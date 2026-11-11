package expo.modules.gymalarm

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.util.Calendar

/** One alarm as the app sends it. `days` are 0 = Sunday; with no days it rings once, on `date` (YYYY-MM-DD). */
class AlarmRecord : Record {
  @Field var id: String = ""
  @Field var hour: Int = 0
  @Field var minute: Int = 0
  @Field var days: List<Int> = emptyList()
  @Field var date: String? = null
  @Field var label: String = ""
  @Field var body: String = ""
}

/** Members' alarms that ring like the phone's clock, with the app closed and the phone locked. */
class GymAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun openSettings(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  override fun definition() = ModuleDefinition {
    Name("GymAlarm")

    /** Sets up the notification channels, which Android 13 needs before it will ask about notifications. */
    Function("prepare") {
      AlarmNotifications.ensureChannels(context)
    }

    /** Replaces every alarm with this list and schedules the next ring of each. */
    Function("setAlarms") { alarms: List<AlarmRecord>, color: String? ->
      val ctx = context
      AlarmStore.setColor(ctx, color)
      AlarmStore.setAlarms(ctx, alarms.map { AlarmSpec(it.id, it.hour, it.minute, it.days, it.date, it.label, it.body) })
      AlarmScheduler.scheduleAll(ctx)
    }

    /** Rings the real alarm now, so a member can see and hear it. */
    Function("ringNow") { label: String, body: String ->
      val now = Calendar.getInstance()
      AlarmService.ring(context, AlarmSpec("test", now.get(Calendar.HOUR_OF_DAY), now.get(Calendar.MINUTE), emptyList(), null, label, body))
    }

    Function("stop") {
      AlarmActions.stop(context, null)
    }

    Function("isRinging") {
      AlarmService.ringing != null
    }

    Function("canScheduleExact") {
      AlarmScheduler.canExact(context)
    }

    Function("openExactSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        openSettings(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + context.packageName)))
      }
    }

    Function("canFullScreen") {
      AlarmNotifications.canFullScreen(context)
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        openSettings(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + context.packageName)))
      }
    }

    Function("notificationsEnabled") {
      AlarmNotifications.enabled(context)
    }

    Function("openNotificationSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        openSettings(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
      }
    }
  }
}
