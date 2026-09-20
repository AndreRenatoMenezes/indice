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

A URL da API no emulador é `http://10.0.2.2:8080/` (host da máquina), fixa no
build type `debug` junto com a chave `dev-local-key`.

O build de `release` aponta para o Cloud Run e exige as duas propriedades —
sem elas o build falha em vez de gerar um APK apontando para `localhost`:

```bash
./gradlew :app:assembleRelease \
  -Pindice.apiBaseUrl=https://indice-api-XXXX.run.app/ \
  -Pindice.apiKey=CHAVE_DO_SECRET_MANAGER
```

Para não repetir os parâmetros, guarde `indice.apiBaseUrl` e `indice.apiKey`
em `~/.gradle/gradle.properties` (fora do repositório). A chave fica embutida
no APK; como o app é de usuário único, o risco é perder o aparelho — se isso
acontecer, revogue a linha em `ApiKey` (campo `revokedAt`) e gere outra.
