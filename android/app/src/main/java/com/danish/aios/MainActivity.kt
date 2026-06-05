package com.danish.aios

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.danish.aios.util.NetworkUtil
import com.danish.aios.voice.VoiceInputHandler
import com.danish.aios.voice.VoiceOutputHandler
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var splashOverlay: View
    private lateinit var offlineBanner: TextView
    private lateinit var networkUtil: NetworkUtil
    private lateinit var voiceInput: VoiceInputHandler
    private lateinit var voiceOutput: VoiceOutputHandler
    private lateinit var danishBridge: DanishBridge

    private var webViewLoaded = false
    private var hasError = false

    private val requestMicPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            evaluateJs("window.danishMicGranted?.()")
        }
    }

    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            evaluateJs("window.danishNotificationGranted?.()")
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        networkUtil = NetworkUtil(this)
        voiceInput = VoiceInputHandler(this)
        voiceOutput = VoiceOutputHandler(this)
        danishBridge = DanishBridge(this, voiceInput, voiceOutput)

        initViews()
        setupWebView()
        setupSwipeRefresh()
        observeNetwork()
        requestPermissions()
    }

    private fun installSplashScreen() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = getColor(R.color.background_dark)
        window.navigationBarColor = getColor(R.color.background_dark)

        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.statusBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    private fun initViews() {
        setContentView(layoutInflater.inflate(R.layout.activity_main, null))

        webView = findViewById(R.id.webview)
        swipeRefresh = findViewById(R.id.swipe_refresh)
        splashOverlay = findViewById(R.id.splash_overlay)
        offlineBanner = findViewById(R.id.offline_banner)

        swipeRefresh.setColorSchemeColors(
            getColor(R.color.cyan_electric),
            getColor(R.color.mint)
        )
        swipeRefresh.setProgressBackgroundColorSchemeColor(getColor(R.color.background_card))
    }

    private fun setupWebView() {
        val settings = webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            useWideViewPort = true
            loadWithOverviewMode = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
            userAgentString = settings.userAgentString + " DANISH-Android/1.0"
        }

        WebView.setWebContentsDebuggingEnabled(true)

        webView.webViewClient = object : DanishWebViewClient(
            onPageStarted = {
                hasError = false
            },
            onPageFinished = {
                if (!webViewLoaded) {
                    webViewLoaded = true
                    splashOverlay.animate()
                        .alpha(0f)
                        .setDuration(400)
                        .withEndAction { splashOverlay.visibility = View.GONE }
                        .start()
                    injectBridge()
                }
            },
            onReceivedError = { errorCode ->
                hasError = true
                if (errorCode == -2) { // HOST_LOOKUP (no internet)
                    showOfflineBanner(true)
                }
            }
        ) {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                hasError = false
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("tel:") || url.startsWith("mailto:")) {
                    startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url)))
                    return true
                }
                return false
            }
        }

        webView.webChromeClient = DanishChromeClient()

        webView.addJavascriptInterface(danishBridge, "AndroidBridge")

        loadPwaUrl()
    }

    private fun loadPwaUrl() {
        val url = if (BuildConfig.DEBUG) {
            getString(R.string.webview_home_url)
                .replace("https://d-a-n-i-s-h.vercel.app", "http://10.0.2.2:3000")
        } else {
            getString(R.string.webview_home_url)
        }
        webView.loadUrl(url)
    }

    private fun injectBridge() {
        val js = """
            (function() {
                if (window.danishBridgeCallbacks) return;
                window.danishBridgeCallbacks = new Map();
                var id = 0;
                window.danishBridge = {
                    isOnline: function() {
                        return AndroidBridge.isOnline();
                    },
                    getAppVersion: function() {
                        return AndroidBridge.getAppVersion();
                    },
                    getPlatform: function() {
                        return AndroidBridge.getPlatform();
                    },
                    hasMicPermission: function() {
                        return AndroidBridge.hasMicPermission();
                    },
                    hasNotificationPermission: function() {
                        return AndroidBridge.hasNotificationPermission();
                    },
                    startVoiceInput: function() {
                        return new Promise(function(resolve) {
                            var cid = 'voice_' + (id++);
                            window.danishBridgeCallbacks.set(cid, resolve);
                            AndroidBridge.startVoiceInput(cid);
                        });
                    },
                    stopVoiceInput: function() {
                        AndroidBridge.stopVoiceInput();
                    },
                    speak: function(text) {
                        return new Promise(function(resolve) {
                            var cid = 'speak_' + (id++);
                            window.danishBridgeCallbacks.set(cid, resolve);
                            AndroidBridge.speak(text, cid);
                        });
                    },
                    stopSpeaking: function() {
                        AndroidBridge.stopSpeaking();
                    },
                    requestMicPermission: function() {
                        AndroidBridge.requestMicPermission();
                    },
                    requestNotificationPermission: function() {
                        AndroidBridge.requestNotificationPermission();
                    }
                };
            })();
        """.trimIndent()
        evaluateJs(js)
    }

    fun evaluateJs(js: String) {
        webView.post {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                webView.evaluateJavascript(js, null)
            } else {
                webView.loadUrl("javascript:$js")
            }
        }
    }

    private fun setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener {
            webView.reload()
        }
    }

    private fun observeNetwork() {
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                networkUtil.observeNetworkState().collect { isOnline ->
                    showOfflineBanner(!isOnline)
                    if (isOnline && hasError) {
                        webView.reload()
                    }
                }
            }
        }
    }

    private fun showOfflineBanner(show: Boolean) {
        offlineBanner.visibility = if (show) View.VISIBLE else View.GONE
        swipeRefresh.isEnabled = !show
    }

    private fun requestPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                requestNotificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    fun requestMicPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
            != PackageManager.PERMISSION_GRANTED
        ) {
            requestMicPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        voiceInput.destroy()
        voiceOutput.destroy()
        super.onDestroy()
    }
}
