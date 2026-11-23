import java.io.FileInputStream
import java.net.URI
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

abstract class DemoNetworkConfigTask : DefaultTask() {
    @get:Input
    abstract val apiBaseUrl: Property<String>

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @TaskAction
    fun generate() {
        val uri = URI(apiBaseUrl.get().trim().trimEnd('/'))
        val xmlFile = outputDirectory.file("xml/network_security_config.xml").get().asFile
        xmlFile.parentFile.mkdirs()
        // Keep normal system certificate verification for HTTPS.
        val exception = if (uri.scheme == "http") {
            "<domain-config cleartextTrafficPermitted=\"true\">" +
                "<domain includeSubdomains=\"false\">${uri.host}</domain></domain-config>"
        } else ""
        xmlFile.writeText("""
            <?xml version="1.0" encoding="utf-8"?>
            <network-security-config>
                <base-config cleartextTrafficPermitted="false">
                    <trust-anchors><certificates src="system" /></trust-anchors>
                </base-config>
                $exception
            </network-security-config>
        """.trimIndent())
    }
}

// 可外置保管的发布签名：keystore 与密码不进入仓库。
val keystorePropertiesFile = rootProject.file(System.getenv("PANDORA_KEY_PROPERTIES") ?: "key.properties")
val keystoreProperties = Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

if (gradle.startParameter.taskNames.any { it.contains("release", ignoreCase = true) }
    && !keystorePropertiesFile.exists()) {
    throw GradleException("Release requires external signing properties: set PANDORA_KEY_PROPERTIES.")
}

// Flutter's --dart-define is also used by Gradle so Android permits precisely the
// same HTTP host as the Dart client. Generated resources stay outside source control.
val demoApiUrl = providers.gradleProperty("dart-defines").orNull
    ?.split(",")
    ?.map { String(Base64.getDecoder().decode(it), Charsets.UTF_8) }
    ?.firstOrNull { it.startsWith("API_BASE_URL=") }
    ?.substringAfter("=")
    ?: "https://8.141.96.122:6644/api/v1"
val demoApiUri = URI(demoApiUrl.trim().trimEnd('/'))
if (demoApiUri.scheme !in listOf("http", "https") || demoApiUri.host.isNullOrBlank()
    || demoApiUri.rawUserInfo != null || demoApiUri.rawQuery != null
    || demoApiUri.rawFragment != null || demoApiUri.path != "/api/v1") {
    throw GradleException("API_BASE_URL must be http(s)://host[:port]/api/v1 without credentials, query or fragment.")
}
val generateDemoNetworkConfig = tasks.register<DemoNetworkConfigTask>("generateDemoNetworkConfig") {
    apiBaseUrl.set(demoApiUrl)
    outputDirectory.set(layout.buildDirectory.dir("generated/demoNetwork/res"))
}

android {
    namespace = "cn.pandora.employee.flutter"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "cn.pandora.employee.flutter"
        // 首轮支持 Android 8.0 / API 26 起；目标 SDK 跟随当前 Flutter stable（至少 API 36）。
        minSdk = 26
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        if (keystorePropertiesFile.exists()) {
            create("release") {
                keyAlias = keystoreProperties["keyAlias"] as String
                keyPassword = keystoreProperties["keyPassword"] as String
                storeFile = file(keystoreProperties["storeFile"] as String)
                storePassword = keystoreProperties["storePassword"] as String
            }
        }
    }

    buildTypes {
        debug {
            // 与旧套壳 cn.pandora.mobile.debug 及正式包共存。
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-dev"
        }
        release {
            signingConfig = if (keystorePropertiesFile.exists()) {
                signingConfigs.getByName("release")
            } else {
                null
            }
            // 代码压缩/资源裁剪由 Flutter Gradle 插件按 release 规则开启；
            // 这里不再关闭 minify，否则 shrinkResources 会与之冲突。
        }
    }
}

androidComponents.onVariants(androidComponents.selector().withBuildType("debug")) { variant ->
    variant.sources.res?.addGeneratedSourceDirectory(generateDemoNetworkConfig) { it.outputDirectory }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
