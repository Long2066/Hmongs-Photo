package com.toolphoto.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
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
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMuxer;

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
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(120000);
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

    private static String sanitizeFilename(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "ImageTool_" + System.currentTimeMillis();
        }
        String clean = name.trim().replaceAll("[\\\\/:*?\"<>|]", "_");
        if (clean.length() > 80) {
            int dotIdx = clean.lastIndexOf('.');
            if (dotIdx > 0) {
                String ext = clean.substring(dotIdx);
                clean = clean.substring(0, Math.min(dotIdx, 75)) + ext;
            } else {
                clean = clean.substring(0, 80);
            }
        }
        return clean;
    }

    private static void copyFile(File src, File dst) throws Exception {
        try (InputStream in = new BufferedInputStream(new java.io.FileInputStream(src));
             OutputStream out = new java.io.BufferedOutputStream(new FileOutputStream(dst))) {
            byte[] buffer = new byte[32768];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
            out.flush();
        }
    }

    private static void downloadHttpToFile(String urlStr, File destFile) throws Exception {
        URL currentUrl = new URL(urlStr);
        HttpURLConnection conn = null;
        int redirectCount = 0;

        while (redirectCount < 6) {
            conn = (HttpURLConnection) currentUrl.openConnection();
            conn.setConnectTimeout(25000);
            conn.setReadTimeout(120000);
            conn.setInstanceFollowRedirects(true);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
            conn.setRequestProperty("Accept", "*/*");
            conn.connect();

            int status = conn.getResponseCode();
            if (status == HttpURLConnection.HTTP_MOVED_TEMP || status == HttpURLConnection.HTTP_MOVED_PERM || status == 307 || status == 308) {
                String newUrl = conn.getHeaderField("Location");
                if (newUrl != null && !newUrl.isEmpty()) {
                    currentUrl = new URL(currentUrl, newUrl);
                    redirectCount++;
                    continue;
                }
            }
            break;
        }

        if (conn == null || (conn.getResponseCode() != HttpURLConnection.HTTP_OK && conn.getResponseCode() != 206)) {
            throw new Exception("HTTP " + (conn != null ? conn.getResponseCode() : "Unknown"));
        }

        try (InputStream in = new BufferedInputStream(conn.getInputStream());
             FileOutputStream out = new FileOutputStream(destFile)) {
            byte[] buffer = new byte[32768];
            int len;
            while ((len = in.read(buffer)) != -1) {
                out.write(buffer, 0, len);
            }
            out.flush();
        }
    }

    private Uri saveFileToGalleryInternal(Context ctx, File srcFile, String filename, String mimeType, boolean isVideo) {
        OutputStream out = null;
        Uri mediaUri = null;
        File legacyFile = null;
        try {
            String safeFilename = sanitizeFilename(filename);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(isVideo ? MediaStore.Video.Media.DISPLAY_NAME : MediaStore.Images.Media.DISPLAY_NAME, safeFilename);
                values.put(isVideo ? MediaStore.Video.Media.MIME_TYPE : MediaStore.Images.Media.MIME_TYPE, mimeType);
                values.put(isVideo ? MediaStore.Video.Media.RELATIVE_PATH : MediaStore.Images.Media.RELATIVE_PATH,
                        (isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/ImageTool");
                values.put(isVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 1);

                Uri collection = isVideo ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                mediaUri = ctx.getContentResolver().insert(collection, values);
                if (mediaUri != null) {
                    out = ctx.getContentResolver().openOutputStream(mediaUri);
                }
            } else {
                File targetDir = Environment.getExternalStoragePublicDirectory(
                        isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                File appDir = new File(targetDir, "ImageTool");
                if (!appDir.exists() && !appDir.mkdirs()) {
                    appDir = ctx.getExternalFilesDir(isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                }
                legacyFile = new File(appDir, safeFilename);
                out = new FileOutputStream(legacyFile);
            }

            if (out != null) {
                try (InputStream in = new BufferedInputStream(new java.io.FileInputStream(srcFile))) {
                    byte[] buffer = new byte[32768];
                    int len;
                    while ((len = in.read(buffer)) != -1) {
                        out.write(buffer, 0, len);
                    }
                    out.flush();
                }
                out.close();
                out = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && mediaUri != null) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(isVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 0);
                        ctx.getContentResolver().update(mediaUri, values, null, null);
                    } catch (Exception ignored) {}
                } else if (legacyFile != null) {
                    MediaScannerConnection.scanFile(ctx, new String[]{legacyFile.getAbsolutePath()}, new String[]{mimeType}, null);
                }
            }
            return mediaUri != null ? mediaUri : (legacyFile != null ? Uri.fromFile(legacyFile) : null);
        } catch (Exception e) {
            if (out != null) {
                try { out.close(); } catch (Exception ignored) {}
            }
            return null;
        }
    }

    /**
     * Native MediaStore Downloader (Gallery / Movies / Pictures)
     * Directly streams and saves image/video into Android Gallery so users can immediately view it!
     */
    @PluginMethod
    public void saveMediaToGallery(PluginCall call) {
        String urlStr = call.getString("url");
        String base64Str = call.getString("base64");
        String filePath = call.getString("filePath");
        String filename = call.getString("filename");
        String mimeType = call.getString("mimeType");

        if (filename == null || filename.trim().isEmpty()) {
            filename = "ImageTool_" + System.currentTimeMillis() + ".mp4";
        }
        filename = sanitizeFilename(filename);

        if (mimeType == null || mimeType.trim().isEmpty()) {
            mimeType = filename.endsWith(".mp4") ? "video/mp4" : "image/png";
        }

        final boolean isVideo = mimeType.startsWith("video/") || filename.endsWith(".mp4");
        final String finalFilename = filename;
        final String finalMimeType = mimeType;

        new Thread(() -> {
            OutputStream out = null;
            Uri mediaUri = null;
            File legacyFile = null;
            try {
                Context ctx = getContext();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(isVideo ? MediaStore.Video.Media.DISPLAY_NAME : MediaStore.Images.Media.DISPLAY_NAME, finalFilename);
                    values.put(isVideo ? MediaStore.Video.Media.MIME_TYPE : MediaStore.Images.Media.MIME_TYPE, finalMimeType);
                    values.put(isVideo ? MediaStore.Video.Media.RELATIVE_PATH : MediaStore.Images.Media.RELATIVE_PATH,
                            (isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/ImageTool");
                    values.put(isVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 1);

                    Uri collection = isVideo ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                    mediaUri = ctx.getContentResolver().insert(collection, values);
                    if (mediaUri == null) {
                        call.reject("Không thể tạo bản ghi MediaStore (Có thể trùng tên tệp)");
                        return;
                    }
                    out = ctx.getContentResolver().openOutputStream(mediaUri);
                } else {
                    File targetDir = Environment.getExternalStoragePublicDirectory(
                            isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                    File appDir = new File(targetDir, "ImageTool");
                    if (!appDir.exists() && !appDir.mkdirs()) {
                        appDir = ctx.getExternalFilesDir(isVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                    }
                    legacyFile = new File(appDir, finalFilename);
                    out = new FileOutputStream(legacyFile);
                }

                if (out == null) {
                    call.reject("Không thể mở luồng ghi tệp");
                    return;
                }

                // 1. Nếu có đường dẫn file nội bộ (filePath từ Cache / App storage)
                if (filePath != null && !filePath.trim().isEmpty()) {
                    String cleanPath = filePath.trim();
                    if (cleanPath.startsWith("file://")) {
                        cleanPath = cleanPath.substring(7);
                    }
                    File srcFile = new File(cleanPath);
                    if (!srcFile.exists()) {
                        call.reject("Không tìm thấy file nguồn tạm: " + cleanPath);
                        return;
                    }
                    try (InputStream in = new BufferedInputStream(new java.io.FileInputStream(srcFile))) {
                        byte[] buffer = new byte[32768];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            out.write(buffer, 0, len);
                        }
                        out.flush();
                    }
                    try {
                        if (srcFile.getAbsolutePath().contains(ctx.getCacheDir().getAbsolutePath())) {
                            srcFile.delete();
                        }
                    } catch (Exception ignored) {}
                }
                // 2. Nếu là URL mạng từ máy chủ (HTTP/HTTPS) -> stream trực tiếp với User-Agent & redirect
                else if (urlStr != null && (urlStr.startsWith("http://") || urlStr.startsWith("https://"))) {
                    File tempDownload = new File(ctx.getCacheDir(), "dl_" + System.currentTimeMillis() + "_" + finalFilename);
                    downloadHttpToFile(urlStr, tempDownload);

                    try (InputStream in = new BufferedInputStream(new java.io.FileInputStream(tempDownload))) {
                        byte[] buffer = new byte[32768];
                        int len;
                        while ((len = in.read(buffer)) != -1) {
                            out.write(buffer, 0, len);
                        }
                        out.flush();
                    }
                    try { tempDownload.delete(); } catch (Exception ignored) {}
                }
                // 3. Nếu là dữ liệu Base64
                else if (base64Str != null && !base64Str.isEmpty()) {
                    String clean = base64Str.contains(",") ? base64Str.substring(base64Str.indexOf(",") + 1) : base64Str;
                    byte[] bytes = Base64.decode(clean, Base64.DEFAULT);
                    out.write(bytes);
                    out.flush();
                } else {
                    call.reject("Dữ liệu video hoặc link tải không hợp lệ");
                    return;
                }

                out.close();
                out = null;

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && mediaUri != null) {
                    try {
                        ContentValues values = new ContentValues();
                        values.put(isVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 0);
                        ctx.getContentResolver().update(mediaUri, values, null, null);
                    } catch (Exception ignored) {}
                } else if (legacyFile != null) {
                    MediaScannerConnection.scanFile(ctx, new String[]{legacyFile.getAbsolutePath()}, new String[]{finalMimeType}, null);
                }

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("message", "✅ Đã lưu vào Bộ sưu tập (" + (isVideo ? "Movies/ImageTool" : "Pictures/ImageTool") + ")");
                res.put("path", mediaUri != null ? mediaUri.toString() : (legacyFile != null ? legacyFile.getAbsolutePath() : ""));
                call.resolve(res);
            } catch (Exception e) {
                if (out != null) {
                    try { out.close(); } catch (Exception ignored) {}
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && mediaUri != null) {
                    try { getContext().getContentResolver().delete(mediaUri, null, null); } catch (Exception ignored) {}
                }
                call.reject("Lỗi lưu media vào máy: " + e.getMessage());
            }
        }).start();
    }

    private final ExecutorService chunkExecutor = Executors.newSingleThreadExecutor();
    private OutputStream chunkOutputStream = null;
    private Uri chunkMediaUri = null;
    private File chunkLegacyFile = null;
    private String chunkFinalMime = null;
    private boolean chunkIsVideo = false;

    /**
     * Synchronized chunked media writer for large blobs and videos to avoid WebView bridge memory limits
     */
    @PluginMethod
    public void saveMediaChunk(PluginCall call) {
        String chunkBase64 = call.getString("chunk");
        Boolean isFirst = call.getBoolean("isFirst", false);
        Boolean isLast = call.getBoolean("isLast", false);
        String rawFilename = call.getString("filename");
        String rawMimeType = call.getString("mimeType");

        chunkExecutor.submit(() -> {
            try {
                Context ctx = getContext();
                if (Boolean.TRUE.equals(isFirst) || chunkOutputStream == null) {
                    if (chunkOutputStream != null) {
                        try { chunkOutputStream.close(); } catch (Exception ignored) {}
                        chunkOutputStream = null;
                    }

                    String filename = (rawFilename != null && !rawFilename.trim().isEmpty())
                            ? rawFilename.trim()
                            : ("ImageTool_" + System.currentTimeMillis() + ".mp4");
                    filename = sanitizeFilename(filename);

                    String mimeType = (rawMimeType != null && !rawMimeType.trim().isEmpty())
                            ? rawMimeType.trim()
                            : (filename.endsWith(".mp4") ? "video/mp4" : "image/png");

                    chunkIsVideo = mimeType.startsWith("video/") || filename.endsWith(".mp4");
                    chunkFinalMime = mimeType;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        ContentValues values = new ContentValues();
                        values.put(chunkIsVideo ? MediaStore.Video.Media.DISPLAY_NAME : MediaStore.Images.Media.DISPLAY_NAME, filename);
                        values.put(chunkIsVideo ? MediaStore.Video.Media.MIME_TYPE : MediaStore.Images.Media.MIME_TYPE, chunkFinalMime);
                        values.put(chunkIsVideo ? MediaStore.Video.Media.RELATIVE_PATH : MediaStore.Images.Media.RELATIVE_PATH,
                                (chunkIsVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES) + "/ImageTool");
                        values.put(chunkIsVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 1);

                        Uri collection = chunkIsVideo ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
                        chunkMediaUri = ctx.getContentResolver().insert(collection, values);
                        if (chunkMediaUri == null) {
                            call.reject("Không thể tạo MediaStore URI (Có thể trùng tên tệp)");
                            return;
                        }
                        chunkOutputStream = ctx.getContentResolver().openOutputStream(chunkMediaUri);
                    } else {
                        File targetDir = Environment.getExternalStoragePublicDirectory(
                                chunkIsVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                        File appDir = new File(targetDir, "ImageTool");
                        if (!appDir.exists() && !appDir.mkdirs()) {
                            appDir = ctx.getExternalFilesDir(chunkIsVideo ? Environment.DIRECTORY_MOVIES : Environment.DIRECTORY_PICTURES);
                        }
                        chunkLegacyFile = new File(appDir, filename);
                        chunkOutputStream = new FileOutputStream(chunkLegacyFile);
                    }
                }

                if (chunkOutputStream == null) {
                    call.reject("Luồng ghi MediaStore chưa được khởi tạo");
                    return;
                }

                if (chunkBase64 != null && !chunkBase64.isEmpty()) {
                    String clean = chunkBase64.contains(",") ? chunkBase64.substring(chunkBase64.indexOf(",") + 1) : chunkBase64;
                    byte[] bytes = Base64.decode(clean, Base64.DEFAULT);

                    // Auto detect magic bytes on first chunk
                    if (Boolean.TRUE.equals(isFirst) && bytes.length >= 8) {
                        if (bytes[0] == (byte) 0x1A && bytes[1] == (byte) 0x45 && bytes[2] == (byte) 0xDF && bytes[3] == (byte) 0xA3) {
                            chunkFinalMime = "video/webm";
                        } else if (bytes[4] == 'f' && bytes[5] == 't' && bytes[6] == 'y' && bytes[7] == 'p') {
                            chunkFinalMime = "video/mp4";
                        }
                    }

                    chunkOutputStream.write(bytes);
                    chunkOutputStream.flush();
                }

                if (Boolean.TRUE.equals(isLast)) {
                    chunkOutputStream.close();
                    chunkOutputStream = null;

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && chunkMediaUri != null) {
                        try {
                            ContentValues values = new ContentValues();
                            values.put(chunkIsVideo ? MediaStore.Video.Media.IS_PENDING : MediaStore.Images.Media.IS_PENDING, 0);
                            values.put(chunkIsVideo ? MediaStore.Video.Media.MIME_TYPE : MediaStore.Images.Media.MIME_TYPE, chunkFinalMime);
                            ctx.getContentResolver().update(chunkMediaUri, values, null, null);
                        } catch (Exception ignored) {}
                    } else if (chunkLegacyFile != null) {
                        MediaScannerConnection.scanFile(ctx, new String[]{chunkLegacyFile.getAbsolutePath()}, new String[]{chunkFinalMime}, null);
                    }

                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("message", "✅ Đã lưu vào Bộ sưu tập (" + (chunkIsVideo ? "Movies/ImageTool" : "Pictures/ImageTool") + ")");
                    res.put("path", chunkMediaUri != null ? chunkMediaUri.toString() : (chunkLegacyFile != null ? chunkLegacyFile.getAbsolutePath() : ""));
                    call.resolve(res);
                } else {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("chunkSaved", true);
                    call.resolve(res);
                }
            } catch (Exception e) {
                if (chunkOutputStream != null) {
                    try { chunkOutputStream.close(); } catch (Exception ignored) {}
                    chunkOutputStream = null;
                }
                call.reject("Lỗi khi ghi chunk media: " + e.getMessage());
            }
        });
    }

    /**
     * Native MP4 Video Concatenation for Android APK (MediaExtractor + MediaMuxer)
     * Extremely fast (0.2s), genuine MP4 H.264, zero quality loss.
     */
    @PluginMethod
    public void mergeVideos(PluginCall call) {
        org.json.JSONArray urlsJson = call.getArray("videoUrls");
        String filename = call.getString("filename");
        if (urlsJson == null || urlsJson.length() == 0) {
            call.reject("Không có danh sách video để ghép");
            return;
        }

        new Thread(() -> {
            File cacheDir = null;
            try {
                Context ctx = getContext();
                List<File> tempClips = new ArrayList<>();
                cacheDir = new File(ctx.getCacheDir(), "video_merge_" + System.currentTimeMillis());
                cacheDir.mkdirs();

                for (int i = 0; i < urlsJson.length(); i++) {
                    String clipUrl = urlsJson.getString(i);
                    File localFile = new File(cacheDir, "clip_" + i + ".mp4");

                    if (clipUrl.startsWith("http://") || clipUrl.startsWith("https://")) {
                        downloadHttpToFile(clipUrl, localFile);
                    } else if (clipUrl.startsWith("file://")) {
                        File src = new File(Uri.parse(clipUrl).getPath());
                        copyFile(src, localFile);
                    } else {
                        File src = new File(clipUrl);
                        if (src.exists()) {
                            copyFile(src, localFile);
                        } else {
                            throw new Exception("Không tìm thấy clip: " + clipUrl);
                        }
                    }
                    tempClips.add(localFile);
                }

                if (tempClips.isEmpty()) {
                    throw new Exception("Không tải được clip nào để ghép");
                }

                if (tempClips.size() == 1) {
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("path", tempClips.get(0).getAbsolutePath());
                    res.put("url", "file://" + tempClips.get(0).getAbsolutePath());
                    call.resolve(res);
                    return;
                }

                String cleanName = sanitizeFilename(filename);
                if (!cleanName.endsWith(".mp4")) cleanName += ".mp4";
                File tempOutput = new File(cacheDir, "merged_" + cleanName);

                MediaMuxer muxer = new MediaMuxer(tempOutput.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);

                int muxerVideoTrack = -1;
                int muxerAudioTrack = -1;

                MediaExtractor firstExtractor = new MediaExtractor();
                firstExtractor.setDataSource(tempClips.get(0).getAbsolutePath());
                for (int i = 0; i < firstExtractor.getTrackCount(); i++) {
                    MediaFormat format = firstExtractor.getTrackFormat(i);
                    String mime = format.getString(MediaFormat.KEY_MIME);
                    if (mime != null && mime.startsWith("video/") && muxerVideoTrack == -1) {
                        muxerVideoTrack = muxer.addTrack(format);
                    } else if (mime != null && mime.startsWith("audio/") && muxerAudioTrack == -1) {
                        muxerAudioTrack = muxer.addTrack(format);
                    }
                }
                firstExtractor.release();

                if (muxerVideoTrack == -1) {
                    throw new Exception("Không tìm thấy luồng video hợp lệ trong clip đầu tiên");
                }

                muxer.start();

                ByteBuffer buffer = ByteBuffer.allocate(1024 * 1024 * 2);
                MediaCodec.BufferInfo bufferInfo = new MediaCodec.BufferInfo();
                long videoPtsOffsetUs = 0;
                long audioPtsOffsetUs = 0;

                for (File clip : tempClips) {
                    MediaExtractor extractor = new MediaExtractor();
                    extractor.setDataSource(clip.getAbsolutePath());

                    int clipVideoTrack = -1;
                    int clipAudioTrack = -1;
                    for (int i = 0; i < extractor.getTrackCount(); i++) {
                        MediaFormat format = extractor.getTrackFormat(i);
                        String mime = format.getString(MediaFormat.KEY_MIME);
                        if (mime != null && mime.startsWith("video/") && clipVideoTrack == -1) {
                            clipVideoTrack = i;
                        } else if (mime != null && mime.startsWith("audio/") && clipAudioTrack == -1) {
                            clipAudioTrack = i;
                        }
                    }

                    long lastVideoPts = 0;
                    long lastAudioPts = 0;

                    if (clipVideoTrack != -1) {
                        extractor.selectTrack(clipVideoTrack);
                        while (true) {
                            int sampleSize = extractor.readSampleData(buffer, 0);
                            if (sampleSize < 0) break;

                            bufferInfo.offset = 0;
                            bufferInfo.size = sampleSize;
                            bufferInfo.presentationTimeUs = extractor.getSampleTime() + videoPtsOffsetUs;
                            bufferInfo.flags = extractor.getSampleFlags();

                            muxer.writeSampleData(muxerVideoTrack, buffer, bufferInfo);
                            lastVideoPts = extractor.getSampleTime();
                            extractor.advance();
                        }
                        extractor.unselectTrack(clipVideoTrack);
                    }

                    if (clipAudioTrack != -1 && muxerAudioTrack != -1) {
                        extractor.selectTrack(clipAudioTrack);
                        while (true) {
                            int sampleSize = extractor.readSampleData(buffer, 0);
                            if (sampleSize < 0) break;

                            bufferInfo.offset = 0;
                            bufferInfo.size = sampleSize;
                            bufferInfo.presentationTimeUs = extractor.getSampleTime() + audioPtsOffsetUs;
                            bufferInfo.flags = extractor.getSampleFlags();

                            muxer.writeSampleData(muxerAudioTrack, buffer, bufferInfo);
                            lastAudioPts = extractor.getSampleTime();
                            extractor.advance();
                        }
                        extractor.unselectTrack(clipAudioTrack);
                    }

                    extractor.release();

                    videoPtsOffsetUs += lastVideoPts + 33000L;
                    audioPtsOffsetUs += lastAudioPts + 23000L;
                }

                muxer.stop();
                muxer.release();

                // Lưu bản sao vào Gallery MediaStore
                Uri galleryUri = saveFileToGalleryInternal(ctx, tempOutput, cleanName, "video/mp4", true);

                JSObject res = new JSObject();
                res.put("success", true);
                res.put("path", tempOutput.getAbsolutePath());
                res.put("url", "file://" + tempOutput.getAbsolutePath());
                if (galleryUri != null) {
                    res.put("galleryUri", galleryUri.toString());
                }
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Lỗi ghép video Android Native: " + e.getMessage());
            }
        }).start();
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
