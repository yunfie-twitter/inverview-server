package xyz.tsub4sa.invidiousclient

import fi.iki.elonen.NanoHTTPD
import okhttp3.Headers
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response as OkHttpResponse
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URL
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

private const val PRIMARY_COMPANION_UPSTREAM = "https://companion.tsub4sa.xyz"
private const val FALLBACK_COMPANION_UPSTREAM = "https://proxy.tsub4sa.xyz"

private fun firstNonBlank(vararg values: String?): String {
    for (value in values) {
        if (!value.isNullOrBlank()) return value.trim()
    }
    return ""
}

data class ProxyConfig(
    val apiProxyUpstream: String = "https://invidious.tsub4sa.xyz",
    val companionUpstream: String = firstNonBlank(PRIMARY_COMPANION_UPSTREAM, FALLBACK_COMPANION_UPSTREAM),
    val companionSecret: String = "",
)

data class TvCommand(
    val id: String,
    val videoId: String,
    val sentAt: Long,
)

data class TvSession(
    val id: String,
    val createdAt: Long,
    var updatedAt: Long,
    var lastCommand: TvCommand?,
)

class LocalProxyServer(
    port: Int = 8282,
    private var config: ProxyConfig = ProxyConfig(),
) : NanoHTTPD("127.0.0.1", port) {
    private val httpClient = OkHttpClient()
    private val tvSessions = ConcurrentHashMap<String, TvSession>()
    private val sessionTtlMs = 1000L * 60L * 60L * 6L

    fun updateConfig(next: ProxyConfig) {
        config = next
    }

    override fun serve(session: IHTTPSession): Response {
        if (session.method == Method.OPTIONS) {
            return corsResponse(newFixedLengthResponse(Response.Status.NO_CONTENT, "text/plain", ""))
        }

        return try {
            when {
                session.uri.startsWith("/api-proxy") -> forwardUpstream(session, config.apiProxyUpstream, stripPrefix(session.uri, "/api-proxy"), false)
                session.uri.startsWith("/companion") -> forwardUpstream(session, config.companionUpstream, session.uri, true)
                session.uri == "/health" -> corsResponse(newFixedLengthResponse(Response.Status.OK, "application/json", """{"status":"ok"}"""))
                session.uri == "/tv-sync/session" && (session.method == Method.POST || session.method == Method.GET) -> handleCreateSession()
                session.uri.startsWith("/tv-sync/session/") && session.uri.endsWith("/command") && session.method == Method.POST -> handlePostCommand(session)
                session.uri.startsWith("/tv-sync/session/") && session.uri.endsWith("/command") && session.method == Method.GET -> handleGetCommand(session)
                else -> corsResponse(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"not_found"}"""))
            }
        } catch (_: Exception) {
            corsResponse(newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "application/json", """{"error":"internal_error"}"""))
        }
    }

    private fun forwardUpstream(session: IHTTPSession, upstreamBase: String, path: String, withCompanionAuth: Boolean): Response {
        val upstream = buildUrl(upstreamBase, path, session.queryParameterString.orEmpty())
        val bodyBytes = readBodyBytes(session.inputStream)

        val requestBuilder = Request.Builder().url(upstream)
        requestBuilder.method(session.method.name, buildRequestBody(session, bodyBytes))

        val headers = session.headers
        headers["content-type"]?.let { requestBuilder.header("Content-Type", it) }
        headers["accept"]?.let { requestBuilder.header("Accept", it) }
        headers["range"]?.let { requestBuilder.header("Range", it) }
        headers["user-agent"]?.let { requestBuilder.header("User-Agent", it) }
        headers["authorization"]?.let { requestBuilder.header("Authorization", it) }
        if (withCompanionAuth && config.companionSecret.isNotBlank()) {
            requestBuilder.header("Authorization", "Bearer ${config.companionSecret}")
        }

        val response = httpClient.newCall(requestBuilder.build()).execute()
        return toNanoResponse(response)
    }

    private fun toNanoResponse(response: OkHttpResponse): Response {
        val status = Response.Status.lookup(response.code) ?: Response.Status.OK
        val bodyBytes = response.body?.bytes() ?: ByteArray(0)
        val contentType = response.header("Content-Type") ?: "application/octet-stream"
        val nanoResponse = newFixedLengthResponse(status, contentType, bodyBytes.inputStream(), bodyBytes.size.toLong())

        copyHeaderIfPresent(response.headers, nanoResponse, "Content-Type")
        copyHeaderIfPresent(response.headers, nanoResponse, "Content-Length")
        copyHeaderIfPresent(response.headers, nanoResponse, "Content-Range")
        copyHeaderIfPresent(response.headers, nanoResponse, "Accept-Ranges")
        copyHeaderIfPresent(response.headers, nanoResponse, "Cache-Control")
        copyHeaderIfPresent(response.headers, nanoResponse, "ETag")
        copyHeaderIfPresent(response.headers, nanoResponse, "Last-Modified")

        return corsResponse(nanoResponse)
    }

    private fun copyHeaderIfPresent(headers: Headers, response: NanoHTTPD.Response, name: String) {
        headers[name]?.let { response.addHeader(name, it) }
    }

    private fun corsResponse(response: Response): Response {
        response.addHeader("Access-Control-Allow-Origin", "*")
        response.addHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
        response.addHeader("Access-Control-Allow-Headers", "Authorization,Content-Type,Range,Accept,Origin,User-Agent")
        response.addHeader("Access-Control-Expose-Headers", "Content-Length,Content-Range,Accept-Ranges")
        return response
    }

    private fun handleCreateSession(): Response {
        cleanupExpiredSessions()
        val id = UUID.randomUUID().toString()
        val now = System.currentTimeMillis()
        tvSessions[id] = TvSession(id = id, createdAt = now, updatedAt = now, lastCommand = null)
        return corsResponse(newFixedLengthResponse(Response.Status.OK, "application/json", """{"sessionId":"$id","expiresInMs":$sessionTtlMs}"""))
    }

    private fun handlePostCommand(session: IHTTPSession): Response {
        cleanupExpiredSessions()
        val sessionId = extractSessionId(session.uri) ?: return corsResponse(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", """{"error":"invalid_session_id"}"""))
        val target = tvSessions[sessionId] ?: return corsResponse(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"session_not_found"}"""))
        val body = readBodyBytes(session.inputStream).decodeToString()
        val videoId = extractVideoIdFromJson(body)
        if (videoId.isBlank()) return corsResponse(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", """{"error":"video_id_required"}"""))

        val command = TvCommand(id = UUID.randomUUID().toString(), videoId = videoId, sentAt = System.currentTimeMillis())
        target.lastCommand = command
        target.updatedAt = System.currentTimeMillis()
        return corsResponse(newFixedLengthResponse(Response.Status.OK, "application/json", """{"ok":true,"commandId":"${command.id}"}"""))
    }

    private fun handleGetCommand(session: IHTTPSession): Response {
        cleanupExpiredSessions()
        val sessionId = extractSessionId(session.uri) ?: return corsResponse(newFixedLengthResponse(Response.Status.BAD_REQUEST, "application/json", """{"error":"invalid_session_id"}"""))
        val target = tvSessions[sessionId] ?: return corsResponse(newFixedLengthResponse(Response.Status.NOT_FOUND, "application/json", """{"error":"session_not_found"}"""))
        val after = session.parameters["after"]?.firstOrNull().orEmpty()
        val command = target.lastCommand
        if (command == null || command.id == after) {
            return corsResponse(newFixedLengthResponse(Response.Status.OK, "application/json", """{"hasCommand":false}"""))
        }
        return corsResponse(
            newFixedLengthResponse(
                Response.Status.OK,
                "application/json",
                """{"hasCommand":true,"command":{"id":"${command.id}","videoId":"${command.videoId}","sentAt":${command.sentAt}}}""",
            ),
        )
    }

    private fun cleanupExpiredSessions() {
        val now = System.currentTimeMillis()
        tvSessions.entries.removeIf { now - it.value.updatedAt > sessionTtlMs }
    }

    private fun extractSessionId(uri: String): String? {
        val parts = uri.split("/")
        val idx = parts.indexOf("session")
        if (idx < 0 || idx + 1 >= parts.size) return null
        return parts[idx + 1]
    }

    private fun extractVideoIdFromJson(json: String): String {
        val pattern = """"videoId"\s*:\s*"([^"]+)"""".toRegex()
        return pattern.find(json)?.groupValues?.getOrNull(1)?.trim().orEmpty()
    }

    private fun buildUrl(base: String, path: String, rawQuery: String): String {
        val normalizedBase = if (base.endsWith("/")) base.dropLast(1) else base
        val normalizedPath = if (path.startsWith("/")) path else "/$path"
        val url = URL("$normalizedBase$normalizedPath")
        return if (rawQuery.isBlank()) url.toString() else "${url}?$rawQuery"
    }

    private fun stripPrefix(value: String, prefix: String): String {
        val stripped = value.removePrefix(prefix)
        return if (stripped.startsWith("/")) stripped else "/$stripped"
    }

    private fun buildRequestBody(session: IHTTPSession, body: ByteArray): okhttp3.RequestBody? {
        if (session.method == Method.GET || session.method == Method.HEAD || session.method == Method.OPTIONS) return null
        val contentType = session.headers["content-type"]?.toMediaTypeOrNull()
        return body.toRequestBody(contentType)
    }

    private fun readBodyBytes(input: InputStream): ByteArray {
        val output = ByteArrayOutputStream()
        val buffer = ByteArray(8 * 1024)
        while (true) {
            val read = input.read(buffer)
            if (read <= 0) break
            output.write(buffer, 0, read)
        }
        return output.toByteArray()
    }
}
