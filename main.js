

const { app, BrowserWindow, ipcMain, Menu, dialog, globalShortcut } = require('electron'); 
const path = require('path');
const fs = require('fs');


let optionsWindow = null;
let turntableWindow = null;
let timerWindow = null;
let isTurntableFrameless = false, isTimerFrameless = false;
let lastKnownOptionsData = [], countdownSeconds = 0, countdownInterval = null;
const autoSavePath = path.join(app.getPath('userData'), 'app-state.json');
let lastKnownColors = { background: '#2c3e50', font: '#ecf0f1' };


app.whenReady().then(() => {
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


function formatTime(totalSeconds) { const sign = totalSeconds < 0 ? "-" : ""; totalSeconds = Math.abs(totalSeconds); const h = Math.floor(totalSeconds / 3600); const m = Math.floor((totalSeconds % 3600) / 60); const s = totalSeconds % 60; return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; }
function broadcastTime() { const time = formatTime(countdownSeconds); if (optionsWindow && !optionsWindow.isDestroyed()) optionsWindow.webContents.send('time-update', time); if (timerWindow && !timerWindow.isDestroyed()) timerWindow.webContents.send('time-update', time); }
function startPauseTimer() { if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; } else { countdownInterval = setInterval(() => { countdownSeconds--; broadcastTime(); }, 1000); } }
function resetTimer() { clearInterval(countdownInterval); countdownInterval = null; countdownSeconds = 0; broadcastTime(); }
function adjustTime(seconds) { countdownSeconds += seconds; broadcastTime(); }
function broadcastWindowState() { const state = { isTurntableOpen: !!(turntableWindow && !turntableWindow.isDestroyed()), isTimerOpen: !!(timerWindow && !timerWindow.isDestroyed()) }; if (optionsWindow && !optionsWindow.isDestroyed()) { optionsWindow.webContents.send('window-state-update', state); } }
function createOptionsWindow() { optionsWindow = new BrowserWindow({ width: 630, height: 750, x: 620, y: 50, webPreferences: { contextIsolation: false, nodeIntegration: true, backgroundThrottling: false }, icon: path.join(__dirname, 'icon.ico') }); optionsWindow.loadFile('options.html'); optionsWindow.webContents.on('did-finish-load', () => { try { if (fs.existsSync(autoSavePath)) { const savedState = JSON.parse(fs.readFileSync(autoSavePath, 'utf-8')); optionsWindow.webContents.send('load-state', savedState); } } catch (error) { console.error('讀取自動儲存檔案失敗:', error); } }); optionsWindow.on('close', () => { if (turntableWindow && !turntableWindow.isDestroyed()) turntableWindow.destroy(); if (timerWindow && !timerWindow.isDestroyed()) timerWindow.destroy(); }); optionsWindow.on('closed', () => { app.quit(); }); }
function createTurntableWindow(bounds = null) { if (turntableWindow && !turntableWindow.isDestroyed()) { turntableWindow.focus(); return; } const windowOptions = { width: 550, height: 550, frame: !isTurntableFrameless, transparent: isTurntableFrameless, webPreferences: { contextIsolation: false, nodeIntegration: true } }; if (bounds) { Object.assign(windowOptions, bounds); } else { windowOptions.x = 50; windowOptions.y = 50; } turntableWindow = new BrowserWindow(windowOptions); turntableWindow.loadFile('turntable.html'); const menuTemplate = [{ label: '控制', submenu: [{ label: '切換邊框', accelerator: 'F10', click: () => { if (turntableWindow && !turntableWindow.isDestroyed()) { const currentBounds = turntableWindow.getBounds(); isTurntableFrameless = !isTurntableFrameless; turntableWindow.destroy(); createTurntableWindow(currentBounds); } } }] }]; const menu = Menu.buildFromTemplate(menuTemplate); turntableWindow.setMenu(menu); turntableWindow.setMenuBarVisibility(false); turntableWindow.webContents.on('did-finish-load', () => { if (turntableWindow && !turntableWindow.isDestroyed()) turntableWindow.webContents.send('wheel-updated', lastKnownOptionsData); }); turntableWindow.on('close', () => { turntableWindow = null; broadcastWindowState(); }); broadcastWindowState(); }
function createTimerWindow(bounds = null) { if (timerWindow && !timerWindow.isDestroyed()) { timerWindow.focus(); return; } const windowOptions = { width: 300, height: 150, frame: !isTimerFrameless, transparent: isTimerFrameless, webPreferences: { contextIsolation: false, nodeIntegration: true, backgroundThrottling: false } }; if (bounds) { Object.assign(windowOptions, bounds); } else { windowOptions.x = 50; windowOptions.y = 620; } timerWindow = new BrowserWindow(windowOptions); timerWindow.loadFile('timer.html'); const menuTemplate = [{ label: '控制', submenu: [{ label: '切換邊框', accelerator: 'F10', click: () => { if (timerWindow && !timerWindow.isDestroyed()) { const currentBounds = timerWindow.getBounds(); isTimerFrameless = !isTimerFrameless; timerWindow.destroy(); createTimerWindow(currentBounds); } } }] }]; const menu = Menu.buildFromTemplate(menuTemplate); timerWindow.setMenu(menu); timerWindow.setMenuBarVisibility(false); timerWindow.webContents.on('did-finish-load', () => { broadcastTime(); if (timerWindow && !timerWindow.isDestroyed()) { timerWindow.webContents.send('apply-color-update', lastKnownColors); } }); timerWindow.on('close', () => { timerWindow = null; broadcastWindowState(); }); broadcastWindowState(); }
app.on('window-all-closed', () => { if (process.platform !== 'darwin') { app.quit(); } });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) { createOptionsWindow(); } });
ipcMain.handle('get-initial-options', () => lastKnownOptionsData);
ipcMain.on('toggle-turntable', () => { if (turntableWindow && !turntableWindow.isDestroyed()) { turntableWindow.close(); } else { createTurntableWindow(); } });
ipcMain.on('toggle-timer', () => { if (timerWindow && !timerWindow.isDestroyed()) { timerWindow.close(); } else { createTimerWindow(); } });
let lastKnownState = {}; ipcMain.on('state-update', (event, state) => { lastKnownState = state; }); ipcMain.on('save-state-on-close', () => { try { fs.writeFileSync(autoSavePath, JSON.stringify(lastKnownState, null, 2)); console.log('應用程式狀態已自動儲存。'); } catch (error) { console.error('自動儲存失敗:', error); } });
ipcMain.handle('export-data', async (event, state) => { const { canceled, filePath } = await dialog.showSaveDialog({ title: '匯出設定', defaultPath: 'turntable-settings.json', filters: [{ name: 'JSON 檔案', extensions: ['json'] }] }); if (!canceled && filePath) { try { fs.writeFileSync(filePath, JSON.stringify(state, null, 2)); return { success: true, path: filePath }; } catch (error) { return { success: false, error: error.message }; } } return { success: false }; });
ipcMain.handle('import-data', async () => { const { canceled, filePaths } = await dialog.showOpenDialog({ title: '匯入設定', filters: [{ name: 'JSON 檔案', extensions: ['json'] }], properties: ['openFile'] }); if (!canceled && filePaths.length > 0) { try { const data = fs.readFileSync(filePaths[0], 'utf-8'); return { success: true, state: JSON.parse(data) }; } catch (error) { return { success: false, error: error.message }; } } return { success: false }; });
ipcMain.on('update-wheel', (event, optionsData) => { lastKnownOptionsData = optionsData; if (turntableWindow && !turntableWindow.isDestroyed()) { turntableWindow.webContents.send('wheel-updated', optionsData); } });
ipcMain.on('spin-result', (event, timeData) => { const timeToAdd = (timeData.h * 3600) + (timeData.m * 60) + timeData.s; adjustTime(timeToAdd); });
ipcMain.on('timer-control', (event, command) => { if (command === 'start-pause') startPauseTimer(); if (command === 'reset') resetTimer(); });
ipcMain.on('time-adjust', (event, seconds) => { adjustTime(seconds); });
ipcMain.on('color-update', (event, colors) => { lastKnownColors = colors; if (timerWindow && !timerWindow.isDestroyed()) { timerWindow.webContents.send('apply-color-update', colors); } });