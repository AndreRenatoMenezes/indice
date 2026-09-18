# Índice — Android

Kotlin + Jetpack Compose + Retrofit (kotlinx.serialization). Abra a pasta
`apps/android` no Android Studio; o Gradle wrapper é gerado pelo IDE na
primeira sincronização (ou rode `gradle wrapper` se tiver o Gradle instalado).

- `data/api/IndiceApi.kt` — cliente Retrofit espelhando a API.
- `data/api/Dto.kt` — DTOs espelhando `packages/shared/src/index.ts`.
- `data/repository/IndiceRepository.kt` — fachada; ponto de entrada do futuro modo offline.
- `ui/today/` — tela "Hoje" (visão diária).
- `widget/HabitWidget.kt` — widget Glance de marcação rápida de hábitos.

A URL da API no emulador é `http://10.0.2.2:8080/` (host da máquina). Ajuste
em `app/build.gradle.kts` (`API_BASE_URL`, `DEV_API_KEY`).
