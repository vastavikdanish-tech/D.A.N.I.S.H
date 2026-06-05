package com.danish.aios

import android.Manifest
import android.content.pm.PackageManager
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat
import com.danish.aios.util.NetworkUtil
import com.danish.aios.voice.VoiceInputHandler
import com.danish.aios.voice.VoiceOutputHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DanishBridge(
    private val activity: MainActivity,
    private val voiceInput: VoiceInputHandler,
    private val voiceOutput: VoiceOutputHandler
) {
    private val scope = CoroutineScope(Dispatchers.Main)
    private var transcriptCallback: String? = null

    @JavascriptInterface
    fun isOnline(): Boolean {
        return NetworkUtil(activity).isOnline
    }

    @JavascriptInterface
    fun getAppVersion(): String {
        return "1.0.0"
    }

    @JavascriptInterface
    fun getPlatform(): String {
        return "android"
    }

    @JavascriptInterface
    fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun hasNotificationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity, Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun startVoiceInput(callbackId: String) {
        transcriptCallback = callbackId
        scope.launch {
            voiceInput.startListening().collect { result ->
                activity.runOnUiThread {
                    activity.evaluateJs("window.danishBridgeCallbacks?.get('$callbackId')?.(${toJson(result)})")
                }
            }
        }
    }

    @JavascriptInterface
    fun stopVoiceInput() {
        voiceInput.stopListening()
    }

    @JavascriptInterface
    fun speak(text: String, callbackId: String?) {
        if (!voiceOutput.isAvailable) {
            voiceOutput.initialize { ready ->
                if (ready) {
                    doSpeak(text, callbackId)
                }
            }
        } else {
            doSpeak(text, callbackId)
        }
    }

    private fun doSpeak(text: String, callbackId: String?) {
        scope.launch {
            voiceOutput.speak(text).collect { success ->
                activity.runOnUiThread {
                    callbackId?.let { id ->
                        activity.evaluateJs("window.danishBridgeCallbacks?.get('$id')?.($success)")
                    }
                }
            }
        }
    }

    @JavascriptInterface
    fun stopSpeaking() {
        voiceOutput.stop()
    }

    private fun toJson(value: String): String {
        return "\"" + value.replace("\\", "\\\\")
            .replace("\"", "\\\"")
            .replace("\n", "\\n")
            .replace("\r", "\\r")
            .replace("\t", "\\t") + "\""
    }
}
