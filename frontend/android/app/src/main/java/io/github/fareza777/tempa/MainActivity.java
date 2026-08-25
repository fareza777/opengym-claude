package io.github.fareza777.tempa;

import android.os.Build;
import android.os.Bundle;
import android.view.View;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

/**
 * Edge-to-edge, with the window insets handed to CSS.
 *
 * <p>Android 15 (API 35) forces edge-to-edge on any app targeting it, and this
 * one targets 36, so opting out is not available. That leaves two ways to keep
 * the tab bar out from under the gesture bar:
 *
 * <ol>
 *   <li>Capacitor's {@code adjustMarginsForEdgeToEdge}, which margins the whole
 *       WebView inside the insets and consumes them. Simple, but it means the
 *       strips behind the system bars are painted by the <em>window</em>
 *       background, which is a flat colour — so the navigation bar sits on a
 *       different tone from the app's own navigation bar right above it, and
 *       there is a visible two-tone band along the bottom edge.</li>
 *   <li>Let the WebView fill the window and tell CSS where the safe area is.
 *       Then the app's own surfaces paint all the way to the physical edges and
 *       there is no seam at all.</li>
 * </ol>
 *
 * <p>This is (2). It cannot rely on {@code env(safe-area-inset-*)}: that is a
 * WKWebView guarantee, and Android WebView populates it inconsistently across
 * versions — on the versions where it returns 0, the navigation bar would sit
 * on top of the tab bar. So the values are pushed in as the same custom
 * properties the stylesheet already reads, and the {@code env()} fallbacks in
 * index.css stay as the belt to this braces.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Transparent bars so the page's own background shows through. Ignored
        // on 15+, where the platform enforces transparency anyway, but this app
        // supports back to API 23.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            getWindow().setStatusBarColor(0);
            getWindow().setNavigationBarColor(0);
        }

        final View root = getWindow().getDecorView();
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), root);
        // Dark is the app's default theme, so the system icons have to be light
        // to be visible on it. Kept in step from the web side via
        // setSystemBarsAppearance below when the user switches to the light theme.
        bars.setAppearanceLightStatusBars(false);
        bars.setAppearanceLightNavigationBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(root, (v, windowInsets) -> {
            Insets i = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            pushInsets(i.top, i.bottom, i.left, i.right);
            // NOT consumed: the WebView still needs them for its own keyboard
            // handling, and nothing else in the hierarchy competes for them.
            return windowInsets;
        });
    }

    @Override
    public void onResume() {
        super.onResume();
        // The first inset dispatch usually beats the page load, and an
        // evaluateJavascript against a document that does not exist yet is
        // simply dropped. Asking for a fresh dispatch here re-runs the listener
        // once the app is actually on screen, which is after the page is up.
        getWindow().getDecorView().requestApplyInsets();
    }

    private void pushInsets(int top, int bottom, int left, int right) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final float d = getResources().getDisplayMetrics().density;
        final String js =
            "(function(s){" +
            "s.setProperty('--sat','" + px(top, d) + "');" +
            "s.setProperty('--sab','" + px(bottom, d) + "');" +
            "s.setProperty('--sal','" + px(left, d) + "');" +
            "s.setProperty('--sar','" + px(right, d) + "');" +
            "})(document.documentElement.style)";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }

    /** Physical pixels to the CSS pixels the stylesheet is written in. */
    private static String px(int value, float density) {
        return Math.round(value / density) + "px";
    }
}
