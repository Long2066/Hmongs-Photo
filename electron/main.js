const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');

// Store for user settings
let downloadPath = app.getPath('downloads');

// Keep a global reference of the window object
let mainWindow;

// Auto-updater configuration
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '../public/icon.png'),
        title: 'ToolPhoto2025 - AI Studio',
        show: false,
        backgroundColor: '#f8fafc'
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        // Check for updates after window shows
        checkForUpdates();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ============ AUTO-UPDATER ============
function checkForUpdates() {
    autoUpdater.checkForUpdates().catch(err => {
        console.log('Update check failed:', err);
    });
}

autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('update-available', info);
});

autoUpdater.on('update-not-available', () => {
    console.log('App is up to date');
});

autoUpdater.on('download-progress', (progressObj) => {
    mainWindow.webContents.send('update-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info) => {
    mainWindow.webContents.send('update-downloaded', info);
});

autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err);
    mainWindow.webContents.send('update-error', err.message);
});

// ============ IPC HANDLERS ============

// Handle download update request
ipcMain.handle('download-update', async () => {
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Handle install update request
ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
});

// Handle folder picker dialog
ipcMain.handle('select-download-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Chọn thư mục lưu ảnh',
        defaultPath: downloadPath,
        properties: ['openDirectory', 'createDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
        downloadPath = result.filePaths[0];
        return { success: true, path: downloadPath };
    }
    return { success: false };
});

// Get current download path
ipcMain.handle('get-download-path', () => {
    return downloadPath;
});

// Save file to custom folder
ipcMain.handle('save-file', async (event, { base64, filename }) => {
    try {
        const filePath = path.join(downloadPath, filename);
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filePath, buffer);
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Open URL in incognito/private mode
ipcMain.handle('open-incognito', async (event, url) => {
    const { exec } = require('child_process');
    
    // Try Chrome first, then Edge, then Firefox
    const commands = [
        `start chrome --incognito "${url}"`,
        `start msedge --inprivate "${url}"`,
        `start firefox -private-window "${url}"`
    ];

    for (const cmd of commands) {
        try {
            await new Promise((resolve, reject) => {
                exec(cmd, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            return { success: true };
        } catch {
            continue;
        }
    }

    // Fallback: open in default browser (not incognito)
    shell.openExternal(url);
    return { success: true, fallback: true };
});

// Get app version
ipcMain.handle('get-app-version', () => {
    return app.getVersion();
});

// ============ APP LIFECYCLE ============
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});
