package xyz.tsub4sa.invidiousclient

import android.app.Activity
import android.app.PictureInPictureParams
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Rational
import androidx.core.content.ContextCompat

object NativePlaybackManager {
    @Volatile
    private var isPlaying: Boolean = false

    @Volatile
    private var autoEnterPipOnBackground: Boolean = true

    @Volatile
    private var backgroundPlaybackEnabled: Boolean = true

    private var appContext: Context? = null
    private var lastEnabled: Boolean = false
    private var lastTitle: String? = null
    private var lastArtist: String? = null
    private var lastPlaybackUrl: String? = null
    private var lastPositionMs: Long = 0L

    fun initialize(context: Context) {
        appContext = context.applicationContext
    }

    fun setPlaybackState(playing: Boolean, autoPip: Boolean?, backgroundPlayback: Boolean?) {
        isPlaying = playing
        if (autoPip != null) autoEnterPipOnBackground = autoPip
        if (backgroundPlayback != null) backgroundPlaybackEnabled = backgroundPlayback
        syncService()
    }

    fun setNowPlaying(
        enabled: Boolean,
        title: String?,
        artist: String?,
        playbackUrl: String?,
        positionSeconds: Double?,
        playing: Boolean?,
    ) {
        lastEnabled = enabled
        lastTitle = title
        lastArtist = artist
        if (!playbackUrl.isNullOrBlank()) {
            lastPlaybackUrl = playbackUrl
        }
        if (positionSeconds != null && positionSeconds.isFinite() && positionSeconds >= 0.0) {
            lastPositionMs = (positionSeconds * 1000).toLong()
        }
        if (playing != null) {
            isPlaying = playing
        }
        syncService()
    }

    fun clearNowPlaying() {
        lastEnabled = false
        isPlaying = false
        stopService()
    }

    fun canEnterPip(activity: Activity): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        return activity.packageManager.hasSystemFeature("android.software.picture_in_picture")
    }

    fun tryEnterPip(activity: Activity): Boolean {
        if (!canEnterPip(activity)) return false
        val params = PictureInPictureParams.Builder()
            .setAspectRatio(Rational(16, 9))
            .build()
        activity.enterPictureInPictureMode(params)
        return true
    }

    fun shouldAutoEnterPip(): Boolean = autoEnterPipOnBackground && isPlaying

    private fun syncService() {
        val context = appContext ?: return
        if (!lastEnabled || !backgroundPlaybackEnabled || lastPlaybackUrl.isNullOrBlank()) {
            stopService()
            return
        }

        val intent = Intent(context, NativePlaybackService::class.java).apply {
            action = NativePlaybackService.ACTION_SYNC
            putExtra(NativePlaybackService.EXTRA_ENABLED, true)
            putExtra(NativePlaybackService.EXTRA_URL, lastPlaybackUrl)
            putExtra(NativePlaybackService.EXTRA_TITLE, lastTitle)
            putExtra(NativePlaybackService.EXTRA_ARTIST, lastArtist)
            putExtra(NativePlaybackService.EXTRA_PLAYING, isPlaying)
            putExtra(NativePlaybackService.EXTRA_POSITION_MS, lastPositionMs)
        }
        ContextCompat.startForegroundService(context, intent)
    }

    private fun stopService() {
        val context = appContext ?: return
        val intent = Intent(context, NativePlaybackService::class.java).apply {
            action = NativePlaybackService.ACTION_STOP
        }
        context.startService(intent)
    }
}
