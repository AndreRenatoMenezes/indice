package dev.indice.app

import android.app.Application
import dev.indice.app.data.api.ApiClient
import dev.indice.app.data.repository.IndiceRepository

class IndiceApp : Application() {
    // Injeção manual por enquanto; trocar por Hilt quando os módulos crescerem.
    val repository: IndiceRepository by lazy { IndiceRepository(ApiClient.create(this)) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: IndiceApp
            private set
    }
}
