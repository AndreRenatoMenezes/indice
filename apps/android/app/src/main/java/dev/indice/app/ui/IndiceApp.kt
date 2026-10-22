package dev.indice.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.lifecycle.ViewModelStore
import androidx.lifecycle.ViewModelStoreOwner
import androidx.lifecycle.viewmodel.compose.LocalViewModelStoreOwner
import dev.indice.app.data.auth.SessionState
import dev.indice.app.ui.auth.AccessDeniedScreen
import dev.indice.app.ui.auth.AuthHost
import kotlinx.coroutines.launch
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import dev.indice.app.IndiceApp
import dev.indice.app.ui.finance.FinanceScreen
import dev.indice.app.ui.goals.GoalsScreen
import dev.indice.app.ui.habits.HabitsScreen
import dev.indice.app.ui.media.MediaScreen
import dev.indice.app.ui.today.TodayScreen

/** As cinco abas do Índice, na ordem do design: Hoje · Hábitos · Financeiro · Metas · Mídia. */
enum class Tab(val route: String, val label: String, val icon: ImageVector) {
    HOJE("hoje", "Hoje", Icons.Default.Home),
    HABITOS("habitos", "Hábitos", Icons.Default.CheckCircle),
    FINANCEIRO("financeiro", "Financeiro", Icons.Default.ShoppingCart),
    METAS("metas", "Metas", Icons.Default.Star),
    MIDIA("midia", "Mídia", Icons.AutoMirrored.Filled.List),
}

/** Escolhe o fluxo pelo estado da sessão: carregando, entrada, acesso removido ou as abas. */
@Composable
fun IndiceApp() {
    val app = IndiceApp.instance
    val state by app.sessionStore.state.collectAsState(initial = SessionState.Loading)
    val denied by app.sessionStore.denied.collectAsState()
    val scope = rememberCoroutineScope()
    when {
        state is SessionState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        state is SessionState.SignedOut -> AuthHost()
        denied -> AccessDeniedScreen(onSignOut = { scope.launch { app.repository.signOut() } })
        else -> {
            // ViewModels das abas vivem só nesta sessão: sair limpa tudo, e a próxima pessoa não vê dado da anterior.
            val owner = remember { object : ViewModelStoreOwner { override val viewModelStore = ViewModelStore() } }
            DisposableEffect(owner) { onDispose { owner.viewModelStore.clear() } }
            CompositionLocalProvider(LocalViewModelStoreOwner provides owner) { MainTabs() }
        }
    }
}

@Composable
private fun MainTabs() {
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val current = backStack?.destination?.route
    Scaffold(
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { tab ->
                    NavigationBarItem(
                        selected = current == tab.route,
                        onClick = {
                            nav.navigate(tab.route) {
                                popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        },
                        icon = { Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) },
                    )
                }
            }
        },
    ) { padding ->
        NavHost(nav, startDestination = Tab.HOJE.route, modifier = Modifier.padding(padding)) {
            composable(Tab.HOJE.route) { TodayScreen() }
            composable(Tab.HABITOS.route) { HabitsScreen() }
            composable(Tab.FINANCEIRO.route) { FinanceScreen() }
            composable(Tab.METAS.route) { GoalsScreen() }
            composable(Tab.MIDIA.route) { MediaScreen() }
        }
    }
}
