const { ipcRenderer } = require('electron');

const spinButton = document.getElementById('spin_button');
const modal = document.getElementById('modal');
const winnerText = document.getElementById('winner-text'); // 修正：之前這裡變成了 winnerText
const closeModalBtn = document.getElementById('close-modal-btn');

let theWheel;
let spinning = false;
let parsedOptions = [];

// --- IPC 通訊 ---
ipcRenderer.on('f10-pressed', () => {
    ipcRenderer.send('toggle-my-frame');
});

ipcRenderer.on('wheel-updated', (event, optionsData) => {
    parsedOptions = optionsData;
    updateWheel(optionsData);
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
        'textFontSize': 19, // ★★★ 核心修正：將字體大小從 16 增加到 20 ★★★
        'textFontFamily': 'cwTeXFangSong', // 可選：設定一個更清晰的字體
        'textFillStyle': 'black', // 可選：確保文字是黑色，更易讀
        'segments': segmentsForWheel,
        'animation': {
            'type': 'spinToStop',
            'callbackFinished': alertPrize,
            'soundTrigger': 'pin'
        },
        'pins': {
            'number': segmentsForWheel.length * 2,
            'fillStyle': 'silver',
            'outerRadius': 4
        }
    });
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
        confetti({
            particleCount: 150,
            spread: 90,
            origin: {
                y: 0.6
            }
        });
    }
}

closeModalBtn.addEventListener('click', () => {
    modal.classList.remove('visible');
});

spinButton.addEventListener('click', () => {
    if (spinning || !theWheel || theWheel.numSegments === 0) return;
    spinning = true;

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
    const randomDuration = Math.floor(Math.random() * 5) + 7;
    theWheel.animation = { ...theWheel.animation,
        spins: randomSpins,
        duration: randomDuration,
        stopAngle: stopAt
    };
    theWheel.stopAnimation(false);
    theWheel.rotationAngle = 0;
    theWheel.startAnimation();
});