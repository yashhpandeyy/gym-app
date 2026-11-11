package expo.modules.gymalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.text.format.DateFormat
import java.util.Date

/**
 * The notifications an alarm shows. While it rings, Android turns the "ringing" notification into the
 * full-screen alarm on a locked phone, or a card with Stop and Snooze on a phone that's in use.
 */
internal object AlarmNotifications {
  const val RINGING_ID = 7301
  const val BACKUP_ID = 7302
  const val MISSED_ID = 7303

  private const val CH_RINGING = "gym_alarm_ringing"
  private const val CH_BACKUP = "gym_alarm_backup"
  private const val CH_MISSED = "gym_alarm_missed"

  private fun manager(ctx: Context) = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  fun alarmAudio(): AudioAttributes =
    AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()

  fun soundUri(ctx: Context): Uri = Uri.parse("android.resource://" + ctx.packageName + "/" + R.raw.gym_alarm)

  fun appName(ctx: Context): String = ctx.applicationInfo.loadLabel(ctx.packageManager).toString()

  fun timeNow(ctx: Context): String = DateFormat.getTimeFormat(ctx).format(Date())

  fun ensureChannels(ctx: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = manager(ctx)
    // The ringing sound comes from the alarm itself, so this channel stays silent and doesn't buzz twice.
    val ringing = NotificationChannel(CH_RINGING, "Ringing alarms", NotificationManager.IMPORTANCE_HIGH)
    ringing.description = "The alarm on screen, with Stop and Snooze"
    ringing.setSound(null, null)
    ringing.enableVibration(false)
    ringing.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    ringing.setShowBadge(false)
    nm.createNotificationChannel(ringing)

    val backup = NotificationChannel(CH_BACKUP, "Alarms (backup)", NotificationManager.IMPORTANCE_HIGH)
    backup.description = "Used when the phone won't let the alarm start by itself"
    backup.setSound(soundUri(ctx), alarmAudio())
    backup.enableVibration(true)
    backup.vibrationPattern = longArrayOf(0, 800, 600, 800, 600, 800)
    backup.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    nm.createNotificationChannel(backup)

    val missed = NotificationChannel(CH_MISSED, "Missed alarms", NotificationManager.IMPORTANCE_DEFAULT)
    missed.setSound(null, null)
    nm.createNotificationChannel(missed)
  }

  @Suppress("DEPRECATION")
  private fun builder(ctx: Context, channel: String): Notification.Builder =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(ctx, channel) else Notification.Builder(ctx)

  private fun action(ctx: Context, title: String, act: String, spec: AlarmSpec, code: Int): Notification.Action {
    val intent = spec.into(Intent(ctx, AlarmReceiver::class.java).setAction(act))
    val pi = PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    return Notification.Action.Builder(Icon.createWithResource(ctx, R.drawable.gym_alarm_small), title, pi).build()
  }

  private fun fullScreen(ctx: Context, spec: AlarmSpec): PendingIntent =
    PendingIntent.getActivity(ctx, 11, AlarmActivity.intent(ctx, spec), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  @Suppress("DEPRECATION")
  private fun alarmBuilder(ctx: Context, channel: String, spec: AlarmSpec): Notification.Builder {
    val full = fullScreen(ctx, spec)
    val b = builder(ctx, channel)
      .setSmallIcon(R.drawable.gym_alarm_small)
      .setContentTitle(spec.label)
      .setContentText(appName(ctx) + " alarm, " + timeNow(ctx))
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setColor(AlarmStore.color(ctx))
      .setOngoing(true)
      .setAutoCancel(false)
      .setShowWhen(false)
      .setContentIntent(full)
      .setFullScreenIntent(full, true)
      .addAction(action(ctx, "Snooze " + SNOOZE_MINUTES + " min", ACTION_SNOOZE, spec, 12))
      .addAction(action(ctx, "Stop", ACTION_STOP, spec, 13))
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) b.setPriority(Notification.PRIORITY_MAX)
    return b
  }

  /** The notification the ringing alarm runs under. */
  fun ringing(ctx: Context, spec: AlarmSpec): Notification {
    ensureChannels(ctx)
    return alarmBuilder(ctx, CH_RINGING, spec).build()
  }

  /**
   * When Android won't let the alarm start its ringing service (it was scheduled inexactly), the
   * notification rings by itself instead, repeating its sound until it's stopped.
   */
  @Suppress("DEPRECATION")
  fun postBackup(ctx: Context, spec: AlarmSpec) {
    ensureChannels(ctx)
    val b = alarmBuilder(ctx, CH_BACKUP, spec)
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      b.setSound(soundUri(ctx), alarmAudio())
      b.setVibrate(longArrayOf(0, 800, 600, 800, 600, 800))
    }
    val n = b.build()
    n.flags = n.flags or Notification.FLAG_INSISTENT
    try {
      manager(ctx).notify(BACKUP_ID, n)
    } catch (e: SecurityException) {
      // Notifications are switched off for the app; nothing more we can do.
    }
  }

  fun missed(ctx: Context, spec: AlarmSpec) {
    ensureChannels(ctx)
    val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
    val b = builder(ctx, CH_MISSED)
      .setSmallIcon(R.drawable.gym_alarm_small)
      .setContentTitle("Missed alarm: " + spec.label)
      .setContentText("It rang for " + RING_MINUTES + " minutes and nobody stopped it.")
      .setColor(AlarmStore.color(ctx))
      .setAutoCancel(true)
    if (launch != null) b.setContentIntent(PendingIntent.getActivity(ctx, 14, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    try {
      manager(ctx).notify(MISSED_ID, b.build())
    } catch (e: SecurityException) {
      // Notifications are switched off for the app.
    }
  }

  fun cancelRinging(ctx: Context) {
    val nm = manager(ctx)
    nm.cancel(RINGING_ID)
    nm.cancel(BACKUP_ID)
  }

  fun enabled(ctx: Context): Boolean = manager(ctx).areNotificationsEnabled()

  fun canFullScreen(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
    return manager(ctx).canUseFullScreenIntent()
  }
}
