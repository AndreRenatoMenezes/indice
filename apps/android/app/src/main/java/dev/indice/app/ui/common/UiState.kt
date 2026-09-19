package dev.indice.app.ui.common

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.indice.app.IndiceApp
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Ready<T>(val data: T, val busy: Boolean = false) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

/**
 * Base das telas: carrega `load()` no init, expõe `state` e `messages` (erros de
 * ação para o Snackbar). `mutate` roda uma ação e recarrega; a falha vira mensagem
 * sem derrubar a tela.
 */
abstract class LoadViewModel<T> : ViewModel() {
    protected val repo = IndiceApp.instance.repository
    private val _state = MutableStateFlow<UiState<T>>(UiState.Loading)
    val state: StateFlow<UiState<T>> = _state
    private val _messages = MutableSharedFlow<String>(extraBufferCapacity = 4)
    val messages: SharedFlow<String> = _messages

    protected abstract suspend fun load(): T

    fun refresh() = viewModelScope.launch {
        runCatching { load() }
            .onSuccess { _state.value = UiState.Ready(it) }
            .onFailure { _state.value = UiState.Error(it.message ?: "Falha ao carregar") }
    }

    protected fun mutate(block: suspend () -> Unit) = viewModelScope.launch {
        _state.update { if (it is UiState.Ready) it.copy(busy = true) else it }
        runCatching { block() }.onFailure { _messages.tryEmit(it.message ?: "Erro") }
        refresh()
    }
}
