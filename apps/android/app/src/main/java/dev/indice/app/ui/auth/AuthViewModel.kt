package dev.indice.app.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.indice.app.IndiceApp
import dev.indice.app.data.repository.ApiException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class AuthUi(
    val email: String = "",
    val busy: Boolean = false,
    val error: String? = null,
    val info: String? = null,
)

/**
 * Estado compartilhado pelas telas de auth (Entrar, Criar conta, Código, Esqueci a senha).
 * Senha e código ficam só nos campos da tela. O login bem-sucedido grava a sessão e a
 * navegação troca sozinha para as abas.
 */
class AuthViewModel : ViewModel() {
    private val repo = IndiceApp.instance.repository
    private val _ui = MutableStateFlow(AuthUi())
    val ui: StateFlow<AuthUi> = _ui

    fun setEmail(email: String) = _ui.update { it.copy(email = email) }
    fun clearMessages() = _ui.update { it.copy(error = null, info = null) }

    private fun run(info: String? = null, onOk: () -> Unit = {}, block: suspend () -> Unit) {
        _ui.update { it.copy(busy = true, error = null, info = null) }
        viewModelScope.launch {
            try {
                block()
                _ui.update { it.copy(busy = false, info = info) }
                onOk()
            } catch (e: ApiException) {
                _ui.update { it.copy(busy = false, error = e.message) }
            }
        }
    }

    fun signIn(password: String, onNeedsCode: () -> Unit) {
        val email = _ui.value.email.trim()
        _ui.update { it.copy(busy = true, error = null, info = null) }
        viewModelScope.launch {
            try {
                repo.signIn(email, password)
                _ui.update { it.copy(busy = false) }
            } catch (e: ApiException) {
                if (e.serverError == "email not verified") {
                    // Conta sem verificação: reenvia o código e leva à tela dele.
                    runCatching { repo.resendVerification(email) }
                    _ui.update { it.copy(busy = false, info = "Verifique seu e-mail: enviamos um código.") }
                    onNeedsCode()
                } else {
                    _ui.update { it.copy(busy = false, error = e.message) }
                }
            }
        }
    }

    fun signUp(name: String, password: String, onDone: () -> Unit) =
        run(info = "Enviamos um código de 6 dígitos para o seu e-mail.", onOk = onDone) { repo.signUp(name.trim(), _ui.value.email.trim(), password) }

    fun verify(otp: String, onDone: () -> Unit) =
        run(info = "E-mail verificado. Entre com a sua senha.", onOk = onDone) { repo.verifyEmail(_ui.value.email.trim(), otp) }

    fun resend() = run(info = "Código reenviado.") { repo.resendVerification(_ui.value.email.trim()) }

    fun forgotPassword() =
        run(info = "Se o e-mail estiver cadastrado, enviamos um link. Abra-o no navegador para criar a nova senha.") {
            repo.forgotPassword(_ui.value.email.trim())
        }

    fun fail(message: String) = _ui.update { it.copy(error = message, info = null) }
}
