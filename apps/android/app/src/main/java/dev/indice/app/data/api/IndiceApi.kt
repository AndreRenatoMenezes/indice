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

    @POST("entries/{id}/migrate")
    suspend fun migrateEntry(@Path("id") id: String, @Body body: MigrateEntryRequest): EntryDto

    @DELETE("entries/{id}")
    suspend fun deleteEntry(@Path("id") id: String)

    @PUT("daily-log/{date}")
    suspend fun upsertDailyLog(@Path("date") date: String, @Body body: UpsertDailyLogRequest): DailyLogDto

    // Hábitos — usados também pelo widget
    @GET("habits")
    suspend fun habits(): HabitsResponse

    @GET("habits/today")
    suspend fun habitsToday(@Query("date") date: String? = null): HabitsTodayResponse

    @POST("habits")
    suspend fun createHabit(@Body body: CreateHabitRequest): HabitDto

    @PUT("habits/{id}/log")
    suspend fun logHabit(@Path("id") id: String, @Body body: LogHabitRequest): HabitLogDto

    @DELETE("habits/{id}/log")
    suspend fun unlogHabit(@Path("id") id: String, @Query("date") date: String? = null)

    // Financeiro
    @GET("finance/summary")
    suspend fun financeSummary(@Query("date") date: String? = null): FinanceSummaryDto

    @GET("transactions")
    suspend fun transactions(@Query("limit") limit: Int = 50, @Query("from") from: String? = null, @Query("to") to: String? = null): TransactionsResponse

    @POST("transactions")
    suspend fun createTransaction(@Body body: CreateTransactionRequest): TransactionDto

    @DELETE("transactions/{id}")
    suspend fun deleteTransaction(@Path("id") id: String)

    @GET("accounts")
    suspend fun accounts(): AccountsResponse

    @GET("categories")
    suspend fun categories(): CategoriesResponse

    @GET("institutions")
    suspend fun institutions(): InstitutionsResponse

    @GET("invoices")
    suspend fun invoices(): InvoicesResponse

    @POST("invoices/{id}/pay")
    suspend fun payInvoice(@Path("id") id: String, @Body body: PayInvoiceRequest): TransactionDto

    // Metas
    @GET("goals")
    suspend fun goals(): GoalsResponse

    @GET("goals/{id}")
    suspend fun goal(@Path("id") id: String): GoalDetailDto

    @POST("goals")
    suspend fun createGoal(@Body body: CreateGoalRequest): IdResponse

    @PATCH("goals/{id}")
    suspend fun updateGoal(@Path("id") id: String, @Body body: UpdateGoalRequest): GoalProgressDto

    @POST("goals/{id}/contributions")
    suspend fun contribute(@Path("id") id: String, @Body body: ContributeGoalRequest): IdResponse

    // Mídia
    @GET("media")
    suspend fun media(@Query("status") status: String? = null, @Query("kind") kind: String? = null): MediaResponse

    @POST("media")
    suspend fun createMedia(@Body body: CreateMediaRequest): MediaItemDto

    @PATCH("media/{id}")
    suspend fun updateMedia(@Path("id") id: String, @Body body: UpdateMediaRequest): MediaItemDto

    @POST("media/{id}/sessions")
    suspend fun addMediaSession(@Path("id") id: String, @Body body: MediaSessionRequest): IdResponse
}
