package dev.indice.app.ui.habits

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedIconButton
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
import dev.indice.app.data.api.CreateHabitRequest
import dev.indice.app.data.api.HabitTodayDto
import dev.indice.app.data.api.HabitsTodayResponse
import dev.indice.app.ui.common.Bar
import dev.indice.app.ui.common.DropdownField
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Fmt.trim
import dev.indice.app.ui.common.Loadable
import dev.indice.app.ui.common.MessageHost
import dev.indice.app.ui.common.Pill
import dev.indice.app.ui.common.ScreenHeader
import dev.indice.app.ui.common.SectionCard
import dev.indice.app.ui.common.Tones
import dev.indice.app.ui.common.WeekDots

@Composable
fun HabitsScreen(vm: HabitsViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    MessageHost(vm.messages, snack)
    var logging by remember { mutableStateOf<HabitTodayDto?>(null) }
    var creating by remember { mutableStateOf(false) }
    Scaffold(snackbarHost = { SnackbarHost(snack) }, contentWindowInsets = WindowInsets(0)) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Loadable(state, onRetry = vm::refresh) { s, _ ->
                HabitsContent(s, vm, onLogValue = { logging = it }, onCreate = { creating = true })
            }
        }
    }
    logging?.let { h -> LogValueDialog(h, onDismiss = { logging = null }) { value, time, note -> vm.logValue(h.habit.id, value, time, note); logging = null } }
    if (creating) NewHabitDialog(onDismiss = { creating = false }) { vm.create(it); creating = false }
}

@Composable
private fun HabitsContent(s: HabitsTodayResponse, vm: HabitsViewModel, onLogValue: (HabitTodayDto) -> Unit, onCreate: () -> Unit) {
    val scheduled = s.habits.filter { it.scheduledToday }
    val done = scheduled.count { it.done }
    val week = s.habits.firstOrNull()?.week?.map { it.date } ?: emptyList()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            ScreenHeader(Fmt.weekRange(week).ifEmpty { Fmt.dateBR(s.date) }, "Hábitos", pill = {
                Pill("$done de ${scheduled.size} hoje", if (scheduled.isNotEmpty() && done == scheduled.size) Tones.green else if (done > 0) Tones.yellow else Tones.red)
            }, onRefresh = vm::refresh)
        }
        items(s.habits, key = { it.habit.id }) { h -> HabitCard(h, onQuick = { vm.toggle(h.habit.id, !h.done) }, onLogValue = { onLogValue(h) }) }
        if (s.habits.isEmpty()) item { Text("Nenhum hábito ainda.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        item { OutlinedButton(onClick = onCreate, Modifier.fillMaxWidth()) { Icon(Icons.Default.Add, null); Text("  Novo hábito") } }
    }
}

@Composable
private fun HabitCard(h: HabitTodayDto, onQuick: () -> Unit, onLogValue: () -> Unit) {
    SectionCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(Modifier.weight(1f)) {
                Text(h.habit.name, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Medium)
                val sub = listOfNotNull(h.log?.let { Fmt.habitLogLabel(h.habit.kind, it.value, h.habit.unit) }, Fmt.habitSubline(h.habit)).joinToString(" · ")
                Text(sub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Column(horizontalAlignment = Alignment.End) {
                Text("${h.streak}", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                Text("sequência", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (h.done) FilledIconButton(onClick = onQuick, Modifier.size(48.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = Tones.green)) { Icon(Icons.Default.Check, contentDescription = "Desmarcar ${h.habit.name}") }
            else OutlinedIconButton(onClick = { if (h.habit.kind == "BOOLEAN") onQuick() else onLogValue() }, Modifier.size(48.dp)) { Icon(Icons.Default.Check, contentDescription = "Marcar ${h.habit.name}", tint = MaterialTheme.colorScheme.outline) }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            WeekDots(h.week)
            if (h.habit.kind != "BOOLEAN" && !h.done) TextButton(onClick = onQuick) { Text("marcar meta") }
        }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("30 dias · ${h.consistency30.trim()}%", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Box(Modifier.weight(1f)) { Bar(h.consistency30, if (h.consistency30 >= 80) Tones.green else if (h.consistency30 >= 50) Tones.yellow else Tones.red, 6.dp) }
        }
    }
}

@Composable
private fun LogValueDialog(h: HabitTodayDto, onDismiss: () -> Unit, onConfirm: (Double?, String?, String?) -> Unit) {
    val isTime = h.habit.kind == "TIME"
    var value by remember { mutableStateOf(if (isTime) "" else (h.log?.value ?: h.habit.targetValue)?.trim() ?: "") }
    var note by remember { mutableStateOf("") }
    val valid = if (isTime) Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(value) else value.replace(',', '.').toDoubleOrNull() != null
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(h.habit.name) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value, { value = it }, label = { Text(if (isTime) "horário (HH:mm)" else "valor${h.habit.unit?.let { " ($it)" } ?: ""}") }, singleLine = true,
                    placeholder = { Text(if (isTime) h.habit.targetTime ?: "05:30" else h.habit.targetValue?.trim() ?: "") },
                    keyboardOptions = KeyboardOptions(keyboardType = if (isTime) KeyboardType.Text else KeyboardType.Decimal))
                OutlinedTextField(note, { note = it }, label = { Text("nota") }, singleLine = true)
            }
        },
        confirmButton = { TextButton(enabled = valid, onClick = { onConfirm(if (isTime) null else value.replace(',', '.').toDouble(), if (isTime) value else null, note.takeIf { it.isNotBlank() }) }) { Text("Registrar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}

@Composable
private fun NewHabitDialog(onDismiss: () -> Unit, onConfirm: (CreateHabitRequest) -> Unit) {
    var name by remember { mutableStateOf("") }
    var kind by remember { mutableStateOf("BOOLEAN") }
    var target by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("") }
    var targetTime by remember { mutableStateOf("") }
    var days by remember { mutableStateOf(setOf(1, 2, 3, 4, 5, 6, 7)) }
    val names = listOf("seg", "ter", "qua", "qui", "sex", "sáb", "dom")
    val valid = name.isNotBlank() && days.isNotEmpty() && (kind != "TIME" || Regex("^([01]\\d|2[0-3]):[0-5]\\d$").matches(targetTime))
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Novo hábito") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("nome") }, singleLine = true)
                DropdownField("tipo", Fmt.HABIT_KIND.toList(), kind, { kind = it ?: "BOOLEAN" })
                if (kind == "COUNTER" || kind == "DURATION") Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(target, { target = it }, Modifier.weight(1f), label = { Text("meta") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(unit, { unit = it }, Modifier.weight(1f), label = { Text("unidade") }, placeholder = { Text(if (kind == "DURATION") "min" else "copos") }, singleLine = true)
                }
                if (kind == "TIME") OutlinedTextField(targetTime, { targetTime = it }, label = { Text("até que horas (HH:mm)") }, placeholder = { Text("05:30") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    names.forEachIndexed { i, n -> FilterChip(selected = (i + 1) in days, onClick = { days = if ((i + 1) in days) days - (i + 1) else days + (i + 1) }, label = { Text(n, style = MaterialTheme.typography.labelSmall) }) }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                onConfirm(CreateHabitRequest(
                    name = name.trim(), kind = kind, unit = unit.takeIf { it.isNotBlank() }, targetValue = target.replace(',', '.').toDoubleOrNull(),
                    targetTime = targetTime.takeIf { kind == "TIME" }, weekdays = days.sorted(),
                ))
            }) { Text("Criar") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
