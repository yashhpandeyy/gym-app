package expo.modules.gymalarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.view.animation.Animation
import android.view.animation.ScaleAnimation
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference

/**
 * The full-screen alarm, like the phone's clock: it turns the screen on over the lock screen, says
 * which app it's from, and puts Stop and Snooze right there. Built in plain Android views so it opens
 * instantly, even when the app itself isn't running.
 */
class AlarmActivity : Activity() {
  private var spec: AlarmSpec? = null
  private var timeView: TextView? = null
  private val handler = Handler(Looper.getMainLooper())
  private val tick =
    object : Runnable {
      override fun run() {
        timeView?.text = AlarmNotifications.timeNow(this@AlarmActivity)
        handler.postDelayed(this, 15_000L)
      }
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    current = WeakReference(this)
    render(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    render(intent)
  }

  override fun onResume() {
    super.onResume()
    handler.post(tick)
  }

  override fun onPause() {
    handler.removeCallbacks(tick)
    super.onPause()
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  /** Like the phone's clock, Back doesn't put away a ringing alarm: Stop or Snooze does. */
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (AlarmService.ringing == null) finish()
  }

  @Suppress("DEPRECATION")
  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

  @Suppress("DEPRECATION")
  private fun render(intent: Intent?) {
    val s = AlarmSpec.fromIntent(intent) ?: AlarmService.ringing
    spec = s
    val color = AlarmStore.color(this)
    window.statusBarColor = color
    window.navigationBarColor = color
    val soft = Color.argb(217, 255, 255, 255)

    val root = LinearLayout(this)
    root.orientation = LinearLayout.VERTICAL
    root.gravity = Gravity.CENTER_HORIZONTAL
    root.setBackgroundColor(color)
    root.setPadding(dp(28), dp(64), dp(28), dp(40))

    // Whose alarm this is: the app's own icon and name.
    val top = LinearLayout(this)
    top.orientation = LinearLayout.HORIZONTAL
    top.gravity = Gravity.CENTER_VERTICAL
    val icon = ImageView(this)
    icon.setImageDrawable(packageManager.getApplicationIcon(applicationInfo))
    top.addView(icon, LinearLayout.LayoutParams(dp(40), dp(40)))
    val app = TextView(this)
    app.text = AlarmNotifications.appName(this) + " alarm"
    app.setTextColor(Color.WHITE)
    app.textSize = 18f
    app.typeface = Typeface.DEFAULT_BOLD
    app.setPadding(dp(12), 0, 0, 0)
    top.addView(app)
    root.addView(top, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    root.addView(View(this), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

    val bell = ImageView(this)
    bell.setImageResource(R.drawable.gym_alarm_small)
    bell.setColorFilter(Color.WHITE)
    root.addView(bell, LinearLayout.LayoutParams(dp(76), dp(76)))
    val pulse = ScaleAnimation(1f, 1.18f, 1f, 1.18f, Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f)
    pulse.duration = 550
    pulse.repeatMode = Animation.REVERSE
    pulse.repeatCount = Animation.INFINITE
    bell.startAnimation(pulse)

    val time = TextView(this)
    time.text = AlarmNotifications.timeNow(this)
    time.setTextColor(Color.WHITE)
    time.textSize = 68f
    time.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    time.gravity = Gravity.CENTER
    timeView = time
    val timeParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
    timeParams.topMargin = dp(18)
    root.addView(time, timeParams)

    val label = TextView(this)
    label.text = s?.label ?: "Alarm"
    label.setTextColor(Color.WHITE)
    label.textSize = 30f
    label.typeface = Typeface.DEFAULT_BOLD
    label.gravity = Gravity.CENTER
    label.maxLines = 3
    root.addView(label, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))

    val bodyText = s?.body ?: ""
    if (bodyText.isNotEmpty()) {
      val body = TextView(this)
      body.text = bodyText
      body.setTextColor(soft)
      body.textSize = 18f
      body.gravity = Gravity.CENTER
      val bodyParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT)
      bodyParams.topMargin = dp(8)
      root.addView(body, bodyParams)
    }

    root.addView(View(this), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

    val stop = button("Stop", Color.WHITE, color) {
      AlarmActions.stop(this, spec)
      finish()
    }
    root.addView(stop, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64)))

    val snooze = button("Snooze " + SNOOZE_MINUTES + " min", Color.parseColor("#1B1F2A"), Color.WHITE) {
      AlarmActions.snooze(this, spec)
      finish()
    }
    val snoozeParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(64))
    snoozeParams.topMargin = dp(12)
    root.addView(snooze, snoozeParams)

    setContentView(root)
  }

  private fun button(text: String, background: Int, foreground: Int, onClick: () -> Unit): TextView {
    val b = TextView(this)
    b.text = text
    b.gravity = Gravity.CENTER
    b.textSize = 20f
    b.typeface = Typeface.DEFAULT_BOLD
    b.setTextColor(foreground)
    val shape = GradientDrawable()
    shape.cornerRadius = dp(20).toFloat()
    shape.setColor(background)
    b.background = shape
    b.isClickable = true
    b.isFocusable = true
    b.contentDescription = text
    b.setOnClickListener { onClick() }
    return b
  }

  companion object {
    private var current: WeakReference<AlarmActivity>? = null

    internal fun intent(ctx: Context, spec: AlarmSpec): Intent =
      spec.into(Intent(ctx, AlarmActivity::class.java)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)

    /** Opens the alarm if Android allows it right now (the app is on screen). Otherwise the notification does. */
    internal fun show(ctx: Context, spec: AlarmSpec) {
      try {
        ctx.startActivity(intent(ctx, spec))
      } catch (e: Exception) {
        // Not allowed from the background; the full-screen notification takes over.
      }
    }

    internal fun close() {
      Handler(Looper.getMainLooper()).post { current?.get()?.finish() }
    }
  }
}
