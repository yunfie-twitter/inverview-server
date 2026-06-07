package xyz.tsub4sa.invidiousclient

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
@CapacitorPlugin(name = "NativePlayback")
class NativePlaybackPlugin : Plugin() {
    @PluginMethod
    fun setPlaybackState(call: PluginCall) {
        val playing = call.getBoolean("playing") ?: false
        val autoPip = call.getBoolean("autoEnterPipOnBackground")
        val backgroundPlaybackEnabled = call.getBoolean("backgroundPlaybackEnabled")
        NativePlaybackManager.setPlaybackState(playing, autoPip, backgroundPlaybackEnabled)

        val payload = JSObject()
        payload.put("ok", true)
        call.resolve(payload)
    }

    @PluginMethod
    fun setNowPlaying(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        val title = call.getString("title")
        val artist = call.getString("artist")
        val playbackUrl = call.getString("playbackUrl")
        val positionSeconds = call.getDouble("positionSeconds")
        val playing = call.getBoolean("playing")

        NativePlaybackManager.setNowPlaying(
            enabled = enabled,
            title = title,
            artist = artist,
            playbackUrl = playbackUrl,
            positionSeconds = positionSeconds,
            playing = playing,
        )

        val payload = JSObject()
        payload.put("ok", true)
        call.resolve(payload)
    }

    @PluginMethod
    fun enterPictureInPicture(call: PluginCall) {
        val activity = activity
        if (activity == null) {
            val payload = JSObject()
            payload.put("ok", false)
            payload.put("error", "activity_unavailable")
            call.resolve(payload)
            return
        }

        val ok = NativePlaybackManager.tryEnterPip(activity)
        val payload = JSObject()
        payload.put("ok", ok)
        if (!ok) {
            payload.put("error", "pip_not_supported")
        }
        call.resolve(payload)
    }

    @PluginMethod
    fun supportsPictureInPicture(call: PluginCall) {
        val activity = activity
        val supported = activity != null && NativePlaybackManager.canEnterPip(activity)

        val payload = JSObject()
        payload.put("supported", supported)
        call.resolve(payload)
    }
}
