package com.kvflive.tv

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private var player: ExoPlayer? = null
    private var goLiveButton: Button? = null
    private val uiHandler = Handler(Looper.getMainLooper())
    private var liveEdgeRunnable: Runnable? = null
    private var hideUiRunnable: Runnable? = null

    private val defaultStreamUrl =
        "https://w-live-edge2.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8"
    private val liveEdgeToleranceSec = 30.0
    private val uiIdleMs = 4000L
    private val liveEdgeSyncMs = 5000L

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val playerView = findViewById<PlayerView>(R.id.playerView)
        val statusView = findViewById<TextView>(R.id.statusView)
        goLiveButton = findViewById(R.id.goLiveButton)
        val streamUrl = loadStreamUrlFromSharedConfig()

        goLiveButton?.setOnClickListener {
            snapToLiveEdge()
            onUserInteractionDetected()
        }
        goLiveButton?.alpha = 0f
        goLiveButton?.visibility = View.INVISIBLE

        player = ExoPlayer.Builder(this).build().also { exoPlayer ->
            playerView.player = exoPlayer
            exoPlayer.setMediaItem(MediaItem.fromUri(streamUrl))
            exoPlayer.prepare()
            exoPlayer.playWhenReady = true
            exoPlayer.addListener(
                object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        statusView.text = when (playbackState) {
                            Player.STATE_BUFFERING -> "Buffering..."
                            Player.STATE_READY -> {
                                startLiveEdgeSync()
                                "Live"
                            }
                            Player.STATE_ENDED -> "Playback ended"
                            else -> "Starting stream..."
                        }
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        stopLiveEdgeSync()
                        statusView.text = "Stream error"
                    }
                }
            )
        }
    }

    private fun onUserInteractionDetected() {
        showGoLiveButtonTemporarily()
    }

    private fun showGoLiveButtonTemporarily() {
        goLiveButton?.let { btn ->
            btn.visibility = View.VISIBLE
            btn.animate().cancel()
            btn.animate().alpha(1f).setDuration(120).start()
            hideUiRunnable?.let { uiHandler.removeCallbacks(it) }
            hideUiRunnable = Runnable {
                btn.animate().alpha(0f).setDuration(600).withEndAction {
                    btn.visibility = View.INVISIBLE
                }.start()
            }
            uiHandler.postDelayed(hideUiRunnable!!, uiIdleMs)
        }
    }

    private fun startLiveEdgeSync() {
        stopLiveEdgeSync()
        liveEdgeRunnable = object : Runnable {
            override fun run() {
                val exoPlayer = player
                if (exoPlayer != null && exoPlayer.isPlaying) {
                    val liveOffsetMs = exoPlayer.currentLiveOffset
                    if (liveOffsetMs > 0 && liveOffsetMs / 1000.0 > liveEdgeToleranceSec) {
                        exoPlayer.seekToDefaultPosition()
                    }
                }
                uiHandler.postDelayed(this, liveEdgeSyncMs)
            }
        }
        uiHandler.postDelayed(liveEdgeRunnable!!, liveEdgeSyncMs)
    }

    private fun stopLiveEdgeSync() {
        liveEdgeRunnable?.let { uiHandler.removeCallbacks(it) }
        liveEdgeRunnable = null
    }

    private fun snapToLiveEdge() {
        player?.seekToDefaultPosition()
    }

    private fun loadStreamUrlFromSharedConfig(): String {
        return try {
            assets.open("shared/app-config.json").bufferedReader().use { reader ->
                val json = JSONObject(reader.readText())
                json.optString("streamUrl", defaultStreamUrl).ifBlank { defaultStreamUrl }
            }
        } catch (_: Exception) {
            defaultStreamUrl
        }
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            onUserInteractionDetected()
        }
        return super.dispatchKeyEvent(event)
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        onUserInteractionDetected()
        return super.dispatchTouchEvent(ev)
    }

    override fun onStop() {
        super.onStop()
        stopLiveEdgeSync()
        hideUiRunnable?.let { uiHandler.removeCallbacks(it) }
        player?.release()
        player = null
    }
}
