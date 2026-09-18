package dev.indice.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Accent = Color(0xFF1F6F5F)
private val AccentDark = Color(0xFF6FC7B3)

private val Light = lightColorScheme(primary = Accent, background = Color(0xFFFAFAF7), surface = Color(0xFFFFFFFF))
private val Dark = darkColorScheme(primary = AccentDark, background = Color(0xFF121211), surface = Color(0xFF1B1B19))

@Composable
fun IndiceTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
