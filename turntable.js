const { ipcRenderer } = require('electron');

const spinButton = document.getElementById('spin_button');
const modal = document.getElementById('modal');
const winnerText = document.getElementById('winner-text');
const closeModalBtn = document.getElementById('close-modal-btn');

let theWheel;
let spinning = false;
let parsedOptions = [];
let currentWheelFont = 'cwTeXFangSong';

// --- IPC 通訊 ---
ipcRenderer.on('f10-pressed', () => {
    ipcRenderer.send('toggle-my-frame');
});

ipcRenderer.on('wheel-updated', (event, optionsData) => {
    parsedOptions = optionsData;
    updateWheel(optionsData);
});


ipcRenderer.on('wheel-font-change', (event, fontFamily) => {
    currentWheelFont = fontFamily;

    // 1. 更新轉盤物件
    if (theWheel) {
        theWheel.textFontFamily = fontFamily;
        theWheel.draw(); // 必須呼叫這個才會重畫 Canvas
    }

    // 2. 更新中獎彈窗 (Modal)
    const modalContent = document.querySelector('.modal-content');
    if (modalContent) {
        modalContent.style.fontFamily = fontFamily;
    }
});

// --- 初始化 ---
async function initialize() {
    const initialOptions = await ipcRenderer.invoke('get-initial-options');
    if (initialOptions && initialOptions.length > 0) {
        parsedOptions = initialOptions;
        updateWheel(initialOptions);
    }
}
window.onload = initialize;

// --- 核心函數 ---
function updateWheel(options) {
    if (options.length === 0) {
        if (theWheel) theWheel.clearCanvas();
        return;
    }
    
    const totalWeight = options.reduce((sum, opt) => sum + opt.weight, 0);
    const segmentsForWheel = options.map(opt => ({
        ...opt,
        'size': (opt.weight / totalWeight) * 360
    }));

    theWheel = new Winwheel({
        'numSegments': segmentsForWheel.length,
        'outerRadius': 240,
        'innerRadius': 70,
        'textFontSize': 19,
        'textFontFamily': currentWheelFont,
        'textFillStyle': 'black',
        'textOrientation': 'horizontal', // 確保文字方向正確
        'segments': segmentsForWheel,
        'animation': {
            'type': 'spinToStop',
            'duration': 5, // 預設時長
            'callbackFinished': alertPrize,
            'soundTrigger': 'pin'
        }
        
    });
    
    // 繪製一次，避免第一次點擊時卡頓
    theWheel.draw();
}

function alertPrize(indicatedSegment) {
    spinning = false;
    const currentWinner = parsedOptions.find(opt => opt.text === indicatedSegment.text);
    if (currentWinner) {
        ipcRenderer.send('spin-result', {
            h: currentWinner.h,
            m: currentWinner.m,
            s: currentWinner.s
        });

        winnerText.textContent = currentWinner.text;
        modal.classList.add('visible');
        
        // 使用 requestAnimationFrame 延遲觸發，確保不會阻塞動畫
        requestAnimationFrame(() => {
            confetti({
                particleCount: 150,
                spread: 90,
                origin: {
                    y: 0.6
                }
            });
        });
    }
}

closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('visible');
});

spinButton.addEventListener('click', () => {
    if (spinning || !theWheel || theWheel.numSegments === 0) return;
    spinning = true;
    theWheel.animation.clearTheCanvas = true;
    // 計算獲獎段落
    const totalWeight = parsedOptions.reduce((sum, opt) => sum + opt.weight, 0);
    let randomWeight = Math.random() * totalWeight;
    let winningSegmentIndex = -1;
    
    for (let i = 0; i < parsedOptions.length; i++) {
        randomWeight -= parsedOptions[i].weight;
        if (randomWeight <= 0) {
            winningSegmentIndex = i;
            break;
        }
    }
    
    const winningSegment = theWheel.segments[winningSegmentIndex + 1];
    const stopAt = Math.floor(Math.random() * (winningSegment.endAngle - winningSegment.startAngle)) + winningSegment.startAngle;
    const randomSpins = Math.floor(Math.random() * 8) + 8;
    const randomDuration = Math.floor(Math.random() * 3) + 6; // ★ 優化：縮短時間範圍至 6-9 秒，減少計算量
    
    // ★ 優化：直接修改動畫配置，而不是深度合併
    theWheel.animation.spins = randomSpins;
    theWheel.animation.duration = randomDuration;
    theWheel.animation.stopAngle = stopAt;
    
    // ★ 優化：重置前先停止任何進行中的動畫
    theWheel.stopAnimation(false);
    theWheel.rotationAngle = 0;
    
    // ★ 優化：使用 requestAnimationFrame 延遲啟動動畫，確保 UI 不會被阻塞
    requestAnimationFrame(() => {
        theWheel.startAnimation();
    });
});