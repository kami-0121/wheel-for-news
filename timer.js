const { ipcRenderer } = require('electron');

const timerWrapper = document.getElementById('timer-wrapper');
const countdownDisplay = document.getElementById('countdown-display');

// 監聽來自 main.js 的樣式更新指令
ipcRenderer.on('toggle-transparent-bg', () => {
    timerWrapper.classList.toggle('transparent');
});

ipcRenderer.on('toggle-font-weight', () => {
    countdownDisplay.classList.toggle('bold-text');
});

ipcRenderer.on('apply-color-update', (event, colors) => {
    if (countdownDisplay) {
        countdownDisplay.style.backgroundColor = colors.background;
        countdownDisplay.style.color = colors.font;
    }
});

// 監聽時間更新
ipcRenderer.on('time-update', (event, timeString) => {
    if (countdownDisplay) {
        countdownDisplay.textContent = timeString;
    }
});

// 監聽 F10
ipcRenderer.on('f10-pressed', () => {
    ipcRenderer.send('toggle-my-frame');
});

ipcRenderer.on('wheel-font-change', (event, fontFamily) => {
    if (countdownDisplay) {
        countdownDisplay.style.fontFamily = fontFamily;
    }
});