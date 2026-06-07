package xyz.tsub4sa.invidiousclient

import android.os.Bundle
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    private val primaryCompanionUpstream = "https://companion.tsub4sa.xyz"
    private val fallbackCompanionUpstream = "https://proxy.tsub4sa.xyz"
    private fun firstNonBlank(vararg values: String?): String {
        for (value in values) {
            if (!value.isNullOrBlank()) return value.trim()
        }
        return ""
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(NativeProxyPlugin::class.java)
        registerPlugin(NativePlaybackPlugin::class.java)
        super.onCreate(savedInstanceState)
        NativePlaybackManager.initialize(applicationContext)

        NativeProxyManager.start(
            ProxyConfig(
                apiProxyUpstream = "https://invidious.tsub4sa.xyz",
                companionUpstream = firstNonBlank(primaryCompanionUpstream, fallbackCompanionUpstream),
                companionSecret = "",
            ),
            8282,
        )
    }

    override fun onUserLeaveHint() {
        super.onUserLeaveHint()
        if (NativePlaybackManager.shouldAutoEnterPip()) {
            NativePlaybackManager.tryEnterPip(this)
        }
    }

    override fun onDestroy() {
        NativePlaybackManager.clearNowPlaying()
        NativeProxyManager.stop()
        super.onDestroy()
    }
}
