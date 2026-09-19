package dev.indice.app.ui.goals

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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.indice.app.data.api.CreateGoalRequest
import dev.indice.app.data.api.GoalDetailDto
import dev.indice.app.ui.common.Bar
import dev.indice.app.ui.common.DropdownField
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Fmt.trim
import dev.indice.app.ui.common.Kv
import dev.indice.app.ui.common.Loadable
import dev.indice.app.ui.common.MessageHost
import dev.indice.app.ui.common.ScreenHeader
import dev.indice.app.ui.common.SectionCard
import dev.indice.app.ui.common.SectionLabel
import dev.indice.app.ui.common.Tones

private fun fmt(kind: String, v: Double, unit: String?): String = when (kind) {
    "FINANCIAL" -> Fmt.brlInt(v)
    "HABIT" -> "${v.trim()}%"
    else -> "${v.trim()}${unit?.let { " $it" } ?: ""}"
}

@Composable
fun GoalsScreen(vm: GoalsViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    MessageHost(vm.messages, snack)
    var contributing by remember { mutableStateOf<GoalDetailDto?>(null) }
    var editingTarget by remember { mutableStateOf<GoalDetailDto?>(null) }
    var creating by remember { mutableStateOf(false) }
    Scaffold(snackbarHost = { SnackbarHost(snack) }, contentWindowInsets = WindowInsets(0)) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Loadable(state, onRetry = vm::refresh) { goals, _ ->
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    val active = goals.count { it.status == "ACTIVE" }
                    item { ScreenHeader("$active ativa${if (active == 1) "" else "s"}", "Metas", onRefresh = vm::refresh) }
                    items(goals, key = { it.id }) { g -> GoalCard(g, onContribute = { contributing = g }, onEditTarget = { editingTarget = g }, onStatus = { vm.setStatus(g.id, it) }) }
                    if (goals.isEmpty()) item { Text("Nenhuma meta ainda.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    item { OutlinedButton(onClick = { creating = true }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Add, null); Text("  Nova meta") } }
                }
            }
        }
    }
    contributing?.let { g -> ContributeDialog(g, onDismiss = { contributing = null }) { amount, note -> vm.contribute(g.id, amount, note); contributing = null } }
    editingTarget?.let { g -> TargetDialog(g, onDismiss = { editingTarget = null }) { vm.setTarget(g.id, it); editingTarget = null } }
    if (creating) NewGoalDialog(onDismiss = { creating = false }) { vm.create(it); creating = false }
}

@Composable
private fun GoalCard(g: GoalDetailDto, onContribute: () -> Unit, onEditTarget: () -> Unit, onStatus: (String) -> Unit) {
    val onPace = g.paceMonthly != null && g.requiredMonthly != null && g.paceMonthly >= g.requiredMonthly
    SectionCard {
        Text(g.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Text(listOfNotNull(Fmt.GOAL_KIND[g.kind], Fmt.GOAL_STATUS[g.status], g.targetDate?.let { "até ${Fmt.dateBR(it)}" }).joinToString(" · "), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        g.description?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Bottom) {
            Text(fmt(g.kind, g.currentValue, g.unit), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
            Text("de ${fmt(g.kind, g.targetValue, g.unit)} · ${"%.2f".format(g.progressPct)}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Bar(g.progressPct, Tones.green, 12.dp)
        Kv("Faltam", g.daysRemaining?.let { "$it dias" } ?: "—")
        Kv("Necessário por mês", g.requiredMonthly?.let { fmt(g.kind, it, g.unit) } ?: "—")
        Kv("Ritmo atual", g.paceMonthly?.let { "${fmt(g.kind, it, g.unit)}/mês" } ?: "—", if (g.paceMonthly != null) (if (onPace) Tones.green else Tones.red) else null)
        Kv("Projeção no ritmo", Fmt.shortMonth(g.projectedDate), if (g.projectedDate != null && onPace) Tones.green else null)

        if (g.milestones.isNotEmpty()) {
            HorizontalDivider()
            SectionLabel("Marcos")
            g.milestones.forEach { m -> Kv(m.title, listOfNotNull(m.targetValue?.let { fmt(g.kind, it, g.unit) }, m.targetDate?.let { "até ${Fmt.shortMonth(it)}" }).joinToString(" · ")) }
        }
        HorizontalDivider()
        SectionLabel("Aportes")
        if (g.contributions.isEmpty()) Text("Nenhum aporte ainda.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        g.contributions.takeLast(5).reversed().forEach { c ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Fmt.shortDate(c.date), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(c.note ?: if (c.transactionId != null) "via lançamento" else "manual", Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                Text((if (c.amount >= 0) "+ " else "") + fmt(g.kind, c.amount, g.unit), style = MaterialTheme.typography.bodySmall, color = Tones.green, fontWeight = FontWeight.Medium)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            OutlinedButton(onClick = onContribute, Modifier.weight(1f)) { Text("Registrar aporte") }
            TextButton(onClick = onEditTarget) { Text("Alvo") }
            when (g.status) {
                "ACTIVE" -> TextButton(onClick = { onStatus("PAUSED") }) { Text("Pausar") }
                "ACHIEVED" -> TextButton(onClick = { onStatus("ACTIVE") }) { Text("Reabrir") }
                else -> TextButton(onClick = { onStatus("ACTIVE") }) { Text("Reativar") }
            }
        }
    }
}

@Composable
private fun ContributeDialog(g: GoalDetailDto, onDismiss: () -> Unit, onConfirm: (Double, String?) -> Unit) {
    var amount by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }
    val parsed = Fmt.parseAmount(amount)
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Aporte · ${g.title}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(amount, { amount = it }, label = { Text(if (g.kind == "FINANCIAL") "valor (R$)" else "quantidade") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(note, { note = it }, label = { Text("nota") }, singleLine = true)
            }
        },
        confirmButton = { TextButton(enabled = parsed != null, onClick = { onConfirm(parsed!!, note.takeIf { it.isNotBlank() }) }) { Text("Registrar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun TargetDialog(g: GoalDetailDto, onDismiss: () -> Unit, onConfirm: (Double) -> Unit) {
    var target by remember { mutableStateOf(g.targetValue.trim()) }
    val parsed = Fmt.parseAmount(target)
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Alvo · ${g.title}") },
        text = { OutlinedTextField(target, { target = it }, label = { Text(if (g.kind == "FINANCIAL") "alvo (R$)" else "alvo") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal)) },
        confirmButton = { TextButton(enabled = parsed != null, onClick = { onConfirm(parsed!!) }) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun NewGoalDialog(onDismiss: () -> Unit, onConfirm: (CreateGoalRequest) -> Unit) {
    var title by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("FINANCIAL") }
    var target by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("") }
    var date by remember { mutableStateOf("") }
    val parsed = Fmt.parseAmount(target)
    val dateOk = date.isBlank() || Regex("^\\d{4}-\\d{2}-\\d{2}$").matches(date)
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Nova meta") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("título") }, singleLine = true)
                DropdownField("tipo", Fmt.GOAL_KIND.toList(), kind, { kind = it ?: "FINANCIAL" })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(target, { target = it }, Modifier.weight(1f), label = { Text("alvo") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    if (kind == "NUMERIC") OutlinedTextField(unit, { unit = it }, Modifier.weight(1f), label = { Text("unidade") }, singleLine = true)
                }
                OutlinedTextField(date, { date = it }, label = { Text("prazo (AAAA-MM-DD)") }, placeholder = { Text("2035-08-05") }, singleLine = true, isError = !dateOk)
            }
        },
        confirmButton = { TextButton(enabled = title.isNotBlank() && parsed != null && dateOk, onClick = { onConfirm(CreateGoalRequest(title = title.trim(), kind = kind, targetValue = parsed!!, unit = unit.takeIf { it.isNotBlank() }, targetDate = date.takeIf { it.isNotBlank() })) }) { Text("Criar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
