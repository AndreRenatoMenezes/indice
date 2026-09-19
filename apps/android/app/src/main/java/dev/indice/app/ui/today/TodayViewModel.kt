package dev.indice.app.ui.today

import dev.indice.app.data.api.DailySummaryDto
import dev.indice.app.data.api.UpsertDailyLogRequest
import dev.indice.app.ui.common.LoadViewModel

class TodayViewModel : LoadViewModel<DailySummaryDto>() {
    init { refresh() }

    override suspend fun load(): DailySummaryDto = repo.dailySummary()

    private fun date(): String? = (state.value as? dev.indice.app.ui.common.UiState.Ready)?.data?.date

    fun toggleEntry(id: String, done: Boolean) = mutate { repo.setEntryDone(id, done) }
    fun addEntry(text: String, kind: String = "TASK", time: String? = null) = mutate { repo.addEntry(text, date(), kind, time) }
    fun migrateEntry(id: String) = mutate { date()?.let { repo.migrateEntry(id, it) } }
    fun deleteEntry(id: String) = mutate { repo.deleteEntry(id) }
    fun toggleHabit(id: String, done: Boolean) = mutate { repo.toggleHabit(id, done, date()) }
    fun saveDailyLog(body: UpsertDailyLogRequest) = mutate { date()?.let { repo.upsertDailyLog(it, body) } }
}
