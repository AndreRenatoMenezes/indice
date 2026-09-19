package dev.indice.app.ui.media

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import dev.indice.app.data.api.CreateMediaRequest
import dev.indice.app.data.api.MediaItemDto
import dev.indice.app.ui.common.Bar
import dev.indice.app.ui.common.ChipRow
import dev.indice.app.ui.common.DropdownField
import dev.indice.app.ui.common.Fmt
import dev.indice.app.ui.common.Fmt.trim
import dev.indice.app.ui.common.Loadable
import dev.indice.app.ui.common.MessageHost
import dev.indice.app.ui.common.ScreenHeader
import dev.indice.app.ui.common.SectionCard
import dev.indice.app.ui.common.Tones

private val FILTERS = listOf("" to "Todos", "BOOK" to "Livros", "GAME" to "Jogos", "COURSE" to "Cursos", "MOVIE" to "Filmes", "SERIES" to "Séries")
private val GROUPS = listOf("IN_PROGRESS", "WISHLIST", "PAUSED", "DONE", "DROPPED")
private fun kindColor(kind: String): Color = when (kind) { "BOOK" -> Tones.green; "GAME" -> Color(0xFFF2994A); "COURSE" -> Color(0xFF9B51E0); else -> Color(0xFF2D9CDB) }

@Composable
fun MediaScreen(vm: MediaViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val snack = remember { SnackbarHostState() }
    MessageHost(vm.messages, snack)
    var filter by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<MediaItemDto?>(null) }
    var creating by remember { mutableStateOf(false) }
    Scaffold(snackbarHost = { SnackbarHost(snack) }, contentWindowInsets = WindowInsets(0)) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            Loadable(state, onRetry = vm::refresh) { all, _ ->
                val items = if (filter.isEmpty()) all else all.filter { it.kind == filter }
                LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    item { ScreenHeader("livros, jogos e mais", "Mídia", onRefresh = vm::refresh) }
                    item { ChipRow(FILTERS, filter) { filter = it } }
                    GROUPS.forEach { g ->
                        val list = items.filter { it.status == g }
                        if (list.isEmpty()) return@forEach
                        item(key = g) {
                            SectionCard(Fmt.MEDIA_STATUS[g] ?: g) {
                                list.forEachIndexed { i, m ->
                                    MediaRow(m, onClick = { editing = m })
                                    if (i < list.lastIndex) HorizontalDivider()
                                }
                            }
                        }
                    }
                    if (items.isEmpty()) item { Text("Arquivo vazio.", color = MaterialTheme.colorScheme.onSurfaceVariant) }
                    item { OutlinedButton(onClick = { creating = true }, Modifier.fillMaxWidth()) { Icon(Icons.Default.Add, null); Text("  Novo item") } }
                }
            }
        }
    }
    editing?.let { m -> EditMediaDialog(m, onDismiss = { editing = null }, onStatus = { vm.setStatus(m.id, it); editing = null }) { p, r -> vm.update(m.id, p, r); editing = null } }
    if (creating) NewMediaDialog(filter.ifEmpty { "BOOK" }, onDismiss = { creating = false }) { vm.create(it); creating = false }
}

@Composable
private fun MediaRow(m: MediaItemDto, onClick: () -> Unit) {
    val pct = if (m.progress != null && m.progressTotal != null && m.progressTotal > 0) m.progress / m.progressTotal * 100 else null
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.width(44.dp).height(58.dp).clip(RoundedCornerShape(4.dp)).background(kindColor(m.kind).copy(alpha = 0.25f)), contentAlignment = Alignment.Center) {
            Text(Fmt.MEDIA_KIND[m.kind] ?: m.kind, style = MaterialTheme.typography.labelSmall)
        }
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(m.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium)
            val creator = listOfNotNull(m.creator, m.platform, m.year?.toString()).joinToString(" · ")
            if (creator.isNotEmpty()) Text(creator, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            val meta = when {
                pct != null -> "${m.progress!!.trim()} de ${m.progressTotal!!.trim()} ${m.progressUnit ?: ""} · ${pct.toInt()}%"
                m.status == "DONE" -> "terminado em ${Fmt.dateBR(m.finishedAt)}"
                m.startedAt != null -> "desde ${Fmt.dateBR(m.startedAt)}"
                else -> ""
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(meta, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                m.rating?.let { Text("$it/10", style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.Medium) }
            }
            if (pct != null) Bar(pct, kindColor(m.kind), 6.dp)
        }
    }
}

@Composable
private fun EditMediaDialog(m: MediaItemDto, onDismiss: () -> Unit, onStatus: (String) -> Unit, onSave: (Double?, Int?) -> Unit) {
    var progress by remember { mutableStateOf(m.progress?.trim() ?: "") }
    var rating by remember { mutableStateOf(m.rating?.toString() ?: "") }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text(m.title) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Fmt.MEDIA_STATUS[m.status] ?: m.status, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (m.status == "IN_PROGRESS") OutlinedTextField(progress, { progress = it }, label = { Text("progresso${m.progressUnit?.let { " ($it)" } ?: ""}${m.progressTotal?.let { " de ${it.trim()}" } ?: ""}") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                OutlinedTextField(rating, { rating = it.filter(Char::isDigit).take(2) }, label = { Text("nota (1–10)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    if (m.status != "IN_PROGRESS" && m.status != "DONE") TextButton(onClick = { onStatus("IN_PROGRESS") }) { Text("Começar") }
                    if (m.status == "IN_PROGRESS") TextButton(onClick = { onStatus("PAUSED") }) { Text("Pausar") }
                    if (m.status != "DONE") TextButton(onClick = { onStatus("DONE") }) { Text("Concluir") }
                    if (m.status != "DROPPED" && m.status != "DONE") TextButton(onClick = { onStatus("DROPPED") }) { Text("Abandonar") }
                }
            }
        },
        confirmButton = { TextButton(onClick = { onSave(progress.replace(',', '.').toDoubleOrNull(), rating.toIntOrNull()?.takeIf { it in 1..10 }) }) { Text("Salvar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Fechar") } },
    )
}

@Composable
private fun NewMediaDialog(initialKind: String, onDismiss: () -> Unit, onConfirm: (CreateMediaRequest) -> Unit) {
    var kind by remember { mutableStateOf(initialKind) }
    var title by remember { mutableStateOf("") }
    var creator by remember { mutableStateOf("") }
    var platform by remember { mutableStateOf("") }
    var total by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("") }
    var status by remember { mutableStateOf("WISHLIST") }
    AlertDialog(
        onDismissRequest = onDismiss, title = { Text("Novo item") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DropdownField("tipo", Fmt.MEDIA_KIND.toList(), kind, { kind = it ?: "BOOK" })
                OutlinedTextField(title, { title = it }, label = { Text("título") }, singleLine = true)
                OutlinedTextField(creator, { creator = it }, label = { Text("autor / estúdio / instituição") }, singleLine = true)
                OutlinedTextField(platform, { platform = it }, label = { Text("plataforma") }, placeholder = { Text("Kindle, PS5, físico") }, singleLine = true)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(total, { total = it }, Modifier.weight(1f), label = { Text("total") }, placeholder = { Text("320") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal))
                    OutlinedTextField(unit, { unit = it }, Modifier.weight(1f), label = { Text("unidade") }, placeholder = { Text("páginas") }, singleLine = true)
                }
                DropdownField("status", listOf("WISHLIST" to "Quero", "IN_PROGRESS" to "Em andamento"), status, { status = it ?: "WISHLIST" })
            }
        },
        confirmButton = { TextButton(enabled = title.isNotBlank(), onClick = { onConfirm(CreateMediaRequest(kind = kind, title = title.trim(), creator = creator.takeIf { it.isNotBlank() }, platform = platform.takeIf { it.isNotBlank() }, status = status, progressTotal = total.replace(',', '.').toDoubleOrNull(), progressUnit = unit.takeIf { it.isNotBlank() })) }) { Text("Adicionar") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancelar") } },
    )
}
