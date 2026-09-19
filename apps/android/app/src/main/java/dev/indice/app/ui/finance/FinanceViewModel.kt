package dev.indice.app.ui.finance

import dev.indice.app.data.api.AccountDto
import dev.indice.app.data.api.CategoryDto
import dev.indice.app.data.api.CreateTransactionRequest
import dev.indice.app.data.api.FinanceSummaryDto
import dev.indice.app.data.api.InstitutionDto
import dev.indice.app.data.api.InvoiceDto
import dev.indice.app.data.api.TransactionDto
import dev.indice.app.ui.common.LoadViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope

data class FinanceData(
    val summary: FinanceSummaryDto,
    val accounts: List<AccountDto>,
    val unassigned: Double,
    val categories: List<CategoryDto>,
    val institutions: List<InstitutionDto>,
    val invoices: List<InvoiceDto>,
    val transactions: List<TransactionDto>,
) {
    val cards get() = institutions.flatMap { i -> i.cards.map { c -> c.id to "${c.nickname} ····${c.last4} · ${i.name}" } }
}

class FinanceViewModel : LoadViewModel<FinanceData>() {
    init { refresh() }

    override suspend fun load(): FinanceData = coroutineScope {
        val summary = async { repo.financeSummary() }
        val accounts = async { repo.call { accounts() } }
        val categories = async { repo.categories() }
        val institutions = async { repo.institutions() }
        val invoices = async { repo.invoices() }
        val transactions = async { repo.transactions(60) }
        val acc = accounts.await()
        FinanceData(summary.await(), acc.accounts, acc.unassigned, categories.await(), institutions.await(), invoices.await(), transactions.await())
    }

    fun create(body: CreateTransactionRequest) = mutate { repo.createTransaction(body) }
    fun delete(id: String) = mutate { repo.deleteTransaction(id) }
    fun payInvoice(id: String, accountId: String) = mutate { repo.payInvoice(id, accountId) }
}
