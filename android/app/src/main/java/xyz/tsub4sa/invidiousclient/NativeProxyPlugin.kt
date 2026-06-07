package xyz.tsub4sa.invidiousclient

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeProxy")
class NativeProxyPlugin : Plugin() {
    private val primaryCompanionUpstream = "https://companion.tsub4sa.xyz"
    private val fallbackCompanionUpstream = "https://proxy.tsub4sa.xyz"

    private fun firstNonBlank(vararg values: String?): String {
        for (value in values) {
            if (!value.isNullOrBlank()) return value.trim()
        }
        return ""
    }

    @PluginMethod
    fun start(call: PluginCall) {
        val apiProxyUpstream = call.getString("apiProxyUpstream") ?: "https://invidious.tsub4sa.xyz"
        val companionUpstream = firstNonBlank(
            call.getString("companionUpstream"),
            primaryCompanionUpstream,
            fallbackCompanionUpstream,
        )
        val companionSecret = call.getString("companionSecret") ?: ""
        val port = call.getInt("port") ?: 8282

        val ok = NativeProxyManager.start(
            ProxyConfig(
                apiProxyUpstream = apiProxyUpstream,
                companionUpstream = companionUpstream,
                companionSecret = companionSecret,
            ),
            port,
        )

        val payload = JSObject()
        payload.put("ok", ok)
        payload.put("running", NativeProxyManager.isRunning())
        payload.put("port", port)
        if (!ok) {
            payload.put("error", "failed_to_start")
        }
        call.resolve(payload)
    }

    @PluginMethod
    fun stop(call: PluginCall) {
        NativeProxyManager.stop()
        val payload = JSObject()
        payload.put("ok", true)
        payload.put("running", NativeProxyManager.isRunning())
        call.resolve(payload)
    }

    @PluginMethod
    fun status(call: PluginCall) {
        val payload = JSObject()
        payload.put("running", NativeProxyManager.isRunning())
        call.resolve(payload)
    }
}
