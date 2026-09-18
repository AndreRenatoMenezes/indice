package dev.indice.app.ui.today

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.indice.app.data.api.DailySummaryDto
import java.text.NumberFormat
import java.util.Locale

private val brl: NumberFormat = NumberFormat.getCurrencyInstance(Locale("pt", "BR"))

@Composable
fun TodayScreen(vm: TodayViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    Scaffold { padding ->
        when (val s = state) {
            TodayState.Loading -> Column(Modifier.fillMaxSize().padding(padding), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) { CircularProgressIndicator() }
            is TodayState.Error -> Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
                Text("Não deu para carregar", style = MaterialTheme.typography.titleMedium)
                Text(s.message, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.padding(8.dp))
                Button(onClick = vm::refresh) { Text("Tentar de novo") }
            }
            is TodayState.Ready -> TodayContent(s.summary, Modifier.padding(padding), vm)
        }
    }
}

@Composable
private fun TodayContent(s: DailySummaryDto, modifier: Modifier, vm: TodayViewModel) {
    var newText by remember { mutableStateOf("") }
    LazyColumn(modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item { Text("Hoje · ${s.date}", style = MaterialTheme.typography.headlineSmall) }

        item {
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("Financeiro · ${s.finance.trafficLight.label}", style = MaterialTheme.typography.titleSmall)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Saldo ${brl.format(s.finance.balance)}")
                        Text("Por dia ${brl.format(s.finance.dailyBudget)}")
                    }
                    Text(s.finance.trafficLight.message, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        item { Text("Hábitos", style = MaterialTheme.typography.titleMedium) }
        items(s.habits, key = { it.habit.id }) { h ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = h.done, onCheckedChange = { vm.toggleHabit(h.habit.id, it) })
                Text(h.habit.name, Modifier.weight(1f))
                Text("${h.streak}d", style = MaterialTheme.typography.bodySmall)
            }
        }

        item { Text("Bullets", style = MaterialTheme.typography.titleMedium) }
        items(s.journal.entries, key = { it.id }) { e ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = e.status == "DONE", onCheckedChange = { vm.toggleEntry(e.id, it) })
                Text(e.text, Modifier.weight(1f))
                e.time?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(value = newText, onValueChange = { newText = it }, modifier = Modifier.weight(1f), placeholder = { Text("• novo bullet") }, singleLine = true)
                Spacer(Modifier.width(8.dp))
                Button(onClick = { if (newText.isNotBlank()) { vm.addEntry(newText.trim()); newText = "" } }) { Text("+") }
            }
        }

        if (s.goals.isNotEmpty()) {
            item { Text("Metas", style = MaterialTheme.typography.titleMedium) }
            items(s.goals, key = { it.id }) { g ->
                Column(Modifier.fillMaxWidth()) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(g.title)
                        Text("${"%.1f".format(g.progressPct)}%", style = MaterialTheme.typography.bodySmall)
                    }
                    LinearProgressIndicator(progress = { (g.progressPct / 100.0).toFloat().coerceIn(0f, 1f) }, modifier = Modifier.fillMaxWidth())
                }
            }
        }
    }
}
