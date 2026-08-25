# R8 rules for Tempa.
#
# The whole app is a WebView, so the Java surface is small: BridgeActivity, the
# Capacitor bridge, and three plugins. What makes shrinking risky here is that
# Capacitor resolves plugins BY NAME through reflection at runtime — R8 cannot
# see those references, so anything it strips comes back as a plugin that
# silently does not exist. Everything below exists for that reason.

# --- Capacitor bridge & plugins -------------------------------------------
# Plugin classes are looked up reflectively from the plugin registry.
-keep public class com.getcapacitor.** { *; }
-keep public class io.ionic.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
# @PluginMethod is invoked by name from JS; the method names must survive.
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
}
# The plugins this app actually bundles.
-keep class com.capacitorjs.plugins.filesystem.** { *; }
-keep class com.capacitorjs.plugins.localnotifications.** { *; }
-keep class com.capacitorjs.plugins.share.** { *; }

# --- Cordova compatibility layer ------------------------------------------
-keep class org.apache.cordova.** { *; }

# --- JS bridge -------------------------------------------------------------
# Anything reachable from JS via @JavascriptInterface is called by name.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- our own code ----------------------------------------------------------
# MainActivity is named from AndroidManifest.xml.
-keep class io.github.fareza777.tempa.MainActivity { *; }

# --- noise -----------------------------------------------------------------
# Keep the line numbers so a Play Console crash report is readable; the source
# file name itself is not useful and is renamed.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
# AndroidX and OkHttp reference optional annotations that are not on the path.
-dontwarn org.codehaus.mojo.animal_sniffer.**
-dontwarn javax.annotation.**
