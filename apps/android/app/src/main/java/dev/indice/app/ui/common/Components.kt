package dev.indice.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.indice.app.data.api.HabitDayDto
import kotlinx.coroutines.flow.SharedFlow

object Tones {
    val green = Color(0xFF00C28A)
    val yellow = Color(0xFFF2C94C)
    val red = Color(0xFFEB5757)
    fun of(status: String): Color = when (status) { "green" -> green; "yellow" -> yellow; else -> red }
}

@Composable
fun ScreenHeader(kicker: String, title: String, pill: (@Composable () -> Unit)? = null, onRefresh: (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(kicker, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.SemiBold)
        }
        pill?.invoke()
        if (onRefresh != null) IconButton(onClick = onRefresh) { Icon(Icons.Default.Refresh, contentDescription = "Atualizar") }
    }
}

@Composable
fun Pill(text: String, tone: Color) {
    Text(
        text, style = MaterialTheme.typography.labelMedium, color = Color.White,
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(tone).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
fun SectionLabel(text: String) {
    Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, letterSpacing = androidx.compose.ui.unit.TextUnit(0.08f, androidx.compose.ui.unit.TextUnitType.Em))
}

@Composable
fun SectionCard(title: String? = null, aside: (@Composable () -> Unit)? = null, tint: Color? = null, content: @Composable ColumnScope.() -> Unit) {
    Card(
        Modifier.fillMaxWidth(),
        colors = if (tint != null) CardDefaults.cardColors(containerColor = tint) else CardDefaults.cardColors(),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            if (title != null || aside != null) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    if (title != null) SectionLabel(title) else Spacer(Modifier.width(1.dp))
                    aside?.invoke()
                }
            }
            content()
        }
    }
}

@Composable
fun Kv(key: String, value: String, color: Color? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(key, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = MaterialTheme.typography.bodySmall, color = color ?: MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun Stat(label: String, value: String, color: Color? = null, big: Boolean = false) {
    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, style = if (big) MaterialTheme.typography.headlineMedium else MaterialTheme.typography.titleMedium, color = color ?: MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
fun Bar(pct: Double, color: Color = MaterialTheme.colorScheme.primary, height: Dp = 8.dp) {
    val frac = (pct / 100.0).coerceIn(0.0, 1.0).toFloat()
    Box(Modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(999.dp)).background(MaterialTheme.colorScheme.surfaceVariant)) {
        Box(Modifier.fillMaxWidth(frac).height(height).clip(RoundedCornerShape(999.dp)).background(color))
    }
}

/** Régua semanal do hábito: S T Q Q S S D com o estado de cada dia. */
@Composable
fun WeekDots(week: List<HabitDayDto>) {
    val letters = listOf("S", "T", "Q", "Q", "S", "S", "D")
    val line = MaterialTheme.colorScheme.outline
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        week.forEachIndexed { i, d ->
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(letters.getOrElse(i) { "" }, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                val base = Modifier.size(16.dp).clip(CircleShape)
                val dot = when (d.status) {
                    "done" -> base.background(Tones.green)
                    "miss" -> base.border(1.5.dp, Tones.red, CircleShape)
                    "today" -> base.border(2.dp, MaterialTheme.colorScheme.onSurface, CircleShape)
                    "off" -> base.border(1.dp, line.copy(alpha = 0.4f), CircleShape)
                    else -> base.border(1.dp, line.copy(alpha = 0.25f), CircleShape)
                }
                Box(dot)
            }
        }
    }
}

@Composable
fun <T> Loadable(state: UiState<T>, onRetry: () -> Unit, content: @Composable (data: T, busy: Boolean) -> Unit) {
    when (state) {
        UiState.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        is UiState.Error -> Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Não deu para carregar", style = MaterialTheme.typography.titleMedium)
            Text(state.message, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Button(onClick = onRetry) { Text("Tentar de novo") }
        }
        is UiState.Ready -> content(state.data, state.busy)
    }
}

/** Encaminha mensagens de erro de ações para o Snackbar da tela. */
@Composable
fun MessageHost(messages: SharedFlow<String>, host: SnackbarHostState) {
    LaunchedEffect(messages) { messages.collect { host.showSnackbar(it) } }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownField(label: String, options: List<Pair<String, String>>, selected: String?, onSelect: (String?) -> Unit, noneLabel: String? = null, modifier: Modifier = Modifier) {
    var expanded by remember { mutableStateOf(false) }
    val text = options.firstOrNull { it.first == selected }?.second ?: noneLabel ?: ""
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        OutlinedTextField(
            value = text, onValueChange = {}, readOnly = true, label = { Text(label) }, singleLine = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (noneLabel != null) DropdownMenuItem(text = { Text(noneLabel) }, onClick = { onSelect(null); expanded = false })
            options.forEach { (id, name) -> DropdownMenuItem(text = { Text(name) }, onClick = { onSelect(id); expanded = false }) }
        }
    }
}

@Composable
fun ChipRow(options: List<Pair<String, String>>, selected: String?, onSelect: (String) -> Unit) {
    LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        items(options, key = { it.first }) { (id, name) -> FilterChip(selected = id == selected, onClick = { onSelect(id) }, label = { Text(name) }) }
    }
}
