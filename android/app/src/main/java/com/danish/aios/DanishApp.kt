package com.danish.aios

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.danish.aios.notification.NotificationHelper

class DanishApp : Application() {
    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val alertsChannel = NotificationChannel(
                NotificationHelper.CHANNEL_ALERTS,
                getString(R.string.notification_channel_alerts),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "AI responses, reminders, and system alerts"
                enableVibration(true)
                enableLights(true)
            }

            val remindersChannel = NotificationChannel(
                NotificationHelper.CHANNEL_REMINDERS,
                getString(R.string.notification_channel_reminders),
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Scheduled reminders"
            }

            val deviceChannel = NotificationChannel(
                NotificationHelper.CHANNEL_DEVICE,
                getString(R.string.notification_channel_device),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Device command results"
            }

            manager.createNotificationChannel(alertsChannel)
            manager.createNotificationChannel(remindersChannel)
            manager.createNotificationChannel(deviceChannel)
        }
    }
}
