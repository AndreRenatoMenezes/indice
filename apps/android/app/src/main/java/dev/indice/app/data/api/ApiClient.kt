package dev.indice.app.data.api

import android.content.Context
import dev.indice.app.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {
    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false; coerceInputValues = true }

    fun create(context: Context, baseUrl: String = BuildConfig.API_BASE_URL, apiKey: String = BuildConfig.API_KEY): IndiceApi {
        val auth = Interceptor { chain ->
            chain.proceed(chain.request().newBuilder().header("X-Api-Key", apiKey).build())
        }
        val client = OkHttpClient.Builder()
            .addInterceptor(auth)
            .apply { if (BuildConfig.DEBUG) addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC)) }
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(IndiceApi::class.java)
    }
}
