package expo.modules.gymalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

internal const val ACTION_FIRE = "expo.modules.gymalarm.FIRE"
internal const val ACTION_RING = "expo.modules.gymalarm.RING"
internal const val ACTION_STOP = "expo.modules.gymalarm.STOP"
internal const val ACTION_SNOOZE = "expo.modules.gymalarm.SNOOZE"

internal const val EXTRA_ID = "gymalarm.id"
internal const val EXTRA_LABEL = "gymalarm.label"
internal const val EXTRA_BODY = "gymalarm.body"
internal const val EXTRA_HOUR = "gymalarm.hour"
internal const val EXTRA_MINUTE = "gymalarm.minute"

internal const val SNOOZE_PREFIX = "snooze:"
internal const val SNOOZE_MINUTES = 5
/** Like the phone's clock, an alarm nobody stops goes quiet after ten minutes. */
internal const val RING_MINUTES = 10

/**
 * One alarm as the app set it: a time of day, the days it repeats (0 = Sunday), or a single date.
 * Snoozes are alarms too, with a fixed moment in `at`.
 */
internal data class AlarmSpec(
  val id: String,
  val hour: Int,
  val minute: Int,
  val days: List<Int>,
  val date: String?,
  val label: String,
  val body: String,
  val at: Long? = null
) {
  fun toJson(): JSONObject {
    val o = JSONObject()
    o.put("id", id)
    o.put("hour", hour)
    o.put("minute", minute)
    o.put("days", JSONArray(days))
    if (date != null) o.put("date", date)
    o.put("label", label)
    o.put("body", body)
    if (at != null) o.put("at", at)
    return o
  }

  fun into(intent: Intent): Intent {
    intent.putExtra(EXTRA_ID, id)
    intent.putExtra(EXTRA_LABEL, label)
    intent.putExtra(EXTRA_BODY, body)
    intent.putExtra(EXTRA_HOUR, hour)
    intent.putExtra(EXTRA_MINUTE, minute)
    return intent
  }

  /** The next time this alarm rings after `after`, or null when it won't ring again. */
  fun nextTrigger(after: Long): Long? {
    if (at != null) return if (at > after) at else null
    val cal = Calendar.getInstance()
    if (days.isEmpty()) {
      val parts = (date ?: return null).split("-")
      if (parts.size != 3) return null
      val y = parts[0].toIntOrNull() ?: return null
      val m = parts[1].toIntOrNull() ?: return null
      val d = parts[2].toIntOrNull() ?: return null
      cal.set(y, m - 1, d, hour, minute, 0)
      cal.set(Calendar.MILLISECOND, 0)
      return if (cal.timeInMillis > after) cal.timeInMillis else null
    }
    cal.timeInMillis = after
    cal.set(Calendar.HOUR_OF_DAY, hour)
    cal.set(Calendar.MINUTE, minute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    for (i in 0..7) {
      if (i > 0) {
        cal.add(Calendar.DAY_OF_YEAR, 1)
        // Daylight saving can shift the wall clock when days are added.
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
      }
      if (cal.timeInMillis > after && days.contains(cal.get(Calendar.DAY_OF_WEEK) - 1)) return cal.timeInMillis
    }
    return null
  }

  companion object {
    fun fromJson(o: JSONObject): AlarmSpec {
      val list = o.optJSONArray("days")
      val days = ArrayList<Int>()
      if (list != null) for (i in 0 until list.length()) days.add(list.optInt(i))
      return AlarmSpec(
        id = o.optString("id"),
        hour = o.optInt("hour"),
        minute = o.optInt("minute"),
        days = days,
        date = if (o.has("date")) o.optString("date") else null,
        label = o.optString("label"),
        body = o.optString("body"),
        at = if (o.has("at")) o.optLong("at") else null
      )
    }

    fun fromIntent(intent: Intent?): AlarmSpec? {
      if (intent == null) return null
      val id = intent.getStringExtra(EXTRA_ID) ?: return null
      return AlarmSpec(
        id = id,
        hour = intent.getIntExtra(EXTRA_HOUR, 0),
        minute = intent.getIntExtra(EXTRA_MINUTE, 0),
        days = emptyList(),
        date = null,
        label = intent.getStringExtra(EXTRA_LABEL) ?: "Alarm",
        body = intent.getStringExtra(EXTRA_BODY) ?: ""
      )
    }
  }
}

/** What the app asked for, kept on the phone so alarms still ring after a restart or with the app closed. */
internal object AlarmStore {
  private const val PREFS = "expo.modules.gymalarm"

  private fun prefs(ctx: Context) = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun read(ctx: Context, key: String): List<AlarmSpec> =
    try {
      val a = JSONArray(prefs(ctx).getString(key, "[]"))
      (0 until a.length()).map { AlarmSpec.fromJson(a.getJSONObject(it)) }
    } catch (e: Exception) {
      emptyList()
    }

  private fun write(ctx: Context, key: String, list: List<AlarmSpec>) {
    val a = JSONArray()
    for (s in list) a.put(s.toJson())
    prefs(ctx).edit().putString(key, a.toString()).apply()
  }

  fun alarms(ctx: Context) = read(ctx, "alarms")

  fun snoozes(ctx: Context) = read(ctx, "snoozes")

  fun find(ctx: Context, id: String): AlarmSpec? = (alarms(ctx) + snoozes(ctx)).firstOrNull { it.id == id }

  /** Replaces the app's alarms. Snoozes of alarms that are gone or switched off go too. */
  fun setAlarms(ctx: Context, list: List<AlarmSpec>) {
    write(ctx, "alarms", list)
    val ids = list.map { it.id }.toSet()
    write(ctx, "snoozes", snoozes(ctx).filter { ids.contains(it.id.removePrefix(SNOOZE_PREFIX)) || it.id == SNOOZE_PREFIX + "test" })
  }

  fun putSnooze(ctx: Context, spec: AlarmSpec) {
    write(ctx, "snoozes", snoozes(ctx).filter { it.id != spec.id } + spec)
  }

  fun removeSnooze(ctx: Context, id: String) {
    write(ctx, "snoozes", snoozes(ctx).filter { it.id != id })
  }

  fun pruneSnoozes(ctx: Context, now: Long) {
    write(ctx, "snoozes", snoozes(ctx).filter { (it.at ?: 0L) > now })
  }

  fun scheduled(ctx: Context): Set<String> = prefs(ctx).getStringSet("scheduled", emptySet())?.toSet() ?: emptySet()

  fun setScheduled(ctx: Context, ids: Set<String>) {
    prefs(ctx).edit().putStringSet("scheduled", HashSet(ids)).apply()
  }

  fun color(ctx: Context): Int = prefs(ctx).getInt("color", Color.parseColor("#2F45FF"))

  fun setColor(ctx: Context, hex: String?) {
    if (hex.isNullOrBlank()) return
    try {
      prefs(ctx).edit().putInt("color", Color.parseColor(hex)).apply()
    } catch (e: IllegalArgumentException) {
      // Not a colour Android understands; keep the last one.
    }
  }
}

/** Hands alarms to Android's AlarmManager, the same timer the phone's clock uses. */
internal object AlarmScheduler {
  private fun manager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  fun canExact(ctx: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    return manager(ctx).canScheduleExactAlarms()
  }

  private fun fireIntent(ctx: Context, id: String): Intent =
    Intent(ctx, AlarmReceiver::class.java)
      .setAction(ACTION_FIRE)
      .setData(Uri.parse("gymalarm://alarm/" + Uri.encode(id)))
      .putExtra(EXTRA_ID, id)

  /** Cancels what was set last time and sets the next ring of every alarm and snooze. */
  fun scheduleAll(ctx: Context) {
    val now = System.currentTimeMillis()
    for (id in AlarmStore.scheduled(ctx)) cancel(ctx, id)
    AlarmStore.pruneSnoozes(ctx, now)
    val ids = HashSet<String>()
    for (spec in AlarmStore.alarms(ctx) + AlarmStore.snoozes(ctx)) {
      val at = spec.nextTrigger(now) ?: continue
      setAt(ctx, spec.id, at)
      ids.add(spec.id)
    }
    AlarmStore.setScheduled(ctx, ids)
  }

  /** After an alarm rings, lines up its next ring and leaves every other alarm alone. */
  fun scheduleNext(ctx: Context, spec: AlarmSpec, after: Long) {
    val at = spec.nextTrigger(after)
    if (at != null) setAt(ctx, spec.id, at)
  }

  fun snooze(ctx: Context, spec: AlarmSpec): Long {
    val at = System.currentTimeMillis() + SNOOZE_MINUTES * 60_000L
    val snooze = spec.copy(id = SNOOZE_PREFIX + spec.id.removePrefix(SNOOZE_PREFIX), days = emptyList(), date = null, at = at)
    AlarmStore.putSnooze(ctx, snooze)
    setAt(ctx, snooze.id, at)
    AlarmStore.setScheduled(ctx, AlarmStore.scheduled(ctx) + snooze.id)
    return at
  }

  private fun setAt(ctx: Context, id: String, at: Long) {
    val am = manager(ctx)
    val op = PendingIntent.getBroadcast(ctx, 0, fireIntent(ctx, id), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    if (canExact(ctx)) {
      try {
        // What opens when someone taps the alarm icon in the status bar.
        val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent(ctx, AlarmActivity::class.java)
        val show = PendingIntent.getActivity(ctx, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), op)
        return
      } catch (e: SecurityException) {
        // Exact alarms were switched off a moment ago; fall through to the closest Android allows.
      }
    }
    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, op)
  }

  private fun cancel(ctx: Context, id: String) {
    val pi = PendingIntent.getBroadcast(ctx, 0, fireIntent(ctx, id), PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE)
    if (pi != null) {
      manager(ctx).cancel(pi)
      pi.cancel()
    }
  }
}
