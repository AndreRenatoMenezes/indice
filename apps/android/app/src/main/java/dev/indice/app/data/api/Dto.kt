// Espelho dos contratos de packages/shared/src/index.ts. Manter em sincronia.
package dev.indice.app.data.api

import kotlinx.serialization.Serializable

@Serializable
data class EntryDto(
    val id: String,
    val collectionId: String,
    val parentId: String? = null,
    val kind: String,
    val status: String,
    val text: String,
    val description: String? = null,
    val date: String? = null,
    val time: String? = null,
    val alarm: Boolean = false,
    val priority: Int = 0,
    val color: String? = null,
    val tags: List<String> = emptyList(),
    val position: Int = 0,
    val goalId: String? = null,
    val mediaItemId: String? = null,
    val children: List<EntryDto>? = null,
)

@Serializable
data class CreateEntryRequest(
    val text: String,
    val date: String? = null,
    val kind: String = "TASK",
    val time: String? = null,
    val priority: Int? = null,
    val source: String = "ANDROID",
)

@Serializable
data class UpdateEntryRequest(val status: String? = null, val text: String? = null)

@Serializable
data class HabitDto(
    val id: String,
    val name: String,
    val icon: String? = null,
    val color: String? = null,
    val kind: String,
    val unit: String? = null,
    val targetValue: Double? = null,
    val targetTime: String? = null,
    val weekdays: List<Int> = emptyList(),
    val sortOrder: Int = 0,
)

@Serializable
data class HabitLogDto(val habitId: String, val date: String, val value: Double, val done: Boolean, val note: String? = null)

@Serializable
data class HabitTodayDto(val habit: HabitDto, val log: HabitLogDto? = null, val done: Boolean, val streak: Int, val scheduledToday: Boolean)

@Serializable
data class HabitsTodayResponse(val date: String, val habits: List<HabitTodayDto>)

@Serializable
data class LogHabitRequest(val date: String? = null, val value: Double? = null, val time: String? = null, val note: String? = null, val source: String = "ANDROID")

@Serializable
data class TrafficLightDto(val status: String, val label: String, val message: String)

@Serializable
data class BillDueDto(val id: String, val name: String, val amount: Double, val dueDay: Int? = null)

@Serializable
data class InvoiceDueDto(val id: String, val institution: String, val total: Double, val dueDate: String, val status: String)

@Serializable
data class MonthRef(val year: Int, val month: Int)

@Serializable
data class FinanceSummaryDto(
    val month: MonthRef,
    val totalIncome: Double,
    val totalExpense: Double,
    val totalInvestment: Double,
    val openBills: Double,
    val balance: Double,
    val dailyBudget: Double,
    val daysRemaining: Int,
    val spentToday: Double,
    val trafficLight: TrafficLightDto,
    val daysToSalary: Int? = null,
    val billsDueSoon: List<BillDueDto> = emptyList(),
    val invoicesDueSoon: List<InvoiceDueDto> = emptyList(),
)

@Serializable
data class CreateTransactionRequest(
    val type: String,
    val date: String,
    val amount: Double,
    val description: String = "",
    val categoryId: String? = null,
    val paymentMethod: String? = null,
    val accountId: String? = null,
    val creditCardId: String? = null,
    val source: String = "ANDROID",
)

@Serializable
data class TransactionDto(
    val id: String,
    val type: String,
    val date: String,
    val amount: Double,
    val description: String,
    val categoryId: String? = null,
    val categoryName: String? = null,
    val paymentMethod: String? = null,
    val accountId: String? = null,
    val toAccountId: String? = null,
    val creditCardId: String? = null,
    val invoiceId: String? = null,
    val installmentNo: Int? = null,
    val installmentTotal: Int? = null,
)

@Serializable
data class GoalProgressDto(
    val id: String,
    val title: String,
    val kind: String,
    val status: String,
    val targetValue: Double,
    val currentValue: Double,
    val progressPct: Double,
    val startDate: String,
    val targetDate: String? = null,
    val daysRemaining: Int? = null,
    val paceMonthly: Double? = null,
    val requiredMonthly: Double? = null,
    val projectedDate: String? = null,
    val icon: String? = null,
    val color: String? = null,
)

@Serializable
data class MediaItemDto(
    val id: String,
    val kind: String,
    val title: String,
    val creator: String? = null,
    val year: Int? = null,
    val platform: String? = null,
    val status: String,
    val rating: Int? = null,
    val progress: Double? = null,
    val progressTotal: Double? = null,
    val progressUnit: String? = null,
    val tags: List<String> = emptyList(),
    val startedAt: String? = null,
    val finishedAt: String? = null,
)

@Serializable
data class DailyLogDto(
    val date: String,
    val wokeAt: String? = null,
    val mood: Int? = null,
    val energy: Int? = null,
    val sleepHours: Double? = null,
    val highlights: String? = null,
    val reflection: String? = null,
)

@Serializable
data class JournalSection(val collectionId: String? = null, val entries: List<EntryDto>, val carriedOver: List<EntryDto>, val log: DailyLogDto? = null)

@Serializable
data class DailySummaryDto(
    val date: String,
    val weekday: Int,
    val journal: JournalSection,
    val habits: List<HabitTodayDto>,
    val finance: FinanceSummaryDto,
    val goals: List<GoalProgressDto>,
    val media: List<MediaItemDto>,
)
