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
    options.push({
      name: row.querySelector('.option-name-input').value.trim(),
      probability: parseFloat(row.querySelector('.option-prob-input').value) || 1,
      color: row.querySelector('.option-color-input').value,
      h: parseInt(row.querySelector('.option-h-input').value) || 0,
      m: parseInt(row.querySelector('.option-m-input').value) || 0,
      s: parseInt(row.querySelector('.option-s-input').value) || 0,
    });
  });

  const timeParts = countdownDisplay.textContent.replace('-', '').split(':');
  const sign = countdownDisplay.textContent.startsWith('-') ? -1 : 1;
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

// --- IPC 通訊 ---
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

// --- 事件監聽 ---
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

// --- 介面核心函數 ---
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

  // 概率權重輸入（不限制長度）
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

  // 輸入驗證事件 - 只允許 0-9、+、-、.、*、/
  const validateTimerInput = (input) => {
    input.addEventListener('input', (e) => {
      const originalValue = e.target.value;
      // 只允許數字、+、-、.、*、/
      let filteredValue = originalValue.replace(/[^0-9+\-.*\/]/g, '');
      
      // 驗證規則：最多出現一次「.」和「+-*/」的組合
      // 規則：. 和 +-*/ 最多交替出現一次
      if (!isValidTimerExpression(filteredValue)) {
        // 恢復到上一個有效值
        e.target.value = e.target.dataset.lastValid || '';
      } else {
        e.target.value = filteredValue;
        e.target.dataset.lastValid = filteredValue;
      }
    });

    input.addEventListener('blur', (e) => {
      const val = e.target.value.trim();
      // 只有符號的情況才標記為紅色
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

  // 驗證運算式是否符合規則
  const isValidTimerExpression = (expr) => {
    if (!expr) return true; // 空值允許
    
    // 統計「.」和「+-*/」的出現次數
    let hasDecimal = expr.includes('.');
    let hasOperator = /[+\-*\/]/.test(expr);
    
    // 規則：最多同時出現「.」和「+-*/」其中一個類型
    // 或者兩個都出現，但要符合交替規則
    
    if (!hasDecimal && !hasOperator) {
      // 只有數字，允許
      return /^\d+$/.test(expr);
    }
    
    if (hasDecimal && hasOperator) {
      // 同時有 . 和運算符
      // 規則：只能是「數字.數字運算符」或「運算符數字.數字」這樣的組合
      // 例如：3.5+2, *0.5, /1.5 允許
      // 例如：3+.5 不允許（小數點後無數字）
      
      // 檢查小數點是否有效（前後都有數字）
      const decimalPattern = /\d+\.\d+/;
      if (!decimalPattern.test(expr)) {
        return false; // 小數點格式無效
      }
      
      // 檢查運算符的位置
      // 允許的模式：
      // - *0.5, /1.5, -0.5 等（運算符在開頭）
      // - 3.5+2, 2.5*3 等（小數點在數字中）
      // - 不允許：3.5.2（兩個小數點）
      // - 不允許：3+.5（小數點後無數字）
      
      if ((expr.match(/\./g) || []).length > 1) {
        return false; // 多個小數點不允許
      }
      
      return true;
    }
    
    if (hasDecimal) {
      // 只有小數點，檢查格式
      return /^\d+\.\d*$/.test(expr) || /^\.\d+$/.test(expr);
    }
    
    if (hasOperator) {
      // 只有運算符和數字
      // 允許的格式：*2, /3, +5, -2, 2*3, 5+2 等
      return true;
    }
    
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