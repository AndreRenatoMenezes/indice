package dev.indice.app.ui.common

import dev.indice.app.data.api.HabitDto
import dev.indice.app.data.api.TransactionDto
import java.text.NumberFormat
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Formatação e rótulos em pt-BR compartilhados pelas telas e pelo widget. */
object Fmt {
    private val ptBR = Locale("pt", "BR")
    private val brlFmt: NumberFormat = NumberFormat.getCurrencyInstance(ptBR)
    private val headerFmt = DateTimeFormatter.ofPattern("EEEE · d MMM yyyy", ptBR)
    private val monthFmt = DateTimeFormatter.ofPattern("MMMM", ptBR)
    private val monthYearFmt = DateTimeFormatter.ofPattern("MMMM yyyy", ptBR)
    private val shortMonthFmt = DateTimeFormatter.ofPattern("MMM yyyy", ptBR)

    fun brl(v: Double): String = brlFmt.format(v)
    fun brlInt(v: Double): String = brlFmt.format(Math.round(v).toDouble()).removeSuffix(",00")

    fun dateBR(iso: String?): String = iso?.takeIf { it.length >= 10 }?.substring(0, 10)?.split("-")?.reversed()?.joinToString("/") ?: "—"
    fun shortDate(iso: String): String = iso.substring(5, 10).split("-").reversed().joinToString("/")
    fun header(iso: String): String = runCatching { LocalDate.parse(iso).format(headerFmt) }.getOrDefault(iso)
    fun monthName(year: Int, month: Int): String = LocalDate.of(year, month, 1).format(monthFmt)
    fun monthYear(year: Int, month: Int): String = LocalDate.of(year, month, 1).format(monthYearFmt)
    fun shortMonth(iso: String?): String = iso?.let { runCatching { LocalDate.parse(it).format(shortMonthFmt) }.getOrNull() } ?: "—"
    fun today(): String = LocalDate.now().toString()

    fun hhmm(minutes: Double): String {
        val m = minutes.toInt()
        return "%02d:%02d".format(m / 60, m % 60)
    }

    fun weekRange(week: List<String>): String {
        if (week.size < 7) return ""
        val a = LocalDate.parse(week.first()); val b = LocalDate.parse(week.last())
        val dayMonth = DateTimeFormatter.ofPattern("d MMM", ptBR)
        return if (a.month == b.month) "semana ${a.dayOfMonth} – ${b.format(dayMonth)}" else "semana ${a.format(dayMonth)} – ${b.format(dayMonth)}"
    }

    val TX_TYPE = mapOf("EXPENSE" to "Saída", "INCOME" to "Entrada", "INVESTMENT" to "Aporte", "TRANSFER" to "Transferência")
    val PAYMENT = mapOf("DEBIT" to "débito", "PIX" to "pix", "CREDIT" to "crédito", "CASH" to "dinheiro", "BOLETO" to "boleto", "OTHER" to "outro")
    val ACCOUNT_KIND = mapOf("CHECKING" to "corrente", "SAVINGS" to "poupança", "PAYMENT" to "pagamento", "CASH" to "dinheiro", "INVESTMENT" to "investimento")
    val MEDIA_KIND = mapOf("BOOK" to "Livro", "GAME" to "Jogo", "MOVIE" to "Filme", "SERIES" to "Série", "COURSE" to "Curso", "ARTICLE" to "Artigo", "PODCAST" to "Podcast")
    val MEDIA_STATUS = mapOf("IN_PROGRESS" to "Em andamento", "WISHLIST" to "Quero", "PAUSED" to "Pausados", "DONE" to "Concluídos", "DROPPED" to "Abandonados")
    val GOAL_KIND = mapOf("FINANCIAL" to "financeira", "NUMERIC" to "numérica", "HABIT" to "de hábito", "MILESTONE" to "por marcos")
    val GOAL_STATUS = mapOf("ACTIVE" to "ativa", "PAUSED" to "pausada", "ACHIEVED" to "alcançada", "ABANDONED" to "abandonada")
    val HABIT_KIND = mapOf("BOOLEAN" to "feito / não feito", "COUNTER" to "contagem", "DURATION" to "duração", "TIME" to "horário")
    val INVOICE_STATUS = mapOf("OPEN" to "aberta", "CLOSED" to "fechada", "PAID" to "paga")

    /** "pix · Conta corrente" | "crédito · Roxinho ····1234 · fatura 11/26". */
    fun txSubline(t: TransactionDto): String {
        val parts = mutableListOf<String>()
        when (t.type) {
            "INCOME" -> parts += "entrada"
            "INVESTMENT" -> parts += "aporte"
            "TRANSFER" -> parts += "transferência"
            else -> t.paymentMethod?.let { parts += (PAYMENT[it] ?: it.lowercase()) }
        }
        t.creditCardLabel?.let { parts += it } ?: t.accountName?.let { parts += it }
        t.toAccountName?.let { parts += "→ $it" }
        t.invoiceRef?.let { parts += "fatura " + it.replace(Regex("/20(\\d\\d)$"), "/$1") }
        t.installmentNo?.let { parts += "$it/${t.installmentTotal}" }
        return parts.joinToString(" · ")
    }

    /** "seg – sex · 60 min" | "todo dia · até 05:30". */
    fun habitSubline(h: HabitDto): String {
        val names = listOf("", "seg", "ter", "qua", "qui", "sex", "sáb", "dom")
        val days = when {
            h.weekdays.size == 7 -> "todo dia"
            h.weekdays.size == 5 && 6 !in h.weekdays && 7 !in h.weekdays -> "seg – sex"
            else -> h.weekdays.joinToString(" ") { names[it] }
        }
        val target = when {
            h.kind == "TIME" && h.targetTime != null -> "até ${h.targetTime}"
            h.targetValue != null -> "${h.targetValue.trim()} ${h.unit ?: ""}".trim()
            else -> ""
        }
        return listOf(days, target).filter { it.isNotEmpty() }.joinToString(" · ")
    }

    /** Valor do log de hoje: "05:20 hoje" | "30 min hoje". */
    fun habitLogLabel(kind: String, value: Double, unit: String?): String = when (kind) {
        "TIME" -> "${hhmm(value)} hoje"
        "BOOLEAN" -> "feito hoje"
        else -> "${value.trim()} ${unit ?: ""} hoje".replace("  ", " ")
    }

    /** Número sem ".0" quando inteiro. */
    fun Double.trim(): String = if (this % 1.0 == 0.0) this.toLong().toString() else this.toString().replace('.', ',')

    /** "45,00" · "1.234,56" · "45.5" → Double positivo, ou null. */
    fun parseAmount(s: String): Double? {
        val t = s.trim()
        val n = if (',' in t) t.replace(".", "").replace(',', '.') else t
        return n.toDoubleOrNull()?.takeIf { it > 0 }
    }
}
