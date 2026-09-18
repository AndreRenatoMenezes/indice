package dev.indice.app.ui.today

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.indice.app.IndiceApp
import dev.indice.app.data.api.DailySummaryDto
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface TodayState {
    data object Loading : TodayState
    data class Ready(val summary: DailySummaryDto, val busy: Boolean = false) : TodayState
    data class Error(val message: String) : TodayState
}

class TodayViewModel : ViewModel() {
    private val repo = IndiceApp.instance.repository
    private val _state = MutableStateFlow<TodayState>(TodayState.Loading)
    val state: StateFlow<TodayState> = _state

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        runCatching { repo.dailySummary() }
            .onSuccess { _state.value = TodayState.Ready(it) }
            .onFailure { _state.value = TodayState.Error(it.message ?: "Falha ao carregar") }
    }

    fun toggleEntry(id: String, done: Boolean) = mutate { repo.setEntryDone(id, done) }
    fun toggleHabit(id: String, done: Boolean) = mutate { repo.toggleHabit(id, done) }
    fun addEntry(text: String) = mutate { repo.addEntry(text) }

    private fun mutate(block: suspend () -> Unit) = viewModelScope.launch {
        _state.update { if (it is TodayState.Ready) it.copy(busy = true) else it }
        runCatching { block() }
        refresh()
    }
}
