// Variáveis globais para armazenar os dados
let chartData = null;
let currentSong = null;
let currentDifficulty = null;
let gameState = 'menu'; // 'menu', 'preparing', 'countdown', 'playing', 'paused'

// --- Configurações do Jogo ---
const NUM_LANES = 5;
// Constante para padding lateral das lanes em landscape (porcentagem da largura da tela)
const LANDSCAPE_LANE_PADDING_PERCENT = 15; // 15% de cada lado = 30% total de padding

// Função para detectar orientação e calcular dimensões responsivas
function getResponsiveDimensions() {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const isLandscape = screenWidth > screenHeight;
    const isMobile = screenWidth <= 768 || screenHeight <= 768;
    
    let gameWidth, gameHeight, laneWidth, laneAreaWidth, laneStartX;
    
    if (isLandscape && isMobile && screenHeight <= 600) {
        // Landscape mobile: usa toda a tela para o container, mas aplica padding nas lanes
        gameWidth = screenWidth;
        gameHeight = screenHeight;
        
        // Calcula área das lanes com padding lateral
        const lateralPadding = screenWidth * (LANDSCAPE_LANE_PADDING_PERCENT / 100);
        laneAreaWidth = screenWidth - (lateralPadding * 2);
        laneWidth = Math.floor(laneAreaWidth / NUM_LANES);
        laneStartX = lateralPadding; // Posição X onde começam as lanes
    } else if (isMobile) {
        // Portrait mobile: usa 90% da largura
        laneWidth = Math.floor((screenWidth * 0.9) / NUM_LANES);
        laneAreaWidth = laneWidth * NUM_LANES;
        gameWidth = laneAreaWidth;
        gameHeight = screenHeight * 0.95;
        laneStartX = 0; // Sem offset em portrait
    } else {
        // Desktop: tamanho fixo
        laneWidth = 100;
        laneAreaWidth = laneWidth * NUM_LANES;
        gameWidth = laneAreaWidth;
        gameHeight = screenHeight * 0.95;
        laneStartX = 0; // Sem offset em desktop
    }
    
    // Define offset vertical para targets no mobile
    let targetOffsetY;
    if (isMobile) {
        // Mobile: targets mais baixos para melhor alcance (menor offset = mais baixo na tela)
        targetOffsetY = 60;
    } else {
        // Desktop: posição padrão
        targetOffsetY = 100;
    }
    
    return { 
        gameWidth, 
        gameHeight, 
        laneWidth, 
        laneAreaWidth,
        laneStartX,
        targetOffsetY,
        isLandscape, 
        isMobile 
    };
}

// Configurações responsivas iniciais
let dimensions = getResponsiveDimensions();
let LANE_WIDTH = dimensions.laneWidth;
let GAME_WIDTH = dimensions.gameWidth;
let GAME_HEIGHT = dimensions.gameHeight;
let LANE_AREA_WIDTH = dimensions.laneAreaWidth;
let LANE_START_X = dimensions.laneStartX;
let TARGET_OFFSET_Y = dimensions.targetOffsetY;
let VISUALIZER_BAR_WIDTH = LANE_WIDTH; // Cada barra alinhada com uma lane
const NOTE_HEIGHT = 25;

// Função para redimensionar o jogo quando a orientação muda
function resizeGame() {
    const newDimensions = getResponsiveDimensions();
    
    // Só redimensiona se as dimensões mudaram significativamente
    if (Math.abs(newDimensions.gameWidth - GAME_WIDTH) > 10 || 
        Math.abs(newDimensions.gameHeight - GAME_HEIGHT) > 10) {
        
        LANE_WIDTH = newDimensions.laneWidth;
        GAME_WIDTH = newDimensions.gameWidth;
        GAME_HEIGHT = newDimensions.gameHeight;
        LANE_AREA_WIDTH = newDimensions.laneAreaWidth;
        LANE_START_X = newDimensions.laneStartX;
        TARGET_OFFSET_Y = newDimensions.targetOffsetY;
        VISUALIZER_BAR_WIDTH = LANE_WIDTH; // Atualizar largura das barras do visualizador
        
        // Atualizar configurações dependentes
        updateNoteSpeedSettings();
        
        // Redimensionar canvas se o PixiJS estiver inicializado
        if (pixiApp) {
            pixiApp.renderer.resize(GAME_WIDTH, GAME_HEIGHT);
            
            // Reposicionar elementos se necessário
            if (gameState === 'playing' || gameState === 'paused') {
                repositionGameElements();
            }
        }
        
        // Atualizar controles touch - não necessário mais
        // As touch areas são do PixiJS e são atualizadas automaticamente
        
        // Atualizar container do jogo
        const gameContainer = document.getElementById('game-container');
        if (gameContainer && newDimensions.isLandscape && newDimensions.isMobile) {
            gameContainer.style.width = '100vw';
            gameContainer.style.height = '100vh';
            gameContainer.style.border = 'none';
            gameContainer.style.borderRadius = '0';
        } else if (gameContainer) {
            gameContainer.style.width = '';
            gameContainer.style.height = '';
            gameContainer.style.border = '';
            gameContainer.style.borderRadius = '';
        }
    }
}

// Função para reposicionar elementos do jogo após redimensionamento
function repositionGameElements() {
    if (!pixiApp) return;
    
    // Reposicionar targets usando o offset das lanes
    targets.forEach((target, i) => {
        // Usar tamanho original (sem redução para landscape)
        const targetRadius = LANE_WIDTH / 2 - 5;
        
        // Recriar o círculo com novo tamanho e posição
        target.clear();
        target.beginFill(LANE_COLORS[i], 0.2);
        target.lineStyle(2, LANE_COLORS[i], 0.7);
        target.drawCircle(LANE_START_X + (i * LANE_WIDTH) + (LANE_WIDTH / 2), GAME_HEIGHT - TARGET_OFFSET_Y, targetRadius);
        target.endFill();
        target.radius = targetRadius; // Atualizar raio armazenado
    });
    
    // Reposicionar linha principal
    if (mainTargetLine) {
        mainTargetLine.clear();
        mainTargetLine.lineStyle(4, 0xffffff, 0.8);
        mainTargetLine.moveTo(LANE_START_X, GAME_HEIGHT - TARGET_OFFSET_Y);
        mainTargetLine.lineTo(LANE_START_X + LANE_AREA_WIDTH, GAME_HEIGHT - TARGET_OFFSET_Y);
    }
    
    // Recriar bordas se necessário
    if (glowBorder) {
        createGlowBorder();
    }
    
    // Reposicionar notas existentes
    notesOnScreen.forEach(note => {
        if (note.laneIndex !== undefined) {
            note.x = LANE_START_X + (note.laneIndex * LANE_WIDTH) + (LANE_WIDTH / 2);
        }
    });
    
    // Reposicionar touch areas do PixiJS
    if (pixiTouchAreas && pixiTouchAreas.length > 0) {
        const touchAreaHeight = GAME_HEIGHT * 0.35;
        const touchAreaY = GAME_HEIGHT - touchAreaHeight;
        
        pixiTouchAreas.forEach((touchArea, i) => {
            // Limpar e recriar as áreas touch com nova posição
            const normalState = touchArea.normalState;
            const pressedState = touchArea.pressedState;
            
            const laneX = LANE_START_X + (i * LANE_WIDTH);
            
            // Recriar estado normal
            normalState.clear();
            normalState.beginFill(LANE_COLORS[i], 0.08);
            normalState.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
            normalState.lineStyle(1, LANE_COLORS[i], 0.2);
            normalState.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
            normalState.endFill();
            
            // Recriar estado pressionado
            pressedState.clear();
            pressedState.beginFill(LANE_COLORS[i], 0.3);
            pressedState.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
            pressedState.lineStyle(2, LANE_COLORS[i], 0.6);
            pressedState.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
            pressedState.endFill();
        });
    }
    
    // Reposicionar barras do visualizador
    if (visualizerBars && visualizerBars.length > 0) {
        visualizerBars.forEach((bar, i) => {
            bar.x = LANE_START_X + (i * LANE_WIDTH);
        });
    }
    
    // Recriar backgrounds das lanes
    if (backgroundContainer) {
        // Remove backgrounds antigos das lanes
        const childrenToRemove = [];
        backgroundContainer.children.forEach(child => {
            if (child.isLaneOverlay || child.isLaneSeparator) {
                childrenToRemove.push(child);
            }
        });
        
        childrenToRemove.forEach(child => {
            backgroundContainer.removeChild(child);
            child.destroy();
        });
        
        // Recriar backgrounds das lanes com nova posição
        for (let i = 0; i < NUM_LANES; i++) {
            const laneOverlay = new PIXI.Graphics();
            laneOverlay.beginFill(LANE_COLORS[i], 0.08);
            laneOverlay.drawRect(LANE_START_X + (i * LANE_WIDTH), 0, LANE_WIDTH, GAME_HEIGHT);
            laneOverlay.endFill();
            laneOverlay.isLaneOverlay = true; // Marcador para identificação
            backgroundContainer.addChild(laneOverlay);
        }
        
        // Recriar linhas separadoras
        const graphics = new PIXI.Graphics();
        for (let i = 1; i < NUM_LANES; i++) {
            graphics.lineStyle(2, 0x444444, 0.5);
            graphics.moveTo(LANE_START_X + (i * LANE_WIDTH), 0);
            graphics.lineTo(LANE_START_X + (i * LANE_WIDTH), GAME_HEIGHT);
        }
        graphics.isLaneSeparator = true; // Marcador para identificação
        backgroundContainer.addChild(graphics);
    }
}

// --- Configurações de Velocidade das Notas ---
// Valores padrão - serão atualizados dinamicamente baseados nas configurações
let NOTE_FALL_SPEED = 300; // Velocidade de queda das notas em pixels por segundo (ajustável)
let NOTE_SCROLL_DISTANCE = GAME_HEIGHT - TARGET_OFFSET_Y; // Distância que a nota percorre até a zona alvo
let NOTE_LEAD_TIME = NOTE_SCROLL_DISTANCE / NOTE_FALL_SPEED * 1000; // Tempo em ms que a nota precisa para chegar ao alvo
let NOTE_SPEED = NOTE_FALL_SPEED / 1000; // Conversão para pixels por milissegundo (compatibilidade)

// --- Configurações de Interpolação ---
const NOTE_INTERPOLATION_SPEED = 15.0; // Velocidade da interpolação (quanto maior, mais rápida a convergência)

// Função para atualizar as configurações de velocidade das notas
function updateNoteSpeedSettings() {
    const config = getCurrentNoteSpeedConfig();
    NOTE_FALL_SPEED = config.speed;
    NOTE_SCROLL_DISTANCE = GAME_HEIGHT - TARGET_OFFSET_Y;
    NOTE_LEAD_TIME = NOTE_SCROLL_DISTANCE / NOTE_FALL_SPEED * 1000;
    NOTE_SPEED = NOTE_FALL_SPEED / 1000;
}

// Configurações de efeitos visuais
const STAR_SPEED_TRANSITION_RATE = 0.4;
const ENABLE_STAR_ACCELERATION = true; // Define se as estrelas aceleram quando uma nota é pressionada

// Janelas de tempo para acerto (em ms)
const HIT_WINDOWS = {
    PERFECT: 50,
    GOOD: 100,
    FAIR: 140,
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

// --- Variáveis de Estado do Jogo ---
let score = 0, combo = 0, maxCombo = 0;
let totalNotes = 0, hitNotes = 0; // Para calcular accuracy
let pixiApp, noteContainer, targetContainer, feedbackContainer, particleContainer, backgroundContainer, touchContainer;
let notesOnScreen = [], targets = [], particles = [], stars = [];
// OTIMIZAÇÃO: Índice de notas por lane para O(1) lookup
let notesByLane = [[], [], [], [], []]; // Array de arrays para cada lane
let gameStartTime = 0;
let mainTargetLine, glowBorder;
let keysPressed = new Set();
let starSpeedMultiplier = 1.0;
let currentPlayer = null;
let gameFinished = false;
let allNotesSpawned = false;
let musicFinished = false;
let musicDuration = 0;

/* OTIMIZAÇÕES DE PERFORMANCE IMPLEMENTADAS:
 * 
 * === MOBILE TOUCH OPTIMIZATION ===
 * 1. Touch areas com cache visual - usa alternância de visibilidade em vez de redesenhar geometria
 * 2. Índice de notas por lane - reduz checkNoteHit() de O(n) para O(1) 
 * 3. Pool de textos de feedback - reutiliza objetos PIXI.Text em vez de criar/destruir
 * 4. Configurações adaptativas mobile/desktop - menos partículas e efeitos em mobile
 * 5. Efeitos visuais assíncronos - partículas executam no próximo frame
 * 
 * === VISUAL EFFECTS OPTIMIZATION ===
 * 6. Pool de partículas com limite máximo ativo
 * 7. Taxa de atualização controlada para efeitos visuais (30fps em vez de 60fps)
 * 
 * PERFORMANCE MOBILE:
 * - Touch responsivo sem quedas de FPS
 * - Limites adaptativos de partículas (6 vs 12)
 * - Pools de objetos para evitar garbage collection
 * - Operações críticas separadas de efeitos visuais
 */

// --- Configurações do sistema de rastro das estrelas ---
const TRAIL_LENGTH = 8; // Reduzido de 15 para 8 - menos pontos para melhor performance
const TRAIL_ALPHA_DECAY = 0.4; // Taxa de decaimento do alpha do rastro

// --- Configurações de performance ---
let frameCounter = 0;
const VISUAL_EFFECTS_UPDATE_RATE = 1; // Atualizar efeitos visuais a cada 2 frames (30fps em vez de 60fps)

// OTIMIZAÇÃO: Configurações adaptativas para mobile
const MOBILE_PERFORMANCE_CONFIG = {
    maxParticlesPerHit: 6, // Reduzido de 12 para 6 no mobile
    maxActiveParticles: 50, // Limite total de partículas ativas
    feedbackTextPool: 10, // Pool de textos de feedback para reuso
    reduceVisualEffects: true // Flag para reduzir efeitos em mobile
};

const DESKTOP_PERFORMANCE_CONFIG = {
    maxParticlesPerHit: 12,
    maxActiveParticles: 100,
    feedbackTextPool: 20,
    reduceVisualEffects: false
};

// Detecta configuração baseada na plataforma
const PERF_CONFIG = detectMobile() ? MOBILE_PERFORMANCE_CONFIG : DESKTOP_PERFORMANCE_CONFIG;

// --- Configurações de indicadores visuais ---
const SHOW_HIT_FEEDBACK = true; // Define se os indicadores de hit (PERFECT, GOOD, etc.) serão mostrados

/* OTIMIZAÇÕES DE PERFORMANCE IMPLEMENTADAS:
 * 
 * CONTROLES DE PERFORMANCE:
 * - SHOW_HIT_FEEDBACK: Controla se indicadores de hit são mostrados (PERFECT, GOOD, etc.)
 * 
 * TOUCH AREAS OTIMIZADOS (MOBILE):
 * - Implementação PIXI nativa em vez de manipulação DOM
 * - Elimina reflow/repaint do navegador
 * - Sistema de eventos PIXI mais performático
 * - Renderização no mesmo contexto do canvas
 * - Feedback visual sem manipulação de CSS
 * 
 * ELEMENTOS QUE MANTÉM 60FPS (CRÍTICOS PARA GAMEPLAY):
 * - Movimento das notas (precisão de timing essencial)
 * - Resposta dos targets a inputs (responsividade imediata)
 * - Touch areas PIXI (resposta instantânea)
 * - Detecção de hits e feedback de input
 * - Movimento das partículas ativas
 * 
 * ELEMENTOS LIMITADOS A 30FPS (EFEITOS VISUAIS SECUNDÁRIOS):
 * - Visualizador de música (updateMusicVisualizer)
 * - Apenas os redesenhos condicionais do visualizador
 * 
 * OUTRAS OTIMIZAÇÕES:
 * 1. Object pooling: Reutilização de partículas (pool de 100)
 * 2. Redução de complexidade: Menos estrelas (120 vs 200), menos partículas (12 vs 20)
 * 3. Renderização baseada em mudanças: Só redesenha quando necessário
 * 4. Loops otimizados: Uso de for em vez de forEach
 * 5. Thresholds aumentados: Maior threshold para redesenho do visualizador
 */

// --- Sistema de pooling de partículas ---
const PARTICLE_POOL_SIZE = 100;
let particlePool = [];
let activeParticles = [];

// Inicializar pool de partículas
function initParticlePool() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const particle = new PIXI.Graphics();
        particle.beginFill(0xFFFFFF);
        particle.drawCircle(0, 0, 2);
        particle.endFill();
        particle.visible = false;
        particlePool.push(particle);
        particleContainer.addChild(particle);
    }
}

// Função otimizada para obter partícula do pool
function getParticleFromPool() {
    if (particlePool.length > 0) {
        const particle = particlePool.pop();
        particle.visible = true;
        return particle;
    }
    return null; // Pool esgotado
}

// Função para retornar partícula ao pool
function returnParticleToPool(particle) {
    particle.visible = false;
    particle.alpha = 1;
    particlePool.push(particle);
    
    const index = activeParticles.indexOf(particle);
    if (index > -1) {
        activeParticles.splice(index, 1);
    }
}

// --- Variáveis do Visualizador de Música ---
let audioContext = null;
let analyser = null;
let dataArray = null;
let bufferLength = 0;
let visualizerContainer = null;

// --- Variáveis para Dispositivos Móveis ---
let isMobile = false;
let pixiTouchAreas = []; // PIXI.js touch areas para melhor performance
let touchStates = new Set(); // Para rastrear toques ativos
let visualizerBars = [];
let visualizerTargetHeights = []; // Para suavização das transições
const VISUALIZER_BARS = 5; // Mesmo número de lanes
const VISUALIZER_MAX_HEIGHT = GAME_HEIGHT; // Altura máxima = altura total da tela
const VISUALIZER_MIN_HEIGHT = GAME_HEIGHT / 4; // Altura mínima = 1/4 da altura total
const VISUALIZER_SMOOTHING = 0.15; // Constante para suavização das transições (0.1 = mais suave, 0.3 = mais rápido)
const VISUALIZER_ALPHA_MIN = 0.03; // Alpha mínimo das barras (4%)
const VISUALIZER_ALPHA_MAX = 0.3; // Alpha máximo das barras (20%)
const VISUALIZER_ALPHA_STOPPED = 0.04; // Alpha quando o jogo está parado (4%)

// --- Configurações do Jogo (persistentes) ---
let gameSettings = {
    audioDelay: 20, // Delay de áudio em milissegundos
    noteSpeed: 'normal' // Velocidade das notas: 'slow', 'normal', 'fast'
};

// --- Configurações de Velocidade das Notas (dinâmicas) ---
const NOTE_SPEED_CONFIGS = {
    slow: { speed: 200, label: 'Devagar' },
    normal: { speed: 300, label: 'Normal' },
    fast: { speed: 450, label: 'Rápido' }
};

// Função para obter as configurações atuais de velocidade
function getCurrentNoteSpeedConfig() {
    return NOTE_SPEED_CONFIGS[gameSettings.noteSpeed] || NOTE_SPEED_CONFIGS.normal;
}

// --- Sistema de Highscores ---
let highScores = {};

// Função para carregar highscores do localStorage
function loadHighScores() {
    const saved = localStorage.getItem('rhythmGameHighScores');
    if (saved) {
        try {
            highScores = JSON.parse(saved);
        } catch (e) {
            console.warn('Erro ao carregar highscores:', e);
            highScores = {};
        }
    }
}

// Função para salvar highscores no localStorage
function saveHighScores() {
    try {
        localStorage.setItem('rhythmGameHighScores', JSON.stringify(highScores));
    } catch (e) {
        console.warn('Erro ao salvar highscores:', e);
    }
}

// Função para obter a chave do highscore (song + difficulty)
function getHighScoreKey(song, difficulty) {
    return `${song.id}_${difficulty.level}`;
}

// Função para obter o highscore de uma música/dificuldade
function getHighScore(song, difficulty) {
    const key = getHighScoreKey(song, difficulty);
    return highScores[key] || null;
}

// Função para atualizar o highscore
function updateHighScore(song, difficulty, scoreData) {
    const key = getHighScoreKey(song, difficulty);
    const currentHigh = highScores[key];
    
    if (!currentHigh || scoreData.score > currentHigh.score) {
        highScores[key] = {
            score: scoreData.score,
            accuracy: scoreData.accuracy,
            combo: scoreData.combo,
            date: new Date().toISOString()
        };
        saveHighScores();
        return true; // Novo record
    }
    
    return false; // Não é um novo record
}

// Função para contrair todos os cards de música
function contractAllSongCards() {
    document.querySelectorAll('.song-item.expanded').forEach(item => {
        item.classList.remove('expanded');
        item.classList.add('compact');
    });
    forceStopPreview();
}

function showResultsModal(gameResults, isNewRecord) {
    resultsSongTitle.textContent = currentSong.title;
    resultsSongDifficulty.textContent = currentDifficulty.name;
    
    resultsScore.textContent = gameResults.score.toLocaleString();
    resultsAccuracy.textContent = `${gameResults.accuracy}%`;
    resultsCombo.textContent = gameResults.combo.toLocaleString();
    resultsHitNotes.textContent = gameResults.hitNotes.toLocaleString();
    resultsTotalNotes.textContent = gameResults.totalNotes.toLocaleString();
    
    if (isNewRecord) {
        newRecordBadge.style.display = 'block';
    } else {
        newRecordBadge.style.display = 'none';
    }
    
    resultsModal.style.display = 'flex';
    startScreen.style.display = 'none';
    pauseBtn.style.display = 'none';
}

function hideResultsModal() {
    resultsModal.style.display = 'none';
}

function restartCurrentSong() {
    hideResultsModal();
    setupGame();
    showStartScreen();
}

function returnToMainMenu() {
    hideResultsModal();
    stopGame();
    gameState = 'menu';
    startScreen.style.display = 'none';
    pauseModal.style.display = 'none';
    mainMenu.style.display = 'flex';
    welcomeState.style.display = 'none';
    menuState.style.display = 'flex';
    pauseBtn.style.display = 'none';
    
    populateSongList();
}

// --- Variáveis para Detecção Automática de Delay ---
let autoDetectModal = null;
let autoDetectBtn = null;
let detectStatus = null;
let progressFill = null;
let startDetectionBtn = null;
let cancelDetectionBtn = null;
let detectionCanvas = null;
let detectionCtx = null;

// Configurações da detecção visual
const DETECTION_CONFIG = {
    TOTAL_TAPS: 10, // Reduzido para 5 interações
    BAR_SPEED: 1.2, // Velocidade da barra (pixels por frame) - reduzida de 2.5 para 1.2
    CYCLE_HEIGHT: 120, // Altura total do ciclo da barra (reduzida de 200 para 120)
    TARGET_LINE_Y: 60, // Posição Y da linha alvo (meio do trajeto reduzido)
    CANVAS_WIDTH: 400,
    CANVAS_HEIGHT: 200,
    TARGET_LINE_WIDTH: 300,
    TARGET_LINE_THICKNESS: 4
};

// Variáveis para o sistema visual de detecção
let isDetecting = false;
let detectionAnimationId = null;
let barPosition = 0; // Posição Y da barra
let crossingTimes = []; // Momentos quando a barra cruza a linha
let tapTimes = []; // Momentos dos taps do usuário
let tapCount = 0;
let lastCrossingTime = 0;
let detectionStartTime = 0;

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
const noteSpeedSelect = document.getElementById('note-speed-select');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');
const backToMenuBtn = document.getElementById('back-to-menu-btn');

// Elementos do modal de resultados
const resultsModal = document.getElementById('results-modal');
const resultsSongTitle = document.getElementById('results-song-title');
const resultsSongDifficulty = document.getElementById('results-song-difficulty');
const resultsScore = document.getElementById('results-score');
const resultsAccuracy = document.getElementById('results-accuracy');
const resultsCombo = document.getElementById('results-combo');
const resultsHitNotes = document.getElementById('results-hit-notes');
const resultsTotalNotes = document.getElementById('results-total-notes');
const newRecordBadge = document.getElementById('new-record-badge');
const restartSongBtn = document.getElementById('restart-song-btn');
const backToMenuFromResultsBtn = document.getElementById('back-to-menu-from-results-btn');

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
    noteSpeedSelect.value = gameSettings.noteSpeed;
    
    // Atualiza as configurações de velocidade das notas
    updateNoteSpeedSettings();
}

function saveSettings() {
    const newDelay = parseInt(audioDelayInput.value) || 40;
    const newNoteSpeed = noteSpeedSelect.value;

    // Valida o range do delay
    if (newDelay < -500 || newDelay > 500) {
        alert('O delay deve estar entre -500ms e 500ms');
        return;
    }

    // Valida a velocidade das notas
    if (!NOTE_SPEED_CONFIGS[newNoteSpeed]) {
        alert('Velocidade de nota inválida');
        return;
    }

    gameSettings.audioDelay = newDelay;
    gameSettings.noteSpeed = newNoteSpeed;

    // Atualiza as configurações de velocidade das notas
    updateNoteSpeedSettings();

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
    contractAllSongCards(); // Contrai cards ao abrir configurações
    mainMenu.style.display = 'none';
    settingsScreen.style.display = 'flex';
    audioDelayInput.value = gameSettings.audioDelay;
}

function closeSettings() {
    gameState = 'menu';
    settingsScreen.style.display = 'none';
    mainMenu.style.display = 'flex';
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
    
    welcomeState.classList.add('fade-out');
    
    setTimeout(() => {
        welcomeState.style.display = 'none';
        menuState.style.display = 'flex';
        
        welcomeState.classList.remove('fade-out');
        
        const songListElement = document.getElementById('song-list');
        const menuFooter = menuState.querySelector('.menu-footer');
        
        if (songListElement) {
            songListElement.style.opacity = '0';
        }
        if (menuFooter) {
            menuFooter.style.opacity = '0';
        }
        
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
    progressFill = document.getElementById('progress-fill');
    startDetectionBtn = document.getElementById('start-detection-btn');
    cancelDetectionBtn = document.getElementById('cancel-detection-btn');
    detectionCanvas = document.getElementById('detection-canvas');

    // Configurar canvas se existe
    if (detectionCanvas) {
        detectionCanvas.width = DETECTION_CONFIG.CANVAS_WIDTH;
        detectionCanvas.height = DETECTION_CONFIG.CANVAS_HEIGHT;
        detectionCtx = detectionCanvas.getContext('2d');
    }

    // Event listeners
    autoDetectBtn.onclick = openAutoDetect;
    startDetectionBtn.onclick = startDetection;
    cancelDetectionBtn.onclick = closeAutoDetect;

    // Event listeners para teclado e touch
    document.addEventListener('keydown', handleDetectionInput);
    if (detectionCanvas) {
        detectionCanvas.addEventListener('touchstart', handleDetectionTouch);
        detectionCanvas.addEventListener('click', handleDetectionClick);
    }
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
    crossingTimes = [];
    tapTimes = [];
    barPosition = 0;
    detectStatus.textContent = 'Comece quando quiser!';
    progressFill.style.width = '0%';
    startDetectionBtn.style.display = 'inline-block';
    startDetectionBtn.textContent = 'Iniciar Detecção';
    
    if (detectionAnimationId) {
        cancelAnimationFrame(detectionAnimationId);
        detectionAnimationId = null;
    }
    
    // Limpar canvas
    if (detectionCtx) {
        detectionCtx.clearRect(0, 0, DETECTION_CONFIG.CANVAS_WIDTH, DETECTION_CONFIG.CANVAS_HEIGHT);
        drawDetectionInterface();
    }
}

function startDetection() {
    if (isDetecting) return;

    // Inicializa o contexto de áudio se necessário
    if (!audioContext) {
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Erro ao inicializar AudioContext para beeps:', e);
        }
    }

    isDetecting = true;
    tapCount = 0;
    crossingTimes = [];
    tapTimes = [];
    barPosition = 0; // Inicia no topo
    detectionStartTime = performance.now();

    detectStatus.textContent = 'Comece quando quiser!';
    startDetectionBtn.style.display = 'none';
    progressFill.style.width = '0%';

    // Iniciar animação
    animateDetection();
}

function animateDetection() {
    if (!isDetecting) return;

    // Limpar canvas
    detectionCtx.clearRect(0, 0, DETECTION_CONFIG.CANVAS_WIDTH, DETECTION_CONFIG.CANVAS_HEIGHT);
    
    // Atualizar posição da barra (apenas descendo)
    barPosition += DETECTION_CONFIG.BAR_SPEED;
    
    // Verificar se a barra chegou ao fundo e reiniciar no topo
    if (barPosition >= DETECTION_CONFIG.CYCLE_HEIGHT) {
        barPosition = 0; // Reinicia no topo
    }
    
    // Detectar quando a barra cruza a linha horizontal
    const targetY = DETECTION_CONFIG.TARGET_LINE_Y;
    const currentBarY = barPosition;
    const previousBarY = barPosition - DETECTION_CONFIG.BAR_SPEED;
    
    // Verifica cruzamento da linha (sempre descendo)
    if (previousBarY < targetY && currentBarY >= targetY) {
        const currentTime = performance.now();
        crossingTimes.push(currentTime);
        lastCrossingTime = currentTime;
        
        // Tocar beep no momento do cruzamento
        playDetectionBeep();
        
        // Feedback visual do cruzamento
        drawDetectionInterface(true);
        setTimeout(() => {
            if (isDetecting) drawDetectionInterface();
        }, 100);
    } else {
        drawDetectionInterface();
    }
    
    // Continuar animação
    detectionAnimationId = requestAnimationFrame(animateDetection);
}

function playDetectionBeep() {
    try {
        // Usa o contexto de áudio do Tone.js se disponível, senão cria um novo
        const audioCtx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
        
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        // Beep mais alto e claro para alertar o usuário
        oscillator.frequency.setValueAtTime(1000, audioCtx.currentTime); // 1000Hz
        oscillator.type = 'sine';

        // Volume moderado
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.08);

    } catch (error) {
        console.warn('Erro ao tocar beep de detecção:', error);
    }
}

function drawDetectionInterface(highlight = false) {
    const ctx = detectionCtx;
    const centerX = DETECTION_CONFIG.CANVAS_WIDTH / 2;
    
    // Fundo transparente
    ctx.clearRect(0, 0, DETECTION_CONFIG.CANVAS_WIDTH, DETECTION_CONFIG.CANVAS_HEIGHT);
    
    // Área de detecção com gradiente sutil
    const gradient = ctx.createLinearGradient(0, 0, 0, DETECTION_CONFIG.CYCLE_HEIGHT);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0.03)');
    gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0.03)');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(centerX - DETECTION_CONFIG.TARGET_LINE_WIDTH / 2 - 10, 0, 
                 DETECTION_CONFIG.TARGET_LINE_WIDTH + 20, DETECTION_CONFIG.CYCLE_HEIGHT);
    
    // Linha horizontal alvo
    ctx.strokeStyle = highlight ? '#00FFFF' : '#FFFFFF';
    ctx.lineWidth = DETECTION_CONFIG.TARGET_LINE_THICKNESS;
    ctx.shadowColor = highlight ? '#00FFFF' : '#FFFFFF';
    ctx.shadowBlur = highlight ? 15 : 8;
    ctx.beginPath();
    const lineStartX = centerX - DETECTION_CONFIG.TARGET_LINE_WIDTH / 2;
    const lineEndX = centerX + DETECTION_CONFIG.TARGET_LINE_WIDTH / 2;
    ctx.moveTo(lineStartX, DETECTION_CONFIG.TARGET_LINE_Y);
    ctx.lineTo(lineEndX, DETECTION_CONFIG.TARGET_LINE_Y);
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Barra horizontal que se move verticalmente (50% da largura da linha base)
    ctx.strokeStyle = highlight ? '#00FFFF' : '#FF6347';
    ctx.lineWidth = DETECTION_CONFIG.TARGET_LINE_THICKNESS;
    ctx.shadowColor = highlight ? '#00FFFF' : '#FF6347';
    ctx.shadowBlur = highlight ? 12 : 6;
    ctx.beginPath();
    const barWidth = DETECTION_CONFIG.TARGET_LINE_WIDTH * 0.5; // 50% da largura da linha base
    const barStartX = centerX - barWidth / 2;
    const barEndX = centerX + barWidth / 2;
    ctx.moveTo(barStartX, barPosition);
    ctx.lineTo(barEndX, barPosition);
    ctx.stroke();
    
    // Reset shadow
    ctx.shadowBlur = 0;
    
    // Contador de taps mais elegante
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '18px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${tapCount}/${DETECTION_CONFIG.TOTAL_TAPS}`, centerX, DETECTION_CONFIG.CANVAS_HEIGHT - 15);
}

function handleDetectionInput(event) {
    if (event.code === 'Space' && isDetecting) {
        event.preventDefault();
        processTap();
    }
}

function handleDetectionTouch(event) {
    if (isDetecting) {
        event.preventDefault();
        processTap();
    }
}

function handleDetectionClick(event) {
    if (isDetecting) {
        event.preventDefault();
        processTap();
    }
}

function processTap() {
    if (!isDetecting || tapCount >= DETECTION_CONFIG.TOTAL_TAPS) return;

    const tapTime = performance.now();
    tapTimes.push(tapTime);
    tapCount++;

    // Feedback visual
    const ctx = detectionCtx;
    const centerX = DETECTION_CONFIG.CANVAS_WIDTH / 2;
    
    // Flash branco
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillRect(0, 0, DETECTION_CONFIG.CANVAS_WIDTH, DETECTION_CONFIG.CANVAS_HEIGHT);

    detectStatus.textContent = `Tap ${tapCount}/${DETECTION_CONFIG.TOTAL_TAPS} registrado!`;
    updateProgress();

    // Verifica se completou as 5 interações
    if (tapCount >= DETECTION_CONFIG.TOTAL_TAPS) {
        setTimeout(() => finishDetection(), 500); // Pequeno delay para mostrar o último tap
    }
}

function updateProgress() {
    const progress = (tapCount / DETECTION_CONFIG.TOTAL_TAPS) * 100;
    progressFill.style.width = `${progress}%`;
}

function finishDetection() {
    stopDetection();

    if (tapTimes.length < DETECTION_CONFIG.TOTAL_TAPS || crossingTimes.length === 0) {
        detectStatus.textContent = 'Detecção incompleta. Tente novamente.';
        resetDetection();
        return;
    }

    // Calcular delays para cada tap
    const delays = [];
    
    for (let i = 0; i < tapTimes.length; i++) {
        const tapTime = tapTimes[i];
        
        // Encontrar o cruzamento mais próximo antes deste tap
        let closestCrossing = null;
        let minTimeDiff = Infinity;
        
        for (let j = 0; j < crossingTimes.length; j++) {
            const crossingTime = crossingTimes[j];
            const timeDiff = tapTime - crossingTime;
            
            // Considera cruzamentos que aconteceram próximos ao tap (antes ou depois)
            // e dentro de uma janela razoável (até 2 segundos antes ou depois)
            if (Math.abs(timeDiff) <= 2000 && Math.abs(timeDiff) < minTimeDiff) {
                minTimeDiff = Math.abs(timeDiff);
                closestCrossing = crossingTime;
            }
        }
        
        if (closestCrossing !== null) {
            const delay = tapTime - closestCrossing;
            
            // Filtrar apenas delays extremos demais (provavelmente erros)
            // Aceita delays entre -1000ms (muito antecipado) e +1000ms (muito atrasado)
            if (delay >= -1000 && delay <= 1000) {
                delays.push(delay);
            }
        }
    }

    if (delays.length === 0) {
        detectStatus.textContent = 'Nenhum timing válido detectado. Tente pressionar mais próximo da linha.';
        resetDetection();
        return;
    }

    // Calcular delay médio
    const averageDelay = Math.round(delays.reduce((sum, delay) => sum + delay, 0) / delays.length);

    // Aplicar o delay calculado
    audioDelayInput.value = averageDelay;
    gameSettings.audioDelay = averageDelay;

    const quality = delays.length >= DETECTION_CONFIG.TOTAL_TAPS * 0.8 ? 'excelente' : 
                   delays.length >= DETECTION_CONFIG.TOTAL_TAPS * 0.6 ? 'boa' : 'razoável';

    detectStatus.textContent = `Delay detectado: ${averageDelay}ms (${delays.length}/${tapTimes.length} taps válidos - qualidade ${quality})`;

    // Mostrar botão para detectar novamente
    startDetectionBtn.style.display = 'inline-block';
    startDetectionBtn.textContent = 'Detectar Novamente';

    // Auto-fechar após alguns segundos
    setTimeout(() => {
        if (autoDetectModal.style.display === 'flex') {
            closeAutoDetect();
        }
    }, 4000);
}

function stopDetection() {
    isDetecting = false;

    if (detectionAnimationId) {
        cancelAnimationFrame(detectionAnimationId);
        detectionAnimationId = null;
    }
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

// --- Nova implementação PIXI para Touch Areas (substituindo DOM) ---
function createPixiTouchAreas() {
    if (!detectMobile()) {
        return; // Só cria em dispositivos móveis
    }
    
    // Limpa touch areas anteriores se existirem
    pixiTouchAreas.forEach(area => {
        if (area.parent) {
            area.parent.removeChild(area);
        }
    });
    pixiTouchAreas = [];
    
    const touchAreaHeight = GAME_HEIGHT * 0.35;
    const touchAreaY = GAME_HEIGHT - touchAreaHeight;
    
    for (let i = 0; i < NUM_LANES; i++) {
        // OTIMIZAÇÃO: Criar dois gráficos pré-computados (normal e pressionado)
        const touchAreaNormal = new PIXI.Graphics();
        const touchAreaPressed = new PIXI.Graphics();
        
        const laneX = LANE_START_X + (i * LANE_WIDTH);
        
        // Estado normal
        touchAreaNormal.beginFill(LANE_COLORS[i], 0.08);
        touchAreaNormal.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
        touchAreaNormal.lineStyle(1, LANE_COLORS[i], 0.2);
        touchAreaNormal.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
        touchAreaNormal.endFill();
        
        // Estado pressionado
        touchAreaPressed.beginFill(LANE_COLORS[i], 0.3);
        touchAreaPressed.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
        touchAreaPressed.lineStyle(2, LANE_COLORS[i], 0.6);
        touchAreaPressed.drawRect(laneX, touchAreaY, LANE_WIDTH, touchAreaHeight);
        touchAreaPressed.endFill();
        touchAreaPressed.visible = false; // Inicialmente oculto
        
        // Container para ambos os estados
        const touchArea = new PIXI.Container();
        touchArea.addChild(touchAreaNormal);
        touchArea.addChild(touchAreaPressed);
        
        // Torna interativo
        touchArea.interactive = true;
        touchArea.buttonMode = true;
        
        // Propriedades customizadas
        touchArea.laneIndex = i;
        touchArea.isPressed = false;
        touchArea.normalState = touchAreaNormal;
        touchArea.pressedState = touchAreaPressed;
        
        // Event listeners PIXI (muito mais performáticos que DOM)
        touchArea.on('pointerdown', onTouchAreaStart);
        touchArea.on('pointerup', onTouchAreaEnd);
        touchArea.on('pointerupoutside', onTouchAreaEnd);
        touchArea.on('pointercancel', onTouchAreaEnd);
        
        // Adiciona ao container e array
        touchContainer.addChild(touchArea);
        pixiTouchAreas.push(touchArea);
    }
}

function onTouchAreaStart(event) {
    if (gameState !== 'playing') return;
    
    const touchArea = event.currentTarget;
    const laneIndex = touchArea.laneIndex;
    
    // Adiciona à lista de toques ativos
    touchStates.add(laneIndex);
    touchArea.isPressed = true;
    
    // OTIMIZAÇÃO: Troca de visibilidade instantânea em vez de redesenhar
    touchArea.normalState.visible = false;
    touchArea.pressedState.visible = true;
    
    // Processa o input da lane
    triggerLaneInput(laneIndex);
}

function onTouchAreaEnd(event) {
    const touchArea = event.currentTarget;
    const laneIndex = touchArea.laneIndex;
    
    // Remove da lista de toques ativos
    touchStates.delete(laneIndex);
    touchArea.isPressed = false;
    
    // OTIMIZAÇÃO: Restaura visibilidade normal instantaneamente
    touchArea.normalState.visible = true;
    touchArea.pressedState.visible = false;
}

// Função para mostrar/ocultar touch areas
function setTouchAreasVisibility(visible) {
    pixiTouchAreas.forEach(area => {
        area.visible = visible;
    });
}

function initMobileControls() {
    isMobile = detectMobile();

    if (isMobile) {
        // Touch areas são criados automaticamente no setupPixi()
        // Não há mais controles DOM para configurar
        console.log('Mobile controls initialized - using PixiJS touch areas');
        
        // Configura event listeners globais para prevenir scroll
        setupGlobalTouchPrevention();
    } else {
        // Em desktop não há touch controls
        console.log('Desktop mode - no touch controls needed');
    }
}

function syncTouchLanesPosition() {
    // Esta função não é mais necessária, as touch areas são do PixiJS
    return;
}

function setupGlobalTouchPrevention() {
    // Previne scroll e zoom em dispositivos móveis durante o jogo
    // Removido: prevenção global de touchstart/touchmove
    // Se necessário, adicione preventDefault apenas nos elementos do jogo, não globalmente
}

function setupTouchEventListeners() {
    return;
}

function handleTouchStart(laneIndex) {
    return;
}

function handleTouchEnd(laneIndex) {
    return;
}

function checkNoteHit(laneIndex) {
    const transportOffset = window.__audioTransportOffset || 0;
    const elapsedTime = (Tone.Transport.seconds * 1000) - gameSettings.audioDelay + transportOffset;
    let noteToHit = null;
    let closestTimeDiff = Infinity;

    // OTIMIZAÇÃO: Apenas verifica notas da lane específica em vez de todas as notas
    const laneNotes = notesByLane[laneIndex];
    
    for (let i = 0; i < laneNotes.length; i++) {
        const note = laneNotes[i];
        if (!note.hit) {
            const timeDiff = Math.abs(note.time - elapsedTime);
            if (timeDiff < HIT_WINDOWS.FAIR && timeDiff < closestTimeDiff) {
                noteToHit = note;
                closestTimeDiff = timeDiff;
                break; // OTIMIZAÇÃO: Para no primeiro hit válido (notas são ordenadas por tempo)
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
    loadSettings();
    loadHighScores();
    populateSongList();
    setupEventListeners();
    setupWelcomeEventListeners();
    initMobileControls();
    // setupTouchControls removido - não é mais necessário

    // Mostra o estado de boas-vindas primeiro
    showWelcomeState();

    // Define o texto de instrução baseado no dispositivo
    const currentDimensions = getResponsiveDimensions();
    if (currentDimensions.isMobile) {
        keyMappingText.textContent = 'Toque nas áreas coloridas na parte inferior da tela';
    } else {
        keyMappingText.textContent = `Teclas: ${KEY_MAPPINGS.join(', ').toUpperCase()}`;
    }
};

function setupEventListeners() {
    // Botões da tela de preparação
    startButton.onclick = startCountdown;

    // Botões do modal de pausa - suporte para touch e click
    const resumeBtn = document.getElementById('resume-btn');
    const restartBtn = document.getElementById('restart-btn');
    const exitBtn = document.getElementById('exit-btn');
    
    resumeBtn.onclick = resumeGame;
    resumeBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        resumeGame();
    });
    
    restartBtn.onclick = restartGame;
    restartBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        restartGame();
    });
    
    exitBtn.onclick = exitToMenu;
    exitBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        exitToMenu();
    });

    // Botão pause - suporte para touch e click
    pauseBtn.onclick = pauseGame;
    pauseBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); // Previne o evento click duplo
        pauseGame();
    });

    // Botões de configurações
    settingsBtn.onclick = openSettings;
    saveSettingsBtn.onclick = saveSettings;
    cancelSettingsBtn.onclick = closeSettings;
    backToMenuBtn.onclick = closeSettings;
    
    // Event listeners do modal de resultados
    restartSongBtn.onclick = restartCurrentSong;
    backToMenuFromResultsBtn.onclick = returnToMainMenu;

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
    // Usar a nova função de redimensionamento responsivo
    resizeGame();
}

// Adicionar listener para orientationchange em dispositivos móveis
window.addEventListener('orientationchange', () => {
    // Pequeno delay para garantir que as dimensões da tela foram atualizadas
    setTimeout(resizeGame, 100);
});

// --- Funções de Preview de Áudio ---
async function initializeAudioContext() {
    if (!audioContextInitialized) {
        try {
            // Inicializa o contexto de áudio do Tone.js se necessário
            if (Tone.context.state !== 'running') {
                await Tone.start();
            }
            audioContextInitialized = true;
        } catch (e) {
            // Error handled silently
        }
    }
}

function startPreview(song) {
    if (currentPreviewSong === song && previewAudio && !previewAudio.paused) {
        return;
    }
    
    forceStopPreview();
    
    currentPreviewSong = song;
    
    // Inicia imediatamente sem timeout para melhor responsividade
    playPreview(song);
}

async function playPreview(song) {
    
    // Inicializa contexto de áudio primeiro
    await initializeAudioContext();
    
    // Marca como carregando para evitar múltiplas tentativas
    isPreviewLoading = true;
    
    try {
        const audioPath = `songs/${song.filename}`;
        
        // Testa se o arquivo existe primeiro
        try {
            const response = await fetch(audioPath, { method: 'HEAD' });
            if (!response.ok) {
                throw new Error(`Arquivo não encontrado: ${response.status}`);
            }
        } catch (e) {
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
            if (currentPreviewSong === song && previewAudio && shouldPlay) {
                try {
                    previewAudio.currentTime = 30;
                } catch (e) {
                    // Error handled silently
                }
            }
        });
        
        previewAudio.addEventListener('canplaythrough', () => {
            // Só toca se ainda é a música correta, deve tocar e não está pausado
            if (currentPreviewSong === song && previewAudio && shouldPlay && previewAudio.readyState >= 4) {
                previewAudio.play().then(() => {
                    // Só adiciona efeitos visuais se ainda é a música correta
                    if (currentPreviewSong === song && previewAudio && shouldPlay) {
                        const songItem = findSongItemByTitle(song.title);
                        if (songItem) {
                            songItem.classList.add('playing');
                        }
                        // Inicia fade in
                        startFadeIn();
                    }
                }).catch(e => {
                    // Só loga erro se não foi cancelado intencionalmente
                    if (shouldPlay && currentPreviewSong === song) {
                        // Error handled silently
                    }
                    cleanupPreview();
                });
            }
            isPreviewLoading = false;
        });
        
        previewAudio.addEventListener('error', (e) => {
            cleanupPreview();
        });
        
        // Adiciona função para cancelar o play se necessário
        previewAudio.cancelPlay = () => {
            shouldPlay = false;
        };
        
        // Força o carregamento
        previewAudio.load();
        
    } catch (e) {
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
    document.querySelectorAll('.song-item.playing').forEach(item => {
        item.classList.remove('playing');
    });
    
    if (previewTimeout) {
        clearTimeout(previewTimeout);
        previewTimeout = null;
    }
    
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    
    if (previewAudio) {
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
}

function stopPreview() {
    document.querySelectorAll('.song-item.playing').forEach(item => {
        item.classList.remove('playing');
    });
    
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
        songItem.className = 'song-item compact';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'song-title';
        titleDiv.textContent = song.title;

        const artistDiv = document.createElement('div');
        artistDiv.className = 'song-artist';
        artistDiv.textContent = song.artist;

        // Container para highscore
        const highScoreDiv = document.createElement('div');
        highScoreDiv.className = 'song-highscore';
        
        // Encontra o melhor highscore entre todas as dificuldades
        let bestScore = null;
        song.difficulties.forEach(difficulty => {
            const highScore = getHighScore(song, difficulty);
            if (highScore && (!bestScore || highScore.score > bestScore.score)) {
                bestScore = highScore;
            }
        });
        
        if (bestScore) {
            highScoreDiv.innerHTML = `
                <div class="highscore-label">Melhor Score:</div>
                <div class="highscore-value">${bestScore.score.toLocaleString()}</div>
                <div class="highscore-accuracy">${bestScore.accuracy}%</div>
            `;
        } else {
            highScoreDiv.innerHTML = `
                <div class="highscore-label">Sem records ainda</div>
            `;
        }

        const difficultiesDiv = document.createElement('div');
        difficultiesDiv.className = 'difficulties';

        song.difficulties.forEach(difficulty => {
            const diffBtn = document.createElement('button');
            diffBtn.className = `difficulty-btn difficulty-${difficulty.level}`;
            
            // Mostra o highscore específico da dificuldade no botão
            const diffHighScore = getHighScore(song, difficulty);
            if (diffHighScore) {
                diffBtn.innerHTML = `
                    <div class="difficulty-name">${difficulty.name}</div>
                    <div class="difficulty-score">${diffHighScore.score.toLocaleString()}</div>
                `;
            } else {
                diffBtn.textContent = difficulty.name;
            }

            if (difficulty.chartFile) {
                diffBtn.onclick = (e) => {
                    e.stopPropagation();
                    selectSongAndDifficulty(song, difficulty);
                };
            } else {
                diffBtn.style.opacity = '0.5';
                diffBtn.style.cursor = 'not-allowed';
                diffBtn.title = 'Em breve';
            }

            difficultiesDiv.appendChild(diffBtn);
        });

        // Event listeners para preview de áudio e expansão do card
        let mouseEnterTimeout = null;
        
        // Função para expandir o card
        const expandCard = async () => {
            // Para qualquer preview que esteja tocando
            forceStopPreview();
            
            // Contrai todos os outros cards primeiro
            document.querySelectorAll('.song-item.expanded').forEach(item => {
                if (item !== songItem) {
                    item.classList.remove('expanded');
                    item.classList.add('compact');
                }
            });
            
            // Expande este card
            songItem.classList.remove('compact');
            songItem.classList.add('expanded');
            
            // Inicializa AudioContext na primeira interação
            await initializeAudioContext();
            
            // Inicia preview
            startPreview(song);
        };
        
        // Função para contrair o card
        const contractCard = () => {
            songItem.classList.remove('expanded');
            songItem.classList.add('compact');
            forceStopPreview();
        };
        
        // Função para verificar se este card está expandido
        const isThisCardExpanded = () => {
            return songItem.classList.contains('expanded');
        };
        
        // Click/touch para expandir/contrair
        songItem.addEventListener('click', async (e) => {
            // Se clicou em um botão de dificuldade, não expande
            if (e.target.classList.contains('difficulty-btn')) {
                return;
            }
            
            if (isThisCardExpanded()) {
                contractCard();
            } else {
                await expandCard();
            }
        });
        
        // Para desktop - hover sutil sem expandir
        songItem.addEventListener('mouseenter', () => {
            if (!isThisCardExpanded()) {
                // Só um efeito visual leve no hover se não estiver expandido
                songItem.style.transform = 'translateY(-2px)';
            }
        });
        
        songItem.addEventListener('mouseleave', () => {
            if (!isThisCardExpanded()) {
                songItem.style.transform = '';
            }
        });

        songItem.appendChild(titleDiv);
        songItem.appendChild(artistDiv);
        songItem.appendChild(highScoreDiv);
        songItem.appendChild(difficultiesDiv);
        songList.appendChild(songItem);
    });
}

async function selectSongAndDifficulty(song, difficulty) {
    if (!difficulty.chartFile) {
        alert('Esta dificuldade ainda não está disponível!');
        return;
    }

    contractAllSongCards(); // Contrai cards ao selecionar música

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
    maxCombo = 0;
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
    
    // setupTouchControls removido - touch areas são do PixiJS
}

function setupPixi() {
    pixiApp = new PIXI.Application({
        width: GAME_WIDTH, height: GAME_HEIGHT,
        view: document.getElementById('game-canvas'),
        backgroundColor: 0x0c0c0f, antialias: true,
    });

    // Habilitar interações para touch areas
    pixiApp.stage.interactive = true;

    // Organização de camadas (de trás para frente)
    backgroundContainer = new PIXI.Container();
    visualizerContainer = new PIXI.Container();
    targetContainer = new PIXI.Container();
    noteContainer = new PIXI.Container();
    particleContainer = new PIXI.Container();
    feedbackContainer = new PIXI.Container();
    
    // Container para touch areas móveis (no topo para capturar eventos primeiro)
    touchContainer = new PIXI.Container();
    
    pixiApp.stage.addChild(backgroundContainer, visualizerContainer, targetContainer, noteContainer, particleContainer, feedbackContainer, touchContainer);

    createStarfield();
    createGlowBorder();
    createMusicVisualizer();
    drawLanes();
    drawTargets();
    
    // Inicializar pool de partículas para melhor performance
    initParticlePool();
    
    // OTIMIZAÇÃO: Inicializar pool de textos de feedback
    initFeedbackTextPool();
    
    // Criar touch areas PIXI para dispositivos móveis
    createPixiTouchAreas();
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

    // Atualiza as configurações de velocidade das notas antes de iniciar
    updateNoteSpeedSettings();

    // Reset das variáveis de estado do jogo
    score = 0;
    combo = 0;
    maxCombo = 0;
    totalNotes = 0;
    hitNotes = 0;
    gameFinished = false;
    allNotesSpawned = false;
    musicFinished = false;
    
    // Atualiza UI
    scoreText.textContent = '0';
    comboText.textContent = '0';
    accuracyText.textContent = '100%';
    accuracyText.style.color = '#00FFFF';

    gameState = 'playing';
    pauseBtn.style.display = 'block'; // Mostra o botão de pause
    
    // Mostra touch areas PIXI para dispositivos móveis
    if (isMobile) {
        setTouchAreasVisibility(true);
    }
    
    await Tone.start();

    // Configura o BPM do Transport
    Tone.Transport.bpm.value = chartData.metadata.bpm;

    currentPlayer = new Tone.Player(chartData.song.url).toDestination();
    await Tone.loaded();
    
    // Obtém a duração da música
    musicDuration = currentPlayer.buffer.duration;

    // Configura o analisador de áudio para o visualizador
    setupAudioAnalyser();

    // Aplica o delay de áudio configurado
    const audioDelay = gameSettings.audioDelay / 1000; // Converte ms para segundos

    // Inicia o Transport e o player com delay
    let transportOffset = 0;
    Tone.Transport.start();
    if (audioDelay !== 0) {
        if (audioDelay > 0) {
            // Delay positivo: atrasa o áudio (áudio começa depois)
            currentPlayer.start(audioDelay);
        } else {
            // Delay negativo: adianta o áudio (áudio começa antes, então precisa pular parte inicial)
            currentPlayer.start(0, Math.abs(audioDelay));
            // Compensa o transporte para alinhar notas e áudio
            transportOffset = Math.abs(gameSettings.audioDelay);
        }
        gameStartTime = performance.now();






    } else {
        currentPlayer.start();
        gameStartTime = performance.now();
    }
    // Salva offset global para uso nos cálculos de tempo
    window.__audioTransportOffset = transportOffset;

    chartData.notes.forEach(createNote);
    allNotesSpawned = true; // Marca que todas as notas foram criadas
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
    
    // Oculta touch areas PIXI
    setTouchAreasVisibility(false);

    // Clear game objects
    if (notesOnScreen.length > 0) {
        notesOnScreen.forEach(note => note.destroy());
        notesOnScreen = [];
    }
    
    // OTIMIZAÇÃO: Limpar índices de notas por lane
    for (let i = 0; i < NUM_LANES; i++) {
        notesByLane[i] = [];
    }
    
    if (activeParticles.length > 0) {
        // Retorna todas as partículas ativas ao pool
        activeParticles.forEach(particle => returnParticleToPool(particle));
    }
    
    // OTIMIZAÇÃO: Retornar textos de feedback ao pool
    if (activeFeedbackTexts.length > 0) {
        activeFeedbackTexts.forEach(text => returnFeedbackTextToPool(text));
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
    visualizerBars.forEach((bar, index) => {
        bar.currentHeight = VISUALIZER_MIN_HEIGHT;
        bar.clear();
        bar.beginFill(0x00FFFF, 0.05); // Muito translúcido quando resetado
        bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, VISUALIZER_MIN_HEIGHT);
        bar.endFill();
        bar.x = LANE_START_X + (index * LANE_WIDTH); // Reposicionar com padding
        bar.y = GAME_HEIGHT - VISUALIZER_MIN_HEIGHT;
    });
}

function finishGame() {
    if (gameFinished) return;
    gameFinished = true;
    
    gameState = 'finished';
    
    // Para o áudio
    if (currentPlayer) {
        currentPlayer.stop();
        currentPlayer = null;
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Calcula estatísticas finais
    const finalAccuracy = totalNotes > 0 ? Math.round((hitNotes / totalNotes) * 100) : 100;
    
    const gameResults = {
        score: score,
        accuracy: finalAccuracy,
        combo: maxCombo,
        totalNotes: totalNotes,
        hitNotes: hitNotes
    };
    
    // Verifica se é um novo highscore
    const isNewRecord = updateHighScore(currentSong, currentDifficulty, gameResults);
    
    // Mostra o modal de resultados
    showResultsModal(gameResults, isNewRecord);
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
    // Reduzido de 200 para 120 estrelas para melhor performance
    for (let i = 0; i < 120; i++) {
        const star = new PIXI.Graphics();
        star.beginFill(0xFFFFFF, Math.random() * 0.6 + 0.2); // Alpha um pouco menor
        star.drawCircle(0, 0, Math.random() * 1.2 + 0.4); // Tamanho um pouco menor
        star.endFill();
        star.x = LANE_START_X + (Math.random() * LANE_AREA_WIDTH);
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
        // Usar menos segmentos para melhor performance - pular pontos intermediários
        const skipFactor = Math.max(1, Math.floor(star.trail.length / 6)); // Máximo 6 segmentos
        
        for (let i = skipFactor; i < star.trail.length; i += skipFactor) {
            const prevIndex = Math.max(0, i - skipFactor);
            const prevPoint = star.trail[prevIndex];
            const currentPoint = star.trail[i];
            
            // Calcular alpha baseado na posição no rastro (mais antigo = mais transparente)
            const progress = i / star.trail.length;
            const alphaFactor = Math.pow(1 - progress, 1.5); // Gradiente mais suave
            const alpha = star.baseAlpha * alphaFactor * TRAIL_ALPHA_DECAY;
            
            // Calcular espessura baseada na posição (mais grosso no início)
            const thickness = 2.5 * (1 - progress * 0.7);
            
            if (alpha > 0.05) { // Aumentado threshold para menos desenhos
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

        // Posiciona a barra alinhada com a lane correspondente (com padding)
        bar.x = LANE_START_X + (i * LANE_WIDTH);
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
    // Só atualiza o visualizador a cada N frames para melhor performance
    if (frameCounter % VISUAL_EFFECTS_UPDATE_RATE !== 0) {
        return;
    }
    
    if (!analyser || !dataArray || gameState !== 'playing') {
        // Se não há análise de áudio, mostra barras estáticas mínimas
        visualizerBars.forEach((bar, i) => {
            // Suaviza para a altura mínima
            bar.currentHeight += (VISUALIZER_MIN_HEIGHT - bar.currentHeight) * VISUALIZER_SMOOTHING;

            // Só redesenha se mudou significativamente
            if (Math.abs(bar.currentHeight - bar.lastDrawnHeight) > 2) {
                bar.clear();
                bar.beginFill(LANE_COLORS[i], VISUALIZER_ALPHA_STOPPED);
                bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, bar.currentHeight);
                bar.endFill();
                bar.y = GAME_HEIGHT - bar.currentHeight;
                bar.lastDrawnHeight = bar.currentHeight;
            }
        });
        return;
    }

    // Obtém os dados de frequência
    analyser.getByteFrequencyData(dataArray);

    // Cache para evitar recálculos
    const bufferLengthFloat = bufferLength;
    const frequencyRanges = [
        { start: Math.floor(0 * bufferLengthFloat), end: Math.floor(0.2 * bufferLengthFloat) },
        { start: Math.floor(0.15 * bufferLengthFloat), end: Math.floor(0.35 * bufferLengthFloat) },
        { start: Math.floor(0.3 * bufferLengthFloat), end: Math.floor(0.45 * bufferLengthFloat) },
        { start: Math.floor(0.4 * bufferLengthFloat), end: Math.floor(0.6 * bufferLengthFloat) },
        { start: Math.floor(0.55 * bufferLengthFloat), end: Math.floor(0.7 * bufferLengthFloat) }
    ];

    // Atualiza cada barra do visualizador
    for (let i = 0; i < visualizerBars.length; i++) {
        const bar = visualizerBars[i];
        const range = frequencyRanges[i];
        
        // Calcula a média das frequências na faixa (otimizado)
        let sum = 0;
        const count = range.end - range.start;
        for (let j = range.start; j < range.end; j++) {
            sum += dataArray[j] || 0;
        }
        
        let frequency = count > 0 ? sum / count : 0;
        
        // Aplica amplificação específica por faixa
        if (i >= 3) {
            frequency = Math.min(255, frequency * 1.5);
        }

        // Amplifica a resposta da frequência para mais reatividade
        const amplifiedFrequency = Math.pow(frequency / 255, 0.4) * 255;

        // Calcula a altura target
        const targetHeight = VISUALIZER_MIN_HEIGHT +
            (amplifiedFrequency / 255) * (VISUALIZER_MAX_HEIGHT - VISUALIZER_MIN_HEIGHT);

        // Suaviza a transição para a altura target
        if (!bar.currentHeight) bar.currentHeight = VISUALIZER_MIN_HEIGHT;
        bar.currentHeight += (targetHeight - bar.currentHeight) * VISUALIZER_SMOOTHING;

        // Só redesenha se mudou significativamente (threshold aumentado)
        if (!bar.lastDrawnHeight || Math.abs(bar.currentHeight - bar.lastDrawnHeight) > 3) {
            // Calcula o alpha baseado na intensidade
            const intensityFactor = Math.min(1, amplifiedFrequency / 128);
            const alpha = VISUALIZER_ALPHA_MIN + (VISUALIZER_ALPHA_MAX - VISUALIZER_ALPHA_MIN) * intensityFactor;

            bar.clear();
            bar.beginFill(LANE_COLORS[i], alpha);
            bar.drawRect(0, 0, VISUALIZER_BAR_WIDTH, bar.currentHeight);
            bar.endFill();
            bar.y = GAME_HEIGHT - bar.currentHeight;
            bar.lastDrawnHeight = bar.currentHeight;
        }
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
        laneOverlay.drawRect(LANE_START_X + (i * LANE_WIDTH), 0, LANE_WIDTH, GAME_HEIGHT);
        laneOverlay.endFill();
        laneOverlay.isLaneOverlay = true; // Marcador para identificação
        backgroundContainer.addChild(laneOverlay);
    }

    // Desenha as linhas separadoras das lanes
    const graphics = new PIXI.Graphics();
    for (let i = 1; i < NUM_LANES; i++) {
        graphics.lineStyle(2, 0x444444, 0.5);
        graphics.moveTo(LANE_START_X + (i * LANE_WIDTH), 0);
        graphics.lineTo(LANE_START_X + (i * LANE_WIDTH), GAME_HEIGHT);
    }
    graphics.isLaneSeparator = true; // Marcador para identificação
    backgroundContainer.addChild(graphics);
}

function drawTargets() {
    const targetY = GAME_HEIGHT - TARGET_OFFSET_Y;
    mainTargetLine = new PIXI.Graphics();
    mainTargetLine.lineStyle(4, 0xFFFFFF, 1);
    mainTargetLine.moveTo(LANE_START_X, targetY);
    mainTargetLine.lineTo(LANE_START_X + LANE_AREA_WIDTH, targetY);
    targetContainer.addChild(mainTargetLine);

    for (let i = 0; i < NUM_LANES; i++) {
        const target = new PIXI.Graphics();
        
        // Usar tamanho original dos círculos (sem redução para landscape)
        const targetRadius = LANE_WIDTH / 2 - 5;
        
        target.beginFill(LANE_COLORS[i], 0.2);
        target.lineStyle(2, LANE_COLORS[i], 0.7);
        target.drawCircle(LANE_START_X + (i * LANE_WIDTH) + (LANE_WIDTH / 2), targetY, targetRadius);
        target.endFill();
        target.alpha = 0.5;
        
        // Propriedades para efeitos visuais
        target.laneIndex = i;
        target.isPressed = false;
        target.baseAlpha = 0.5;
        target.pressedAlpha = 0.9;
        target.radius = targetRadius; // Armazenar raio para uso posterior
        target.glowContainer = new PIXI.Graphics(); // Container para o efeito glow
        
        targets.push(target);
        targetContainer.addChild(target.glowContainer); // Adicionar glow primeiro (atrás do target)
        targetContainer.addChild(target);
    }
}

function updateTargetVisuals() {
    const targetY = GAME_HEIGHT - TARGET_OFFSET_Y;
    
    targets.forEach(target => {
        const key = KEY_MAPPINGS[target.laneIndex];
        const isCurrentlyPressed = keysPressed.has(key) || touchStates.has(target.laneIndex);
        
        // SEMPRE responde imediatamente a mudanças de input (60fps para responsividade do gameplay)
        if (target.isPressed !== isCurrentlyPressed) {
            // Atualizar estado
            target.isPressed = isCurrentlyPressed;
            
            // Redesenhar o target imediatamente quando há mudança de estado
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
            target.drawCircle(LANE_START_X + (target.laneIndex * LANE_WIDTH) + (LANE_WIDTH / 2), targetY, target.radius || (LANE_WIDTH / 2 - 5));
            target.endFill();
            
            // Atualizar efeito glow imediatamente
            target.glowContainer.clear();
            if (isCurrentlyPressed) {
                // Criar múltiplas camadas de glow (reduzido para melhor performance)
                const centerX = LANE_START_X + (target.laneIndex * LANE_WIDTH) + (LANE_WIDTH / 2);
                const centerY = targetY;
                const baseRadius = target.radius || (LANE_WIDTH / 2 - 5); // Usar raio armazenado
                
                // Reduzido de 4 para 2 camadas de glow
                const glowLayers = [
                    { radius: baseRadius + 15, alpha: 0.15 },
                    { radius: baseRadius + 8, alpha: 0.25 }
                ];
                
                glowLayers.forEach(layer => {
                    target.glowContainer.beginFill(LANE_COLORS[target.laneIndex], layer.alpha);
                    target.glowContainer.drawCircle(centerX, centerY, layer.radius);
                    target.glowContainer.endFill();
                });
            }
        }
    });
}

function createNote(noteData) {
    const note = new PIXI.Graphics();
    const laneX = LANE_START_X + (noteData.lane * LANE_WIDTH);

    note.beginFill(LANE_COLORS[noteData.lane]);
    note.drawRoundedRect(5, 0, LANE_WIDTH - 10, NOTE_HEIGHT, 8);
    note.endFill();

    note.x = laneX;
    note.pivot.y = NOTE_HEIGHT / 2;

    note.lane = noteData.lane;
    note.laneIndex = noteData.lane; // Adicionando laneIndex para compatibilidade
    note.time = noteData.time;
    note.hit = false;
    
    // Propriedades para interpolação suave
    // Calcula a posição inicial baseada no tempo atual
    const transportOffset = window.__audioTransportOffset || 0;
    const currentTime = (Tone.Transport.seconds * 1000) - gameSettings.audioDelay + transportOffset;
    const targetY = GAME_HEIGHT - TARGET_OFFSET_Y;
    const timeDifference = noteData.time - currentTime;
    const initialY = targetY - (timeDifference * NOTE_SPEED);
    
    note.targetY = initialY; // Posição Y calculada baseada no tempo
    note.currentY = initialY; // Posição Y atual (interpolada) - inicia na mesma posição
    note.y = initialY; // Posição visual

    notesOnScreen.push(note);
    // OTIMIZAÇÃO: Adiciona também ao índice por lane para busca O(1)
    notesByLane[noteData.lane].push(note);
    noteContainer.addChild(note);
}

// OTIMIZAÇÃO: Pool de textos de feedback para reuso
let feedbackTextPool = [];
let activeFeedbackTexts = [];

// Função para inicializar o pool de textos de feedback
function initFeedbackTextPool() {
    for (let i = 0; i < PERF_CONFIG.feedbackTextPool; i++) {
        const text = new PIXI.Text('', {
            fontFamily: 'Segoe UI', fontSize: 32, fontWeight: 'bold',
            fill: 0xFFFFFF, stroke: '#000000', strokeThickness: 4
        });
        text.anchor.set(0.5);
        text.visible = false;
        feedbackContainer.addChild(text);
        feedbackTextPool.push(text);
    }
}

function getFeedbackTextFromPool() {
    if (feedbackTextPool.length > 0) {
        return feedbackTextPool.pop();
    }
    return null; // Pool esgotado
}

function returnFeedbackTextToPool(text) {
    const index = activeFeedbackTexts.indexOf(text);
    if (index > -1) {
        activeFeedbackTexts.splice(index, 1);
    }
    
    text.visible = false;
    text.alpha = 1;
    feedbackTextPool.push(text);
}

function createParticles(x, y, color) {
    // OTIMIZAÇÃO: Usa configuração adaptativa para número de partículas
    const particleCount = Math.min(PERF_CONFIG.maxParticlesPerHit, particlePool.length);
    
    // OTIMIZAÇÃO: Verifica limite de partículas ativas para evitar sobrecarga
    if (activeParticles.length >= PERF_CONFIG.maxActiveParticles) {
        return; // Não cria mais partículas se já atingiu o limite
    }
    
    for (let i = 0; i < particleCount; i++) {
        const particle = getParticleFromPool();
        if (!particle) break; // Pool esgotado
        
        // Reusa o gráfico existente apenas mudando a cor
        particle.tint = color;
        particle.x = x;
        particle.y = y;
        particle.vx = (Math.random() - 0.5) * 8;
        particle.vy = (Math.random() - 0.5) * 8 - 3;
        particle.alpha = 1;
        particle.life = Math.random() * 0.4 + 0.2; // Vida um pouco menor
        
        activeParticles.push(particle);
    }
}

function showFeedback(text, lane, color) {
    // Verifica se os indicadores de hit devem ser mostrados
    if (!SHOW_HIT_FEEDBACK) {
        return; // Não mostra feedback se desabilitado
    }
    
    // OTIMIZAÇÃO: Usa pool de textos em vez de criar novos
    const feedbackText = getFeedbackTextFromPool();
    if (!feedbackText) {
        return; // Pool esgotado, pula o feedback para manter performance
    }
    
    // Configura o texto reutilizado
    feedbackText.text = text;
    feedbackText.style.fill = color;
    feedbackText.x = LANE_START_X + (lane * LANE_WIDTH) + (LANE_WIDTH / 2); // Aplicar padding
    feedbackText.y = GAME_HEIGHT - 150;
    feedbackText.initialY = feedbackText.y;
    feedbackText.life = 0.5;
    feedbackText.visible = true;
    feedbackText.alpha = 1;
    
    activeFeedbackTexts.push(feedbackText);
}

function gameLoop(delta) {
    if (gameState !== 'playing') return;

    // Incrementar contador de frames para controle de taxa de atualização
    frameCounter++;

    const deltaSeconds = delta / PIXI.settings.TARGET_FPMS / 1000;
    // Aplica o delay de áudio no cálculo do tempo das notas (subtrai para corrigir)
    const transportOffset = window.__audioTransportOffset || 0;
    const elapsedTime = (Tone.Transport.seconds * 1000) - gameSettings.audioDelay + transportOffset;
    const targetY = GAME_HEIGHT - TARGET_OFFSET_Y;

    // Atualiza o visualizador de música (controlado por taxa de frames)
    updateMusicVisualizer();
    
    // Atualiza efeitos visuais das zonas alvo (controlado por taxa de frames)
    updateTargetVisuals();

    // Animação de fundo - estrelas (acelera com teclas OU toques apenas se habilitado)
    const targetSpeedMultiplier = ENABLE_STAR_ACCELERATION && (keysPressed.size > 0 || touchStates.size > 0) ? 5.0 : 1.0;
    starSpeedMultiplier += (targetSpeedMultiplier - starSpeedMultiplier) * STAR_SPEED_TRANSITION_RATE;

    // Loop das estrelas otimizado
    for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.y += star.speed * starSpeedMultiplier;
        
        // Atualizar rastro da estrela (controlado por taxa de frames)
        updateStarTrail(star);
        
        if (star.y > GAME_HEIGHT) {
            star.y = 0;
            star.x = LANE_START_X + (Math.random() * LANE_AREA_WIDTH);
            // Reinicializar o rastro quando a estrela reaparece no topo
            star.trail = [];
            for (let j = 0; j < TRAIL_LENGTH; j++) {
                star.trail.push({ x: star.x, y: star.y });
            }
        }
    }

    // Loop das notas - Atualiza posição Y com interpolação suave
    for (let i = notesOnScreen.length - 1; i >= 0; i--) {
        const note = notesOnScreen[i];
        if (note.hit) continue;

        // Calcula diferença de tempo: quanto tempo falta para a nota chegar ao alvo
        const timeDifference = note.time - elapsedTime;
        
        // Calcula a posição target baseada no tempo
        note.targetY = targetY - (timeDifference * NOTE_SPEED);
        
        // Interpola suavemente entre a posição atual e a target
        // Usa uma interpolação exponencial para convergência suave
        const lerpFactor = Math.min(1.0, NOTE_INTERPOLATION_SPEED * deltaSeconds);
        note.currentY += (note.targetY - note.currentY) * lerpFactor;
        
        // Define a posição visual da nota
        note.y = note.currentY;

        if (note.y > GAME_HEIGHT) {
            handleMiss(note);
        }
    }

    // Loop das partículas otimizado com pool
    for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;
        p.alpha -= 0.05; // Fade mais rápido
        p.life -= deltaSeconds;
        
        if (p.life <= 0 || p.alpha <= 0) {
            returnParticleToPool(p);
        }
    }

    // Loop do texto de feedback otimizado com pool
    for (let i = activeFeedbackTexts.length - 1; i >= 0; i--) {
        const text = activeFeedbackTexts[i];
        text.y -= 1;
        text.alpha -= 0.04; // Fade mais rápido
        text.life -= deltaSeconds;
        if (text.life <= 0) {
            returnFeedbackTextToPool(text);
        }
    }
    
    // Verifica se a música terminou baseado na duração
    if (!musicFinished && Tone.Transport.seconds >= musicDuration) {
        musicFinished = true;
    }
    
    // Verifica se o jogo terminou
    if (!gameFinished && allNotesSpawned && notesOnScreen.length === 0 && musicFinished) {
        finishGame();
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

    // OTIMIZAÇÃO: Efeitos visuais críticos executam imediatamente
    showFeedback(feedback, note.lane, feedbackColor);
    
    // OTIMIZAÇÃO: Efeitos não-críticos executam no próximo frame
    requestAnimationFrame(() => {
        const targetY = GAME_HEIGHT - TARGET_OFFSET_Y;
        createParticles(LANE_START_X + (note.lane * LANE_WIDTH) + (LANE_WIDTH / 2), targetY, LANE_COLORS[note.lane]);
    });

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
    // Remove da lista geral
    const index = notesOnScreen.indexOf(note);
    if (index > -1) notesOnScreen.splice(index, 1);
    
    // OTIMIZAÇÃO: Remove também do índice por lane
    const laneIndex = notesByLane[note.lane].indexOf(note);
    if (laneIndex > -1) notesByLane[note.lane].splice(laneIndex, 1);
    
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
    
    // Atualiza o combo máximo
    if (combo > maxCombo) {
        maxCombo = combo;
    }
    
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