package com.danish.aios

import android.content.pm.PackageManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.core.content.ContextCompat

class DanishChromeClient(
    private val onPermissionRequest: (PermissionRequest) -> Unit = {}
) : WebChromeClient() {

    override fun onPermissionRequest(request: PermissionRequest) {
        val resources = request.origin?.let { origin ->
            val host = origin.host
            host?.contains("vercel.app") == true || host?.contains("localhost") == true
        } ?: false

        if (resources) {
            val grantedResources = request.resources.filter { resource ->
                when (resource) {
                    PermissionRequest.RESOURCE_VIDEO_CAPTURE,
                    PermissionRequest.RESOURCE_AUDIO_CAPTURE -> true
                    else -> false
                }
            }.toTypedArray()

            if (grantedResources.isNotEmpty()) {
                request.grant(grantedResources)
                onPermissionRequest(request)
                return
            }
        }
        request.deny()
    }

    override fun onGeolocationPermissionsShowPrompt(
        origin: String?,
        callback: GeolocationPermissions.Callback
    ) {
        callback.invoke(origin, true, false)
    }
}
