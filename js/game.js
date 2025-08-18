/**
 * メインゲームクラス
 * ゲームループ、レベル生成、UI更新、エラーハンドリングを管理
 */

class Game {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.inputManager = null;
        this.soundManager = null;
        
        // ゲーム状態
        this.isRunning = false;
        this.isPaused = false;
        this.gameOver = false;
        
        // ステージ管理
        this.currentStage = 1;
        this.maxStages = 10;
        this.cameraX = 0;
        this.cameraY = 0;
        this.scrollThreshold = 400; // スクロール開始位置
        
        // ゲームオブジェクト
        this.player = null;
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.powerUps = [];  // パワーアップアイテム
        this.background = null;
        
        // タイミング
        this.lastTime = 0;
        this.deltaTime = 0;
        this.frameCount = 0;
        this.fps = 0;

        // ステージクリア演出
        this.stageClear = {
            active: false,
            timer: 0,
            duration: 2000,
            particles: []
        };

        // 被ダメージ演出・画面効果
        this.effects = {
            damageFlashAlpha: 0,
            damageFlashFadeSpeed: 0.06,
            screenShake: { timeLeft: 0, duration: 0, power: 0 },
            floatingTexts: [] // { x, y, vy, timeLeft, duration, text, color, size }
        };

        // ヒットストップ（フレーム凍結）
        this.hitstop = 0;

        // ステージ環境（風・重力・摩擦・テーマ）
        this.environment = {
            windX: 0,           // +右/−左（60FPS基準のフレーム当たり加算）
            gravityScale: 1.0,  // 重力倍率
            frictionScale: 1.0, // 地面摩擦倍率
            theme: 'day'        // 背景テーマ
        };
        
        // ベストスコア
        this.bestScore = Number(localStorage.getItem('bestScore') || 0);
        
        // UI要素
        this.scoreElement = null;
        this.livesElement = null;
        this.gameOverElement = null;
        this.finalScoreElement = null;
        
        // エラーハンドリング
        this.errorHandler = this.handleError.bind(this);
    }

    /**
     * ゲームの初期化
     */
    init() {
        try {
            this.setupCanvas();
            this.setupUI();
            this.setupEventListeners();
            this.createGameObjects();
            this.start();
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * Canvasの設定
     */
    setupCanvas() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            throw new Error('Canvas element not found');
        }

        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            throw new Error('2D context not available');
        }

        // Canvasの内部解像度のみ固定（表示サイズはCSSでスケール）
        this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
        this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;

        // アンチエイリアシングを有効化
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    /**
     * UI要素の設定
     */
    setupUI() {
        this.scoreElement = document.getElementById('score');
        this.livesElement = document.getElementById('lives');
        this.gameOverElement = document.getElementById('gameOver');
        this.finalScoreElement = document.getElementById('finalScore');

        if (!this.scoreElement || !this.livesElement || !this.gameOverElement || !this.finalScoreElement) {
            throw new Error('UI elements not found');
        }
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // エラーハンドリング
        window.addEventListener('error', this.errorHandler);
        window.addEventListener('unhandledrejection', this.errorHandler);

        // キーボードイベント
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Escape') {
                this.togglePause();
            } else if (e.code === 'KeyM') {
                // Mキーでサウンド切り替え
                this.soundManager.toggleSound();
            }
        });

        // ウィンドウリサイズ
        window.addEventListener('resize', this.handleResize.bind(this));

        // タッチイベントの防止（スクロール防止）
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
        }, { passive: false });

        // オーディオコンテキストの再開（ユーザーインタラクション時）
        this.canvas.addEventListener('click', () => {
            this.soundManager.resumeAudioContext();
        });
    }

    /**
     * ゲームオブジェクトの作成
     */
    createGameObjects() {
        try {
            // 入力管理
            this.inputManager = new InputManager();
            
            // サウンド管理
            this.soundManager = new SoundManager();
            
            // 背景
            this.background = new Background();
            
            // プレイヤー（初期位置を調整）
            this.player = new Player(100, 500);
            
            // レベル生成
            this.generateLevel();
        } catch (error) {
            console.error('Error creating game objects:', error);
            throw error;
        }
    }

    /**
     * レベルの生成
     */
    generateLevel() {
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.powerUps = [];
        // 環境デフォルト
        this.setEnvironment({ windX: 0, gravityScale: 1.0, frictionScale: 1.0, theme: 'day' });
        
        // ステージ1
        if (this.currentStage === 1) {
            this.generateStage1();
        } else if (this.currentStage === 2) {
            this.generateStage2();
        } else if (this.currentStage === 3) {
            this.generateStage3();
        } else if (this.currentStage === 4) {
            this.generateStage4();
        } else if (this.currentStage === 5) {
            this.generateStage5();
        } else if (this.currentStage === 6) {
            this.generateStage6();
        } else if (this.currentStage === 7) {
            this.generateStage7();
        } else if (this.currentStage === 8) {
            this.generateStage8();
        } else if (this.currentStage === 9) {
            this.generateStage9();
        } else if (this.currentStage === 10) {
            this.generateStage10();
        }
    }

    /**
     * ステージ環境を設定
     */
    setEnvironment({ windX, gravityScale, frictionScale, theme }) {
        if (typeof windX === 'number') this.environment.windX = windX;
        if (typeof gravityScale === 'number') this.environment.gravityScale = gravityScale;
        if (typeof frictionScale === 'number') this.environment.frictionScale = frictionScale;
        if (typeof theme === 'string') this.environment.theme = theme;
    }

    /**
     * ステージ1の生成
     */
    generateStage1() {
        // 穏やかな昼（標準）
        this.setEnvironment({ windX: 0, gravityScale: 1.0, frictionScale: 1.0, theme: 'day' });
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, GAME_CONFIG.CANVAS_WIDTH, 20));
            
            // 浮遊プラットフォーム
        this.platforms.push(new Platform(200, 450, 120, 20));
        this.platforms.push(new Platform(400, 350, 120, 20));
        this.platforms.push(new Platform(600, 250, 120, 20));
        this.platforms.push(new Platform(300, 150, 120, 20));
            
            // 移動プラットフォーム
        this.platforms.push(new Platform(100, 300, 100, 20, 'moving'));
            
            // 破壊可能プラットフォーム
        this.platforms.push(new Platform(500, 400, 80, 20, 'breakable'));

        // 敵（タイプを混在）
        this.enemies.push(new Enemy(300, 400, 'basic'));
        this.enemies.push(new Enemy(500, 200, 'jumper'));

        // コイン
        this.coins.push(new Coin(250, 400));
        this.coins.push(new Coin(450, 300));
        this.coins.push(new Coin(650, 200));
        this.coins.push(new Coin(350, 100));

        // パワーアップ
        this.powerUps.push(new PowerUp(350, 300, 'jump'));
    }

    /**
     * ステージ2の生成
     */
    generateStage2() {
        const stageWidth = 1600; // ステージ2はより広い
        // 風が強い草原：右向きの風、通常重力
        this.setEnvironment({ windX: 0.05, gravityScale: 1.0, frictionScale: 1.0, theme: 'breeze' });
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        
        // より高いプラットフォーム
        this.platforms.push(new Platform(300, 400, 120, 20));
        this.platforms.push(new Platform(600, 300, 120, 20, 'bounce'));
        this.platforms.push(new Platform(900, 200, 120, 20));
        this.platforms.push(new Platform(1200, 350, 120, 20, 'bounce'));
        this.platforms.push(new Platform(1400, 250, 120, 20));
        
        // 移動プラットフォーム
        this.platforms.push(new Platform(450, 350, 100, 20, 'moving'));
        this.platforms.push(new Platform(750, 250, 100, 20, 'moving'));

        // 敵
        this.enemies.push(new Enemy(400, 350, 'basic'));
        this.enemies.push(new Enemy(700, 250, 'chaser'));
        this.enemies.push(new Enemy(1000, 150, 'jumper'));
        this.enemies.push(new Enemy(1300, 300, 'tank'));

        // コイン
        this.coins.push(new Coin(350, 350));
        this.coins.push(new Coin(650, 250));
        this.coins.push(new Coin(950, 150));
        this.coins.push(new Coin(1250, 300));
        this.coins.push(new Coin(1450, 200));

        // パワーアップ
        this.powerUps.push(new PowerUp(550, 150, 'invincible'));
    }

    /**
     * ステージ3の生成
     */
    generateStage3() {
        const stageWidth = 2000;
        // 氷雪の谷（難易度緩和版）：滑りは控えめ、重力も標準寄り
        this.setEnvironment({ windX: 0, gravityScale: 1.0, frictionScale: 1.2, theme: 'snow' });
        // 氷床ヒント（ダメージは無く滑りやすい）
        if (typeof this.showHint === 'function') {
            this.showHint('氷の床はダメージなし。滑りやすいので減速に注意！');
        }
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20, 'ice'));
        
        // 配置（緩和）：足場を広く・やや低めに
        this.platforms.push(new Platform(200, 470, 120, 20, 'ice'));
        this.platforms.push(new Platform(400, 380, 120, 20, 'ice'));
        this.platforms.push(new Platform(600, 290, 120, 20));
        this.platforms.push(new Platform(800, 210, 120, 20, 'ice'));
        this.platforms.push(new Platform(1000, 330, 120, 20));
        this.platforms.push(new Platform(1200, 260, 120, 20, 'ice'));
        this.platforms.push(new Platform(1400, 420, 120, 20));
        this.platforms.push(new Platform(1600, 290, 120, 20));
        this.platforms.push(new Platform(1800, 380, 120, 20));
        
        // 移動プラットフォーム（広く・低め）
        this.platforms.push(new Platform(300, 330, 100, 20, 'moving'));
        this.platforms.push(new Platform(700, 260, 100, 20, 'moving'));
        this.platforms.push(new Platform(1100, 180, 100, 20, 'moving'));

        // 敵（削減して緩和）
        this.enemies.push(new Enemy(250, 400, 'basic'));
        this.enemies.push(new Enemy(650, 200, 'jumper'));
        this.enemies.push(new Enemy(900, 150, 'flyer'));

        // コイン
        this.coins.push(new Coin(250, 400));
        this.coins.push(new Coin(450, 300));
        this.coins.push(new Coin(650, 200));
        this.coins.push(new Coin(850, 100));
        this.coins.push(new Coin(1050, 250));
        this.coins.push(new Coin(1250, 150));
        this.coins.push(new Coin(1450, 350));
        this.coins.push(new Coin(1650, 200));

        // パワーアップ
        this.powerUps.push(new PowerUp(550, 100, 'jump'));
        this.powerUps.push(new PowerUp(1150, 50, 'invincible'));
    }

    /**
     * ステージ4の生成
     */
    generateStage4() {
        const stageWidth = 2400;
        // 沼地：高摩擦、通常〜重めの重力
        this.setEnvironment({ windX: -0.02, gravityScale: 1.05, frictionScale: 1.4, theme: 'swamp' });
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20, 'mud'));
        
        // より困難な配置
        this.platforms.push(new Platform(150, 450, 80, 20, 'mud'));
        this.platforms.push(new Platform(350, 350, 80, 20));
        this.platforms.push(new Platform(550, 250, 80, 20, 'mud'));
        this.platforms.push(new Platform(750, 150, 80, 20));
        this.platforms.push(new Platform(950, 300, 80, 20, 'mud'));
        this.platforms.push(new Platform(1150, 200, 80, 20));
        this.platforms.push(new Platform(1350, 400, 80, 20));
        this.platforms.push(new Platform(1550, 250, 80, 20));
        this.platforms.push(new Platform(1750, 350, 80, 20));
        this.platforms.push(new Platform(1950, 200, 80, 20));
        this.platforms.push(new Platform(2150, 300, 80, 20));
        
        // 移動プラットフォーム
        this.platforms.push(new Platform(250, 300, 60, 20, 'moving'));
        this.platforms.push(new Platform(650, 200, 60, 20, 'moving'));
        this.platforms.push(new Platform(1050, 100, 60, 20, 'moving'));
        this.platforms.push(new Platform(1450, 350, 60, 20, 'moving'));

        // 敵
        this.enemies.push(new Enemy(200, 400, 'basic'));
        this.enemies.push(new Enemy(400, 300, 'jumper'));
        this.enemies.push(new Enemy(600, 200, 'chaser'));
        this.enemies.push(new Enemy(800, 100, 'flyer'));
        this.enemies.push(new Enemy(1000, 250, 'tank'));
        this.enemies.push(new Enemy(1200, 150, 'basic'));
        this.enemies.push(new Enemy(1400, 350, 'chaser'));
        this.enemies.push(new Enemy(1600, 200, 'jumper'));

        // コイン
        this.coins.push(new Coin(200, 400));
        this.coins.push(new Coin(400, 300));
        this.coins.push(new Coin(600, 200));
        this.coins.push(new Coin(800, 100));
        this.coins.push(new Coin(1000, 250));
        this.coins.push(new Coin(1200, 150));
        this.coins.push(new Coin(1400, 350));
        this.coins.push(new Coin(1600, 200));
        this.coins.push(new Coin(1800, 300));
        this.coins.push(new Coin(2000, 150));

        // パワーアップ
        this.powerUps.push(new PowerUp(450, 200, 'jump'));
        this.powerUps.push(new PowerUp(1250, 100, 'invincible'));
    }

    /**
     * ステージ5の生成（最終ステージ）
     */
    generateStage5() {
        const stageWidth = 2800;
        // 火山：低重力、危険なトゲ、バウンド床
        this.setEnvironment({ windX: 0, gravityScale: 0.9, frictionScale: 1.0, theme: 'volcano' });
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20, 'spike'));
        
        // 最終ステージの困難な配置
        this.platforms.push(new Platform(100, 450, 60, 20, 'bounce'));
        this.platforms.push(new Platform(300, 350, 60, 20));
        this.platforms.push(new Platform(500, 250, 60, 20, 'spike'));
        this.platforms.push(new Platform(700, 150, 60, 20));
        this.platforms.push(new Platform(900, 300, 60, 20, 'bounce'));
        this.platforms.push(new Platform(1100, 200, 60, 20));
        this.platforms.push(new Platform(1300, 400, 60, 20));
        this.platforms.push(new Platform(1500, 250, 60, 20));
        this.platforms.push(new Platform(1700, 350, 60, 20));
        this.platforms.push(new Platform(1900, 200, 60, 20));
        this.platforms.push(new Platform(2100, 300, 60, 20));
        this.platforms.push(new Platform(2300, 150, 60, 20));
        this.platforms.push(new Platform(2500, 250, 60, 20));
        
        // 移動プラットフォーム
        this.platforms.push(new Platform(200, 300, 50, 20, 'moving'));
        this.platforms.push(new Platform(600, 200, 50, 20, 'moving'));
        this.platforms.push(new Platform(1000, 100, 50, 20, 'moving'));
        this.platforms.push(new Platform(1400, 350, 50, 20, 'moving'));
        this.platforms.push(new Platform(1800, 250, 50, 20, 'moving'));

        // 敵
        this.enemies.push(new Enemy(150, 400, 'basic'));
        this.enemies.push(new Enemy(350, 300, 'chaser'));
        this.enemies.push(new Enemy(550, 200, 'jumper'));
        this.enemies.push(new Enemy(750, 100, 'flyer'));
        this.enemies.push(new Enemy(950, 250, 'tank'));
        this.enemies.push(new Enemy(1150, 150, 'basic'));
        this.enemies.push(new Enemy(1350, 350, 'chaser'));
        this.enemies.push(new Enemy(1550, 200, 'jumper'));
        this.enemies.push(new Enemy(1750, 300, 'flyer'));
        this.enemies.push(new Enemy(1950, 150, 'tank'));

        // コイン
        this.coins.push(new Coin(150, 400));
        this.coins.push(new Coin(350, 300));
        this.coins.push(new Coin(550, 200));
        this.coins.push(new Coin(750, 100));
        this.coins.push(new Coin(950, 250));
        this.coins.push(new Coin(1150, 150));
        this.coins.push(new Coin(1350, 350));
        this.coins.push(new Coin(1550, 200));
        this.coins.push(new Coin(1750, 300));
        this.coins.push(new Coin(1950, 150));
        this.coins.push(new Coin(2150, 250));
        this.coins.push(new Coin(2350, 100));
        this.coins.push(new Coin(2550, 200));

        // パワーアップ
        this.powerUps.push(new PowerUp(350, 200, 'jump'));
        this.powerUps.push(new PowerUp(1150, 50, 'invincible'));
        this.powerUps.push(new PowerUp(1950, 100, 'jump'));
    }

    /**
     * ステージ6の生成
     */
    generateStage6() {
        const stageWidth = 3200;
        // 強風：右へ強い風
        this.setEnvironment({ windX: 0.08, gravityScale: 1.0, frictionScale: 1.0, theme: 'breeze' });
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        for (let x = 200; x <= 3000; x += 200) {
            this.platforms.push(new Platform(x, 400 - (x % 400) / 5, 100, 20));
        }
        this.platforms.push(new Platform(500, 300, 100, 20, 'moving'));
        this.platforms.push(new Platform(1500, 250, 100, 20, 'moving'));
        this.enemies.push(new Enemy(800, 350));
        this.enemies.push(new Enemy(1600, 300));
        this.enemies.push(new Enemy(2400, 250));
        for (let x = 300; x <= 2900; x += 300) this.coins.push(new Coin(x, 350));
        this.powerUps.push(new PowerUp(1000, 200, 'jump'));
        this.powerUps.push(new PowerUp(2200, 150, 'invincible'));
    }

    /**
     * ステージ7の生成
     */
    generateStage7() {
        const stageWidth = 3600;
        // トランポリンゾーン：バウンド多め
        this.setEnvironment({ windX: 0, gravityScale: 1.0, frictionScale: 1.0, theme: 'day' });
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        const heights = [450, 350, 250, 350, 200, 300, 250];
        for (let i = 0; i < 14; i++) {
            const x = 200 + i * 240;
            const h = heights[i % heights.length];
            this.platforms.push(new Platform(x, h, 120, 20, i % 3 === 0 ? 'bounce' : 'normal'));
        }
        this.platforms.push(new Platform(900, 200, 80, 20, 'moving'));
        this.platforms.push(new Platform(2100, 150, 80, 20, 'moving'));
        this.enemies.push(new Enemy(1000, 320));
        this.enemies.push(new Enemy(2000, 280));
        this.enemies.push(new Enemy(3000, 240));
        for (let x = 250; x <= 3400; x += 250) this.coins.push(new Coin(x, 280));
        this.powerUps.push(new PowerUp(1700, 180, 'jump'));
    }

    /**
     * ステージ8の生成
     */
    generateStage8() {
        const stageWidth = 4000;
        // 夜の都市：やや低重力、風なし
        this.setEnvironment({ windX: 0, gravityScale: 0.95, frictionScale: 1.0, theme: 'night' });
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        for (let i = 0; i < 10; i++) {
            const x = 300 + i * 350;
            this.platforms.push(new Platform(x, 420 - (i % 2) * 180, 100, 20, i % 2 === 0 ? 'spike' : 'normal'));
            this.platforms.push(new Platform(x + 150, 260 + (i % 2) * 120, 100, 20, i % 3 === 0 ? 'bounce' : 'normal'));
        }
        for (let i = 0; i < 5; i++) this.platforms.push(new Platform(700 + i * 600, 200, 80, 20, 'moving'));
        for (let i = 0; i < 8; i++) this.enemies.push(new Enemy(500 + i * 400, 300));
        for (let i = 0; i < 12; i++) this.coins.push(new Coin(400 + i * 300, 240));
        this.powerUps.push(new PowerUp(2000, 120, 'invincible'));
    }

    /**
     * ステージ9の生成
     */
    generateStage9() {
        const stageWidth = 4400;
        // 極寒：強い氷床、重力やや重い
        this.setEnvironment({ windX: -0.03, gravityScale: 1.1, frictionScale: 0.7, theme: 'snow' });
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        for (let i = 0; i < 16; i++) {
            const x = 200 + i * 260;
            const w = 80 + (i % 3) * 40;
            const y = 420 - ((i * 70) % 300);
            this.platforms.push(new Platform(x, y, w, 20, i % 2 === 0 ? 'ice' : 'normal'));
        }
        this.platforms.push(new Platform(1200, 180, 70, 20, 'moving'));
        this.platforms.push(new Platform(2600, 160, 70, 20, 'moving'));
        for (let i = 0; i < 10; i++) this.enemies.push(new Enemy(600 + i * 350, 260));
        for (let i = 0; i < 16; i++) this.coins.push(new Coin(300 + i * 250, 220));
        this.powerUps.push(new PowerUp(3200, 140, 'jump'));
    }

    /**
     * ステージ10の生成
     */
    generateStage10() {
        const stageWidth = 4800;
        // 最終：混在、低重力
        this.setEnvironment({ windX: 0.02, gravityScale: 0.9, frictionScale: 1.0, theme: 'dusk' });
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        // ジグザグの小さな足場
        for (let i = 0; i < 18; i++) {
            const x = 200 + i * 250;
            const y = 450 - (i % 2) * 220;
            const t = i % 5 === 0 ? 'spike' : i % 3 === 0 ? 'bounce' : 'normal';
            this.platforms.push(new Platform(x, y, 70, 18, t));
        }
        // 多数の移動足場
        for (let i = 0; i < 8; i++) this.platforms.push(new Platform(600 + i * 500, 220 + (i % 3) * 60, 70, 18, 'moving'));
        // 敵を密集配置
        for (let i = 0; i < 12; i++) {
            const types = ['basic', 'chaser', 'jumper', 'flyer', 'tank'];
            const t = types[i % types.length];
            this.enemies.push(new Enemy(500 + i * 350, 240, t));
        }
        // コイン大量
        for (let i = 0; i < 20; i++) this.coins.push(new Coin(300 + i * 220, 200 + (i % 3) * 60));
        // パワーアップを複数
        this.powerUps.push(new PowerUp(1800, 120, 'invincible'));
        this.powerUps.push(new PowerUp(3600, 100, 'jump'));
    }

    /**
     * ゲーム開始
     */
    start() {
        this.isRunning = true;
        this.gameLoop();
    }

    /**
     * ゲームループ
     */
    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;

        try {
            // デルタタイムの計算
            this.deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;

            // FPS計算
            this.frameCount++;
            if (this.frameCount % 60 === 0) {
                this.fps = Math.round(1000 / (this.deltaTime || 1));
            }

            // ゲーム更新
            if (!this.isPaused && !this.gameOver) {
                this.update();
            }

            // レンダリング
            this.render();

            // 次のフレームを要求
            requestAnimationFrame(this.gameLoop.bind(this));

        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * ゲーム更新
     */
    update() {
        // ヒットストップ中はロジック更新を停止（描画のみ継続）
        if (this.hitstop > 0) {
            this.hitstop = Math.max(0, this.hitstop - this.deltaTime);
            return;
        }

        // 背景更新
        if (this.background) {
            this.background.update(this.deltaTime, this.player ? this.player.velocity.x : 0);
        }

        // カメラスクロール更新
        this.updateCamera();

        // ステージクリア演出中はゲーム進行を一時停止
        if (this.stageClear.active) {
            this.updateStageClear();
            this.render();
            return;
        }

        // ステージ進行チェック
        this.checkStageProgress();

        // プラットフォーム更新
        if (this.platforms && Array.isArray(this.platforms)) {
            this.platforms.forEach(platform => {
                if (platform && typeof platform.update === 'function') {
                    platform.update(this.deltaTime);
                }
            });
        }

        // 敵更新
        if (this.enemies && Array.isArray(this.enemies)) {
            this.enemies.forEach(enemy => {
                if (enemy && typeof enemy.update === 'function') {
                    enemy.update(this.deltaTime, this.platforms, this.player);
                }
            });
        }

        // コイン更新
        if (this.coins && Array.isArray(this.coins)) {
            this.coins.forEach(coin => {
                if (coin && typeof coin.update === 'function') {
                    coin.update(this.deltaTime);
                }
            });
        }

        // パワーアップ更新
        if (this.powerUps && Array.isArray(this.powerUps)) {
            this.powerUps.forEach(powerUp => {
                if (powerUp && typeof powerUp.update === 'function') {
                    powerUp.update(this.deltaTime);
                }
            });
        }

        // プレイヤー更新
        this.player.update(this.deltaTime, this.platforms, this.enemies, this.coins, this.powerUps, this.inputManager);

        // ゲームオーバー判定
        this.checkGameOver();

        // UI更新
        this.updateUI();

        // デッドエンティティの削除
        this.cleanupDeadEntities();

        // エフェクト更新
        this.updateEffects(this.deltaTime);
    }

    /**
     * カメラスクロール更新
     */
    updateCamera() {
        if (!this.player) return;

        // プレイヤーが画面中央より右に移動したらカメラをスクロール
        const targetCameraX = this.player.x - this.scrollThreshold;
        
        // スムーズなカメラ追従
        this.cameraX += (targetCameraX - this.cameraX) * 0.1;
        
        // カメラの範囲制限
        this.cameraX = Math.max(0, this.cameraX);
    }

    /**
     * ステージ進行チェック
     */
    checkStageProgress() {
        if (!this.player) return;

        // 現在のステージの幅を取得
        let currentStageWidth = this.getCurrentStageWidth();

        // プレイヤーがステージの右端に到達したら次のステージへ
        if (this.player.x >= currentStageWidth - 100) {
            this.startStageClear();
        }
    }

    /**
     * 次のステージへ進む
     */
    nextStage() {
        if (this.currentStage < this.maxStages) {
            this.currentStage++;
            
            // プレイヤーを次のステージの開始位置に移動
            this.player.x = 100;
            this.player.y = 500;
            this.player.velocity = new Vector2(0, 0);
            
            // カメラをリセット
            this.cameraX = 0;
            
            // 新しいステージを生成
            this.generateLevel();
            
            // ステージ進行エフェクト
            this.showStageTransition();
        } else {
            // 最終ステージクリア
            this.showGameClear();
        }
    }

    /**
     * ステージクリア演出開始
     */
    startStageClear() {
        if (this.stageClear.active) return;
        this.stageClear.active = true;
        this.stageClear.timer = this.stageClear.duration;
        this.stageClear.particles = [];

        // プレイヤーの喜びアニメーション開始
        if (this.player && typeof this.player.startCelebration === 'function') {
            this.player.startCelebration(this.stageClear.duration);
        }

        // フラッシュ効果
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; inset: 0; background: white; opacity: 0.0; pointer-events: none; z-index: 999;
            transition: opacity 150ms ease;
        `;
        document.body.appendChild(flash);
        requestAnimationFrame(() => { flash.style.opacity = '0.8'; });
        setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 200); }, 180);

        // 祝福ポップアップ
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(0.95);
            background: rgba(2, 6, 23, 0.85); color: white; padding: 18px 22px; border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.12); backdrop-filter: blur(8px); z-index: 1000; text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.35); font-weight: 700; letter-spacing: .2px; opacity: 0; transition: all 200ms ease;
        `;
        popup.innerHTML = `ステージ ${this.currentStage} クリア！`;
        document.body.appendChild(popup);
        requestAnimationFrame(() => { popup.style.opacity = '1'; popup.style.transform = 'translate(-50%, -50%) scale(1)'; });
        setTimeout(() => popup.remove(), this.stageClear.duration);

        // プレイヤー周りに簡易パーティクル（花吹雪風）
        for (let i = 0; i < 50; i++) {
            this.stageClear.particles.push({
                x: this.player.x + Math.random() * 40 - 20,
                y: this.player.y - 10 + Math.random() * 20 - 10,
                vx: (Math.random() - 0.5) * 1.5,
                vy: -Math.random() * 2 - 0.5,
                life: 1,
                color: ['#FDE68A', '#FCA5A5', '#A7F3D0'][Math.floor(Math.random() * 3)]
            });
        }
    }

    /**
     * ステージクリア演出の更新と描画
     */
    updateStageClear() {
        const dt = this.deltaTime / 1000;
        this.stageClear.timer -= this.deltaTime;
        if (this.player && typeof this.player.updateCelebrate === 'function') {
            this.player.updateCelebrate(this.deltaTime);
        }
        this.stageClear.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.02; // 重力
            p.life -= dt * 0.6;
        });
        this.stageClear.particles = this.stageClear.particles.filter(p => p.life > 0);

        // クリア演出のオーバーレイ描画
        this.render();
        this.ctx.save();
        this.ctx.translate(-this.cameraX, -this.cameraY);
        this.stageClear.particles.forEach(p => {
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.restore();

        if (this.stageClear.timer <= 0) {
            this.stageClear.active = false;
            this.nextStage();
        }
    }

    /**
     * 現在のステージ幅を返す
     */
    getCurrentStageWidth() {
        switch (this.currentStage) {
            case 1: return GAME_CONFIG.CANVAS_WIDTH;
            case 2: return 1600;
            case 3: return 2000;
            case 4: return 2400;
            case 5: return 2800;
            case 6: return 3200;
            case 7: return 3600;
            case 8: return 4000;
            case 9: return 4400;
            case 10: return 4800;
            default: return GAME_CONFIG.CANVAS_WIDTH;
        }
    }

    /**
     * ステージ進行エフェクト
     */
    showStageTransition() {
        // ステージ進行メッセージを表示
        const stageDiv = document.createElement('div');
        stageDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1000;
            text-align: center;
            font-size: 24px;
            font-weight: bold;
        `;
        stageDiv.textContent = `ステージ ${this.currentStage} 開始！`;
        document.body.appendChild(stageDiv);
        
        // 3秒後に削除
        setTimeout(() => {
            if (stageDiv.parentNode) {
                stageDiv.parentNode.removeChild(stageDiv);
            }
        }, 3000);
    }

    /**
     * ゲームクリア表示
     */
    showGameClear() {
        this.gameOver = true;
        this.isRunning = false;
        
        // ハイスコア保存
        try {
            if (this.player && typeof this.player.score === 'number') {
                if (this.player.score > (this.bestScore || 0)) {
                    this.bestScore = this.player.score;
                    localStorage.setItem('bestScore', String(this.bestScore));
                }
            }
        } catch (e) { console.warn('Failed to save best score', e); }
        
        const clearDiv = document.createElement('div');
        clearDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 255, 0, 0.9);
            color: white;
            padding: 30px;
            border-radius: 15px;
            z-index: 1000;
            text-align: center;
            font-size: 28px;
            font-weight: bold;
        `;
        const bestText = Math.max(this.player.score, this.bestScore || 0);
        clearDiv.innerHTML = `
            <h2>🎉 ゲームクリア！ 🎉</h2>
            <p>最終スコア: ${this.player.score}</p>
            <p>ハイスコア: ${bestText}</p>
            <button onclick="window.game.restart()" 
                    style="background: white; color: green; border: none; padding: 15px 30px; border-radius: 10px; cursor: pointer; font-size: 18px; margin-top: 20px;">
                もう一度プレイ
            </button>
        `;
        document.body.appendChild(clearDiv);
    }

    /**
     * レンダリング
     */
    render() {
        // Canvasをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 背景は画面基準で描画（カメラ変換の外）
        if (this.background && typeof this.background.render === 'function') {
            this.background.render(this.ctx);
        }

        // カメラ変換を適用
        this.ctx.save();
        // スクリーンシェイク（被ダメージ時の揺れ）
        let shakeX = 0, shakeY = 0;
        if (this.effects && this.effects.screenShake.timeLeft > 0 && this.effects.screenShake.duration > 0) {
            const t = this.effects.screenShake.timeLeft / this.effects.screenShake.duration;
            const amplitude = this.effects.screenShake.power * t;
            shakeX = (Math.random() * 2 - 1) * amplitude;
            shakeY = (Math.random() * 2 - 1) * amplitude;
        }
        this.ctx.translate(-this.cameraX + shakeX, -this.cameraY + shakeY);

        // プラットフォーム描画
        if (this.platforms && Array.isArray(this.platforms)) {
            this.platforms.forEach(platform => {
                if (platform && typeof platform.render === 'function') {
                    platform.render(this.ctx);
                }
            });
        }

        // コイン描画
        if (this.coins && Array.isArray(this.coins)) {
            this.coins.forEach(coin => {
                if (coin && typeof coin.render === 'function') {
                    coin.render(this.ctx);
                }
            });
        }

        // パワーアップ描画
        if (this.powerUps && Array.isArray(this.powerUps)) {
            this.powerUps.forEach(powerUp => {
                if (powerUp && typeof powerUp.render === 'function') {
                    powerUp.render(this.ctx);
                }
            });
        }

        // 敵描画
        if (this.enemies && Array.isArray(this.enemies)) {
            this.enemies.forEach(enemy => {
                if (enemy && typeof enemy.render === 'function') {
                    enemy.render(this.ctx);
                }
            });
        }

        // プレイヤー描画
        if (this.player && typeof this.player.render === 'function') {
            this.player.render(this.ctx);
        }

        // フローティングテキスト（ワールド座標で描画）
        if (this.effects && Array.isArray(this.effects.floatingTexts)) {
            this.effects.floatingTexts.forEach(ft => {
                const alpha = Math.max(0, ft.timeLeft / ft.duration);
                this.ctx.save();
                this.ctx.globalAlpha = alpha;
                this.ctx.fillStyle = ft.color || '#ffffff';
                this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
                this.ctx.lineWidth = 3;
                this.ctx.font = `bold ${ft.size || 18}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.strokeText(ft.text, ft.x, ft.y);
                this.ctx.fillText(ft.text, ft.x, ft.y);
                this.ctx.restore();
            });
        }

        // カメラ変換を復元
        this.ctx.restore();

        // UI要素（カメラ変換の影響を受けない）
        this.renderUI();

        // ビネット
        if (typeof this.drawVignette === 'function') {
            this.drawVignette(this.ctx);
        }

        // ダメージフラッシュ（赤いフラッシュオーバーレイ）
        if (this.effects && this.effects.damageFlashAlpha > 0) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(239, 68, 68, ${Math.min(0.45, this.effects.damageFlashAlpha)})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
    }

    // 画面周辺減光（視線の中心誘導）
    drawVignette(ctx) {
        const w = this.canvas && Number.isFinite(this.canvas.width) ? this.canvas.width : 0;
        const h = this.canvas && Number.isFinite(this.canvas.height) ? this.canvas.height : 0;
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return;
        const cx = w / 2, cy = h / 2;
        let rInner = Math.min(w, h) * 0.45;
        let rOuter = Math.max(w, h) * 0.75;
        if (!Number.isFinite(rInner) || rInner <= 0) rInner = 1;
        if (!Number.isFinite(rOuter) || rOuter <= rInner) rOuter = rInner + 1;
        const g = (typeof Utils !== 'undefined' && Utils.createSafeRadialGradient)
            ? Utils.createSafeRadialGradient(ctx, cx, cy, rInner, cx, cy, rOuter)
            : ctx.createRadialGradient(cx, cy, rInner, cx, cy, rOuter);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.save();
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    /**
     * 演出の更新（ダメージフラッシュ、スクリーンシェイク、フローティングテキスト）
     */
    updateEffects(deltaTime) {
        if (!this.effects) return;
        // フラッシュ減衰
        if (this.effects.damageFlashAlpha > 0) {
            this.effects.damageFlashAlpha = Math.max(0, this.effects.damageFlashAlpha - this.effects.damageFlashFadeSpeed);
        }
        // シェイク時間更新
        if (this.effects.screenShake.timeLeft > 0) {
            this.effects.screenShake.timeLeft = Math.max(0, this.effects.screenShake.timeLeft - deltaTime);
        }
        // フローティングテキスト更新
        if (Array.isArray(this.effects.floatingTexts)) {
            for (let i = this.effects.floatingTexts.length - 1; i >= 0; i--) {
                const ft = this.effects.floatingTexts[i];
                ft.timeLeft -= deltaTime;
                // 上にゆっくり移動
                ft.y += (ft.vy !== undefined ? ft.vy : -0.04) * deltaTime;
                if (ft.timeLeft <= 0) this.effects.floatingTexts.splice(i, 1);
            }
        }
    }

    /**
     * プレイヤー被ダメージ時の演出トリガ
     */
    onPlayerDamaged(player) {
        try {
            const cx = player.x + player.width / 2;
            const cy = player.y + player.height / 2 - 10;
            // フラッシュ
            this.effects.damageFlashAlpha = 0.6;
            // シェイク
            this.effects.screenShake = { timeLeft: 280, duration: 280, power: 6 };
            // フローティングテキスト
            this.effects.floatingTexts.push({
                x: cx,
                y: cy,
                vy: -0.06,
                timeLeft: 600,
                duration: 600,
                text: '-1',
                color: '#FF6B6B',
                size: 20
            });
        } catch (e) {
            console.error('Failed to trigger damage effect:', e);
        }
    }

    /**
     * 画面上部に小さなヒントを表示
     */
    showHint(message, duration = 3500) {
        try {
            const hint = document.createElement('div');
            hint.style.cssText = `
                position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
                background: rgba(2, 6, 23, 0.82); color: white; padding: 8px 14px; border-radius: 999px;
                border: 1px solid rgba(255,255,255,0.12); box-shadow: 0 10px 24px rgba(0,0,0,0.3);
                font-weight: 700; letter-spacing: .2px; z-index: 1000; font-size: 14px; opacity: 0; transition: opacity .2s ease;
            `;
            hint.textContent = message;
            document.body.appendChild(hint);
            requestAnimationFrame(() => { hint.style.opacity = '1'; });
            setTimeout(() => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 250);
            }, duration);
        } catch (e) {
            console.error('Failed to show hint:', e);
        }
    }

    /**
     * UI描画
     */
    renderUI() {
        // FPS表示（デバッグ用）
        if (this.fps > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(10, 50, 60, 20);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`FPS: ${this.fps}`, 15, 65);
        }

        // ステージ表示
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(10, 10, 100, 30);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`ステージ: ${this.currentStage}`, 15, 30);

        // ハイスコア表示
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(120, 10, 160, 30);
        this.ctx.fillStyle = 'white';
        this.ctx.font = '16px Arial';
        this.ctx.fillText(`ハイスコア: ${this.bestScore || 0}`, 125, 30);
    }

    /**
     * UI更新
     */
    updateUI() {
        if (this.scoreElement) {
            this.scoreElement.textContent = this.player.score;
        }
        if (this.livesElement) {
            this.livesElement.textContent = this.player.lives;
        }
    }

    /**
     * ゲームオーバー判定
     */
    checkGameOver() {
        if (this.player.lives <= 0) {
            this.endGame();
        }
    }

    /**
     * ゲーム終了
     */
    endGame() {
        this.gameOver = true;
        this.isRunning = false;
        
        if (this.finalScoreElement) {
            this.finalScoreElement.textContent = this.player.score;
        }
        
        // ハイスコア保存
        try {
            if (this.player && typeof this.player.score === 'number') {
                if (this.player.score > (this.bestScore || 0)) {
                    this.bestScore = this.player.score;
                    localStorage.setItem('bestScore', String(this.bestScore));
                }
            }
        } catch (e) { console.warn('Failed to save best score', e); }
        
        if (this.gameOverElement) {
            this.gameOverElement.style.display = 'block';
        }
    }

    /**
     * ゲームリスタート
     */
    restart() {
        try {
            // ゲーム状態をリセット
            this.gameOver = false;
            this.isRunning = false;
            this.isPaused = false;
            
            // ステージをリセット
            this.currentStage = 1;
            this.cameraX = 0;
            this.cameraY = 0;
            
            // ゲームオーバー画面を非表示
            if (this.gameOverElement) {
                this.gameOverElement.style.display = 'none';
            }
            
            // 配列をクリア
            this.powerUps = [];
            this.coins = [];
            this.enemies = [];
            this.platforms = [];
            
            // ゲームオブジェクトを再作成
            this.createGameObjects();
            
            // ゲームを再開
            this.start();
            
        } catch (error) {
            this.handleError(error);
        }
    }

    /**
     * 一時停止切り替え
     */
    togglePause() {
        this.isPaused = !this.isPaused;
    }

    /**
     * デッドエンティティの削除
     */
    cleanupDeadEntities() {
        // デッドエンティティを削除
        if (this.enemies && Array.isArray(this.enemies)) {
            this.enemies = this.enemies.filter(enemy => enemy && !enemy.isDead);
        }
        
        if (this.coins && Array.isArray(this.coins)) {
            this.coins = this.coins.filter(coin => coin && !coin.collected);
        }
        
        // 破壊されたプラットフォームを削除
        if (this.platforms && Array.isArray(this.platforms)) {
            this.platforms = this.platforms.filter(platform => platform && platform.health > 0);
        }
    }

    /**
     * ウィンドウリサイズ処理
     */
    handleResize() {
        // レスポンシブ対応（必要に応じて実装）
        console.log('Window resized');
    }

    /**
     * エラーハンドリング
     */
    handleError(error) {
        console.error('Game Error:', error);
        
        // エラーをユーザーに表示
        this.showErrorMessage(error.message || 'An error occurred');
        
        // ゲームを停止
        this.isRunning = false;
    }

    /**
     * エラーメッセージ表示
     */
    showErrorMessage(message) {
        // エラーメッセージを表示するUIを作成
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            z-index: 1000;
            text-align: center;
            max-width: 400px;
        `;
        errorDiv.innerHTML = `
            <h3>エラーが発生しました</h3>
            <p>${message}</p>
            <button onclick="this.parentElement.remove(); location.reload();" 
                    style="background: white; color: red; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                ページを再読み込み
            </button>
        `;
        document.body.appendChild(errorDiv);
    }

    /**
     * ヒットストップ適用（ms）
     */
    applyHitstop(durationMs = 80) {
        this.hitstop = Math.max(this.hitstop, durationMs);
    }

    /**
     * ゲームの破棄
     */
    destroy() {
        this.isRunning = false;
        
        // イベントリスナーを削除
        window.removeEventListener('error', this.errorHandler);
        window.removeEventListener('unhandledrejection', this.errorHandler);
        
        // ゲームオブジェクトをクリア
        this.player = null;
        this.platforms = [];
        this.enemies = [];
        this.coins = [];
        this.background = null;
    }
}

// グローバルエラーハンドリング
window.addEventListener('load', () => {
    // ゲームが正常に読み込まれたことを確認
    console.log('2D Platformer Game loaded successfully');
});

// ページ離脱時のクリーンアップ
window.addEventListener('beforeunload', () => {
    if (window.game) {
        window.game.destroy();
    }
});
