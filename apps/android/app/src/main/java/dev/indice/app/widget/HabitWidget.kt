package dev.indice.app.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.Text
import androidx.glance.action.clickable
import dev.indice.app.IndiceApp
import dev.indice.app.data.api.HabitTodayDto

/**
 * Widget de marcação rápida de hábitos. Esqueleto funcional: busca a lista do
 * dia e cada linha alterna o log via ActionCallback. Próximos passos: cache em
 * DataStore para render offline, WorkManager para refresh periódico, layout
 * responsivo por tamanho.
 */
class HabitWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val habits = runCatching { IndiceApp.instance.repository.habitsToday() }.getOrDefault(emptyList())
        provideContent { HabitWidgetContent(habits) }
    }
}

@Composable
private fun HabitWidgetContent(habits: List<HabitTodayDto>) {
    Column(GlanceModifier.fillMaxWidth().padding(12.dp)) {
        Text("Índice · hábitos")
        if (habits.isEmpty()) Text("Sem hábitos ou sem conexão")
        habits.filter { it.scheduledToday }.forEach { h ->
            Row(
                GlanceModifier.fillMaxWidth().padding(vertical = 4.dp).clickable(
                    actionRunCallback<ToggleHabitAction>(actionParametersOf(ToggleHabitAction.habitId to h.habit.id, ToggleHabitAction.done to !h.done))
                )
            ) {
                Text(if (h.done) "✓ " else "○ ")
                Text(h.habit.name)
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
