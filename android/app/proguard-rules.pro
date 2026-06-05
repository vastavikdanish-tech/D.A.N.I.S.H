-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keep class com.danish.aios.** { *; }

-keepattributes JavascriptInterface
-keepattributes *Annotation*

-dontwarn com.google.firebase.**
-dontwarn org.conscrypt.**
