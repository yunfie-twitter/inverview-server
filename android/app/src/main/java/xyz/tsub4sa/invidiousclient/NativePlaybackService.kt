package xyz.tsub4sa.invidiousclient

import android.app.PendingIntent
import android.content.Intent
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

@UnstableApi
class NativePlaybackService : MediaSessionService() {
    private var player: ExoPlayer? = null
    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val exoPlayer = ExoPlayer.Builder(this).build()
        val sessionIntent = packageManager.getLaunchIntentForPackage(packageName)
        val sessionActivity = sessionIntent?.let {
            PendingIntent.getActivity(
                this,
                0,
                it,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
        }

        player = exoPlayer
        val builder = MediaSession.Builder(this, exoPlayer)
        if (sessionActivity != null) {
            builder.setSessionActivity(sessionActivity)
        }
        mediaSession = builder.build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val exoPlayer = player ?: return START_NOT_STICKY
        when (intent?.action) {
            ACTION_SYNC -> {
                val enabled = intent.getBooleanExtra(EXTRA_ENABLED, false)
                if (!enabled) {
                    stopPlaybackAndSelf()
                    return START_NOT_STICKY
                }

                val url = intent.getStringExtra(EXTRA_URL)
                val title = intent.getStringExtra(EXTRA_TITLE)
                val artist = intent.getStringExtra(EXTRA_ARTIST)
                val playing = intent.getBooleanExtra(EXTRA_PLAYING, false)
                val positionMs = intent.getLongExtra(EXTRA_POSITION_MS, 0L).coerceAtLeast(0L)

                if (!url.isNullOrBlank()) {
                    val mediaItem = MediaItem.Builder()
                        .setUri(url)
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(title ?: "InverView")
                                .setArtist(artist ?: "")
                                .build(),
                        )
                        .build()

                    val currentUri = exoPlayer.currentMediaItem?.localConfiguration?.uri?.toString()
                    if (currentUri != url) {
                        exoPlayer.setMediaItem(mediaItem)
                        exoPlayer.prepare()
                    } else if (!exoPlayer.isCommandAvailable(androidx.media3.common.Player.COMMAND_GET_CURRENT_MEDIA_ITEM)) {
                        exoPlayer.setMediaItem(mediaItem)
                        exoPlayer.prepare()
                    }
                }

                if (positionMs > 0 && kotlin.math.abs(exoPlayer.currentPosition - positionMs) > 1500L) {
                    exoPlayer.seekTo(positionMs)
                }
                exoPlayer.playWhenReady = playing
            }

            ACTION_PLAY -> exoPlayer.play()
            ACTION_PAUSE -> exoPlayer.pause()
            ACTION_STOP -> {
                stopPlaybackAndSelf()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        stopPlaybackAndSelf()
        super.onTaskRemoved(rootIntent)
    }

    private fun stopPlaybackAndSelf() {
        player?.stop()
        stopSelf()
    }

    override fun onDestroy() {
        mediaSession?.run {
            release()
        }
        mediaSession = null
        player?.release()
        player = null
        super.onDestroy()
    }

    companion object {
        const val ACTION_SYNC = "xyz.tsub4sa.invidiousclient.action.PLAYBACK_SYNC"
        const val ACTION_PLAY = "xyz.tsub4sa.invidiousclient.action.PLAYBACK_PLAY"
        const val ACTION_PAUSE = "xyz.tsub4sa.invidiousclient.action.PLAYBACK_PAUSE"
        const val ACTION_STOP = "xyz.tsub4sa.invidiousclient.action.PLAYBACK_STOP"

        const val EXTRA_ENABLED = "enabled"
        const val EXTRA_URL = "url"
        const val EXTRA_TITLE = "title"
        const val EXTRA_ARTIST = "artist"
        const val EXTRA_PLAYING = "playing"
        const val EXTRA_POSITION_MS = "position_ms"
    }
}
