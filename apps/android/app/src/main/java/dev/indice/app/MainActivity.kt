package dev.indice.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import dev.indice.app.ui.theme.IndiceTheme
import dev.indice.app.ui.today.TodayScreen

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            IndiceTheme {
                TodayScreen()
            }
        }
    }
}
