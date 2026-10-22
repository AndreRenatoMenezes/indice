package dev.indice.app.data.auth

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import dev.indice.app.data.api.AccessTokenDto
import dev.indice.app.data.api.AuthSessionDto
import dev.indice.app.data.api.MeDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.sessionDataStore by preferencesDataStore("session")

data class Session(val refreshToken: String, val accessToken: String, val accessTokenExpiresAt: String, val user: MeDto)

sealed interface SessionState {
    data object Loading : SessionState
    data object SignedOut : SessionState
    data class SignedIn(val user: MeDto) : SessionState
}

/**
 * Sessão do app em DataStore (fora do backup: `allowBackup=false`). O estado de
 * sessão guia a navegação; renovar o access token não o altera.
 */
class SessionStore(context: Context) {
    private val ds = context.sessionDataStore

    val state: Flow<SessionState> = ds.data.map { it.toSession()?.let { s -> SessionState.SignedIn(s.user) } ?: SessionState.SignedOut }
        .distinctUntilChanged()

    private val _denied = MutableStateFlow(false)
    /** 403 da API com sessão ativa: e-mail tirado da lista de permitidos. Só em memória. */
    val denied: StateFlow<Boolean> = _denied

    suspend fun current(): Session? = ds.data.first().toSession()

    suspend fun save(s: AuthSessionDto) {
        _denied.value = false
        ds.edit {
            it[REFRESH] = s.refreshToken
            it[ACCESS] = s.accessToken
            it[EXPIRES] = s.accessTokenExpiresAt
            it[USER_ID] = s.user.id
            it[EMAIL] = s.user.email
            it[NAME] = s.user.displayName
        }
    }

    suspend fun updateAccess(t: AccessTokenDto) {
        ds.edit {
            it[ACCESS] = t.accessToken
            it[EXPIRES] = t.accessTokenExpiresAt
        }
    }

    suspend fun clear() {
        _denied.value = false
        ds.edit { it.clear() }
    }

    fun markDenied() {
        _denied.value = true
    }

    private fun Preferences.toSession(): Session? {
        val refresh = this[REFRESH] ?: return null
        val access = this[ACCESS] ?: return null
        val user = MeDto(this[USER_ID] ?: return null, this[EMAIL] ?: "", this[NAME] ?: "")
        return Session(refresh, access, this[EXPIRES] ?: "", user)
    }

    private companion object {
        val REFRESH = stringPreferencesKey("refresh_token")
        val ACCESS = stringPreferencesKey("access_token")
        val EXPIRES = stringPreferencesKey("access_expires_at")
        val USER_ID = stringPreferencesKey("user_id")
        val EMAIL = stringPreferencesKey("user_email")
        val NAME = stringPreferencesKey("user_name")
    }
}
