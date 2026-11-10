package com.toolphoto.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.File;

@CapacitorPlugin(name = "ApkInstaller")
class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void getPendingAuthUrl(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("url", MainActivity.pendingAuthUrl);
        MainActivity.pendingAuthUrl = null;
        call.resolve(ret);
    }

    @PluginMethod
    public void canRequestPackageInstalls(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("value", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("value", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("filePath is required");
            return;
        }

        try {
            if (filePath.startsWith("file://")) {
                filePath = filePath.substring(7);
            }

            File file = new File(filePath);
            if (!file.exists()) {
                call.reject("Tập tin APK không tồn tại tại: " + filePath);
                return;
            }

            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = FileProvider.getUriForFile(
                    getContext(),
                    getContext().getPackageName() + ".fileprovider",
                    file
                );
            } else {
                apkUri = Uri.fromFile(file);
            }

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Lỗi khi mở trình cài đặt APK: " + e.getMessage());
        }
    }
}

public class MainActivity extends BridgeActivity {
    public static String pendingAuthUrl = null;

    private void handleAuthDeepLink(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data != null) {
            String urlStr = data.toString();
            if (urlStr.startsWith("com.toolphoto.app://auth-callback")) {
                pendingAuthUrl = urlStr;
                if (getBridge() != null && getBridge().getWebView() != null) {
                    final String quotedUrl = JSONObject.quote(urlStr);
                    runOnUiThread(() -> {
                        getBridge().eval("window.dispatchEvent(new CustomEvent('androidGoogleAuthCallback', { detail: " + quotedUrl + " }));", null);
                    });
                }
            }
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkInstallerPlugin.class);
        super.onCreate(savedInstanceState);
        handleAuthDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthDeepLink(intent);
    }
}
