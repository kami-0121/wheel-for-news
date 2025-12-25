const { ipcRenderer } = require('electron');
const Sortable = require('sortablejs');

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
const fontSelect = document.querySelector('.divider-select');

const fonts = [
  { label: '仿宋（cwTeXFangSong）', family: 'cwTeXFangSong' },
  { label: '黑體（Noto Sans TC）', family: 'NotoSansTC' },
  { label: '思源宋體', family: 'SourceHanSerifTC' },
  { label: '微軟正黑體', family: 'Microsoft JhengHei' },
  { label: '標楷體', family: 'DFKai-SB' },
  { label: 'Excalifont', family: 'Excalifont-Regular' }
];

fonts.forEach(font => {
  const option = document.createElement('option');
  option.value = font.family;
  option.textContent = font.label;
  fontSelect.appendChild(option);
});

fontSelect.addEventListener('change', (e) => {
  const font = e.target.value;
    ipcRenderer.send('wheel-font-change', font);
    document.getElementById('countdown-display').style.fontFamily = font;
});
function getCurrentState() {
  const options = [];
  document.querySelectorAll('.option-row').forEach(row => {
    options.push({
      name: row.querySelector('.option-name-input').value.trim(),
      probability: parseFloat(row.querySelector('.option-prob-input').value) || 1,
      color: row.querySelector('.option-color-input').value,
      h: row.querySelector('.option-h-input').value || "0",
      m: row.querySelector('.option-m-input').value || "0",
      s: row.querySelector('.option-s-input').value || "0",
    });
  });

  const timeText = countdownDisplay.textContent;
  const timeParts = timeText.replace('-', '').split(':');
  const sign = timeText.startsWith('-') ? -1 : 1;
  const countdownSeconds = sign * (parseInt(timeParts[0])*3600 + parseInt(timeParts[1])*60 + parseInt(timeParts[2]));
  
  const timerColors = {
    background: bgColorPicker.value,
    font: fontColorPicker.value
  };

  return { options, countdownSeconds, timerColors };
}

function applyState(state) {
  optionsList.innerHTML = '';
  if (state.options && Array.isArray(state.options) && state.options.length > 0) {
    state.options.forEach(opt => {
      createOptionRow(opt.name, opt.probability, opt.color, opt.h, opt.m, opt.s);
    });
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
  if (state.fontFamily) {
    fontSelect.value = state.fontFamily;
    document.getElementById('countdown-display').style.fontFamily = state.fontFamily;
    ipcRenderer.send('wheel-font-change', state.fontFamily);
}
  updatePercentages();
  updateWheelBtn.click();
}

function sendStateToMain() {
  const currentState = getCurrentState();
  ipcRenderer.send('state-update', currentState);
}

function sendColorUpdate() {
  const colors = {
    background: bgColorPicker.value,
    font: fontColorPicker.value
  };
  ipcRenderer.send('color-update', colors);
  sendStateToMain();
}

ipcRenderer.on('time-update', (event, timeString) => {
  countdownDisplay.textContent = timeString;
  sendStateToMain();
});

ipcRenderer.on('window-state-update', (event, state) => {
  if (state.isTurntableOpen) {
    showTurntableBtn.textContent = '關閉轉盤';
    showTurntableBtn.classList.add('active');
  } else {
    showTurntableBtn.textContent = '顯示轉盤';
    showTurntableBtn.classList.remove('active');
  }
  if (state.isTimerOpen) {
    showTimerBtn.textContent = '關閉計時器';
    showTimerBtn.classList.add('active');
  } else {
    showTimerBtn.textContent = '顯示計時器';
    showTimerBtn.classList.remove('active');
  }
});

ipcRenderer.on('load-state', (event, state) => {
  applyState(state);
});

exportBtn.addEventListener('click', async () => {
  const currentState = getCurrentState();
  const result = await ipcRenderer.invoke('export-data', currentState);
  if (result.success) {
    alert(`設定已成功匯出至：\n${result.path}`);
  }
});

importBtn.addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('import-data');
  if (result.success && result.state) {
    applyState(result.state);
    alert('設定已成功匯入！');
  }
});

addOptionBtn.addEventListener('click', () => {
  createOptionRow();
  updatePercentages();
  sendStateToMain();
});

bgColorPicker.addEventListener('input', sendColorUpdate);
fontColorPicker.addEventListener('input', sendColorUpdate);

window.addEventListener('beforeunload', () => {
  ipcRenderer.send('save-state-on-close');
});

updateWheelBtn.addEventListener('click', () => {
  const parsedOptions = [];
  let isAllValid = true;

  document.querySelectorAll('.option-row').forEach(row => {
    const name = row.querySelector('.option-name-input').value.trim();
    const hInput = row.querySelector('.option-h-input');
    const mInput = row.querySelector('.option-m-input');
    const sInput = row.querySelector('.option-s-input');

    const checkValid = (input) => {
      const val = input.value.trim();
      if (val === '*' || val === '/') {
        input.style.border = '2px solid red';
        isAllValid = false;
        return false;
      }
      input.style.border = '';
      return true;
    };

    checkValid(hInput);
    checkValid(mInput);
    checkValid(sInput);

    if (name) {
      parsedOptions.push({
        text: name,
        fillStyle: row.querySelector('.option-color-input').value,
        weight: parseFloat(row.querySelector('.option-prob-input').value) || 1,
        h: hInput.value,
        m: mInput.value,
        s: sInput.value
      });
    }
  });

  if (!isAllValid) {
    alert('請填寫完整的運算式！例如：*2 或 /2，不能只填符號。');
    return;
  }

  ipcRenderer.send('update-wheel', parsedOptions);
  sendStateToMain();
});

startPauseBtn.addEventListener('click', () => {
  ipcRenderer.send('timer-control', 'start-pause');
  if (startPauseBtn.textContent === '開始' || startPauseBtn.textContent === '繼續') {
    startPauseBtn.textContent = '暫停';
    startPauseBtn.classList.add('paused');
  } else {
    startPauseBtn.textContent = '繼續';
    startPauseBtn.classList.remove('paused');
  }
  sendStateToMain();
});

resetBtn.addEventListener('click', () => {
  ipcRenderer.send('timer-control', 'reset');
  startPauseBtn.textContent = '開始';
  startPauseBtn.classList.remove('paused');
  sendStateToMain();
});

timeAdjustButtons.forEach(button => {
  button.addEventListener('click', () => {
    const seconds = parseInt(button.dataset.time);
    ipcRenderer.send('time-adjust', seconds);
    sendStateToMain();
  });
});

showTurntableBtn.addEventListener('click', () => ipcRenderer.send('toggle-turntable'));
showTimerBtn.addEventListener('click', () => ipcRenderer.send('toggle-timer'));

const getRandomColor = () => `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;

function updatePercentages() {
  const probInputs = document.querySelectorAll('.option-prob-input');
  let totalWeight = 0;
  probInputs.forEach(input => {
    totalWeight += parseFloat(input.value) || 0;
  });

  document.querySelectorAll('.option-row').forEach(row => {
    const probInput = row.querySelector('.option-prob-input');
    const percentageSpan = row.querySelector('.option-percentage');
    const weight = parseFloat(probInput.value) || 0;
    if (totalWeight > 0) {
      percentageSpan.textContent = `${((weight / totalWeight) * 100).toFixed(1)}%`;
    } else {
      percentageSpan.textContent = '0.0%';
    }
  });
}

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
  hInput.type = 'text';
  hInput.className = 'option-h-input';
  hInput.placeholder = '時';
  hInput.maxLength = 5;
  if (h !== undefined) hInput.value = h;
  hInput.oninput = sendStateToMain;

  const mInput = document.createElement('input');
  mInput.type = 'text';
  mInput.className = 'option-m-input';
  mInput.placeholder = '分';
  mInput.maxLength = 5;
  if (m !== undefined) mInput.value = m;
  mInput.oninput = sendStateToMain;

  const sInput = document.createElement('input');
  sInput.type = 'text';
  sInput.className = 'option-s-input';
  sInput.placeholder = '秒';
  sInput.maxLength = 5;
  if (s !== undefined) sInput.value = s;
  sInput.oninput = sendStateToMain;

  const validateTimerInput = (input) => {
    input.addEventListener('input', (e) => {
      const originalValue = e.target.value;
      let filteredValue = originalValue.replace(/[^0-9+\-.*\/]/g, '');
      
      if (!isValidTimerExpression(filteredValue)) {
        e.target.value = e.target.dataset.lastValid || '';
      } else {
        e.target.value = filteredValue;
        e.target.dataset.lastValid = filteredValue;
      }
    });

    input.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      if (val === '*' || val === '/' || val === '+' || val === '-' || val === '.') {
        e.target.style.border = '2px solid red';
      } else {
        e.target.style.border = '';
      }
    });

    input.addEventListener('focus', (e) => {
      if (e.target.style.border === '2px solid red') {
        e.target.style.border = '';
      }
    });
  };

    const isValidTimerExpression = (expr) => {
    if (!expr) return true;
    const validChars = /^[0-9+\-*\/.]+$/;
    if (!validChars.test(expr)) return false;

    if (/[+\-*\/]{2,}/.test(expr)) return false;
    
    if ((expr.match(/\./g) || []).length > 1) return false;

    return true;
    };

  validateTimerInput(hInput);
  validateTimerInput(mInput);
  validateTimerInput(sInput);

  timerInputs.append(hInput, mInput, sInput);

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.className = 'option-color-input';
  colorInput.value = color;
  colorInput.oninput = sendStateToMain;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.innerHTML = '×';
  removeBtn.onclick = () => {
    row.remove();
    updatePercentages();
    sendStateToMain();
  };

  row.append(handle, nameInput, probInput, percentageSpan, timerInputs, colorInput, removeBtn);
  optionsList.append(row);

  nameInput.oninput = sendStateToMain;
}

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