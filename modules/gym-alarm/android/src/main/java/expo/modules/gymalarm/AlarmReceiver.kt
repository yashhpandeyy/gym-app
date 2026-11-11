package expo.modules.gymalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.widget.Toast

/** An alarm's time has come, or someone pressed Stop or Snooze on its notification. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      ACTION_FIRE -> {
        val id = intent.getStringExtra(EXTRA_ID) ?: return
        val spec = AlarmStore.find(context, id) ?: return
        if (id.startsWith(SNOOZE_PREFIX)) {
          AlarmStore.removeSnooze(context, id)
        } else {
          // Line up the next ring first, so a repeating alarm keeps going whatever happens next.
          AlarmScheduler.scheduleNext(context, spec, System.currentTimeMillis() + 60_000L)
        }
        AlarmService.ring(context, spec)
      }
      ACTION_STOP -> AlarmActions.stop(context, AlarmSpec.fromIntent(intent))
      ACTION_SNOOZE -> AlarmActions.snooze(context, AlarmSpec.fromIntent(intent))
    }
  }
}

/** Android forgets alarms when the phone restarts, the app updates or the clock changes. This puts them back. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.scheduleAll(context)
  }
}

/** Stop and Snooze, from the full-screen alarm, its notification, or the app. */
internal object AlarmActions {
  fun stop(ctx: Context, spec: AlarmSpec?) = handle(ctx, spec, false)

  fun snooze(ctx: Context, spec: AlarmSpec?) = handle(ctx, spec, true)

  private fun handle(ctx: Context, spec: AlarmSpec?, snooze: Boolean) {
    if (AlarmService.ringing != null) {
      try {
        ctx.startService(AlarmService.intent(ctx, if (snooze) ACTION_SNOOZE else ACTION_STOP, spec))
        return
      } catch (e: Exception) {
        // The service can't be reached; tidy up here instead.
      }
    }
    // Nothing is ringing in the service: the backup notification is the one making the noise.
    if (snooze && spec != null) {
      AlarmScheduler.snooze(ctx, spec)
      val app = ctx.applicationContext
      Handler(Looper.getMainLooper()).post { Toast.makeText(app, "Snoozed for " + SNOOZE_MINUTES + " minutes", Toast.LENGTH_SHORT).show() }
    }
    AlarmNotifications.cancelRinging(ctx)
    AlarmActivity.close()
  }
}
