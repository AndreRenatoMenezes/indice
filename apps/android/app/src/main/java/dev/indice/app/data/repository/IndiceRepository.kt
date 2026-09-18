package dev.indice.app.data.repository

import dev.indice.app.data.api.CreateEntryRequest
import dev.indice.app.data.api.CreateTransactionRequest
import dev.indice.app.data.api.DailySummaryDto
import dev.indice.app.data.api.HabitTodayDto
import dev.indice.app.data.api.IndiceApi
import dev.indice.app.data.api.LogHabitRequest
import dev.indice.app.data.api.UpdateEntryRequest

/**
 * Fachada única sobre a API. Quando entrar o modo offline, é aqui que o Room
 * e a fila de sync (merge de 3 vias herdado do WeekToDo Journal) se encaixam,
 * sem mudar as telas.
 */
class IndiceRepository(private val api: IndiceApi) {
    suspend fun dailySummary(date: String? = null): DailySummaryDto = api.dailySummary(date)

    suspend fun addEntry(text: String, date: String? = null) = api.createEntry(CreateEntryRequest(text = text, date = date))
    suspend fun setEntryDone(id: String, done: Boolean) = api.updateEntry(id, UpdateEntryRequest(status = if (done) "DONE" else "OPEN"))

    suspend fun habitsToday(date: String? = null): List<HabitTodayDto> = api.habitsToday(date).habits
    suspend fun toggleHabit(habitId: String, done: Boolean, date: String? = null) {
        if (done) api.logHabit(habitId, LogHabitRequest(date = date)) else api.unlogHabit(habitId, date)
    }

    suspend fun quickExpense(amount: Double, description: String, date: String) =
        api.createTransaction(CreateTransactionRequest(type = "EXPENSE", date = date, amount = amount, description = description))
}
