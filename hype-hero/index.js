// Variáveis globais para armazenar os dados
let chartData = null;
let currentSong = null;
let currentDifficulty = null;
let gameState = 'menu'; // 'menu', 'preparing', 'countdown', 'playing', 'paused'

// --- Configurações do Jogo ---
const NUM_LANES = 5;
// Calcula largura responsiva: em mobile usa 90% da largura da tela, em desktop usa 100px por lane
const SCREEN_WIDTH = window.innerWidth;
const IS_MOBILE_SIZE = SCREEN_WIDTH <= 768;
const LANE_WIDTH = IS_MOBILE_SIZE ? Math.floor((SCREEN_WIDTH * 0.9) / NUM_LANES) : 100;
const NOTE_HEIGHT = 25;
const GAME_WIDTH = LANE_WIDTH * NUM_LANES;
const GAME_HEIGHT = window.innerHeight * 0.95;
const NOTE_SPEED = 0.6;

// Configurações de efeitos visuais
const STAR_SPEED_TRANSITION_RATE = 0.4;

// Janelas de tempo para acerto (em ms)
const HIT_WINDOWS = {
    PERFECT: 35,
    GOOD: 70,
    FAIR: 100,
};
const SCORE_VALUES = { PERFECT: 300, GOOD: 200, FAIR: 100, MISS: 0 };

const LANE_COLORS = [0xFF6347, 0x90EE90, 0xADD8E6, 0xFFD700, 0xDA70D6];
const KEY_MAPPINGS = ['d', 'f', 'j', 'k', 'l'];

// Função para converter cores PIXI (hex) para CSS RGB
function hexToRgb(hex) {
    const r = (hex >> 16) & 255;
    const g = (hex >> 8) & 255;
    const b = hex & 255;
    return { r, g, b };
}

// Função para aplicar cores específicas às touch lanes
function applyTouchLaneColors() {
    touchLanes.forEach((lane, index) => {
        const color = hexToRgb(LANE_COLORS[index]);
        const { r, g, b } = color;
        
        // Aplica cor de fundo leve (0.1 de opacidade)
        lane.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
        
        // Aplica cor da borda
        lane.style.borderColor = `rgb(${r}, ${g}, ${b})`;
        
        // Armazena as cores para uso no estado ativo
        lane.dataset.colorR = r;
        lane.dataset.colorG = g;
        lane.dataset.colorB = b;
    });
}

// --- Variáveis de Estado do Jogo ---
let score = 0, combo = 0;
let totalNotes = 0, hitNotes = 0; // Para calcular accuracy
let pixiApp, noteContainer, targetContainer, feedbackContainer, particleContainer, backgroundContainer;
let notesOnScreen = [], targets = [], particles = [], stars = [];
let gameStartTime = 0;
let mainTargetLine, glowBorder;
let keysPressed = new Set();
let starSpeedMultiplier = 1.0;
let currentPlayer = null;

// --- Configurações do sistema de rastro das estrelas ---
const TRAIL_LENGTH = 15; // Número de pontos no rastro
const TRAIL_ALPHA_DECAY = 0.4; // Taxa de decaimento do alpha do rastro

// --- Variáveis do Visualizador de Música ---
let audioContext = null;
let analyser = null;
let dataArray = null;
let bufferLength = 0;
let visualizerContainer = null;

// --- Variáveis para Dispositivos Móveis ---
let isMobile = false;
let touchLanes = [];
let touchStates = new Set(); // Para rastrear toques ativos
let visualizerBars = [];
let visualizerTargetHeights = []; // Para suavização das transições
const VISUALIZER_BARS = 5; // Mesmo número de lanes
const VISUALIZER_BAR_WIDTH = LANE_WIDTH; // Cada barra alinhada com uma lane
const VISUALIZER_MAX_HEIGHT = GAME_HEIGHT; // Altura máxima = altura total da tela
const VISUALIZER_MIN_HEIGHT = GAME_HEIGHT / 4; // Altura mínima = 1/4 da altura total
const VISUALIZER_SMOOTHING = 0.15; // Constante para suavização das transições (0.1 = mais suave, 0.3 = mais rápido)
const VISUALIZER_ALPHA_MIN = 0.03; // Alpha mínimo das barras (4%)
const VISUALIZER_ALPHA_MAX = 0.3; // Alpha máximo das barras (20%)
const VISUALIZER_ALPHA_STOPPED = 0.04; // Alpha quando o jogo está parado (4%)

// --- Configurações do Jogo (persistentes) ---
let gameSettings = {
    audioDelay: 0 // Delay de áudio em milissegundos
};

// --- Variáveis para Detecção Automática de Delay ---
let detectionData = {
    isActive: false,
    tapCount: 0,
    tapTimes: [],
    beepTimes: [],
    currentBpm: 120,
    beepInterval: 500, // 500ms para 120 BPM
    beepTimeoutId: null
};

let detectionAudioContext = null;
let autoDetectModal = null;
let autoDetectBtn = null;
let detectStatus = null;
let tapIndicator = null;
let progressFill = null;
let startDetectionBtn = null;
let cancelDetectionBtn = null;
const BPM = 120;
const BEEP_INTERVAL_MS = (60 / BPM) * 1000; // 500ms para 120 BPM
const TOTAL_TAPS = 10; // Número de interações necessárias

// Variáveis para a detecção
let isDetecting = false;
let beepInterval = null;
let beepStartTimes = [];
let tapTimes = [];
let tapCount = 0;

// --- Elementos da UI ---
const scoreText = document.getElementById('score');
const comboText = document.getElementById('combo');
const accuracyText = document.getElementById('accuracy');
const mainMenu = document.getElementById('main-menu');
const welcomeState = document.getElementById('welcome-state');
const menuState = document.getElementById('menu-state');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const startTitle = document.getElementById('start-title');
const startArtist = document.getElementById('start-artist');
const startDifficulty = document.getElementById('start-difficulty');
const keyMappingText = document.getElementById('key-mapping');
const pauseModal = document.getElementById('pause-modal');
const countdown = document.getElementById('countdown');
const countdownNumber = document.getElementById('countdown-number');
const pauseBtn = document.getElementById('pause-btn');
const songList = document.getElementById('song-list');
const settingsScreen = document.getElementById('settings-screen');
const settingsBtn = document.getElementById('settings-btn');
const audioDelayInput = document.getElementById('audio-delay-input');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// Variáveis para preview de áudio
let previewAudio = null;
let previewTimeout = null;
let currentPreviewSong = null;
let isPreviewLoading = false;
let fadeInterval = null;
let audioContextInitialized = false;

// Dados das músicas disponíveis
const AVAILABLE_SONGS = [
    {
        id: "song_003",
        title: "Reaching Saturn",
        artist: "Depths Of Titan",
        filename: "003_reaching-saturn-depths-of-titan.mp3",
        difficulties: [
            { name: "Difícil", level: "hard", chartFile: "charts/003_reaching-saturn-depths-of-titan_medium.json" }
        ]
    },
    {
        id: "song_004",
        title: "Dia Delícia",
        artist: "Nakama",
        filename: "004_dia-delicia-nakama.mp3",
        difficulties: [
            { name: "Difícil", level: "hard", chartFile: "charts/004_dia-delicia-nakama_medium.json" }
        ]
    },
    {
        id: "song_005",
        title: "Passo Bem Solto (Slowed)",
        artist: "ATLSX",
        filename: "005_passo-bem-solto-atlxs-slowed.mp3",
        difficulties: [
            { name: "Médio", level: "medium", chartFile: "charts/005_passo-bem-solto-atlxs-slowed_medium.json" }
        ]
    }
];

// --- Funções de Configurações ---
function loadSettings() {
    const saved = localStorage.getItem('rhythmGameSettings');
    if (saved) {
        try {
            gameSettings = { ...gameSettings, ...JSON.parse(saved) };
        } catch (e) {
            console.warn('Erro ao carregar configurações:', e);
        }
    }
    audioDelayInput.value = gameSettings.audioDelay;
}

function saveSettings() {
    const newDelay = parseInt(audioDelayInput.value) || 0;

    // Valida o range do delay
    if (newDelay < -500 || newDelay > 500) {
        alert('O delay deve estar entre -500ms e 500ms');
        return;
    }

    gameSettings.audioDelay = newDelay;

    try {
        localStorage.setItem('rhythmGameSettings', JSON.stringify(gameSettings));
        closeSettings();

        // Feedback visual
        saveSettingsBtn.textContent = 'Salvo!';
        setTimeout(() => {
            saveSettingsBtn.textContent = 'Salvar';
        }, 1000);
    } catch (e) {
        console.warn('Erro ao salvar configurações:', e);
        alert('Erro ao salvar configurações');
    }
}

function openSettings() {
    gameState = 'settings';
    forceStopPreview(); // Para preview imediatamente ao abrir configurações
    mainMenu.style.display = 'none';
    settingsScreen.style.display = 'flex';
    audioDelayInput.value = gameSettings.audioDelay;
}

function closeSettings() {
    gameState = 'menu';
    settingsScreen.style.display = 'none';
    mainMenu.style.display = 'flex';
    // Mostra o estado do menu, não o de boas-vindas
    welcomeState.style.display = 'none';
    menuState.style.display = 'flex';
}

// --- Funções da Tela de Boas-vindas ---
function showWelcomeState() {
    mainMenu.style.display = 'flex';
    welcomeState.style.display = 'flex';
    menuState.style.display = 'none';
    gameState = 'welcome';
}

function transitionToMenuState() {
    gameState = 'menu';
    
    // Inicia transição: fade-out do estado de boas-vindas
    welcomeState.classList.add('fade-out');
    
    // Aguarda o fade-out completar
    setTimeout(() => {
        // Esconde o estado de boas-vindas e mostra o menu
        welcomeState.style.display = 'none';
        menuState.style.display = 'flex';
        
        // Remove a classe de fade-out
        welcomeState.classList.remove('fade-out');
        
        // Anima a entrada dos elementos do menu
        const songListElement = document.getElementById('song-list');
        const menuFooter = menuState.querySelector('.menu-footer');
        
        // Inicia com elementos invisíveis
        if (songListElement) {
            songListElement.style.opacity = '0';
        }
        if (menuFooter) {
            menuFooter.style.opacity = '0';
        }
        
        // Anima a entrada da lista de músicas
        setTimeout(() => {
            if (songListElement) {
                songListElement.classList.add('fade-in');
            }
        }, 100);
        
        // Anima a entrada do footer
        setTimeout(() => {
            if (menuFooter) {
                menuFooter.classList.add('fade-in');
            }
        }, 200);
        
    }, 800); // Tempo da animação de fade-out
}

function setupWelcomeEventListeners() {
    // Click/touch no estado de boas-vindas
    welcomeState.addEventListener('click', transitionToMenuState);
    welcomeState.addEventListener('touchstart', (e) => {
        e.preventDefault();
        transitionToMenuState();
    });
    
    // Também aceita tecla Enter ou Espaço
    document.addEventListener('keydown', (e) => {
        if (gameState === 'welcome' && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            transitionToMenuState();
        }
    });
}

// --- Funções de Detecção Automática de Delay ---
function initAutoDetect() {
    autoDetectModal = document.getElementById('auto-detect-modal');
    autoDetectBtn = document.getElementById('auto-detect-btn');
    detectStatus = document.getElementById('detect-status');
    tapIndicator = document.getElementById('tap-indicator');
    progressFill = document.getElementById('progress-fill');
    startDetectionBtn = document.getElementById('start-detection-btn');
    cancelDetectionBtn = document.getElementById('cancel-detection-btn');

    // Event listeners
    autoDetectBtn.onclick = openAutoDetect;
    startDetectionBtn.onclick = startDetection;
    cancelDetectionBtn.onclick = closeAutoDetect;
    tapIndicator.onclick = handleTap;
}

function openAutoDetect() {
    autoDetectModal.style.display = 'flex';
    resetDetection();
}

function closeAutoDetect() {
    autoDetectModal.style.display = 'none';
    stopDetection();
}

function resetDetection() {
    isDetecting = false;
    tapCount = 0;
    beepStartTimes = [];
    tapTimes = [];
    detectStatus.textContent = 'Pronto para iniciar';
    progressFill.style.width = '0%';
    startDetectionBtn.style.display = 'inline-block';
    startDetectionBtn.textContent = 'Iniciar Detecção';
    tapIndicator.classList.remove('active');
}

async function startDetection() {
    if (isDetecting) return;

    try {
        // Inicializa o contexto de áudio se necessário
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }

        isDetecting = true;
        tapCount = 0;
        beepStartTimes = [];
        tapTimes = [];

        detectStatus.textContent = 'Preparando... aguarde o primeiro beep';
        startDetectionBtn.style.display = 'none';
        progressFill.style.width = '0%';

        // Adiciona event listener para espaço
        document.addEventListener('keydown', handleDetectionKeyDown);

        // Inicia os beeps após um pequeno delay
        setTimeout(() => {
            if (isDetecting) {
                detectStatus.textContent = 'Pressione ESPAÇO ou toque no círculo no momento do beep!';
                startBeeping();
            }
        }, 1000);

    } catch (error) {
        console.error('Erro ao inicializar detecção:', error);
        detectStatus.textContent = 'Erro ao inicializar áudio. Tente novamente.';
        resetDetection();
    }
}

function startBeeping() {
    if (!isDetecting) return;

    // Primeiro beep imediato
    playBeep();

    // Programa os próximos beeps indefinidamente
    beepInterval = setInterval(() => {
        if (!isDetecting) {
            clearInterval(beepInterval);
            return;
        }

        playBeep();
    }, BEEP_INTERVAL_MS);
}

function playBeep() {
    if (!audioContext || !isDetecting) return;

    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Beep de 800Hz
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.1);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);

        // Registra o tempo do beep para cálculo posterior
        beepStartTimes.push(performance.now());

        // Indicador visual
        tapIndicator.classList.add('active');
        setTimeout(() => {
            tapIndicator.classList.remove('active');
        }, 100);

    } catch (error) {
        console.error('Erro ao tocar beep:', error);
    }
}

function handleDetectionKeyDown(event) {
    if (event.code === 'Space' && isDetecting) {
        event.preventDefault();
        handleTap();
    }
}

function handleTap() {
    if (!isDetecting || tapCount >= TOTAL_TAPS) return;

    const tapTime = performance.now();
    tapTimes.push(tapTime);
    tapCount++;

    // Feedback visual
    tapIndicator.classList.add('active');
    setTimeout(() => {
        tapIndicator.classList.remove('active');
    }, 50);

    detectStatus.textContent = `Tap ${tapCount}/${TOTAL_TAPS} registrado!`;
    updateProgress();

    // Verifica se completou 10 taps
    if (tapCount >= TOTAL_TAPS) {
        finishDetection();
    }
}

function updateProgress() {
    const progress = (tapCount / TOTAL_TAPS) * 100;
    progressFill.style.width = `${progress}%`;
}

function finishDetection() {
    stopDetection();

    if (tapTimes.length < TOTAL_TAPS) {
        detectStatus.textContent = 'Detecção incompleta. Tente novamente.';
        resetDetection();
        return;
    }

    // Calcula o delay médio considerando apenas beeps que receberam reação do usuário
    let totalDelay = 0;
    const validDelays = [];
    const reactedBeeps = new Set(); // Para marcar beeps que já foram reagidos
    
    // Janela de tempo para considerar um tap como reação válida a um beep (em ms)
    const REACTION_WINDOW = 400; // 400ms parece razoável para capturar reações válidas

    for (let i = 0; i < tapTimes.length; i++) {
        const tapTime = tapTimes[i];

        // Encontra o beep mais próximo no tempo que ainda não foi reagido
        let closestBeepTime = null;
        let closestBeepIndex = -1;
        let minDifference = Infinity;

        for (let j = 0; j < beepStartTimes.length; j++) {
            // Pula beeps que já foram reagidos
            if (reactedBeeps.has(j)) continue;
            
            const beepTime = beepStartTimes[j];
            const difference = Math.abs(tapTime - beepTime);

            // Só considera se estiver dentro da janela de reação válida
            if (difference <= REACTION_WINDOW && difference < minDifference) {
                minDifference = difference;
                closestBeepTime = beepTime;
                closestBeepIndex = j;
            }
        }

        // Se encontrou um beep válido dentro da janela de tempo
        if (closestBeepTime !== null && closestBeepIndex !== -1) {
            const delay = tapTime - closestBeepTime;

            // Filtra delays muito extremos (provavelmente erros)
            if (delay >= -300 && delay <= 500) {
                validDelays.push(delay);
                totalDelay += delay;
                
                // Marca este beep como reagido para não ser usado novamente
                reactedBeeps.add(closestBeepIndex);
                
                console.log(`Tap ${i + 1}: delay de ${delay}ms (beep ${closestBeepIndex + 1})`);
            }
        } else {
            console.log(`Tap ${i + 1}: nenhum beep válido encontrado na janela de ${REACTION_WINDOW}ms`);
        }
    }

    if (validDelays.length === 0) {
        detectStatus.textContent = 'Nenhum timing válido detectado. Tente seguir o ritmo dos beeps mais de perto.';
        resetDetection();
        return;
    }

    // Verifica se temos dados suficientes para uma detecção confiável
    const detectionQuality = validDelays.length >= TOTAL_TAPS * 0.7 ? 'boa' : 
                           validDelays.length >= TOTAL_TAPS * 0.5 ? 'razoável' : 'baixa';

    // O delay será a média dos delays encontrados
    const averageDelay = Math.round(totalDelay / validDelays.length);

    // Aplica o delay calculado
    audioDelayInput.value = averageDelay;
    gameSettings.audioDelay = averageDelay;

    detectStatus.textContent = `Delay detectado: ${averageDelay}ms (${validDelays.length}/${tapTimes.length} reações válidas - qualidade ${detectionQuality})`;

    console.log(`Detecção concluída: ${averageDelay}ms de delay médio baseado em ${validDelays.length} reações válidas de ${tapTimes.length} taps totais`);
    console.log('Delays individuais:', validDelays.map(d => `${d}ms`).join(', '));

    // Mostra botão para fechar
    startDetectionBtn.style.display = 'inline-block';
    startDetectionBtn.textContent = 'Detectar Novamente';

    // Auto-fecha após alguns segundos
    setTimeout(() => {
        if (autoDetectModal.style.display === 'flex') {
            closeAutoDetect();
        }
    }, 3000);
}

function stopDetection() {
    isDetecting = false;

    if (beepInterval) {
        clearInterval(beepInterval);
        beepInterval = null;
    }

    document.removeEventListener('keydown', handleDetectionKeyDown);
}

// --- Funções para Dispositivos Móveis ---
function detectMobile() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Detecta dispositivos móveis baseado no user agent e tamanho da tela
    const isMobileUA = /android|avantgo|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(userAgent);
    const isSmallScreen = window.innerWidth <= 768;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    return isMobileUA || (isSmallScreen && hasTouch);
}

function initMobileControls() {
    isMobile = detectMobile();

    if (isMobile) {
        // Obtém referências aos elementos das lanes touch
        touchLanes = Array.from(document.querySelectorAll('.touch-lane'));

        // Sincroniza o posicionamento das touch lanes com as lanes visuais
        syncTouchLanesPosition();

        // Configura os event listeners para touch
        setupTouchEventListeners();

        console.log('Modo mobile ativado');
    } else {
        // Oculta os controles touch em desktop
        document.getElementById('touch-controls').style.display = 'none';
    }
}

function syncTouchLanesPosition() {
    // Verifica o canvas atual para obter dimensões reais
    const canvas = document.getElementById('game-canvas');
    const gameContainer = document.getElementById('game-container');
    
    if (!canvas) {
        console.warn('Canvas não encontrado, não é possível sincronizar touch lanes');
        return;
    }
    
    const canvasRect = canvas.getBoundingClientRect();
    console.log(`CANVAS REAL: left=${canvasRect.left}, width=${canvasRect.width}, height=${canvasRect.height}`);
    
    // AJUSTA o container touch-controls para ter exatamente a mesma largura e posição do canvas
    const touchControlsElement = document.getElementById('touch-controls');
    touchControlsElement.style.left = `${canvasRect.left}px`;
    touchControlsElement.style.width = `${canvasRect.width}px`;
    
    // CALCULA a largura real de cada lane baseada na largura real do canvas
    const realLaneWidth = canvasRect.width / NUM_LANES; // SEM Math.floor para manter precisão
    console.log(`REAL LANE WIDTH: ${realLaneWidth}px (${NUM_LANES} lanes)`);
    console.log(`THEORETICAL TOTAL: ${realLaneWidth * NUM_LANES}px vs CANVAS: ${canvasRect.width}px`);
    
    touchLanes.forEach((lane, index) => {
        // Posição exata sem arredondamento
        const laneLeft = index * realLaneWidth;
        
        // Define posição e largura baseadas na largura real do canvas
        lane.style.left = `${laneLeft}px`;
        lane.style.width = `${realLaneWidth}px`;
        
        // REMOVE completamente qualquer margem/padding que possa existir
        lane.style.margin = '0';
        lane.style.padding = '0';
        lane.style.boxSizing = 'border-box';
        
        console.log(`Lane ${index}: left=${laneLeft.toFixed(2)}px, width=${realLaneWidth.toFixed(2)}px`);
    });
    
    // Aplica as cores específicas de cada lane
    applyTouchLaneColors();
}

function setupTouchEventListeners() {
    // Previne scroll e zoom em dispositivos móveis durante o jogo
    document.addEventListener('touchstart', (e) => {
        if (gameState === 'playing') {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
        if (gameState === 'playing') {
            e.preventDefault();
        }
    }, { passive: false });

    touchLanes.forEach((lane, index) => {
        // Touch start
        lane.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleTouchStart(index);
        }, { passive: false });

        // Touch end
        lane.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTouchEnd(index);
        }, { passive: false });

        // Touch cancel (quando o toque é interrompido)
        lane.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            handleTouchEnd(index);
        }, { passive: false });

        // Adiciona também mouse events para teste em desktop
        lane.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleTouchStart(index);
        });

        lane.addEventListener('mouseup', (e) => {
            e.preventDefault();
            handleTouchEnd(index);
        });

        // Evita o menu de contexto no mobile
        lane.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    });
}

function handleTouchStart(laneIndex) {
    if (gameState !== 'playing') return;

    // Adiciona à lista de toques ativos
    touchStates.add(laneIndex);

    // Feedback visual da lane touch com cor específica
    const lane = touchLanes[laneIndex];
    if (lane) {
        lane.classList.add('active');
        
        // Aplica cor ativa (0.4 de opacidade)
        const r = lane.dataset.colorR;
        const g = lane.dataset.colorG;
        const b = lane.dataset.colorB;
        
        if (r && g && b) {
            lane.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
            lane.style.boxShadow = `0 0 15px rgba(${r}, ${g}, ${b}, 0.5)`;
        }
    }

    // Processa o input da lane
    triggerLaneInput(laneIndex);
}

function handleTouchEnd(laneIndex) {
    // Remove da lista de toques ativos
    touchStates.delete(laneIndex);

    // Remove feedback visual e restaura cor original
    const lane = touchLanes[laneIndex];
    if (lane) {
        lane.classList.remove('active');
        
        // Restaura cor normal (0.1 de opacidade)
        const r = lane.dataset.colorR;
        const g = lane.dataset.colorG;
        const b = lane.dataset.colorB;
        
        if (r && g && b) {
            lane.style.backgroundColor = `rgba(${r}, ${g}, ${b}, 0.1)`;
            lane.style.boxShadow = 'none';
        }
    }
}

function checkNoteHit(laneIndex) {
    const elapsedTime = (Tone.Transport.seconds * 1000) + gameSettings.audioDelay;
    let noteToHit = null;
    let closestTimeDiff = Infinity;

    for (const note of notesOnScreen) {
        if (note.lane === laneIndex && !note.hit) {
            const timeDiff = Math.abs(note.time - elapsedTime);
            if (timeDiff < HIT_WINDOWS.FAIR && timeDiff < closestTimeDiff) {
                noteToHit = note;
                closestTimeDiff = timeDiff;
            }
        }
    }

    if (noteToHit) {
        handleHit(noteToHit, closestTimeDiff);
    }
}

function triggerLaneInput(laneIndex) {
    if (gameState !== 'playing') return;

    // Feedback visual do target
    const target = targets[laneIndex];
    if (target) {
        target.alpha = 1.0;
        setTimeout(() => {
            if (target && !target.destroyed) target.alpha = 0.5;
        }, 150);
    }

    // Verifica hit nas notas
    checkNoteHit(laneIndex);
}

// --- Inicialização ---
window.onload = function () {
    setupPixi();
    populateSongList();
    setupEventListeners();
    setupWelcomeEventListeners();
    loadSettings();
    initMobileControls();

    // Mostra o estado de boas-vindas primeiro
    showWelcomeState();

    // Define o texto de instrução baseado no dispositivo
    if (isMobile) {
        keyMappingText.textContent = 'Toque nas áreas coloridas na parte inferior da tela';
    } else {
        keyMappingText.textContent = `Teclas: ${KEY_MAPPINGS.join(', ').toUpperCase()}`;
    }
};

function setupEventListeners() {
    // Botões da tela de preparação
    startButton.onclick = startCountdown;

    // Botões do modal de pausa
    document.getElementById('resume-btn').onclick = resumeGame;
    document.getElementById('restart-btn').onclick = restartGame;
    document.getElementById('exit-btn').onclick = exitToMenu;

    // Botão pause
    pauseBtn.onclick = pauseGame;

    // Botões de configurações
    settingsBtn.onclick = openSettings;
    saveSettingsBtn.onclick = saveSettings;
    cancelSettingsBtn.onclick = closeSettings;
    backToMenuBtn.onclick = closeSettings;

    // Inicializa detecção automática de delay
    initAutoDetect();

    // Teclas globais
    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    // Para previews quando a página perde foco
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            forceStopPreview();
        }
    });
    
    // Para previews quando a janela perde foco
    window.addEventListener('blur', () => {
        forceStopPreview();
    });

    // Listener para redimensionamento da tela
    window.addEventListener('resize', handleResize);
}

function handleResize() {
    // Recalcula dimensões para dispositivos móveis
    const newScreenWidth = window.innerWidth;
    const newIsMobileSize = newScreenWidth <= 768;

    if (newIsMobileSize !== IS_MOBILE_SIZE) {
        // Se mudou entre mobile e desktop, recarrega a página para recalcular tudo
        location.reload();
    } else if (pixiApp && newIsMobileSize) {
        // Se continua em mobile, apenas redimensiona o canvas
        const newLaneWidth = Math.floor((newScreenWidth * 0.9) / NUM_LANES);
        const newGameWidth = newLaneWidth * NUM_LANES;
        const newGameHeight = window.innerHeight * 0.95;

        pixiApp.renderer.resize(newGameWidth, newGameHeight);
        
        // Re-sincroniza as touch lanes com as novas dimensões
        if (isMobile && touchLanes.length > 0) {
            // Atualiza as constantes globais
            LANE_WIDTH = newLaneWidth;
            GAME_WIDTH = newGameWidth;
            syncTouchLanesPosition();
        }
    }
}

// --- Funções de Preview de Áudio ---
async function initializeAudioContext() {
    if (!audioContextInitialized) {
        try {
            // Inicializa o contexto de áudio do Tone.js se necessário
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            audioContextInitialized = true;
            console.log('AudioContext inicializado');
        } catch (e) {
            console.log('Erro ao inicializar AudioContext:', e);
        }
    }
}

function startPreview(song) {
    console.log('startPreview chamado para:', song.title);
    
    // Se já é a mesma música, não faz nada
    if (currentPreviewSong === song && previewAudio && !previewAudio.paused) {
        console.log('Preview já ativo para esta música');
        return;
    }
    
    // FORÇA parada completa e imediata do preview anterior
    forceStopPreview();
    
    currentPreviewSong = song;
    console.log('Preview definido para:', song.title);
    
    // Inicia imediatamente sem timeout para melhor responsividade
    playPreview(song);
}

async function playPreview(song) {
    console.log('playPreview iniciado para:', song.title);
    
    // Inicializa contexto de áudio primeiro
    await initializeAudioContext();
    
    // Marca como carregando para evitar múltiplas tentativas
    isPreviewLoading = true;
    
    try {
        const audioPath = `songs/${song.filename}`;
        console.log('Criando novo Audio para:', audioPath);
        
        // Testa se o arquivo existe primeiro
        try {
            const response = await fetch(audioPath, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${response.status}`);
            }
            console.log('Arquivo de áudio encontrado');
        } catch (e) {
            console.log('Erro ao verificar arquivo:', e);
            cleanupPreview();
            return;
        }
        
        previewAudio = new Audio(audioPath);
        previewAudio.volume = 0;
        previewAudio.loop = true;
        previewAudio.preload = 'auto';
        previewAudio.crossOrigin = 'anonymous'; // Para evitar problemas de CORS
        
        // Flag para controlar se deve continuar tocando
        let shouldPlay = true;
        
        // Event listeners para controlar o estado
        previewAudio.addEventListener('loadeddata', () => {
            console.log('Audio loadeddata para:', song.title);
            // Só continua se ainda é a música correta e deve tocar
            if (currentPreviewSong === song && previewAudio && shouldPlay) {
                try {
                    previewAudio.currentTime = 30;
                    console.log('CurrentTime definido para 30s');
                } catch (e) {
                    console.log('Erro ao definir currentTime:', e);
                }
            }
        });
        
        previewAudio.addEventListener('canplaythrough', () => {
            console.log('Audio canplaythrough para:', song.title);
            // Só toca se ainda é a música correta, deve tocar e não está pausado
            if (currentPreviewSong === song && previewAudio && shouldPlay && previewAudio.readyState >= 4) {
                console.log('Tentando tocar audio...');
                previewAudio.play().then(() => {
                    console.log('Audio tocando com sucesso!');
                    // Só adiciona efeitos visuais se ainda é a música correta
                    if (currentPreviewSong === song && previewAudio && shouldPlay) {
                        const songItem = findSongItemByTitle(song.title);
                        if (songItem) {
                            songItem.classList.add('playing');
                            console.log('Classe "playing" adicionada');
                        }
                        // Inicia fade in
                        startFadeIn();
                    }
                }).catch(e => {
                    // Só loga erro se não foi cancelado intencionalmente
                    if (shouldPlay && currentPreviewSong === song) {
                        console.log('Erro ao reproduzir preview:', e);
                    }
                    cleanupPreview();
                });
            }
            isPreviewLoading = false;
        });
        
        previewAudio.addEventListener('error', (e) => {
            console.log('Erro ao carregar preview:', e);
            console.log('Tentando carregar:', audioPath);
            console.log('Erro detalhado:', previewAudio.error);
            cleanupPreview();
        });
        
        // Adiciona função para cancelar o play se necessário
        previewAudio.cancelPlay = () => {
            shouldPlay = false;
            console.log('Play cancelado');
        };
        
        // Força o carregamento
        console.log('Forçando load do audio...');
        previewAudio.load();
        
    } catch (e) {
        console.log('Erro ao criar preview:', e);
        cleanupPreview();
    }
}

function startFadeIn() {
    if (fadeInterval) {
        clearInterval(fadeInterval);
    }
    
    let currentVolume = 0;
    fadeInterval = setInterval(() => {
        if (previewAudio && currentVolume < 0.3) {
            currentVolume += 0.03;
            previewAudio.volume = Math.min(currentVolume, 0.3);
        } else {
            clearInterval(fadeInterval);
            fadeInterval = null;
        }
    }, 30);
}

function startFadeOut() {
    if (fadeInterval) {
        clearInterval(fadeInterval);
    }
    
    if (!previewAudio) {
        cleanupPreview();
        return;
    }
    
    fadeInterval = setInterval(() => {
        if (previewAudio && previewAudio.volume > 0.05) {
            try {
                previewAudio.volume -= 0.08;
            } catch (e) {
                // Ignora erros de volume
                clearInterval(fadeInterval);
                fadeInterval = null;
                cleanupPreview();
            }
        } else {
            clearInterval(fadeInterval);
            fadeInterval = null;
            cleanupPreview();
        }
    }, 30);
}

function forceStopPreview() {
    console.log('forceStopPreview chamado');
    
    // Remove classe visual de todos os itens imediatamente
    document.querySelectorAll('.song-item.playing').forEach(item => {
        item.classList.remove('playing');
    });
    
    // Cancela timeout se ainda não começou
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    
    // Para fade intervals imediatamente
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    
    // Para e remove áudio atual IMEDIATAMENTE sem fade
    if (previewAudio) {
        console.log('Parando áudio atual imediatamente');
        
        // Cancela qualquer operação pendente
        if (previewAudio.cancelPlay) {
            previewAudio.cancelPlay();
        }
        
        try {
            // Para o áudio sem fade
            previewAudio.pause();
            previewAudio.currentTime = 0;
        } catch (e) {
            // Ignora erros de pause
        }
        
        // Remove imediatamente
        previewAudio = null;
    }
    
    // Reset completo do estado
    isPreviewLoading = false;
    currentPreviewSong = null;
    
    console.log('forceStopPreview concluído');
}

function stopPreview() {
    console.log('stopPreview chamado (com fade)');
    
    // Remove classe visual de todos os itens
    document.querySelectorAll('.song-item.playing').forEach(item => {
        item.classList.remove('playing');
    });
    
    // Cancela timeout se ainda não começou
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    
    // Para fade intervals
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    
    // Para e remove áudio atual de forma segura
    if (previewAudio) {
        // Cancela qualquer tentativa de play pendente
        if (previewAudio.cancelPlay) {
            previewAudio.cancelPlay();
        }
        
        // Para o áudio se estiver tocando
        if (!previewAudio.paused) {
            try {
                previewAudio.pause();
            } catch (e) {
                // Ignora erros de pause
            }
        }
        
        // Inicia fade out suave apenas se solicitado
        startFadeOut();
    } else {
        cleanupPreview();
    }
}

function cleanupPreview() {
    isPreviewLoading = false;
    currentPreviewSong = null;
    
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    
    if (previewAudio) {
        // Cancela qualquer operação pendente
        if (previewAudio.cancelPlay) {
            previewAudio.cancelPlay();
        }
        
        try {
            // Para o áudio se estiver tocando
            if (!previewAudio.paused) {
                previewAudio.pause();
            }
            // Remove event listeners para evitar vazamentos
            previewAudio.removeEventListener('loadeddata', () => {});
            previewAudio.removeEventListener('canplaythrough', () => {});
            previewAudio.removeEventListener('error', () => {});
        } catch (e) {
            // Ignora erros de cleanup
        }
        
        previewAudio = null;
    }
    
    // Remove todas as classes playing
    document.querySelectorAll('.song-item.playing').forEach(item => {
        item.classList.remove('playing');
    });
}

function findSongItemByTitle(title) {
    const songItems = document.querySelectorAll('.song-item');
    for (let item of songItems) {
        const titleElement = item.querySelector('.song-title');
        if (titleElement && titleElement.textContent === title) {
            return item;
        }
    }
    return null;
}

function populateSongList() {
    songList.innerHTML = '';

    AVAILABLE_SONGS.forEach(song => {
        const songItem = document.createElement('div');
        songItem.className = 'song-item';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        titleDiv.textContent = song.title;

        const artistDiv = document.createElement('div');
        artistDiv.className = 'song-artist';
        artistDiv.textContent = song.artist;

        const difficultiesDiv = document.createElement('div');
        difficultiesDiv.className = 'difficulties';

        song.difficulties.forEach(difficulty => {
            const diffBtn = document.createElement('button');
            diffBtn.className = `difficulty-btn difficulty-${difficulty.level}`;
            diffBtn.textContent = difficulty.name;

            if (difficulty.chartFile) {
                diffBtn.onclick = () => selectSongAndDifficulty(song, difficulty);
            } else {
                diffBtn.style.opacity = '0.5';
                diffBtn.style.cursor = 'not-allowed';
                diffBtn.title = 'Em breve';
            }

            difficultiesDiv.appendChild(diffBtn);
        });

        // Event listeners para preview de áudio
        let mouseEnterTimeout = null;
        
        songItem.addEventListener('mouseenter', async () => {
            // Cancela qualquer timeout de saída anterior
            if (mouseEnterTimeout) {
                clearTimeout(mouseEnterTimeout);
                mouseEnterTimeout = null;
            }
            
            // Inicializa AudioContext na primeira interação
            await initializeAudioContext();
            
            // Inicia preview IMEDIATAMENTE
            startPreview(song);
        });
        
        songItem.addEventListener('mouseleave', () => {
            // Para IMEDIATAMENTE quando sair - sem delay
            forceStopPreview();
        });
        
        // Para dispositivos touch - versão otimizada
        let touchStarted = false;
        let touchTimeout = null;
        
        songItem.addEventListener('touchstart', async (e) => {
            // Previne múltiplos touchstarts
            if (touchStarted) return;
            touchStarted = true;
            
            // Cancela timeouts anteriores
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
            
            // Inicializa AudioContext na primeira interação
            await initializeAudioContext();
            
            // Só inicia preview se não tocou em um botão
            if (!e.target.classList.contains('difficulty-btn')) {
                startPreview(song);
            }
        });
        
        songItem.addEventListener('touchend', () => {
            touchStarted = false;
            
            // Para o preview após um delay
            touchTimeout = setTimeout(() => {
                stopPreview();
                touchTimeout = null;
            }, 1000); // Delay maior no touch para dar tempo de interagir
        });
        
        songItem.addEventListener('touchcancel', () => {
            touchStarted = false;
            if (touchTimeout) {
                clearTimeout(touchTimeout);
                touchTimeout = null;
            }
            stopPreview();
        });

        songItem.appendChild(titleDiv);
        songItem.appendChild(artistDiv);
        songItem.appendChild(difficultiesDiv);
        songList.appendChild(songItem);
    });
}

async function selectSongAndDifficulty(song, difficulty) {
    if (!difficulty.chartFile) {
        alert('Esta dificuldade ainda não está disponível!');
        return;
    }

    forceStopPreview(); // Para preview imediatamente ao selecionar música

    currentSong = song;
    currentDifficulty = difficulty;

    try {
        // Carrega os dados do chart
        const response = await fetch(difficulty.chartFile);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        chartData = await response.json();

        // Atualiza os dados da música no chart se necessário
        chartData.song.url = `songs/${song.filename}`;

        setupGame();
        showStartScreen();

    } catch (error) {
        console.error('Erro ao carregar dados do chart:', error);
        alert('Erro ao carregar os dados da música.');
    }
}

function setupGame() {
    if (!chartData) return;

    const { metadata } = chartData;
    startTitle.textContent = currentSong.title;
    startArtist.textContent = currentSong.artist;
    startDifficulty.textContent = `Dificuldade: ${currentDifficulty.name}`;

    // Reset game state
    score = 0;
    combo = 0;
    totalNotes = 0;
    hitNotes = 0;
    updateScore(0);
    resetCombo();
    updateAccuracy();

    // Clear previous game data
    if (notesOnScreen.length > 0) {
        notesOnScreen.forEach(note => note.destroy());
        notesOnScreen = [];
    }
    if (particles.length > 0) {
        particles.forEach(particle => particle.destroy());
        particles = [];
    }
    
    // Limpar rastros das estrelas
    stars.forEach(star => {
        if (star.trailGraphics) {
            star.trailGraphics.clear();
        }
    });
    
    // Limpar efeitos glow dos targets
    targets.forEach(target => {
        if (target.glowContainer) {
            target.glowContainer.clear();
        }
    });
}

function showStartScreen() {
    gameState = 'preparing';
    mainMenu.style.display = 'none';
    startScreen.style.display = 'flex';
    pauseBtn.style.display = 'none';
}

function setupPixi() {
    pixiApp = new PIXI.Application({
        width: GAME_WIDTH, height: GAME_HEIGHT,
        view: document.getElementById('game-canvas'),
        backgroundColor: 0x0c0c0f, antialias: true,
    });

    // Organização de camadas (de trás para frente)
    backgroundContainer = new PIXI.Container();
    visualizerContainer = new PIXI.Container();
    targetContainer = new PIXI.Container();
    noteContainer = new PIXI.Container();
    particleContainer = new PIXI.Container();
    feedbackContainer = new PIXI.Container();
    pixiApp.stage.addChild(backgroundContainer, visualizerContainer, targetContainer, noteContainer, particleContainer, feedbackContainer);

    createStarfield();
    createGlowBorder();
    createMusicVisualizer();
    drawLanes();
    drawTargets();
}

// --- Lógica de contagem regressiva ---
async function startCountdown() {
    if (!chartData) return;

    gameState = 'countdown';
    startScreen.style.display = 'none';
    countdown.style.display = 'flex';

    for (let i = 3; i > 0; i--) {
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';

        // Force reflow para reiniciar a animação
        countdownNumber.offsetHeight;
        countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    countdown.style.display = 'none';
    startGame();
}

// --- Lógica do jogo ---

async function startGame() {
    if (!chartData) return;

    gameState = 'playing';
    pauseBtn.style.display = 'block'; // Mostra o botão de pause
    await Tone.start();

    // Configura o BPM do Transport
    Tone.Transport.bpm.value = chartData.metadata.bpm;

    currentPlayer = new Tone.Player(chartData.song.url).toDestination();
    await Tone.loaded();

    // Configura o analisador de áudio para o visualizador
    setupAudioAnalyser();

    // Aplica o delay de áudio configurado
    const audioDelay = gameSettings.audioDelay / 1000; // Converte ms para segundos

    // Inicia o Transport e o player com delay
    Tone.Transport.start();
    if (audioDelay !== 0) {
        // Se há delay positivo, atrasa o áudio
        // Se há delay negativo, adianta o áudio
        currentPlayer.start(0, Math.abs(audioDelay) * (audioDelay < 0 ? 1 : 0));

        // Ajusta o tempo de início das notas baseado no delay
        gameStartTime = performance.now() - (audioDelay * 1000);
    } else {
        currentPlayer.start();
        gameStartTime = performance.now();
    }

    chartData.notes.forEach(createNote);
    pixiApp.ticker.add(gameLoop);
}

function pauseGame() {
    if (gameState !== 'playing') return;

    gameState = 'paused';
    Tone.Transport.pause();
    if (currentPlayer) {
        currentPlayer.stop();
    }
    pauseModal.style.display = 'flex';
}

async function resumeGame() {
    if (gameState !== 'paused') return;

    pauseModal.style.display = 'none';

    // Contagem regressiva antes de resumir
    countdown.style.display = 'flex';

    for (let i = 3; i > 0; i--) {
        countdownNumber.textContent = i;
        countdownNumber.style.animation = 'none';
        countdownNumber.offsetHeight;
        countdownNumber.style.animation = 'countdownPulse 1s ease-in-out';

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    countdown.style.display = 'none';
    gameState = 'playing';

    // Resume o Transport (que mantém os agendamentos sincronizados automaticamente)
    const currentTime = Tone.Transport.seconds;
    Tone.Transport.start();
    if (currentPlayer) {
        currentPlayer.start(0, currentTime);
    }
}

function restartGame() {
    pauseModal.style.display = 'none';
    stopGame();
    showStartScreen();
}

function exitToMenu() {
    stopGame();
    pauseModal.style.display = 'none';
    startScreen.style.display = 'none';
    countdown.style.display = 'none';
    pauseBtn.style.display = 'none';
    
    // Volta para o estado do menu, não o de boas-vindas
    mainMenu.style.display = 'flex';
    welcomeState.style.display = 'none';
    menuState.style.display = 'flex';
    gameState = 'menu';
}

function stopGame() {
    if (currentPlayer) {
        currentPlayer.stop();
        currentPlayer = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Limpa o analisador de áudio
    analyser = null;
    dataArray = null;

    if (pixiApp && pixiApp.ticker) {
        pixiApp.ticker.remove(gameLoop);
    }

    // Clear game objects
    if (notesOnScreen.length > 0) {
        notesOnScreen.forEach(note => note.destroy());
        notesOnScreen = [];
    }
    if (particles.length > 0) {
        particles.forEach(particle => particle.destroy());
        particles = [];
    }
    if (feedbackContainer) {
        feedbackContainer.removeChildren();
    }
    
    // Limpar rastros das estrelas
    stars.forEach(star => {
        if (star.trailGraphics) {
            star.trailGraphics.clear();
        }
    });
    
    // Limpar efeitos glow dos targets
    targets.forEach(target => {
        if (target.glowContainer) {
            target.glowContainer.clear();
        }
    });

    // Reset visualizer bars
    visualizerBars.forEach(bar => {
        bar.currentHeight = VISUALIZER_MIN_HEIGHT;
        bar.clear();
        bar.beginFill(0x00FFFF, 0.05); // Muito translúcido quando resetado
        bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, VISUALIZER_MIN_HEIGHT);
        bar.endFill();
        bar.y = GAME_HEIGHT - VISUALIZER_MIN_HEIGHT;
    });
}

function handleGlobalKeyDown(e) {
    if (e.key === 'Escape') {
        if (gameState === 'playing') {
            pauseGame();
            return;
        } else if (gameState === 'settings') {
            closeSettings();
            return;
        }
    }

    if (gameState === 'playing') {
        handleKeyDown(e);
    }
}

// --- Resto das funções do jogo (desenho, efeitos, etc.) ---
function createStarfield() {
    for (let i = 0; i < 200; i++) {
        const star = new PIXI.Graphics();
        star.beginFill(0xFFFFFF, Math.random() * 0.8 + 0.2);
        star.drawCircle(0, 0, Math.random() * 1.5 + 0.5);
        star.endFill();
        star.x = Math.random() * GAME_WIDTH;
        star.y = Math.random() * GAME_HEIGHT;
        star.speed = Math.random() * 0.4 + 0.2;
        
        // Propriedades para o sistema de rastro
        star.trail = []; // Array para armazenar posições do rastro
        star.trailGraphics = new PIXI.Graphics(); // Graphics separado para o rastro
        star.baseAlpha = star.alpha; // Guardar o alpha original da estrela
        
        // Inicializar o rastro com a posição atual
        for (let j = 0; j < TRAIL_LENGTH; j++) {
            star.trail.push({ x: star.x, y: star.y });
        }
        
        stars.push(star);
        backgroundContainer.addChild(star.trailGraphics); // Adicionar rastro primeiro (atrás da estrela)
        backgroundContainer.addChild(star);
    }
}

function createGlowBorder() {
    glowBorder = new PIXI.Graphics();
    glowBorder.alpha = 0.3;
    backgroundContainer.addChild(glowBorder);
    updateGlowBorder();
}

function updateStarTrail(star) {
    // Atualizar posições do rastro
    star.trail.unshift({ x: star.x, y: star.y });
    if (star.trail.length > TRAIL_LENGTH) {
        star.trail.pop();
    }
    
    // Redesenhar o rastro
    star.trailGraphics.clear();
    
    if (star.trail.length > 1) {
        // Desenhar linha do rastro com gradiente de alpha e espessura
        for (let i = 1; i < star.trail.length; i++) {
            const prevPoint = star.trail[i - 1];
            const currentPoint = star.trail[i];
            
            // Calcular alpha baseado na posição no rastro (mais antigo = mais transparente)
            const progress = i / star.trail.length;
            const alphaFactor = Math.pow(1 - progress, 1.5); // Gradiente mais suave
            const alpha = star.baseAlpha * alphaFactor * TRAIL_ALPHA_DECAY;
            
            // Calcular espessura baseada na posição (mais grosso no início)
            const thickness = 2.5 * (1 - progress * 0.7);
            
            if (alpha > 0.02) { // Só desenhar se alpha for visível
                star.trailGraphics.lineStyle(thickness, 0xFFFFFF, alpha);
                star.trailGraphics.moveTo(prevPoint.x, prevPoint.y);
                star.trailGraphics.lineTo(currentPoint.x, currentPoint.y);
            }
        }
    }
}

function updateGlowBorder() {
    if (!glowBorder) return;

    glowBorder.clear();

    const glowLayers = [
        { thickness: 50, alpha: 0.08 },
        { thickness: 40, alpha: 0.12 },
        { thickness: 30, alpha: 0.16 },
        { thickness: 22, alpha: 0.20 },
        { thickness: 15, alpha: 0.25 },
        { thickness: 10, alpha: 0.30 },
        { thickness: 6, alpha: 0.35 }
    ];

    glowLayers.forEach(layer => {
        const adjustedAlpha = layer.alpha * glowBorder.alpha;

        glowBorder.beginFill(0x000000, adjustedAlpha);
        glowBorder.drawRect(0, 0, GAME_WIDTH, layer.thickness);
        glowBorder.drawRect(0, GAME_HEIGHT - layer.thickness, GAME_WIDTH, layer.thickness);
        glowBorder.drawRect(0, 0, layer.thickness, GAME_HEIGHT);
        glowBorder.drawRect(GAME_WIDTH - layer.thickness, 0, layer.thickness, GAME_HEIGHT);
        glowBorder.endFill();
    });
}

function createMusicVisualizer() {
    // Inicializa o array de alturas alvo para suavização
    visualizerTargetHeights = new Array(VISUALIZER_BARS).fill(VISUALIZER_MIN_HEIGHT);

    // Cria as barras verticais na parte inferior da tela
    for (let i = 0; i < VISUALIZER_BARS; i++) {
        const bar = new PIXI.Graphics();
        
        // Usa a cor da lane correspondente, mas mais clara (menor alpha)
        bar.beginFill(LANE_COLORS[i], VISUALIZER_ALPHA_STOPPED); // Translúcido inicial
        bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, VISUALIZER_MIN_HEIGHT);
        bar.endFill();

        // Posiciona a barra alinhada com a lane correspondente
        bar.x = i * LANE_WIDTH;
        bar.y = GAME_HEIGHT - VISUALIZER_MIN_HEIGHT;

        // Armazena a altura atual para suavização
        bar.currentHeight = VISUALIZER_MIN_HEIGHT;

        visualizerBars.push(bar);
        visualizerContainer.addChild(bar);
    }
}

function setupAudioAnalyser() {
    try {
        // Usa o contexto de áudio do Tone.js
        audioContext = Tone.context;

        // Cria o analisador de áudio
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 128; // Resulta em 64 bins de frequência
        analyser.smoothingTimeConstant = 0.6; // Menos suavização para mais responsividade
        analyser.minDecibels = -90;
        analyser.maxDecibels = -10;
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        // Conecta o player do Tone.js ao analisador
        if (currentPlayer) {
            currentPlayer.connect(analyser);
            // Também mantém a conexão com o destination para o áudio sair
            currentPlayer.connect(Tone.Destination);
        }
    } catch (error) {
        console.warn('Erro ao configurar analisador de áudio:', error);
    }
}

function updateMusicVisualizer() {
    if (!analyser || !dataArray || gameState !== 'playing') {
        // Se não há análise de áudio, mostra barras estáticas mínimas
        visualizerBars.forEach((bar, i) => {
            // Suaviza para a altura mínima
            bar.currentHeight += (VISUALIZER_MIN_HEIGHT - bar.currentHeight) * VISUALIZER_SMOOTHING;

            bar.clear();
            bar.beginFill(LANE_COLORS[i], VISUALIZER_ALPHA_STOPPED); // Muito translúcido quando parado
            bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, bar.currentHeight);
            bar.endFill();
            bar.y = GAME_HEIGHT - bar.currentHeight;
        });
        return;
    }

    // Obtém os dados de frequência
    analyser.getByteFrequencyData(dataArray);

    // Atualiza cada barra do visualizador
    for (let i = 0; i < visualizerBars.length; i++) {
        const bar = visualizerBars[i];

        // Distribui as frequências de forma equilibrada entre as 5 barras
        let frequency = 0;

        // Mapeia cada barra para uma faixa específica do espectro de frequência
        const frequencyRanges = [
            { start: 0, end: 0.2 },      // Barra 0: Graves (0-20% do espectro)
            { start: 0.15, end: 0.35 },  // Barra 1: Médio-graves (15-35%)
            { start: 0.3, end: 0.45 },   // Barra 2: Médios (30-45%)
            { start: 0.4, end: 0.6 },    // Barra 3: Médio-agudos (40-60%)
            { start: 0.55, end: 0.7 }    // Barra 4: Agudos (55-70%)
        ];

        const range = frequencyRanges[i];
        const startIndex = Math.floor(range.start * bufferLength);
        const endIndex = Math.floor(range.end * bufferLength);
        
        // Calcula a média das frequências na faixa
        let sum = 0;
        let count = 0;
        for (let j = startIndex; j < endIndex && j < bufferLength; j++) {
            sum += dataArray[j] || 0;
            count++;
        }
        
        frequency = count > 0 ? sum / count : 0;
        
        // Aplica amplificação específica por faixa
        if (i >= 3) {
            // Amplifica frequências médio-agudas e agudas
            frequency = Math.min(255, frequency * 1.5);
        }

        // Amplifica a resposta da frequência para mais reatividade
        const amplifiedFrequency = Math.pow(frequency / 255, 0.4) * 255;

        // Calcula a altura alvo
        const targetHeight = VISUALIZER_MIN_HEIGHT +
            (amplifiedFrequency / 255) * (VISUALIZER_MAX_HEIGHT - VISUALIZER_MIN_HEIGHT);

        // Suaviza a transição para a altura alvo
        if (!bar.currentHeight) bar.currentHeight = VISUALIZER_MIN_HEIGHT;
        bar.currentHeight += (targetHeight - bar.currentHeight) * VISUALIZER_SMOOTHING;

        const barHeight = Math.max(VISUALIZER_MIN_HEIGHT, bar.currentHeight);

        // Atualiza a altura da barra (crescendo para cima)
        bar.clear();

        // Usa a cor da lane correspondente
        const intensity = amplifiedFrequency / 255;
        
        // Alpha varia de acordo com a altura da barra e intensidade
        const heightRatio = (barHeight - VISUALIZER_MIN_HEIGHT) / (VISUALIZER_MAX_HEIGHT - VISUALIZER_MIN_HEIGHT);
        const alphaRange = VISUALIZER_ALPHA_MAX - VISUALIZER_ALPHA_MIN;
        const baseAlpha = VISUALIZER_ALPHA_MIN + (heightRatio * alphaRange * 0.75); // 75% do range baseado na altura
        const intensityBonus = intensity * (alphaRange * 0.25); // 25% do range como bonus de intensidade
        const alpha = Math.min(VISUALIZER_ALPHA_MAX, baseAlpha + intensityBonus); // Limita ao alpha máximo

        bar.beginFill(LANE_COLORS[i], alpha);
        bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, barHeight);
        bar.endFill();

        // Posiciona a barra para que cresça de baixo para cima
        bar.y = GAME_HEIGHT - barHeight;
    }
}

// Função auxiliar para converter HSL para HEX
function hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return parseInt(`0x${f(0)}${f(8)}${f(4)}`);
}

function drawLanes() {
    // Desenha overlays coloridos sob cada lane
    for (let i = 0; i < NUM_LANES; i++) {
        const laneOverlay = new PIXI.Graphics();
        laneOverlay.beginFill(LANE_COLORS[i], 0.08);
        laneOverlay.drawRect(i * LANE_WIDTH, 0, LANE_WIDTH, GAME_HEIGHT);
        laneOverlay.endFill();
        backgroundContainer.addChild(laneOverlay);
    }

    // Desenha as linhas separadoras das lanes
    const graphics = new PIXI.Graphics();
    for (let i = 1; i < NUM_LANES; i++) {
        graphics.lineStyle(2, 0x444444, 0.5);
        graphics.moveTo(i * LANE_WIDTH, 0);
        graphics.lineTo(i * LANE_WIDTH, GAME_HEIGHT);
    }
    backgroundContainer.addChild(graphics);
}

function drawTargets() {
    const targetY = GAME_HEIGHT - 100;
    mainTargetLine = new PIXI.Graphics();
    mainTargetLine.lineStyle(4, 0xFFFFFF, 1);
    mainTargetLine.moveTo(0, targetY);
    mainTargetLine.lineTo(GAME_WIDTH, targetY);
    mainTargetLine.pivot.set(GAME_WIDTH / 2, targetY);
    mainTargetLine.x = GAME_WIDTH / 2;
    mainTargetLine.y = targetY;
    targetContainer.addChild(mainTargetLine);

    for (let i = 0; i < NUM_LANES; i++) {
        const target = new PIXI.Graphics();
        target.beginFill(LANE_COLORS[i], 0.2);
        target.lineStyle(2, LANE_COLORS[i], 0.7);
        target.drawCircle(i * LANE_WIDTH + LANE_WIDTH / 2, targetY, LANE_WIDTH / 2 - 5);
        target.endFill();
        target.alpha = 0.5;
        
        // Propriedades para efeitos visuais
        target.laneIndex = i;
        target.isPressed = false;
        target.baseAlpha = 0.5;
        target.pressedAlpha = 0.9;
        target.glowContainer = new PIXI.Graphics(); // Container para o efeito glow
        
        targets.push(target);
        targetContainer.addChild(target.glowContainer); // Adicionar glow primeiro (atrás do target)
        targetContainer.addChild(target);
    }
}

function updateTargetVisuals() {
    const targetY = GAME_HEIGHT - 100;
    
    targets.forEach(target => {
        const key = KEY_MAPPINGS[target.laneIndex];
        const isCurrentlyPressed = keysPressed.has(key);
        
        // Atualizar estado
        target.isPressed = isCurrentlyPressed;
        
        // Redesenhar o target com cor mais intensa se pressionado
        target.clear();
        if (isCurrentlyPressed) {
            // Estado pressionado - cor mais intensa e borda mais grossa
            target.beginFill(LANE_COLORS[target.laneIndex], 0.6);
            target.lineStyle(4, LANE_COLORS[target.laneIndex], 1.0);
            target.alpha = target.pressedAlpha;
        } else {
            // Estado normal
            target.beginFill(LANE_COLORS[target.laneIndex], 0.2);
            target.lineStyle(2, LANE_COLORS[target.laneIndex], 0.7);
            target.alpha = target.baseAlpha;
        }
        target.drawCircle(target.laneIndex * LANE_WIDTH + LANE_WIDTH / 2, targetY, LANE_WIDTH / 2 - 5);
        target.endFill();
        
        // Atualizar efeito glow
        target.glowContainer.clear();
        if (isCurrentlyPressed) {
            // Criar múltiplas camadas de glow
            const centerX = target.laneIndex * LANE_WIDTH + LANE_WIDTH / 2;
            const centerY = targetY;
            const baseRadius = LANE_WIDTH / 2 - 5;
            
            const glowLayers = [
                { radius: baseRadius + 20, alpha: 0.1 },
                { radius: baseRadius + 15, alpha: 0.15 },
                { radius: baseRadius + 10, alpha: 0.2 },
                { radius: baseRadius + 5, alpha: 0.25 }
            ];
            
            glowLayers.forEach(layer => {
                target.glowContainer.beginFill(LANE_COLORS[target.laneIndex], layer.alpha);
                target.glowContainer.drawCircle(centerX, centerY, layer.radius);
                target.glowContainer.endFill();
            });
        }
    });
}

function createNote(noteData) {
    const note = new PIXI.Graphics();
    const laneX = noteData.lane * LANE_WIDTH;

    note.beginFill(LANE_COLORS[noteData.lane]);
    note.drawRoundedRect(5, 0, LANE_WIDTH - 10, NOTE_HEIGHT, 8);
    note.endFill();

    note.x = laneX;
    note.pivot.y = NOTE_HEIGHT / 2;

    note.lane = noteData.lane;
    note.time = noteData.time;
    note.hit = false;

    notesOnScreen.push(note);
    noteContainer.addChild(note);
}

function createParticles(x, y, color) {
    for (let i = 0; i < 20; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(color);
        particle.drawCircle(0, 0, Math.random() * 3 + 1);
        particle.endFill();
        particle.x = x;
        particle.y = y;
        particle.vx = (Math.random() - 0.5) * 8;
        particle.vy = (Math.random() - 0.5) * 8 - 3;
        particle.alpha = 1;
        particle.life = Math.random() * 0.5 + 0.3;
        particles.push(particle);
        particleContainer.addChild(particle);
    }
}

function showFeedback(text, lane, color) {
    const feedbackText = new PIXI.Text(text, {
        fontFamily: 'Segoe UI', fontSize: 32, fontWeight: 'bold',
        fill: color, stroke: '#000000', strokeThickness: 4
    });
    feedbackText.anchor.set(0.5);
    feedbackText.x = lane * LANE_WIDTH + LANE_WIDTH / 2;
    feedbackText.y = GAME_HEIGHT - 150;
    feedbackText.initialY = feedbackText.y;
    feedbackText.life = 0.5;

    feedbackContainer.addChild(feedbackText);
}

function gameLoop(delta) {
    if (gameState !== 'playing') return;

    const deltaSeconds = delta / PIXI.settings.TARGET_FPMS / 1000;
    // Aplica o delay de áudio no cálculo do tempo das notas
    const elapsedTime = (Tone.Transport.seconds * 1000) + gameSettings.audioDelay;
    const targetY = GAME_HEIGHT - 100;

    // Atualiza o visualizador de música
    updateMusicVisualizer();
    
    // Atualiza efeitos visuais das zonas alvo
    updateTargetVisuals();

    // Animação de fundo - estrelas
    const targetSpeedMultiplier = keysPressed.size > 0 ? 5.0 : 1.0;
    starSpeedMultiplier += (targetSpeedMultiplier - starSpeedMultiplier) * STAR_SPEED_TRANSITION_RATE;

    stars.forEach(star => {
        star.y += star.speed * starSpeedMultiplier;
        
        // Atualizar rastro da estrela
        updateStarTrail(star);
        
        if (star.y > GAME_HEIGHT) {
            star.y = 0;
            star.x = Math.random() * GAME_WIDTH;
            // Reinicializar o rastro quando a estrela reaparece no topo
            star.trail = [];
            for (let j = 0; j < TRAIL_LENGTH; j++) {
                star.trail.push({ x: star.x, y: star.y });
            }
        }
    });

    // Loop das notas
    for (let i = notesOnScreen.length - 1; i >= 0; i--) {
        const note = notesOnScreen[i];
        if (note.hit) continue;

        const timeDifference = note.time - elapsedTime;
        note.y = targetY - (timeDifference * NOTE_SPEED);

        if (note.y > GAME_HEIGHT) {
            handleMiss(note);
        }
    }

    // Loop das partículas
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= 0.04;
        p.life -= deltaSeconds;
        if (p.life <= 0) {
            p.destroy();
            particles.splice(i, 1);
        }
    }

    // Loop do texto de feedback
    for (let i = feedbackContainer.children.length - 1; i >= 0; i--) {
        const text = feedbackContainer.children[i];
        text.y -= 1;
        text.alpha -= 0.03;
        text.life -= deltaSeconds;
        if (text.life <= 0) {
            text.destroy();
        }
    }
}

function handleKeyDown(e) {
    const key = e.key.toLowerCase();
    const laneIndex = KEY_MAPPINGS.indexOf(key);

    if (laneIndex !== -1) {
        keysPressed.add(key);

        // Processa o input da lane
        triggerLaneInput(laneIndex);
    }
}

function handleKeyUp(e) {
    const key = e.key.toLowerCase();
    keysPressed.delete(key);
}

function handleHit(note, timeDiff) {
    note.hit = true;

    let feedback = '';
    let feedbackColor = 0xFFFFFF;
    let scoreValue = 0;

    if (timeDiff < HIT_WINDOWS.PERFECT) {
        feedback = 'PERFECT';
        feedbackColor = 0x00FFFF;
        scoreValue = SCORE_VALUES.PERFECT;
    } else if (timeDiff < HIT_WINDOWS.GOOD) {
        feedback = 'GOOD';
        feedbackColor = 0x90EE90;
        scoreValue = SCORE_VALUES.GOOD;
    } else {
        feedback = 'FAIR';
        feedbackColor = 0xFFD700;
        scoreValue = SCORE_VALUES.FAIR;
    }

    const targetY = GAME_HEIGHT - 100;
    createParticles(note.lane * LANE_WIDTH + LANE_WIDTH / 2, targetY, LANE_COLORS[note.lane]);
    showFeedback(feedback, note.lane, feedbackColor);

    incrementCombo();
    updateScore(scoreValue);

    // Atualiza accuracy
    totalNotes++;
    hitNotes++;
    updateAccuracy();

    removeNote(note);
}

function handleMiss(note) {
    note.hit = true;
    resetCombo();
    showFeedback('MISS', note.lane, 0xFF6347);

    const target = targets[note.lane];
    if (target) {
        const originalColor = LANE_COLORS[note.lane];
        target.tint = 0xFF0000;
        setTimeout(() => { if (target && !target.destroyed) target.tint = 0xFFFFFF; }, 200);
    }

    // Atualiza accuracy
    totalNotes++;
    updateAccuracy();

    removeNote(note);
}

function removeNote(note) {
    const index = notesOnScreen.indexOf(note);
    if (index > -1) notesOnScreen.splice(index, 1);
    note.destroy();
}

function updateScore(points) {
    score += points;
    scoreText.textContent = score.toLocaleString();
}

function updateAccuracy() {
    const accuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 100;
    accuracyText.textContent = `${accuracy}%`;

    // Muda a cor baseada no accuracy
    if (accuracy >= 95) {
        accuracyText.style.color = '#00FFFF'; // Ciano (Perfeito)
    } else if (accuracy >= 85) {
        accuracyText.style.color = '#90EE90'; // Verde claro (Muito bom)
    } else if (accuracy >= 70) {
        accuracyText.style.color = '#FFD700'; // Dourado (Bom)
    } else if (accuracy >= 50) {
        accuracyText.style.color = '#FFA500'; // Laranja (Médio)
    } else {
        accuracyText.style.color = '#FF6347'; // Vermelho (Ruim)
    }
}

function incrementCombo() {
    combo++;
    comboText.textContent = combo;
    
    // Adiciona efeito visual no container do combo
    const comboContainer = comboText.closest('.stat-item');
    if (comboContainer) {
        comboContainer.classList.add('combo-pulse');
        setTimeout(() => { 
            comboContainer.classList.remove('combo-pulse'); 
        }, 100);
    }
}

function resetCombo() {
    combo = 0;
    comboText.textContent = combo;
}

window.onresize = function () {
    const newHeight = window.innerHeight * 0.95;
    pixiApp.renderer.resize(GAME_WIDTH, newHeight);
};