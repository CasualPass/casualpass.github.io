package io.github.casualpass.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.JsResult;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import org.json.JSONObject;

/** A small host for the live website. Game code and versions remain on the web. */
public final class MainActivity extends Activity {
    private static final String HOME = "https://casualpass.github.io/";
    private static final int PICK_FILE = 10, SAVE_FILE = 11;
    private WebView web;
    private LinearLayout errorPanel;
    private ValueCallback<Uri[]> fileCallback;
    private boolean navigationFailed;
    private String pendingSave;
    private JavaScriptReplyProxy saveReply;
    private boolean hapticsActive;
    private long lastHaptic = -1000;

    static boolean trusted(Uri url) {
        return url != null && "https".equals(url.getScheme()) && "casualpass.github.io".equals(url.getHost())
            && (url.getPort() == -1 || url.getPort() == 443) && url.getUserInfo() == null;
    }

    @Override public void onCreate(Bundle savedState) {
        super.onCreate(savedState);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(16, 18, 15));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(), insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 18, 15));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true); // User-selected save files only; top-level content:// navigation is blocked.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUserAgentString(settings.getUserAgentString() + " CasualPassAndroid/1.0.0");
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (trusted(request.getUrl())) return false;
                if (request.isForMainFrame()) openExternal(request.getUrl());
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap icon) { navigationFailed = false; }
            @Override public void onPageFinished(WebView view, String url) { if (!navigationFailed && trusted(Uri.parse(url))) errorPanel.setVisibility(View.GONE); }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) { navigationFailed = true; errorPanel.setVisibility(View.VISIBLE); }
            }
            // SSL errors use WebView's default cancellation; never bypass certificates.
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onJsConfirm(WebView view, String url, String message, JsResult result) {
                if (!trusted(Uri.parse(url))) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("CasualPass").setMessage(message)
                    .setPositiveButton("Devam et", (d, w) -> result.confirm()).setNegativeButton("Vazgeç", (d, w) -> result.cancel())
                    .setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onJsAlert(WebView view, String url, String message, JsResult result) {
                if (!trusted(Uri.parse(url))) { result.cancel(); return true; }
                new AlertDialog.Builder(MainActivity.this).setTitle("CasualPass").setMessage(message)
                    .setPositiveButton("Tamam", (d, w) -> result.confirm()).setOnCancelListener(d -> result.cancel()).show(); return true;
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!trusted(Uri.parse(view.getUrl() == null ? "" : view.getUrl()))) return false;
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(picker, PICK_FILE); } catch (Exception e) { fileCallback.onReceiveValue(null); fileCallback = null; }
                return true;
            }
        });
        // Origin- and main-frame-scoped bridge; no unrestricted addJavascriptInterface.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(web, "CasualPassHaptics", Collections.singleton("https://casualpass.github.io"), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !trusted(origin)) return;
                String pattern = message.getData();
                if (pattern == null || !java.util.Arrays.asList("tap", "move", "success", "win", "fail", "cancel").contains(pattern)) return;
                runOnUiThread(() -> haptic(pattern));
            });
            WebViewCompat.addWebMessageListener(web, "CasualPassNative", Collections.singleton("https://casualpass.github.io"), (view, message, origin, mainFrame, reply) -> {
                if (!mainFrame || !trusted(origin) || pendingSave != null) { reply.postMessage("{\"error\":\"Dosya işlemi başlatılamadı.\"}"); return; }
                try {
                    String data = message.getData();
                    if (data == null || data.getBytes(StandardCharsets.UTF_8).length > 131072) throw new Exception();
                    JSONObject save = new JSONObject(data);
                    if (!"casualpass-save".equals(save.optString("format"))) throw new Exception();
                    pendingSave = data; saveReply = reply;
                    Intent picker = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, "casualpass-kayit.json");
                    startActivityForResult(picker, SAVE_FILE);
                } catch (Exception e) { pendingSave = null; saveReply = null; reply.postMessage("{\"error\":\"Kayıt dosyası açılamadı.\"}"); }
            });
        }
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        errorPanel = new LinearLayout(this); errorPanel.setOrientation(LinearLayout.VERTICAL); errorPanel.setGravity(Gravity.CENTER); errorPanel.setPadding(32, 32, 32, 32);
        errorPanel.setBackgroundColor(Color.rgb(16, 18, 15));
        TextView errorText = new TextView(this); errorText.setText("CasualPass açılamadı.\nİlk açılış için internet bağlantısı gerekir. Daha önce kaydedilen oyunlar çevrimdışı açılabilir."); errorText.setTextColor(Color.WHITE); errorText.setGravity(Gravity.CENTER); errorPanel.addView(errorText);
        Button retry = new Button(this); retry.setText("Yeniden dene"); retry.setOnClickListener(v -> { errorPanel.setVisibility(View.GONE); web.loadUrl(HOME); }); errorPanel.addView(retry);
        errorPanel.setVisibility(View.GONE); root.addView(errorPanel, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (savedState == null || web.restoreState(savedState) == null || !trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) web.loadUrl(HOME);
    }

    private void haptic(String pattern) {
        Vibrator vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;
        if ("cancel".equals(pattern)) { vibrator.cancel(); return; }
        if (!hapticsActive || !hasWindowFocus() || !trusted(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) return;
        long now = SystemClock.uptimeMillis();
        if (("tap".equals(pattern) || "move".equals(pattern)) && now - lastHaptic < 35) return;
        lastHaptic = now;
        long[] timings;
        switch (pattern) {
            case "tap": timings = new long[]{0, 8}; break;
            case "move": timings = new long[]{0, 12}; break;
            case "success": timings = new long[]{0, 18, 40, 28}; break;
            case "win": timings = new long[]{0, 30, 60, 30, 60, 60}; break;
            case "fail": timings = new long[]{0, 70, 50, 110}; break;
            default: return;
        }
        vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
    }

    private void openExternal(Uri url) {
        if (!"https".equals(url.getScheme()) && !"mailto".equals(url.getScheme())) return;
        try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (Exception e) { Toast.makeText(this, "Bağlantı açılamadı.", Toast.LENGTH_SHORT).show(); }
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onSaveInstanceState(Bundle outState) { web.saveState(outState); super.onSaveInstanceState(outState); }
    @Override protected void onPause() { hapticsActive = false; haptic("cancel"); web.onPause(); CookieManager.getInstance().flush(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); hapticsActive = true; if (web != null) web.onResume(); }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && fileCallback != null) { fileCallback.onReceiveValue(result == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null); fileCallback = null; }
        if (request == SAVE_FILE && saveReply != null) {
            String response = "{\"cancelled\":true}";
            if (result == RESULT_OK && data != null && data.getData() != null && pendingSave != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    if (out == null) throw new Exception(); out.write(pendingSave.getBytes(StandardCharsets.UTF_8)); response = "{\"cancelled\":false}";
                } catch (Exception e) { response = "{\"error\":\"Dosya kaydedilemedi.\"}"; }
            }
            try { saveReply.postMessage(response); } catch (Exception ignored) { }
            saveReply = null; pendingSave = null;
        }
    }
}
