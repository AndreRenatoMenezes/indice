package dev.indice.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Mesma paleta do web (globals.css): papel, tinta, verde de acento, linhas neutras.
private val Accent = Color(0xFF1F6F5F)
private val AccentDark = Color(0xFF6FC7B3)

private val Light = lightColorScheme(
    primary = Accent, onPrimary = Color.White,
    secondaryContainer = Color(0xFFD7EFE8), onSecondaryContainer = Accent,
    background = Color(0xFFFAFAF7), onBackground = Color(0xFF1C1C1A),
    surface = Color(0xFFFAFAF7), onSurface = Color(0xFF1C1C1A),
    surfaceVariant = Color(0xFFE6E4DD), onSurfaceVariant = Color(0xFF6B6B66),
    surfaceContainerLow = Color(0xFFFFFFFF), surfaceContainer = Color(0xFFF3F2EE), surfaceContainerHigh = Color(0xFFEDECE7), surfaceContainerHighest = Color(0xFFFFFFFF),
    outline = Color(0xFF8A8A84), outlineVariant = Color(0xFFE6E4DD),
)
private val Dark = darkColorScheme(
    primary = AccentDark, onPrimary = Color(0xFF0F2A24),
    secondaryContainer = Color(0xFF244640), onSecondaryContainer = AccentDark,
    background = Color(0xFF121211), onBackground = Color(0xFFECEBE6),
    surface = Color(0xFF121211), onSurface = Color(0xFFECEBE6),
    surfaceVariant = Color(0xFF2A2A27), onSurfaceVariant = Color(0xFF9B9A93),
    surfaceContainerLow = Color(0xFF1B1B19), surfaceContainer = Color(0xFF202020), surfaceContainerHigh = Color(0xFF262624), surfaceContainerHighest = Color(0xFF1B1B19),
    outline = Color(0xFF6E6E68), outlineVariant = Color(0xFF2A2A27),
)

@Composable
fun IndiceTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
