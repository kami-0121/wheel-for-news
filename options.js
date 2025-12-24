const { ipcRenderer } = require('electron');
const Sortable = require('sortablejs'); 
// --- 元素獲取 ---
const showTurntableBtn = document.getElementById('show-turntable-btn');
const showTimerBtn = document.getElementById('show-timer-btn');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const optionsList = document.getElementById('options-list');
const addOptionBtn = document.getElementById('add-option-btn');
const updateWheelBtn = document.getElementById('update-wheel-btn');
const countdownDisplay = document.getElementById('countdown-display');
const startPauseBtn = document.getElementById('start-pause-btn');
const resetBtn = document.getElementById('reset-btn');
const timeAdjustButtons = document.querySelectorAll('.time-btn');
const bgColorPicker = document.getElementById('bg-color-picker');
const fontColorPicker = document.getElementById('font-color-picker');

// --- 核心函數：狀態管理 ---
function getCurrentState() {
    const options = [];
    document.querySelectorAll('.option-row').forEach(row => {
        options.push({ name: row.querySelector('.option-name-input').value.trim(), probability: parseFloat(row.querySelector('.option-prob-input').value) || 1, color: row.querySelector('.option-color-input').value, h: parseInt(row.querySelector('.option-h-input').value) || 0, m: parseInt(row.querySelector('.option-m-input').value) || 0, s: parseInt(row.querySelector('.option-s-input').value) || 0, });
    });
    const timeParts = countdownDisplay.textContent.replace('-', '').split(':');
    const sign = countdownDisplay.textContent.startsWith('-') ? -1 : 1;
    const countdownSeconds = sign * (parseInt(timeParts[0])*3600 + parseInt(timeParts[1])*60 + parseInt(timeParts[2]));
    const timerColors = { background: bgColorPicker.value, font: fontColorPicker.value };
    return { options, countdownSeconds, timerColors };
}

function applyState(state) {
    optionsList.innerHTML = '';
    if (state.options && Array.isArray(state.options) && state.options.length > 0) {
        state.options.forEach(opt => { createOptionRow(opt.name, opt.probability, opt.color, opt.h, opt.m, opt.s); });
    } else {
        loadDefaultOptions();
    }
    ipcRenderer.send('timer-control', 'reset');
    ipcRenderer.send('time-adjust', state.countdownSeconds || 0);
    if (state.timerColors) {
        bgColorPicker.value = state.timerColors.background || '#2c3e50';
        fontColorPicker.value = state.timerColors.font || '#ecf0f1';
        sendColorUpdate();
    }
    updatePercentages();
    updateWheelBtn.click();
}

function sendStateToMain() { const currentState = getCurrentState(); ipcRenderer.send('state-update', currentState); }
function sendColorUpdate() { const colors = { background: bgColorPicker.value, font: fontColorPicker.value }; ipcRenderer.send('color-update', colors); sendStateToMain(); }

// --- IPC 通訊 ---
ipcRenderer.on('time-update', (event, timeString) => { countdownDisplay.textContent = timeString; sendStateToMain(); });
ipcRenderer.on('window-state-update', (event, state) => { if (state.isTurntableOpen) { showTurntableBtn.textContent = '關閉轉盤'; showTurntableBtn.classList.add('active'); } else { showTurntableBtn.textContent = '顯示轉盤'; showTurntableBtn.classList.remove('active'); } if (state.isTimerOpen) { showTimerBtn.textContent = '關閉計時器'; showTimerBtn.classList.add('active'); } else { showTimerBtn.textContent = '顯示計時器'; showTimerBtn.classList.remove('active'); } });
ipcRenderer.on('load-state', (event, state) => { applyState(state); });

// --- 事件監聽 ---
exportBtn.addEventListener('click', async () => { const currentState = getCurrentState(); const result = await ipcRenderer.invoke('export-data', currentState); if (result.success) { alert(`設定已成功匯出至：\n${result.path}`); } });
importBtn.addEventListener('click', async () => { const result = await ipcRenderer.invoke('import-data'); if (result.success && result.state) { applyState(result.state); alert('設定已成功匯入！'); } });
addOptionBtn.addEventListener('click', () => { createOptionRow(); updatePercentages(); sendStateToMain(); });
bgColorPicker.addEventListener('input', sendColorUpdate);
fontColorPicker.addEventListener('input', sendColorUpdate);
window.addEventListener('beforeunload', () => { ipcRenderer.send('save-state-on-close'); });
updateWheelBtn.addEventListener('click', () => { const parsedOptions = []; document.querySelectorAll('.option-row').forEach(row => { const name = row.querySelector('.option-name-input').value.trim(); if (name) { parsedOptions.push({ text: name, fillStyle: row.querySelector('.option-color-input').value, weight: parseFloat(row.querySelector('.option-prob-input').value) || 1, h: parseInt(row.querySelector('.option-h-input').value) || 0, m: parseInt(row.querySelector('.option-m-input').value) || 0, s: parseInt(row.querySelector('.option-s-input').value) || 0 }); } }); ipcRenderer.send('update-wheel', parsedOptions); sendStateToMain(); });
startPauseBtn.addEventListener('click', () => { ipcRenderer.send('timer-control', 'start-pause'); if (startPauseBtn.textContent === '開始' || startPauseBtn.textContent === '繼續') { startPauseBtn.textContent = '暫停'; startPauseBtn.classList.add('paused'); } else { startPauseBtn.textContent = '繼續'; startPauseBtn.classList.remove('paused'); } sendStateToMain(); });
resetBtn.addEventListener('click', () => { ipcRenderer.send('timer-control', 'reset'); startPauseBtn.textContent = '開始'; startPauseBtn.classList.remove('paused'); sendStateToMain(); });
timeAdjustButtons.forEach(button => { button.addEventListener('click', () => { const seconds = parseInt(button.dataset.time); ipcRenderer.send('time-adjust', seconds); sendStateToMain(); }); });
showTurntableBtn.addEventListener('click', () => ipcRenderer.send('toggle-turntable'));
showTimerBtn.addEventListener('click', () => ipcRenderer.send('toggle-timer'));

// --- 介面核心函數 ---
const getRandomColor = () => `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
function updatePercentages() { const probInputs = document.querySelectorAll('.option-prob-input'); let totalWeight = 0; probInputs.forEach(input => { totalWeight += parseFloat(input.value) || 0; }); document.querySelectorAll('.option-row').forEach(row => { const probInput = row.querySelector('.option-prob-input'); const percentageSpan = row.querySelector('.option-percentage'); const weight = parseFloat(probInput.value) || 0; if (totalWeight > 0) { percentageSpan.textContent = `${((weight / totalWeight) * 100).toFixed(1)}%`; } else { percentageSpan.textContent = '0.0%'; } }); }
function createOptionRow(name = '', probability = 1, color = getRandomColor(), h, m, s) {
    const row = document.createElement('div');
    row.className = 'option-row';


    const handle = document.createElement('div');
    handle.className = 'drag-handle';
    handle.innerHTML = '⠿';
    handle.style.fontSize = '20px'; 


    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'option-name-input';
    nameInput.placeholder = '選項名稱';
    nameInput.value = name;

    const probInput = document.createElement('input');
    probInput.type = 'number';
    probInput.className = 'option-prob-input';
    probInput.min = '1';
    probInput.value = probability;
    probInput.oninput = () => {
        updatePercentages();
        sendStateToMain();
    };

    const percentageSpan = document.createElement('span');
    percentageSpan.className = 'option-percentage';

    const timerInputs = document.createElement('div');
    timerInputs.className = 'timer-inputs';

    const hInput = document.createElement('input');
    hInput.type = 'number';
    hInput.className = 'option-h-input';
    hInput.placeholder = '時';
    if (h !== undefined) hInput.value = h;
    hInput.oninput = sendStateToMain;

    const mInput = document.createElement('input');
    mInput.type = 'number';
    mInput.className = 'option-m-input';
    mInput.placeholder = '分';
    if (m !== undefined) mInput.value = m;
    mInput.oninput = sendStateToMain;

    const sInput = document.createElement('input');
    sInput.type = 'number';
    sInput.className = 'option-s-input';
    sInput.placeholder = '秒';
    if (s !== undefined) sInput.value = s;
    sInput.oninput = sendStateToMain;

    timerInputs.append(hInput, mInput, sInput);

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'option-color-input';
    colorInput.value = color;
    colorInput.oninput = sendStateToMain;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.innerHTML = '&times;';
    removeBtn.onclick = () => {
        row.remove();
        updatePercentages();
        sendStateToMain();
    };

    row.append(handle,nameInput, probInput, percentageSpan, timerInputs, colorInput, removeBtn);
    optionsList.append(row);

    nameInput.oninput = sendStateToMain;
}

// --- 初始載入 ---
function loadDefaultOptions() {
    createOptionRow('加 1 分鐘', 1, '#2ecc71', undefined, 1, undefined);
    createOptionRow('減 30 秒', 1, '#e74c3c', undefined, undefined, -30);
    createOptionRow('加 5 分鐘', 1, '#3498db', undefined, 5, undefined);
    updatePercentages();
    updateWheelBtn.click();
}
window.onload = function() {
    setTimeout(() => {
        if (optionsList.children.length === 0) {
            loadDefaultOptions();
        }
    }, 100);
     new Sortable(optionsList, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function (evt) {
            
            updateWheelBtn.click();
        },
    });
};