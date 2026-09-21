plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
}

// Release aponta para o Cloud Run: passe `-Pindice.apiBaseUrl=https://.../`
// e `-Pindice.apiKey=...` (ou deixe fixo em ~/.gradle/gradle.properties, fora
// do repositório). O debug continua falando com a API local do emulador.
val releaseApiBaseUrl = providers.gradleProperty("indice.apiBaseUrl").getOrElse("")
val releaseApiKey = providers.gradleProperty("indice.apiKey").getOrElse("")

android {
    namespace = "dev.indice.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.indice.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:8080/\"")
            buildConfigField("String", "API_KEY", "\"dev-local-key\"")
        }
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            buildConfigField("String", "API_BASE_URL", "\"$releaseApiBaseUrl\"")
            buildConfigField("String", "API_KEY", "\"$releaseApiKey\"")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
}

// Sem as propriedades, o APK de release sairia apontando para lugar nenhum.
tasks.matching { it.name == "generateReleaseBuildConfig" }.configureEach {
    doFirst {
        require(releaseApiBaseUrl.isNotBlank() && releaseApiKey.isNotBlank()) {
            "Build de release exige -Pindice.apiBaseUrl=https://SEU-API.run.app/ e -Pindice.apiKey=CHAVE"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.activity.compose)
    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.tooling.preview)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore.preferences)
    implementation(libs.androidx.glance.appwidget)
    implementation(libs.androidx.glance.material3)
    implementation(libs.retrofit)
    implementation(libs.retrofit.kotlinx.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    debugImplementation(libs.androidx.compose.ui.tooling)
}
