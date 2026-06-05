package com.danish.aios.voice

import android.content.Context
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import java.util.Locale
import java.util.UUID

class VoiceOutputHandler(private val context: Context) {
    private var tts: TextToSpeech? = null
    private var isInitialized = false
    private var isSpeaking = false

    val isAvailable: Boolean
        get() = isInitialized

    fun initialize(onReady: (Boolean) -> Unit) {
        if (isInitialized) {
            onReady(true)
            return
        }
        tts = TextToSpeech(context) { status ->
            isInitialized = (status == TextToSpeech.SUCCESS)
            if (isInitialized) {
                tts?.language = Locale.US
                try {
                    tts?.setVoice(Voice("en-US-x-sfg#female_2-local", Locale.US, 400, 220, true, null))
                } catch (_: Exception) {
                    tts?.voice = null
                }
                tts?.setSpeechRate(0.95f)
                tts?.setPitch(1.0f)
            }
            onReady(isInitialized)
        }
    }

    fun speak(text: String): Flow<Boolean> = callbackFlow {
        if (!isInitialized || tts == null) {
            trySend(false)
            close()
            return@callbackFlow
        }

        val utteranceId = UUID.randomUUID().toString()

        tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) {
                isSpeaking = true
            }

            override fun onDone(utteranceId: String?) {
                isSpeaking = false
                trySend(true)
                close()
            }

            override fun onError(utteranceId: String?) {
                isSpeaking = false
                trySend(false)
                close()
            }

            override fun onStop(utteranceId: String?, interrupted: Boolean) {
                isSpeaking = false
                trySend(false)
                close()
            }
        })

        val result = tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
        if (result == TextToSpeech.ERROR) {
            trySend(false)
            close()
        }

        awaitClose {
            if (isSpeaking) {
                tts?.stop()
            }
        }
    }

    fun stop() {
        isSpeaking = false
        tts?.stop()
    }

    fun destroy() {
        stop()
        tts?.shutdown()
        tts = null
        isInitialized = false
    }
}
