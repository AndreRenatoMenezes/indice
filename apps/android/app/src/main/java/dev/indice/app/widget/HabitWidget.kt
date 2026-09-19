package dev.indice.app.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import dev.indice.app.IndiceApp
import dev.indice.app.MainActivity
import dev.indice.app.data.api.HabitTodayDto
import dev.indice.app.ui.common.Fmt
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Widget de marcação rápida de hábitos (design "Widget"): cabeçalho com a data,
 * uma linha por hábito escalado hoje com o registro ou a meta à direita. Um toque
 * alterna o log (marcação rápida = meta atingida). Próximos passos: cache em
 * DataStore para render offline e WorkManager para refresh periódico.
 */
class HabitWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val result = runCatching { IndiceApp.instance.repository.habitsToday() }
        provideContent {
            GlanceTheme {
                HabitWidgetContent(result.getOrNull()?.date ?: Fmt.today(), result.getOrNull()?.habits ?: emptyList(), result.isFailure)
            }
        }
    }
}

private val Ink = ColorProvider(Color(0xFF1C1C1A))
private val Muted = ColorProvider(Color(0xFF6B6B66))
private val Paper = ColorProvider(Color(0xFFFAFAF7))
private val Green = ColorProvider(Color(0xFF00C28A))

@Composable
private fun HabitWidgetContent(date: String, habits: List<HabitTodayDto>, offline: Boolean) {
    val header = runCatching { LocalDate.parse(date).format(DateTimeFormatter.ofPattern("EEE d", Locale("pt", "BR"))) }.getOrDefault(date)
    Column(GlanceModifier.fillMaxWidth().background(Paper).cornerRadius(20.dp).padding(horizontal = 16.dp, vertical = 12.dp).clickable(actionStartActivity<MainActivity>())) {
        Row(GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("Índice · hábitos", style = TextStyle(color = Ink, fontWeight = FontWeight.Bold, fontSize = 14.sp), modifier = GlanceModifier.defaultWeight())
            Text(header, style = TextStyle(color = Muted, fontSize = 12.sp))
        }
        Spacer(GlanceModifier.padding(2.dp))
        if (habits.isEmpty()) Text(if (offline) "Sem conexão com a API" else "Sem hábitos hoje", style = TextStyle(color = Muted, fontSize = 12.sp))
        habits.filter { it.scheduledToday }.forEach { h ->
            Row(
                GlanceModifier.fillMaxWidth().padding(vertical = 5.dp).clickable(
                    actionRunCallback<ToggleHabitAction>(actionParametersOf(ToggleHabitAction.habitId to h.habit.id, ToggleHabitAction.done to !h.done)),
                ),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(if (h.done) "☑" else "☐", style = TextStyle(color = if (h.done) Green else Ink, fontSize = 18.sp))
                Spacer(GlanceModifier.width(8.dp))
                Text(h.habit.name, style = TextStyle(color = Ink, fontSize = 14.sp), modifier = GlanceModifier.defaultWeight(), maxLines = 1)
                val right = h.log?.let { l -> (if (h.habit.kind == "TIME") Fmt.hhmm(l.value) else if (h.habit.kind == "BOOLEAN") "" else "${l.value.toInt()} ${h.habit.unit ?: ""}".trim()) + " · ${h.streak}d" }
                    ?: (h.habit.targetTime ?: h.habit.targetValue?.let { "${it.toInt()} ${h.habit.unit ?: ""}".trim() } ?: "")
                Text(right.trim(' ', '·'), style = TextStyle(color = Muted, fontSize = 12.sp))
            }
        }
    }
}

class ToggleHabitAction : ActionCallback {
    override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val id = parameters[habitId] ?: return
        val done = parameters[done] ?: true
        runCatching { IndiceApp.instance.repository.toggleHabit(id, done) }
        HabitWidget().update(context, glanceId)
    }

    companion object {
        val habitId = ActionParameters.Key<String>("habitId")
        val done = ActionParameters.Key<Boolean>("done")
    }
}

class HabitWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HabitWidget()
}
