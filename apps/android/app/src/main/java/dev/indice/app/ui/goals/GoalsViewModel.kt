package dev.indice.app.ui.goals

import dev.indice.app.data.api.CreateGoalRequest
import dev.indice.app.data.api.GoalDetailDto
import dev.indice.app.data.api.UpdateGoalRequest
import dev.indice.app.ui.common.LoadViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

class GoalsViewModel : LoadViewModel<List<GoalDetailDto>>() {
    init { refresh() }

    override suspend fun load(): List<GoalDetailDto> = coroutineScope {
        repo.goals().map { g -> async { repo.goal(g.id) } }.awaitAll()
    }

    fun contribute(goalId: String, amount: Double, note: String?) = mutate { repo.contribute(goalId, amount, note) }
    fun create(body: CreateGoalRequest) = mutate { repo.createGoal(body) }
    fun setStatus(id: String, status: String) = mutate { repo.updateGoal(id, UpdateGoalRequest(status = status)) }
    fun setTarget(id: String, target: Double) = mutate { repo.updateGoal(id, UpdateGoalRequest(targetValue = target)) }
}
