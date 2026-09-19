package dev.indice.app.ui.habits

import dev.indice.app.data.api.CreateHabitRequest
import dev.indice.app.data.api.HabitsTodayResponse
import dev.indice.app.ui.common.LoadViewModel
import dev.indice.app.ui.common.UiState

class HabitsViewModel : LoadViewModel<HabitsTodayResponse>() {
    init { refresh() }

    override suspend fun load(): HabitsTodayResponse = repo.habitsToday()

    private fun date(): String? = (state.value as? UiState.Ready)?.data?.date

    fun toggle(habitId: String, done: Boolean) = mutate { repo.toggleHabit(habitId, done, date()) }
    fun logValue(habitId: String, value: Double?, time: String?, note: String?) = mutate { repo.logHabitValue(habitId, value, time, note, date()) }
    fun create(body: CreateHabitRequest) = mutate { repo.createHabit(body) }
}
