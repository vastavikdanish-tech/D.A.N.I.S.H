package com.danish.aios.notification

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.danish.aios.MainActivity
import com.danish.aios.R

object NotificationHelper {
    const val CHANNEL_ALERTS = "danish_alerts"
    const val CHANNEL_REMINDERS = "danish_reminders"
    const val CHANNEL_DEVICE = "danish_device"

    fun showNotification(
        context: Context,
        channelId: String,
        title: String,
        body: String,
        notificationId: Int = System.currentTimeMillis().toInt(),
        dataUrl: String? = null,
        priority: Int = NotificationCompat.PRIORITY_DEFAULT
    ) {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            dataUrl?.let { data = android.net.Uri.parse(it) }
        }

        val pendingIntent = PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(priority)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .build()

        try {
            NotificationManagerCompat.from(context).notify(notificationId, notification)
        } catch (_: SecurityException) {
            // Notification permission not granted
        }
    }
}
