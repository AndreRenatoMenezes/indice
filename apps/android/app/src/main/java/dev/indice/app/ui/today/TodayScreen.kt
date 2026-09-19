package dev.indice.app.ui.today

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.indice.app.data.api.DailySummaryDto
import dev.indice.app.data.api.EntryDto
import dev.indice.app.data.api.HabitTodayDto
import dev.indice.app.ui.common.Bar
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Kv
import dev.indice.app.ui.common.Loadable
import dev.indice.app.ui.common.MessageHost
import dev.indice.app.ui.common.Pill
import dev.indice.app.ui.common.ScreenHeader
import dev.indice.app.ui.common.SectionCard
import dev.indice.app.ui.common.SectionLabel
import dev.indice.app.ui.common.Stat
import dev.indice.app.ui.common.Tones

@Composable
fun TodayScreen(vm: TodayViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    MessageHost(vm.messages, snack)
    Scaffold(snackbarHost = { SnackbarHost(snack) }, contentWindowInsets = WindowInsets(0)) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Loadable(state, onRetry = vm::refresh) { s, _ -> TodayContent(s, vm) }
        }
    }
}

@Composable
private fun TodayContent(s: DailySummaryDto, vm: TodayViewModel) {
    val f = s.finance
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { ScreenHeader(Fmt.header(s.date), "Hoje", pill = { Pill(f.trafficLight.label, Tones.of(f.trafficLight.status)) }, onRefresh = vm::refresh) }

        item {
            SectionCard("Bullets") {
                if (s.journal.entries.isEmpty()) Text("Nada registrado ainda.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                s.journal.entries.forEachIndexed { i, e ->
                    BulletRow(e, onToggle = { vm.toggleEntry(e.id, it) }, onDelete = { vm.deleteEntry(e.id) })
                    if (i < s.journal.entries.lastIndex) HorizontalDivider()
                }
                NewBulletRow(onAdd = { text, kind -> vm.addEntry(text, kind) })
                if (s.journal.carriedOver.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    SectionLabel("De dias anteriores")
                    s.journal.carriedOver.forEach { e ->
                        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(Fmt.shortDate(e.date ?: s.date), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text(e.text, Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
                            TextButton(onClick = { vm.migrateEntry(e.id) }) { Text("migrar →") }
                        }
                    }
                }
            }
        }

        item {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                val scheduled = s.habits.filter { it.scheduledToday }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    SectionLabel("Hábitos")
                    Text("${scheduled.count { it.done }} de ${scheduled.size} hoje", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(s.habits, key = { it.habit.id }) { h -> HabitChip(h) { vm.toggleHabit(h.habit.id, !h.done) } }
                }
            }
        }

        item {
            SectionCard("Financeiro · ${Fmt.monthName(f.month.year, f.month.month)}", aside = { Text("${f.daysRemaining} dias restantes", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Stat("Saldo do mês", Fmt.brlInt(f.balance), if (f.balance < 0) Tones.red else null)
                    Stat("Por dia", Fmt.brlInt(f.dailyBudget), Tones.of(f.trafficLight.status))
                    Stat("Gasto hoje", Fmt.brlInt(f.spentToday))
                }
                Text(f.trafficLight.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (f.invoicesDueSoon.isNotEmpty() || f.billsDueSoon.isNotEmpty()) {
                    HorizontalDivider()
                    f.invoicesDueSoon.forEach { Kv("Fatura ${it.institution} · vence ${Fmt.shortDate(it.dueDate)}", Fmt.brl(it.total)) }
                    f.billsDueSoon.forEach { Kv(it.name + (it.dueDay?.let { d -> " · dia $d" } ?: ""), Fmt.brl(it.amount)) }
                }
            }
        }

        if (s.goals.isNotEmpty() || s.media.isNotEmpty()) {
            item {
                SectionCard {
                    s.goals.forEach { g ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(g.title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                            Text("${"%.2f".format(g.progressPct)}%", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Bar(g.progressPct, Tones.green)
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(g.targetDate?.let { "até ${Fmt.dateBR(it)}" + (g.daysRemaining?.let { d -> " · $d dias" } ?: "") } ?: "sem prazo", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            g.requiredMonthly?.let { Text("${Fmt.brlInt(it)}/mês", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
                        }
                    }
                    if (s.goals.isNotEmpty() && s.media.isNotEmpty()) HorizontalDivider()
                    s.media.forEach { m ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(buildString { append(if (m.kind == "BOOK") "Lendo " else if (m.kind == "GAME") "Jogando " else "Em andamento: "); append(m.title) }, Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
                            if (m.progress != null && m.progressTotal != null) Text("${m.progress.toInt()}/${m.progressTotal.toInt()} ${m.progressUnit ?: ""}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }

        item { DailyLogCard(s, vm) }
    }
}

@Composable
private fun BulletRow(e: EntryDto, onToggle: (Boolean) -> Unit, onDelete: () -> Unit) {
    val done = e.status == "DONE"
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        if (e.kind == "TASK") Checkbox(checked = done, onCheckedChange = onToggle)
        else Text(if (e.kind == "EVENT") "○" else "–", Modifier.width(48.dp), style = MaterialTheme.typography.titleMedium, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Column(Modifier.weight(1f).clickable { if (e.kind == "TASK") onToggle(!done) }) {
            Text(e.text + (if (e.priority > 0) " " + "*".repeat(e.priority) else ""), style = MaterialTheme.typography.bodyLarge, textDecoration = if (done) TextDecoration.LineThrough else null, color = if (done) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface)
            val meta = listOfNotNull(e.time, e.children?.takeIf { it.isNotEmpty() }?.let { c -> "${c.count { it.status == "DONE" }}/${c.size}" }).joinToString(" · ")
            if (meta.isNotEmpty()) Text(meta, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        TextButton(onClick = onDelete) { Text("×", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}

@Composable
private fun NewBulletRow(onAdd: (String, String) -> Unit) {
    var text by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("TASK") }
    fun submit() { if (text.isNotBlank()) { onAdd(text.trim(), kind); text = "" } }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        TextButton(onClick = { kind = when (kind) { "TASK" -> "EVENT"; "EVENT" -> "NOTE"; else -> "TASK" } }) {
            Text(when (kind) { "EVENT" -> "○"; "NOTE" -> "–"; else -> "•" }, style = MaterialTheme.typography.titleLarge)
        }
        OutlinedTextField(
            value = text, onValueChange = { text = it }, modifier = Modifier.weight(1f), singleLine = true,
            placeholder = { Text(when (kind) { "EVENT" -> "novo evento"; "NOTE" -> "nova nota"; else -> "novo bullet" }) },
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done), keyboardActions = KeyboardActions(onDone = { submit() }),
        )
        IconButton(onClick = ::submit) { Icon(Icons.Default.Add, contentDescription = "Adicionar") }
    }
}

@Composable
private fun HabitChip(h: HabitTodayDto, onClick: () -> Unit) {
    val bg = if (h.done) Tones.green.copy(alpha = 0.18f) else MaterialTheme.colorScheme.surface
    Column(
        Modifier.width(128.dp).clip(RoundedCornerShape(10.dp)).background(bg)
            .border(1.dp, if (h.done) Tones.green else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(10.dp))
            .clickable(onClick = onClick).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text((if (h.done) "✓ " else "○ ") + h.habit.name, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium, maxLines = 2, color = if (h.scheduledToday) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            val sub = h.log?.let { Fmt.habitLogLabel(h.habit.kind, it.value, h.habit.unit) } ?: Fmt.habitSubline(h.habit).substringAfter(" · ", Fmt.habitSubline(h.habit))
            Text(sub, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
            Text("${h.streak}d", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun DailyLogCard(s: DailySummaryDto, vm: TodayViewModel) {
    val log = s.journal.log
    var wokeAt by remember(log) { mutableStateOf(log?.wokeAt ?: "") }
    var mood by remember(log) { mutableStateOf(log?.mood?.toString() ?: "") }
    var energy by remember(log) { mutableStateOf(log?.energy?.toString() ?: "") }
    var highlights by remember(log) { mutableStateOf(log?.highlights ?: "") }
    SectionCard("Diário do dia") {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(wokeAt, { wokeAt = it }, Modifier.weight(1.2f), label = { Text("acordei às") }, placeholder = { Text("05:20") }, singleLine = true)
            OutlinedTextField(mood, { mood = it.filter(Char::isDigit).take(1) }, Modifier.weight(1f), label = { Text("humor") }, placeholder = { Text("1–5") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number))
            OutlinedTextField(energy, { energy = it.filter(Char::isDigit).take(1) }, Modifier.weight(1f), label = { Text("energia") }, placeholder = { Text("1–5") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number))
        }
        OutlinedTextField(highlights, { highlights = it }, Modifier.fillMaxWidth(), label = { Text("destaque do dia") }, singleLine = true)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = {
                vm.saveDailyLog(dev.indice.app.data.api.UpsertDailyLogRequest(
                    wokeAt = wokeAt.takeIf { Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(it) },
                    mood = mood.toIntOrNull()?.takeIf { it in 1..5 }, energy = energy.toIntOrNull()?.takeIf { it in 1..5 },
                    highlights = highlights.takeIf { it.isNotBlank() },
                ))
            }) { Text("Salvar") }
        }
    }
}
