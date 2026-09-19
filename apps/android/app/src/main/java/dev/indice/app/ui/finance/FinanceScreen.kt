package dev.indice.app.ui.finance

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.indice.app.data.api.InvoiceDto
import dev.indice.app.data.api.TransactionDto
import dev.indice.app.ui.common.DropdownField
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Kv
import dev.indice.app.ui.common.Loadable
import dev.indice.app.ui.common.MessageHost
import dev.indice.app.ui.common.Pill
import dev.indice.app.ui.common.ScreenHeader
import dev.indice.app.ui.common.SectionCard
import dev.indice.app.ui.common.Stat
import dev.indice.app.ui.common.Tones

@Composable
fun FinanceScreen(vm: FinanceViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    MessageHost(vm.messages, snack)
    var sheetOpen by remember { mutableStateOf(false) }
    var paying by remember { mutableStateOf<InvoiceDto?>(null) }
    var deleting by remember { mutableStateOf<TransactionDto?>(null) }
    Scaffold(
        snackbarHost = { SnackbarHost(snack) },
        contentWindowInsets = WindowInsets(0),
        floatingActionButton = { FloatingActionButton(onClick = { sheetOpen = true }, containerColor = Tones.green) { Icon(Icons.Default.Add, contentDescription = "Lançamento rápido") } },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Loadable(state, onRetry = vm::refresh) { d, _ ->
                FinanceContent(d, vm, onPay = { paying = it }, onDelete = { deleting = it })
                if (sheetOpen) QuickEntrySheet(d, onDismiss = { sheetOpen = false }) { vm.create(it); sheetOpen = false }
                paying?.let { inv -> PayInvoiceDialog(inv, d.accounts.map { it.id to it.name }, d.accounts.firstOrNull { it.isDefault }?.id ?: d.accounts.firstOrNull()?.id, onDismiss = { paying = null }) { acc -> vm.payInvoice(inv.id, acc); paying = null } }
                deleting?.let { t ->
                    AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Apagar lançamento?") }, text = { Text("${t.description.ifBlank { Fmt.TX_TYPE[t.type] ?: t.type }} · ${Fmt.brl(t.amount)} · ${Fmt.dateBR(t.date)}") },
                        confirmButton = { TextButton(onClick = { vm.delete(t.id); deleting = null }) { Text("Apagar") } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } })
                }
            }
        }
    }
}

@Composable
private fun FinanceContent(d: FinanceData, vm: FinanceViewModel, onPay: (InvoiceDto) -> Unit, onDelete: (TransactionDto) -> Unit) {
    val f = d.summary
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 16.dp, top = 16.dp, end = 16.dp, bottom = 88.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader(Fmt.monthYear(f.month.year, f.month.month), "Financeiro", pill = { Pill(f.trafficLight.label, Tones.of(f.trafficLight.status)) }, onRefresh = vm::refresh) }

        item {
            SectionCard(tint = Tones.of(f.trafficLight.status).copy(alpha = 0.12f)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
                    Stat("Saldo do mês", Fmt.brl(f.balance), if (f.balance < 0) Tones.red else null, big = true)
                    Text("${f.daysRemaining} dias restantes", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Por dia", Fmt.brl(f.dailyBudget), Tones.of(f.trafficLight.status))
                    Stat("Gasto hoje", Fmt.brl(f.spentToday))
                    Stat("Contas abertas", Fmt.brl(f.openBills))
                }
                HorizontalDivider()
                Text(f.trafficLight.message, style = MaterialTheme.typography.bodySmall)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("entradas ${Fmt.brlInt(f.totalIncome)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("saídas ${Fmt.brlInt(f.totalExpense)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("aportes ${Fmt.brlInt(f.totalInvestment)}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        item {
            SectionCard("Contas") {
                if (d.accounts.isEmpty()) Text("Nenhuma conta. Crie pela API ou pelo web.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                d.accounts.forEachIndexed { i, a ->
                    TwoLine(a.name, listOfNotNull(Fmt.ACCOUNT_KIND[a.kind] ?: a.kind.lowercase(), "padrão".takeIf { a.isDefault }, a.institution).joinToString(" · "), Fmt.brl(a.balance))
                    if (i < d.accounts.lastIndex) HorizontalDivider()
                }
                if (d.unassigned != 0.0) { HorizontalDivider(); Kv("Sem conta informada", Fmt.brl(d.unassigned)) }
            }
        }

        item {
            SectionCard("Faturas") {
                if (d.invoices.isEmpty()) Text("Nenhuma fatura.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                d.invoices.take(6).forEachIndexed { i, inv ->
                    Column(Modifier.fillMaxWidth()) {
                        TwoLine("${inv.institution} · ${"%02d".format(inv.refMonth)}/${inv.refYear}", "${Fmt.INVOICE_STATUS[inv.status] ?: inv.status.lowercase()} · fecha ${Fmt.shortDate(inv.closingDate ?: "")} · vence ${Fmt.shortDate(inv.dueDate ?: "")} · ${inv.purchases} compra${if (inv.purchases == 1) "" else "s"}", Fmt.brl(inv.total))
                        if (inv.status != "PAID" && d.accounts.isNotEmpty()) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) { TextButton(onClick = { onPay(inv) }) { Text("Pagar fatura") } }
                    }
                    if (i < d.invoices.take(6).lastIndex) HorizontalDivider()
                }
            }
        }

        item {
            SectionCard("Últimos lançamentos") {
                if (d.transactions.isEmpty()) Text("Sem lançamentos. Toque em + para lançar.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                d.transactions.forEachIndexed { i, t ->
                    TransactionRow(t, onLongPress = { onDelete(t) })
                    if (i < d.transactions.lastIndex) HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun TwoLine(title: String, sub: String, right: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.bodyMedium)
            if (sub.isNotBlank()) Text(sub, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(right, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun TransactionRow(t: TransactionDto, onLongPress: (() -> Unit)? = null) {
    val positive = t.type == "INCOME"
    val sign = when (t.type) { "INCOME" -> "+ "; "TRANSFER" -> "↔ "; else -> "− " }
    val base = Modifier.fillMaxWidth().padding(vertical = 4.dp)
    Row(
        if (onLongPress != null) base.combinedClickable(onClick = {}, onLongClick = onLongPress) else base,
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(Fmt.shortDate(t.date), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Column(Modifier.weight(1f)) {
            Text(t.description.ifBlank { t.categoryName ?: Fmt.TX_TYPE[t.type] ?: t.type }, style = MaterialTheme.typography.bodyMedium)
            Text(listOfNotNull(t.categoryName, Fmt.txSubline(t).takeIf { it.isNotBlank() }).joinToString(" · "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(sign + Fmt.brl(t.amount), style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium, color = if (positive) Tones.green else MaterialTheme.colorScheme.onSurface)
    }
}

@Composable
private fun PayInvoiceDialog(inv: InvoiceDto, accounts: List<Pair<String, String>>, defaultAccount: String?, onDismiss: () -> Unit, onConfirm: (String) -> Unit) {
    var account by remember { mutableStateOf(defaultAccount) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Pagar fatura ${inv.institution} ${"%02d".format(inv.refMonth)}/${inv.refYear}") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) { Text(Fmt.brl(inv.total), style = MaterialTheme.typography.headlineSmall); DropdownField("conta", accounts, account, { account = it }) } },
        confirmButton = { TextButton(enabled = account != null, onClick = { onConfirm(account!!) }) { Text("Pagar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
