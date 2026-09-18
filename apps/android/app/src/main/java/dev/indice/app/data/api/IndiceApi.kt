package dev.indice.app.data.api

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/** Cliente Retrofit da API do Índice. Autenticação via interceptor (X-Api-Key). */
interface IndiceApi {
    @GET("daily-summary")
    suspend fun dailySummary(@Query("date") date: String? = null): DailySummaryDto

    // Journal
    @POST("entries")
    suspend fun createEntry(@Body body: CreateEntryRequest): EntryDto

    @PATCH("entries/{id}")
    suspend fun updateEntry(@Path("id") id: String, @Body body: UpdateEntryRequest): EntryDto

    // Hábitos — usados também pelo widget
    @GET("habits/today")
    suspend fun habitsToday(@Query("date") date: String? = null): HabitsTodayResponse

    @PUT("habits/{id}/log")
    suspend fun logHabit(@Path("id") id: String, @Body body: LogHabitRequest): HabitLogDto

    @DELETE("habits/{id}/log")
    suspend fun unlogHabit(@Path("id") id: String, @Query("date") date: String? = null)

    // Financeiro
    @GET("finance/summary")
    suspend fun financeSummary(@Query("date") date: String? = null): FinanceSummaryDto

    @POST("transactions")
    suspend fun createTransaction(@Body body: CreateTransactionRequest): TransactionDto

    // Metas e mídia
    @GET("goals")
    suspend fun goals(): GoalsResponse

    @GET("media")
    suspend fun media(@Query("status") status: String? = null): MediaResponse
}

@kotlinx.serialization.Serializable
data class GoalsResponse(val goals: List<GoalProgressDto>)

@kotlinx.serialization.Serializable
data class MediaResponse(val items: List<MediaItemDto>)
