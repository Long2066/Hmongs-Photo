import json
import os
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_DIR = os.path.join(ROOT_DIR, 'dist')
OTA_DIR = os.path.join(ROOT_DIR, 'AdminPanel', 'public', 'ota')
PKG_PATH = os.path.join(ROOT_DIR, 'package.json')

with open(PKG_PATH, 'r', encoding='utf-8') as f:
    pkg = json.load(f)

version = pkg['version']
os.makedirs(OTA_DIR, exist_ok=True)

bundle_zip_path = os.path.join(OTA_DIR, 'bundle.zip')

# Pack dist/ into bundle.zip using POSIX forward slashes
with zipfile.ZipFile(bundle_zip_path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
    for root, dirs, files in os.walk(DIST_DIR):
        for file in files:
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, DIST_DIR).replace('\\', '/')
            zf.write(full_path, rel_path)

manifest = {
    "version": version,
    "minNativeVersion": "2.25.40",
    "bundleUrl": f"https://toolphoto-2025.web.app/ota/bundle.zip?v={version}",
    "notes": f"Phien ban {version} - Tu dong cap nhat khi co mang & toi uu full man hinh"
}

manifest_path = os.path.join(OTA_DIR, 'version.json')
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)

size_kb = os.path.getsize(bundle_zip_path) / 1024
print(f"[OTA] Built bundle.zip ({size_kb:.1f} KB) and version.json for v{version}")
