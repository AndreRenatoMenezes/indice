package dev.indice.app.ui.media

import dev.indice.app.data.api.CreateMediaRequest
import dev.indice.app.data.api.MediaItemDto
import dev.indice.app.data.api.UpdateMediaRequest
import dev.indice.app.ui.common.LoadViewModel

class MediaViewModel : LoadViewModel<List<MediaItemDto>>() {
    init { refresh() }

    override suspend fun load(): List<MediaItemDto> = repo.media()

    fun create(body: CreateMediaRequest) = mutate { repo.createMedia(body) }
    fun setStatus(id: String, status: String) = mutate { repo.updateMedia(id, UpdateMediaRequest(status = status)) }
    fun update(id: String, progress: Double?, rating: Int?) = mutate { repo.updateMedia(id, UpdateMediaRequest(progress = progress, rating = rating)) }
}
