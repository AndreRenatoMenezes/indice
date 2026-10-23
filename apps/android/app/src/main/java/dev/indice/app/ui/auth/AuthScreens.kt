package dev.indice.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.collectAsState
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController

private const val ENTRAR = "entrar"
private const val CRIAR = "criar-conta"
private const val CODIGO = "codigo"
private const val ESQUECI = "esqueci-senha"

/** Fluxo de auth, mostrado enquanto não há sessão. O login grava a sessão e IndiceApp troca para as abas. */
@Composable
fun AuthHost(vm: AuthViewModel = viewModel()) {
    val nav = rememberNavController()
    fun go(route: String) { vm.clearMessages(); nav.navigate(route) }
    fun back() { vm.clearMessages(); nav.popBackStack() }
    NavHost(nav, startDestination = ENTRAR) {
        composable(ENTRAR) {
            SignInScreen(vm, onSignUp = { go(CRIAR) }, onForgot = { go(ESQUECI) }, onNeedsCode = { nav.navigate(CODIGO) })
        }
        composable(CRIAR) {
            SignUpScreen(vm, onBack = ::back, onDone = { nav.navigate(CODIGO) })
        }
        composable(CODIGO) {
            CodeScreen(vm, onBack = ::back, onVerified = { nav.popBackStack(ENTRAR, inclusive = false) })
        }
        composable(ESQUECI) {
            ForgotScreen(vm, onBack = ::back)
        }
    }
}

@Composable
private fun AuthScaffold(title: String, vm: AuthViewModel, content: @Composable ColumnScope.(busy: Boolean) -> Unit) {
    val ui by vm.ui.collectAsState()
    Surface(Modifier.fillMaxSize()) {
        Column(
            Modifier.safeDrawingPadding().imePadding().verticalScroll(rememberScrollState()).padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Spacer(Modifier.height(32.dp))
            Text("Índice", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(title, style = MaterialTheme.typography.headlineMedium)
            ui.info?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary) }
            ui.error?.let { Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error) }
            content(ui.busy)
        }
    }
}

@Composable
private fun EmailField(vm: AuthViewModel, enabled: Boolean) {
    val ui by vm.ui.collectAsState()
    OutlinedTextField(
        value = ui.email, onValueChange = vm::setEmail, label = { Text("E-mail") }, singleLine = true, enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun PasswordField(label: String, value: String, onChange: (String) -> Unit, enabled: Boolean) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, singleLine = true, enabled = enabled,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SubmitButton(text: String, busy: Boolean, onClick: () -> Unit) {
    Button(onClick = onClick, enabled = !busy, modifier = Modifier.fillMaxWidth()) {
        if (busy) CircularProgressIndicator(Modifier.height(18.dp), strokeWidth = 2.dp) else Text(text)
    }
}

@Composable
private fun SignInScreen(vm: AuthViewModel, onSignUp: () -> Unit, onForgot: () -> Unit, onNeedsCode: () -> Unit) {
    var password by rememberSaveable { mutableStateOf("") }
    AuthScaffold("Entrar", vm) { busy ->
        EmailField(vm, !busy)
        PasswordField("Senha", password, { password = it }, !busy)
        SubmitButton("Entrar", busy) {
            if (vm.ui.value.email.isBlank() || password.isEmpty()) vm.fail("Informe e-mail e senha") else vm.signIn(password, onNeedsCode)
        }
        TextButton(onClick = onSignUp, enabled = !busy) { Text("Criar conta") }
        TextButton(onClick = onForgot, enabled = !busy) { Text("Esqueci a senha") }
    }
}

@Composable
private fun SignUpScreen(vm: AuthViewModel, onBack: () -> Unit, onDone: () -> Unit) {
    var name by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    AuthScaffold("Criar conta", vm) { busy ->
        OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Nome") }, singleLine = true, enabled = !busy, modifier = Modifier.fillMaxWidth())
        EmailField(vm, !busy)
        PasswordField("Senha (mínimo 8 caracteres)", password, { password = it }, !busy)
        SubmitButton("Criar conta", busy) {
            when {
                name.isBlank() || vm.ui.value.email.isBlank() -> vm.fail("Informe nome e e-mail")
                password.length < 8 -> vm.fail("A senha precisa ter pelo menos 8 caracteres")
                else -> vm.signUp(name, password, onDone)
            }
        }
        TextButton(onClick = onBack, enabled = !busy) { Text("Já tenho conta") }
    }
}

@Composable
private fun CodeScreen(vm: AuthViewModel, onBack: () -> Unit, onVerified: () -> Unit) {
    var otp by rememberSaveable { mutableStateOf("") }
    val ui by vm.ui.collectAsState()
    AuthScaffold("Código", vm) { busy ->
        Text("Digite o código de 6 dígitos enviado para ${ui.email}.", style = MaterialTheme.typography.bodyMedium)
        OutlinedTextField(
            value = otp, onValueChange = { otp = it.filter(Char::isDigit).take(6) }, label = { Text("Código") }, singleLine = true, enabled = !busy,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword), modifier = Modifier.fillMaxWidth(),
        )
        SubmitButton("Verificar", busy) {
            if (otp.length != 6) vm.fail("O código tem 6 dígitos") else vm.verify(otp, onVerified)
        }
        TextButton(onClick = vm::resend, enabled = !busy) { Text("Reenviar código") }
        TextButton(onClick = onBack, enabled = !busy) { Text("Voltar") }
    }
}

@Composable
private fun ForgotScreen(vm: AuthViewModel, onBack: () -> Unit) {
    AuthScaffold("Esqueci a senha", vm) { busy ->
        Text("Enviaremos um link para criar uma nova senha. Ele abre no navegador.", style = MaterialTheme.typography.bodyMedium)
        EmailField(vm, !busy)
        SubmitButton("Enviar link", busy) {
            if (vm.ui.value.email.isBlank()) vm.fail("Informe o e-mail") else vm.forgotPassword()
        }
        TextButton(onClick = onBack, enabled = !busy) { Text("Voltar") }
    }
}

/** Sessão válida, mas o e-mail saiu da lista de permitidos (403 da API). */
@Composable
fun AccessDeniedScreen(onSignOut: () -> Unit) {
    Surface(Modifier.fillMaxSize()) {
        Column(Modifier.safeDrawingPadding().padding(24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Spacer(Modifier.height(32.dp))
            Text("Acesso removido", style = MaterialTheme.typography.headlineMedium)
            Text("Este e-mail não tem mais acesso ao Índice.", style = MaterialTheme.typography.bodyMedium)
            Button(onClick = onSignOut) { Text("Sair") }
        }
    }
}
