package dev.indice.app.data.repository

import dev.indice.app.data.api.AccountDto
import dev.indice.app.data.api.EmailInput
import dev.indice.app.data.api.RefreshInput
import dev.indice.app.data.api.SignInInput
import dev.indice.app.data.api.SignUpInput
import dev.indice.app.data.api.VerifyEmailInput
import dev.indice.app.data.auth.SessionStore
import dev.indice.app.data.api.CategoryDto
import dev.indice.app.data.api.ContributeGoalRequest
import dev.indice.app.data.api.CreateEntryRequest
import dev.indice.app.data.api.CreateGoalRequest
import dev.indice.app.data.api.CreateHabitRequest
import dev.indice.app.data.api.CreateMediaRequest
import dev.indice.app.data.api.CreateTransactionRequest
import dev.indice.app.data.api.DailySummaryDto
import dev.indice.app.data.api.ErrorResponse
import dev.indice.app.data.api.FinanceSummaryDto
import dev.indice.app.data.api.GoalDetailDto
import dev.indice.app.data.api.GoalProgressDto
import dev.indice.app.data.api.HabitTodayDto
import dev.indice.app.data.api.HabitsTodayResponse
import dev.indice.app.data.api.IndiceApi
import dev.indice.app.data.api.InstitutionDto
import dev.indice.app.data.api.InvoiceDto
import dev.indice.app.data.api.LogHabitRequest
import dev.indice.app.data.api.MediaItemDto
import dev.indice.app.data.api.MigrateEntryRequest
import dev.indice.app.data.api.PayInvoiceRequest
import dev.indice.app.data.api.TransactionDto
import dev.indice.app.data.api.UpdateEntryRequest
import dev.indice.app.data.api.UpdateGoalRequest
import dev.indice.app.data.api.UpdateMediaRequest
import dev.indice.app.data.api.UpsertDailyLogRequest
import kotlinx.serialization.json.Json
import retrofit2.HttpException
import java.io.IOException

/** Erro da API já legível para a tela ("TRANSFER exige accountId…", "sem conexão"). */
class ApiException(message: String, val status: Int? = null, val serverError: String? = null) : Exception(message)

/**
 * Fachada única sobre a API. Quando entrar o modo offline, é aqui que o Room
 * e a fila de sync (merge de 3 vias herdado do WeekToDo Journal) se encaixam,
 * sem mudar as telas.
 */
class IndiceRepository(private val api: IndiceApi, private val session: SessionStore) {
    private val json = Json { ignoreUnknownKeys = true }

    /** Converte HttpException/IOException em ApiException com a mensagem do servidor. */
    private suspend fun <T> request(block: suspend IndiceApi.() -> T): T = try {
        api.block()
    } catch (e: HttpException) {
        val body = e.response()?.errorBody()?.string()
        val server = body?.let { runCatching { json.decodeFromString<ErrorResponse>(it).error }.getOrNull() }
        throw ApiException(server ?: "HTTP ${e.code()}", e.code(), server)
    } catch (e: IOException) {
        throw ApiException("Sem conexão com a API (${e.message ?: e::class.simpleName})")
    }

    /** Chamada de dados: 403 com sessão ativa é acesso removido, e a navegação mostra a tela própria. */
    suspend fun <T> call(block: suspend IndiceApi.() -> T): T = try {
        request(block)
    } catch (e: ApiException) {
        if (e.status == 403) session.markDenied()
        throw e
    }

    // ── Sessão
    /** Chamada de auth: a mensagem do servidor (em inglês) vira texto de tela. */
    private suspend fun <T> authCall(block: suspend IndiceApi.() -> T): T = try {
        request(block)
    } catch (e: ApiException) {
        val text = when {
            e.status == null -> e.message
            e.serverError == "invalid credentials" -> "E-mail ou senha incorretos"
            e.serverError == "not allowed" -> "E-mail não autorizado"
            e.serverError == "email not verified" -> "E-mail ainda não verificado"
            e.serverError == "email already registered" -> "E-mail já cadastrado"
            e.serverError == "invalid code" -> "Código inválido"
            e.status == 429 -> "Muitas tentativas, aguarde um minuto"
            e.status == 502 || e.serverError == "auth unavailable" || e.serverError == "auth not configured" ->
                "Serviço de login indisponível, tente de novo"
            e.status == 400 -> "Dados inválidos"
            else -> e.message
        }
        throw ApiException(text ?: "Erro", e.status, e.serverError)
    }

    suspend fun signIn(email: String, password: String) = session.save(authCall { signIn(SignInInput(email, password)) })
    suspend fun signUp(name: String, email: String, password: String) = authCall { signUp(SignUpInput(name, email, password)) }
    suspend fun verifyEmail(email: String, otp: String) = authCall { verifyEmail(VerifyEmailInput(email, otp)) }
    suspend fun resendVerification(email: String) = authCall { resendVerification(EmailInput(email)) }
    suspend fun forgotPassword(email: String) = authCall { forgotPassword(EmailInput(email)) }

    /** Encerra a sessão no servidor (melhor esforço) e sempre limpa a local. */
    suspend fun signOut() {
        val refresh = session.current()?.refreshToken
        if (refresh != null) runCatching { api.signOut(RefreshInput(refresh)) }
        session.clear()
    }

    // ── Hoje / journal
    suspend fun dailySummary(date: String? = null): DailySummaryDto = call { dailySummary(date) }
    suspend fun addEntry(text: String, date: String? = null, kind: String = "TASK", time: String? = null) =
        call { createEntry(CreateEntryRequest(text = text, date = date, kind = kind, time = time)) }
    suspend fun setEntryDone(id: String, done: Boolean) = call { updateEntry(id, UpdateEntryRequest(status = if (done) "DONE" else "OPEN")) }
    suspend fun migrateEntry(id: String, toDate: String) = call { migrateEntry(id, MigrateEntryRequest(toDate)) }
    suspend fun deleteEntry(id: String) = call { deleteEntry(id) }
    suspend fun upsertDailyLog(date: String, body: UpsertDailyLogRequest) = call { upsertDailyLog(date, body) }

    // ── Hábitos
    suspend fun habitsToday(date: String? = null): HabitsTodayResponse = call { habitsToday(date) }
    suspend fun habitsTodayList(date: String? = null): List<HabitTodayDto> = habitsToday(date).habits
    suspend fun toggleHabit(habitId: String, done: Boolean, date: String? = null) {
        if (done) call { logHabit(habitId, LogHabitRequest(date = date)) } else call { unlogHabit(habitId, date) }
    }
    suspend fun logHabitValue(habitId: String, value: Double? = null, time: String? = null, note: String? = null, date: String? = null) =
        call { logHabit(habitId, LogHabitRequest(date = date, value = value, time = time, note = note)) }
    suspend fun createHabit(body: CreateHabitRequest) = call { createHabit(body) }

    // ── Financeiro
    suspend fun financeSummary(date: String? = null): FinanceSummaryDto = call { financeSummary(date) }
    suspend fun transactions(limit: Int = 50): List<TransactionDto> = call { transactions(limit) }.transactions
    suspend fun accounts(): List<AccountDto> = call { accounts() }.accounts
    suspend fun categories(): List<CategoryDto> = call { categories() }.categories
    suspend fun institutions(): List<InstitutionDto> = call { institutions() }.institutions
    suspend fun invoices(): List<InvoiceDto> = call { invoices() }.invoices
    suspend fun createTransaction(body: CreateTransactionRequest): TransactionDto = call { createTransaction(body) }
    suspend fun deleteTransaction(id: String) = call { deleteTransaction(id) }
    suspend fun payInvoice(id: String, accountId: String, amount: Double? = null) = call { payInvoice(id, PayInvoiceRequest(accountId = accountId, amount = amount)) }
    suspend fun quickExpense(amount: Double, description: String, date: String) =
        createTransaction(CreateTransactionRequest(type = "EXPENSE", date = date, amount = amount, description = description))

    // ── Metas
    suspend fun goals(): List<GoalProgressDto> = call { goals() }.goals
    suspend fun goal(id: String): GoalDetailDto = call { goal(id) }
    suspend fun createGoal(body: CreateGoalRequest) = call { createGoal(body) }
    suspend fun updateGoal(id: String, body: UpdateGoalRequest) = call { updateGoal(id, body) }
    suspend fun contribute(goalId: String, amount: Double, note: String? = null, date: String? = null) =
        call { contribute(goalId, ContributeGoalRequest(amount = amount, note = note, date = date)) }

    // ── Mídia
    suspend fun media(kind: String? = null): List<MediaItemDto> = call { media(kind = kind) }.items
    suspend fun createMedia(body: CreateMediaRequest) = call { createMedia(body) }
    suspend fun updateMedia(id: String, body: UpdateMediaRequest) = call { updateMedia(id, body) }
}
