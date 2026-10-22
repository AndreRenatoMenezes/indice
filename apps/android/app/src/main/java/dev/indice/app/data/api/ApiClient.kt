package dev.indice.app.data.api

import dev.indice.app.BuildConfig
import dev.indice.app.data.auth.AuthAuthenticator
import dev.indice.app.data.auth.SessionStore
import kotlinx.coroutines.runBlocking
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

    fun create(store: SessionStore, baseUrl: String = BuildConfig.API_BASE_URL): IndiceApi {
        // O refresh usa um client sem Authenticator, para um 401 dele não renovar a si mesmo.
        val refreshApi = retrofit(baseUrl, newClient().build())
        val bearer = Interceptor { chain ->
            val request = chain.request()
            // As rotas /auth/* são públicas: não levam Bearer.
            val token = if (request.url.pathSegments.firstOrNull() == "auth") null else runBlocking { store.current()?.accessToken }
            chain.proceed(if (token == null) request else request.newBuilder().header("Authorization", "Bearer $token").build())
        }
        val client = newClient()
            .addInterceptor(bearer)
            .authenticator(AuthAuthenticator(store, refreshApi))
            .build()
        return retrofit(baseUrl, client)
    }

    private fun newClient() = OkHttpClient.Builder()
        .apply { if (BuildConfig.DEBUG) addInterceptor(HttpLoggingInterceptor().setLevel(HttpLoggingInterceptor.Level.BASIC)) }
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)

    private fun retrofit(baseUrl: String, client: OkHttpClient): IndiceApi = Retrofit.Builder()
        .baseUrl(baseUrl)
        .client(client)
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(IndiceApi::class.java)
}
