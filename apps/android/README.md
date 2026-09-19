# Índice — Android

Kotlin + Jetpack Compose + Retrofit (kotlinx.serialization). Abra a pasta
`apps/android` no Android Studio; o Gradle wrapper é gerado pelo IDE na
primeira sincronização (ou rode `gradle wrapper` se tiver o Gradle instalado).

- `data/api/IndiceApi.kt` — cliente Retrofit espelhando a API.
- `data/api/Dto.kt` — DTOs espelhando `packages/shared/src/index.ts`.
- `data/repository/IndiceRepository.kt` — fachada; converte erros HTTP em `ApiException` legível; ponto de entrada do futuro modo offline.
- `ui/IndiceApp.kt` — navegação por abas (Hoje · Hábitos · Financeiro · Metas · Mídia).
- `ui/common/` — `LoadViewModel` (carrega/recarrega/mutação com Snackbar), componentes (cards, régua semanal, dropdowns) e `Fmt` (R$, datas, rótulos).
- `ui/today/` — Hoje: bullets, chips de hábitos, financeiro, meta/mídia, diário do dia.
- `ui/habits/` — Hábitos: régua semanal, sequência, consistência 30 dias, registro com valor/horário, novo hábito.
- `ui/finance/` — Financeiro: resumo, contas, faturas (pagar), lançamentos (long-press apaga) e o sheet de lançamento rápido.
- `ui/goals/` — Metas: progresso, ritmo, projeção, aportes, alvo/status, nova meta.
- `ui/media/` — Mídia: filtro por tipo, grupos por status, progresso/nota, novo item.
- `widget/HabitWidget.kt` — widget Glance de marcação rápida de hábitos.

Build por linha de comando (sem abrir o IDE):

```bash
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
./gradlew :app:assembleDebug
```

A URL da API no emulador é `http://10.0.2.2:8080/` (host da máquina). Ajuste
em `app/build.gradle.kts` (`API_BASE_URL`, `DEV_API_KEY`).
