const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// ===== 快取和臨時目錄配置 =====
// 禁用所有硬體加速
app.disableHardwareAcceleration();

// 使用用戶資料目錄下的快取文件夾
const userDataPath = app.getPath('userData');
const cacheDir = path.join(userDataPath, 'cache');

try {
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    app.setPath('cache', cacheDir);
} catch (err) {
    console.log('快取目錄設定提示:', err.message);
}

// 禁用V8代碼快取
process.env.ELECTRON_DISABLE_V8_CODE_CACHE = '1';

// 🔴 變數統一定義在這裡
let currentFontFamily = 'cwTeXFangSong'; 
let optionsWindow = null;
let turntableWindow = null;
let timerWindow = null;
let isTurntableFrameless = false, isTimerFrameless = false;
let lastKnownOptionsData = [], countdownSeconds = 0, countdownInterval = null;
const autoSavePath = path.join(app.getPath('userData'), 'app-state.json');
let lastKnownColors = { background: '#2c3e50', font: '#ecf0f1' };


app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createOptionsWindow();

    globalShortcut.register('F9', () => {
        if (timerWindow && !timerWindow.isDestroyed()) {
            timerWindow.webContents.send('toggle-transparent-bg');
        }
    });

    globalShortcut.register('F8', () => {
        if (timerWindow && !timerWindow.isDestroyed()) {
            timerWindow.webContents.send('toggle-font-weight');
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

// 安全廣播函數
function safeBroadcast(channel, data) {
    const windows = [optionsWindow, turntableWindow, timerWindow];
    windows.forEach(win => {
        // 檢查視窗存在且尚未被銷毀
        if (win && !win.isDestroyed() && win.webContents) {
            win.webContents.send(channel, data);
        }
    });
}

function formatTime(totalSeconds) {
    const sign = totalSeconds < 0 ? '-' : '';
    totalSeconds = Math.abs(totalSeconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function broadcastTime() {
    const time = formatTime(countdownSeconds);
    if (optionsWindow && !optionsWindow.isDestroyed()) {
        optionsWindow.webContents.send('time-update', time);
    }
    if (timerWindow && !timerWindow.isDestroyed()) {
        timerWindow.webContents.send('time-update', time);
    }
}

function startPauseTimer() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
        return;
    }

    countdownInterval = setInterval(() => {
        countdownSeconds--;
        broadcastTime();
    }, 1000);
}

function resetTimer() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }
    countdownSeconds = 0;
    broadcastTime();
}

function adjustTime(seconds) {
    countdownSeconds += seconds;
    broadcastTime();
}

function broadcastWindowState() {
    const state = {
        isTurntableOpen: !!(turntableWindow && !turntableWindow.isDestroyed()),
        isTimerOpen: !!(timerWindow && !timerWindow.isDestroyed())
    };

    if (optionsWindow && !optionsWindow.isDestroyed()) {
        optionsWindow.webContents.send('window-state-update', state);
    }
}

function createOptionsWindow() {
    optionsWindow = new BrowserWindow({
        width: 700,
        height: 750,
        x: 620,
        y: 50,
        autoHideMenuBar: true,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            backgroundThrottling: false,
            preload: undefined
        },
        icon: path.join(__dirname, 'icon.ico')
    });

    optionsWindow.loadFile('options.html');

    optionsWindow.webContents.on('did-finish-load', () => {
        try {
            if (fs.existsSync(autoSavePath)) {
                const savedState = JSON.parse(fs.readFileSync(autoSavePath, 'utf-8'));
                optionsWindow.webContents.send('load-state', savedState);
            }
        } catch (error) {
            console.error('讀取自動儲存檔案失敗:', error);
        }
    });

    optionsWindow.on('close', () => {
        if (turntableWindow && !turntableWindow.isDestroyed()) turntableWindow.destroy();
        if (timerWindow && !timerWindow.isDestroyed()) timerWindow.destroy();
    });

    optionsWindow.on('closed', () => {
        app.quit();
    });
}

function createTurntableWindow(bounds = null) {
    if (turntableWindow && !turntableWindow.isDestroyed()) {
        turntableWindow.focus();
        return;
    }

    const windowOptions = {
        width: 550,
        height: 550,
        frame: !isTurntableFrameless,
        transparent: isTurntableFrameless,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            backgroundThrottling: false
        },
        icon: path.join(__dirname, 'icon.ico')
    };

    if (bounds) {
        Object.assign(windowOptions, bounds);
    } else {
        windowOptions.x = 50;
        windowOptions.y = 50;
    }

    turntableWindow = new BrowserWindow(windowOptions);
    turntableWindow.loadFile('turntable.html');

    const menuTemplate = [
        {
            label: '控制',
            submenu: [
                {
                    label: '切換邊框',
                    accelerator: 'F10',
                    click: () => {
                        if (turntableWindow && !turntableWindow.isDestroyed()) {
                            const currentBounds = turntableWindow.getBounds();
                            isTurntableFrameless = !isTurntableFrameless;
                            turntableWindow.destroy();
                            createTurntableWindow(currentBounds);
                        }
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    turntableWindow.setMenu(menu);
    turntableWindow.setMenuBarVisibility(false);

    // ✅ 修正：在這裡處理轉盤視窗建立後的初始化
    turntableWindow.webContents.on('did-finish-load', () => {
        if (turntableWindow && !turntableWindow.isDestroyed()) {
            turntableWindow.webContents.send('wheel-updated', lastKnownOptionsData);
            // 補發字體設定 (解決 F10 重置問題)
            turntableWindow.webContents.send('wheel-font-change', currentFontFamily);
        }
    });

    turntableWindow.on('close', () => {
        turntableWindow = null;
        broadcastWindowState();
    });

    broadcastWindowState();
}

function createTimerWindow(bounds = null) {
    if (timerWindow && !timerWindow.isDestroyed()) {
        timerWindow.focus();
        return;
    }

    const windowOptions = {
        width: 300,
        height: 150,
        frame: !isTimerFrameless,
        transparent: isTimerFrameless,
        webPreferences: {
            contextIsolation: false,
            nodeIntegration: true,
            backgroundThrottling: false
        },
        icon: path.join(__dirname, 'icon.ico')
    };

    if (bounds) {
        Object.assign(windowOptions, bounds);
    } else {
        windowOptions.x = 50;
        windowOptions.y = 620;
    }

    timerWindow = new BrowserWindow(windowOptions);
    timerWindow.loadFile('timer.html');

    const menuTemplate = [
        {
            label: '控制',
            submenu: [
                {
                    label: '切換邊框',
                    accelerator: 'F10',
                    click: () => {
                        if (timerWindow && !timerWindow.isDestroyed()) {
                            const currentBounds = timerWindow.getBounds();
                            isTimerFrameless = !isTimerFrameless;
                            timerWindow.destroy();
                            createTimerWindow(currentBounds);
                        }
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(menuTemplate);
    timerWindow.setMenu(menu);
    timerWindow.setMenuBarVisibility(false);

    // ✅ 修正：在這裡處理計時器視窗建立後的初始化
    timerWindow.webContents.on('did-finish-load', () => {
        broadcastTime();
        if (timerWindow && !timerWindow.isDestroyed()) {
            // 補發顏色和字體設定 (解決 F10 重置問題)
            timerWindow.webContents.send('apply-color-update', lastKnownColors);
            timerWindow.webContents.send('wheel-font-change', currentFontFamily);
        }
    });

    timerWindow.on('close', () => {
        timerWindow = null;
        broadcastWindowState();
    });

    broadcastWindowState();
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createOptionsWindow();
    }
});

ipcMain.handle('get-initial-options', () => lastKnownOptionsData);

// ✅ 修正：統一字體切換邏輯
ipcMain.on('wheel-font-change', (event, fontFamily) => {
    currentFontFamily = fontFamily; // 記住當前字體
    safeBroadcast('wheel-font-change', fontFamily); // 廣播給所有視窗
});

ipcMain.on('toggle-turntable', () => {
    if (turntableWindow && !turntableWindow.isDestroyed()) {
        turntableWindow.close();
    } else {
        createTurntableWindow();
    }
});

ipcMain.on('toggle-timer', () => {
    if (timerWindow && !timerWindow.isDestroyed()) {
        timerWindow.close();
    } else {
        createTimerWindow();
    }
});

let lastKnownState = {};
ipcMain.on('state-update', (event, state) => {
    lastKnownState = state;
});

ipcMain.on('save-state-on-close', (event, state) => {
  try {
    fs.writeFileSync(autoSavePath, JSON.stringify(state, null, 2));
    console.log('應用程式狀態已自動儲存。');
  } catch (error) {
    console.error('自動儲存失敗:', error);
  }
});

ipcMain.handle('export-data', async (event, state) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
        title: '匯出設定',
        defaultPath: 'turntable-settings.json',
        filters: [{ name: 'JSON 檔案', extensions: ['json'] }]
    });

    if (!canceled && filePath) {
        try {
            fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    return { success: false };
});

ipcMain.handle('import-data', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: '匯入設定',
        filters: [{ name: 'JSON 檔案', extensions: ['json'] }],
        properties: ['openFile']
    });

    if (!canceled && filePaths.length > 0) {
        try {
            const data = fs.readFileSync(filePaths[0], 'utf-8');
            return { success: true, state: JSON.parse(data) };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    return { success: false };
});

ipcMain.on('update-wheel', (event, optionsData) => {
    lastKnownOptionsData = optionsData;
    if (turntableWindow && !turntableWindow.isDestroyed()) {
        turntableWindow.webContents.send('wheel-updated', optionsData);
    }
});

ipcMain.on('spin-result', (event, timeData) => {
    let currentTotal = typeof countdownSeconds === 'number' ? countdownSeconds : 0;

    let currentH = Math.floor(currentTotal / 3600);
    let currentM = Math.floor((currentTotal % 3600) / 60);
    let currentS = currentTotal % 60;

    const processField = (input, currentVal) => {
        if (input === null || input === undefined || input === '') return currentVal;
        
        let val = String(input).trim();
        if (val === "" || val === "0" || val === "undefined") return currentVal;

        try {
            if (val.startsWith('*') || val.startsWith('/')) {
                const operator = val[0];
                const operandStr = val.substring(1).trim();
                
                if (!operandStr || operandStr === '') {
                    return currentVal;
                }
                
                const factor = new Function(`return ${operandStr}`)();
                
                if (typeof factor !== 'number' || isNaN(factor)) return currentVal;
                
                let result;
                if (operator === '*') result = currentVal * factor;
                if (operator === '/') result = factor !== 0 ? currentVal / factor : currentVal;
                
                return isFinite(result) ? result : currentVal;
            }

            if (val.startsWith('+') || val.startsWith('-')) {
                const amountToAdd = new Function(`return ${val}`)();
                if (typeof amountToAdd !== 'number' || isNaN(amountToAdd)) return currentVal;
                return currentVal + amountToAdd;
            }

            const calculatedValue = new Function(`return ${val}`)();
            if (typeof calculatedValue !== 'number' || isNaN(calculatedValue)) return currentVal;
            
            return currentVal + calculatedValue;

        } catch (e) {
            return currentVal;
        }
    };

    let nextH = processField(timeData.h, currentH);
    let nextM = processField(timeData.m, currentM);
    let nextS = processField(timeData.s, currentS);

    const finalTotalSeconds = Math.max(0, Math.round((nextH * 3600) + (nextM * 60) + nextS));
    countdownSeconds = finalTotalSeconds;

    broadcastTime();
});

ipcMain.on('timer-control', (event, command) => {
    if (command === 'start-pause') startPauseTimer();
    if (command === 'reset') resetTimer();
});

ipcMain.on('time-adjust', (event, seconds) => {
    adjustTime(seconds);
});

ipcMain.on('color-update', (event, colors) => {
    lastKnownColors = colors;
    if (timerWindow && !timerWindow.isDestroyed()) {
        timerWindow.webContents.send('apply-color-update', colors);
    }
});

ipcMain.on('request-wheel-font', (event) => {
    // 修正：使用正確的變數名稱
    event.sender.send('wheel-font-init', currentFontFamily);
});

// 🔴 這裡原本有你貼錯的 dangling code，已經被移除了，請確保你的檔案到這裡就結束了