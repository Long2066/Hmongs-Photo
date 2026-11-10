package com.toolphoto.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebSettings;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.plugin.WebView;
import org.json.JSONObject;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@CapacitorPlugin(name = "ApkInstaller")
class ApkInstallerPlugin extends Plugin {

    @PluginMethod
    public void getNativeVersion(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(getContext().getPackageName(), 0);
            ret.put("versionName", pInfo.versionName);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ret.put("versionCode", pInfo.getLongVersionCode());
            } else {
                ret.put("versionCode", pInfo.versionCode);
            }
        } catch (Exception e) {
            ret.put("versionName", "2.25.42");
            ret.put("versionCode", 22542);
        }
        call.resolve(ret);
    }

    /**
     * Silent Live OTA Bundle Updater (Over-The-Air)
     * Downloads bundle.zip from Firebase Hosting / CDN, extracts to app storage,
     * persists CAP_SERVER_PATH and hot-reloads WebView without any manual APK install!
     */
    @PluginMethod
    public void applyOtaUpdate(PluginCall call) {
        String bundleUrl = call.getString("bundleUrl");
        String version = call.getString("version");
        boolean reloadNow = Boolean.TRUE.equals(call.getBoolean("reloadNow", true));

        if (bundleUrl == null || version == null) {
            call.reject("bundleUrl and version are required");
            return;
        }

        new Thread(() -> {
            File tempZip = null;
            try {
                // 1. Download zip from CDN
                URL url = new URL(bundleUrl);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(30000);
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    call.reject("Tải gói OTA thất bại: HTTP " + conn.getResponseCode());
                    return;
                }

                tempZip = new File(getContext().getCacheDir(), "ota-" + version + ".zip");
                try (InputStream in = new BufferedInputStream(conn.getInputStream());
                     FileOutputStream out = new FileOutputStream(tempZip)) {
                    byte[] buffer = new byte[8192];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                }

                // 2. Extract into files/ota-bundles/<version>
                File targetDir = new File(getContext().getFilesDir(), "ota-bundles/" + version);
                if (targetDir.exists()) {
                    deleteRecursive(targetDir);
                }
                targetDir.mkdirs();

                try (ZipInputStream zis = new ZipInputStream(new BufferedInputStream(new java.io.FileInputStream(tempZip)))) {
                    ZipEntry entry;
                    byte[] buffer = new byte[8192];
                    while ((entry = zis.getNextEntry()) != null) {
                        String name = entry.getName();
                        // Guard against zip slip
                        File outFile = new File(targetDir, name);
                        String canonicalDestPath = targetDir.getCanonicalPath();
                        String canonicalDestFile = outFile.getCanonicalPath();
                        if (!canonicalDestFile.startsWith(canonicalDestPath + File.separator) && !canonicalDestFile.equals(canonicalDestPath)) {
                            continue;
                        }

                        if (entry.isDirectory()) {
                            outFile.mkdirs();
                        } else {
                            File parent = outFile.getParentFile();
                            if (parent != null && !parent.exists()) {
                                parent.mkdirs();
                            }
                            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                                int count;
                                while ((count = zis.read(buffer)) != -1) {
                                    fos.write(buffer, 0, count);
                                }
                            }
                        }
                        zis.closeEntry();
                    }
                }

                // 3. Verify index.html exists
                File indexFile = new File(targetDir, "index.html");
                if (!indexFile.exists()) {
                    call.reject("Gói OTA không hợp lệ (thiếu index.html)");
                    return;
                }

                // 4. Persist to SharedPreferences so app always loads this directory
                SharedPreferences prefs = getContext().getSharedPreferences(WebView.WEBVIEW_PREFS_NAME, Activity.MODE_PRIVATE);
                prefs.edit().putString(WebView.CAP_SERVER_PATH, targetDir.getAbsolutePath()).apply();

                // 5. Clean up temp zip
                if (tempZip.exists()) {
                    tempZip.delete();
                }

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("version", version);
                res.put("path", targetDir.getAbsolutePath());

                // 6. Reload live if requested
                if (reloadNow && getBridge() != null) {
                    getActivity().runOnUiThread(() -> {
                        getBridge().setServerBasePath(targetDir.getAbsolutePath());
                    });
                }

                call.resolve(res);
            } catch (Exception e) {
                if (tempZip != null && tempZip.exists()) {
                    tempZip.delete();
                }
                call.reject("Lỗi cập nhật OTA tự động: " + e.getMessage());
            }
        }).start();
    }

    private void deleteRecursive(File fileOrDirectory) {
        if (fileOrDirectory.isDirectory()) {
            File[] children = fileOrDirectory.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        fileOrDirectory.delete();
    }

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

        // Auto full-screen sizing on any device: adapt to system cutouts/bars
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            getWindow().setDecorFitsSystemWindows(true);
        }

        // Optimize WebView scaling & font zoom on diverse Android screen densities & system settings
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings settings = getBridge().getWebView().getSettings();
            if (settings != null) {
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(true);
                settings.setTextZoom(100); // Prevent device system font scale from breaking UI layouts
            }
        }

        handleAuthDeepLink(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleAuthDeepLink(intent);
    }
}
