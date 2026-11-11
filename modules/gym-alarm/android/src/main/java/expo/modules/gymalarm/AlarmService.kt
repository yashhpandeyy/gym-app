package expo.modules.gymalarm

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.widget.Toast

/**
 * Rings an alarm the way the phone's clock does: the alarm sound on the alarm volume, looping, with a
 * repeating buzz, until someone presses Stop or Snooze (or ten minutes pass). It runs as a foreground
 * service so Android doesn't cut it off, and its notification brings up the full-screen alarm.
 */
class AlarmService : Service() {
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wakeLock: PowerManager.WakeLock? = null
  // An AudioFocusRequest on Android 8 and later. Kept untyped so older phones never load the class.
  private var focus: Any? = null
  private val handler = Handler(Looper.getMainLooper())

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_RING -> {
        val spec = AlarmSpec.fromIntent(intent)
        if (spec == null) stopSelf() else ring(spec)
      }
      ACTION_STOP -> finish(intent, false)
      ACTION_SNOOZE -> finish(intent, true)
      else -> if (ringing == null) stopSelf()
    }
    return START_NOT_STICKY
  }

  private fun ring(spec: AlarmSpec) {
    val notification = AlarmNotifications.ringing(this, spec)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(AlarmNotifications.RINGING_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
      } else {
        startForeground(AlarmNotifications.RINGING_ID, notification)
      }
    } catch (e: Exception) {
      // Android won't let it run in the foreground right now: the notification rings by itself instead.
      AlarmNotifications.postBackup(this, spec)
      stopSelf()
      return
    }
    silence()
    ringing = spec
    acquireWakeLock()
    startSound()
    startVibration()
    // If the app is on screen the alarm opens straight away; on a locked phone the notification opens it.
    AlarmActivity.show(this, spec)
    handler.postDelayed({ timeOut() }, RING_MINUTES * 60_000L)
  }

  private fun finish(intent: Intent?, snooze: Boolean) {
    val spec = ringing ?: AlarmSpec.fromIntent(intent)
    silence()
    if (snooze && spec != null) {
      AlarmScheduler.snooze(this, spec)
      Toast.makeText(this, "Snoozed for " + SNOOZE_MINUTES + " minutes", Toast.LENGTH_SHORT).show()
    }
    AlarmNotifications.cancelRinging(this)
    AlarmActivity.close()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun timeOut() {
    val spec = ringing
    silence()
    if (spec != null) AlarmNotifications.missed(this, spec)
    AlarmNotifications.cancelRinging(this)
    AlarmActivity.close()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun startSound() {
    val attrs = AlarmNotifications.alarmAudio()
    val audio = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      // Music and videos pause while the alarm rings.
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT).setAudioAttributes(attrs).build()
      audio.requestAudioFocus(request)
      focus = request
    }
    player = play(AlarmNotifications.soundUri(this))
      ?: play(RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM))
      ?: play(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM))
  }

  private fun play(uri: Uri?): MediaPlayer? {
    if (uri == null) return null
    val p = MediaPlayer()
    return try {
      p.setAudioAttributes(AlarmNotifications.alarmAudio())
      p.setDataSource(this, uri)
      p.isLooping = true
      p.prepare()
      p.start()
      p
    } catch (e: Exception) {
      p.release()
      null
    }
  }

  @Suppress("DEPRECATION")
  private fun startVibration() {
    val v: Vibrator =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
      } else {
        getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
    if (!v.hasVibrator()) return
    val pattern = longArrayOf(0, 800, 600)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      v.vibrate(VibrationEffect.createWaveform(pattern, 0), AlarmNotifications.alarmAudio())
    } else {
      v.vibrate(pattern, 0, AlarmNotifications.alarmAudio())
    }
    vibrator = v
  }

  private fun acquireWakeLock() {
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    val lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "gymalarm:ringing")
    lock.setReferenceCounted(false)
    lock.acquire(RING_MINUTES * 60_000L + 30_000L)
    wakeLock = lock
  }

  private fun silence() {
    handler.removeCallbacksAndMessages(null)
    player?.let {
      try {
        it.stop()
      } catch (e: Exception) {
        // Already stopped.
      }
      it.release()
    }
    player = null
    vibrator?.cancel()
    vibrator = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      (focus as? AudioFocusRequest)?.let { (getSystemService(Context.AUDIO_SERVICE) as AudioManager).abandonAudioFocusRequest(it) }
    }
    focus = null
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
    ringing = null
  }

  override fun onDestroy() {
    silence()
    super.onDestroy()
  }

  companion object {
    /** The alarm ringing right now, if any. */
    @Volatile
    internal var ringing: AlarmSpec? = null

    internal fun intent(ctx: Context, action: String, spec: AlarmSpec?): Intent {
      val i = Intent(ctx, AlarmService::class.java).setAction(action)
      spec?.into(i)
      return i
    }

    /** Starts ringing. If Android refuses a foreground start, the notification rings on its own. */
    internal fun ring(ctx: Context, spec: AlarmSpec) {
      val i = intent(ctx, ACTION_RING, spec)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
      } catch (e: Exception) {
        AlarmNotifications.postBackup(ctx, spec)
      }
    }
  }
}
