package xyz.tsub4sa.invidiousclient

import android.util.Log
import fi.iki.elonen.NanoHTTPD

object NativeProxyManager {
    private const val TAG = "NativeProxyManager"
    private var server: LocalProxyServer? = null
    private var port: Int = 8282

    @Synchronized
    fun start(config: ProxyConfig = ProxyConfig(), listenPort: Int = 8282): Boolean {
        return try {
            if (server == null || port != listenPort) {
                stop()
                server = LocalProxyServer(port = listenPort, config = config)
                port = listenPort
                server?.start(NanoHTTPD.SOCKET_READ_TIMEOUT, false)
            } else {
                server?.updateConfig(config)
            }
            true
        } catch (error: Exception) {
            Log.e(TAG, "Failed to start local proxy server", error)
            false
        }
    }

    @Synchronized
    fun stop() {
        try {
            server?.stop()
        } catch (error: Exception) {
            Log.e(TAG, "Failed to stop local proxy server", error)
        } finally {
            server = null
        }
    }

    @Synchronized
    fun isRunning(): Boolean = server != null
}
