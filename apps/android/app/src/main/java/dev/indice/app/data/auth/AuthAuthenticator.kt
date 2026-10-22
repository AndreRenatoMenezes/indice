package dev.indice.app.data.auth

import dev.indice.app.data.api.IndiceApi
import dev.indice.app.data.api.RefreshInput
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route
import retrofit2.HttpException

/**
 * Trata o 401 de uma chamada autenticada: renova o access token (uma renovação
 * por vez) e repete a chamada uma vez. Refresh com 401 limpa a sessão; falha de
 * rede ou 5xx mantém a sessão e deixa o 401 original subir.
 * `refreshApi` vem de um client sem este authenticator.
 */
class AuthAuthenticator(private val store: SessionStore, private val refreshApi: IndiceApi) : Authenticator {
    private val mutex = Mutex()

    override fun authenticate(route: Route?, response: Response): Request? {
        val sent = response.request.header("Authorization") ?: return null
        if (response.priorCount() > 1) return null
        return runBlocking {
            mutex.withLock {
                val session = store.current() ?: return@withLock null
                // Outra chamada já renovou enquanto esta esperava o mutex.
                if ("Bearer ${session.accessToken}" != sent) return@withLock response.request.withToken(session.accessToken)
                try {
                    val fresh = refreshApi.refresh(RefreshInput(session.refreshToken))
                    store.updateAccess(fresh)
                    response.request.withToken(fresh.accessToken)
                } catch (e: HttpException) {
                    if (e.code() == 401) store.clear()
                    null
                } catch (_: Exception) {
                    null
                }
            }
        }
    }

    private fun Request.withToken(token: String) = newBuilder().header("Authorization", "Bearer $token").build()

    private fun Response.priorCount(): Int {
        var n = 1
        var r = priorResponse
        while (r != null) { n++; r = r.priorResponse }
        return n
    }
}
