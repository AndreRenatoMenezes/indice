package dev.indice.app

import android.app.Application
import androidx.glance.appwidget.updateAll
import dev.indice.app.data.api.ApiClient
import dev.indice.app.data.auth.SessionStore
import dev.indice.app.data.repository.IndiceRepository
import dev.indice.app.widget.HabitWidget
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.launch

class IndiceApp : Application() {
    // Injeção manual por enquanto; trocar por Hilt quando os módulos crescerem.
    val sessionStore: SessionStore by lazy { SessionStore(this) }
    val repository: IndiceRepository by lazy { IndiceRepository(ApiClient.create(sessionStore), sessionStore) }

    override fun onCreate() {
        super.onCreate()
        instance = this
        // Entrar ou sair muda o que o widget mostra.
        CoroutineScope(SupervisorJob() + Dispatchers.Default).launch {
            sessionStore.state.drop(1).collect { runCatching { HabitWidget().updateAll(this@IndiceApp) } }
        }
    }

    companion object {
        lateinit var instance: IndiceApp
            private set
    }
}
