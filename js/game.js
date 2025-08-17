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
        this.maxStages = 5;
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

        // Canvasのサイズを設定
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
        }
    }

    /**
     * ステージ1の生成
     */
    generateStage1() {
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

        // 敵
        this.enemies.push(new Enemy(300, 400));
        this.enemies.push(new Enemy(500, 200));

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
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        
        // より高いプラットフォーム
        this.platforms.push(new Platform(300, 400, 120, 20));
        this.platforms.push(new Platform(600, 300, 120, 20));
        this.platforms.push(new Platform(900, 200, 120, 20));
        this.platforms.push(new Platform(1200, 350, 120, 20));
        this.platforms.push(new Platform(1400, 250, 120, 20));
        
        // 移動プラットフォーム
        this.platforms.push(new Platform(450, 350, 100, 20, 'moving'));
        this.platforms.push(new Platform(750, 250, 100, 20, 'moving'));

        // 敵
        this.enemies.push(new Enemy(400, 350));
        this.enemies.push(new Enemy(700, 250));
        this.enemies.push(new Enemy(1000, 150));
        this.enemies.push(new Enemy(1300, 300));

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
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        
        // 複雑な配置
        this.platforms.push(new Platform(200, 450, 100, 20));
        this.platforms.push(new Platform(400, 350, 100, 20));
        this.platforms.push(new Platform(600, 250, 100, 20));
        this.platforms.push(new Platform(800, 150, 100, 20));
        this.platforms.push(new Platform(1000, 300, 100, 20));
        this.platforms.push(new Platform(1200, 200, 100, 20));
        this.platforms.push(new Platform(1400, 400, 100, 20));
        this.platforms.push(new Platform(1600, 250, 100, 20));
        this.platforms.push(new Platform(1800, 350, 100, 20));
        
        // 移動プラットフォーム
        this.platforms.push(new Platform(300, 300, 80, 20, 'moving'));
        this.platforms.push(new Platform(700, 200, 80, 20, 'moving'));
        this.platforms.push(new Platform(1100, 100, 80, 20, 'moving'));

        // 敵
        this.enemies.push(new Enemy(250, 400));
        this.enemies.push(new Enemy(450, 300));
        this.enemies.push(new Enemy(650, 200));
        this.enemies.push(new Enemy(850, 100));
        this.enemies.push(new Enemy(1050, 250));
        this.enemies.push(new Enemy(1250, 150));

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
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        
        // より困難な配置
        this.platforms.push(new Platform(150, 450, 80, 20));
        this.platforms.push(new Platform(350, 350, 80, 20));
        this.platforms.push(new Platform(550, 250, 80, 20));
        this.platforms.push(new Platform(750, 150, 80, 20));
        this.platforms.push(new Platform(950, 300, 80, 20));
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
        this.enemies.push(new Enemy(200, 400));
        this.enemies.push(new Enemy(400, 300));
        this.enemies.push(new Enemy(600, 200));
        this.enemies.push(new Enemy(800, 100));
        this.enemies.push(new Enemy(1000, 250));
        this.enemies.push(new Enemy(1200, 150));
        this.enemies.push(new Enemy(1400, 350));
        this.enemies.push(new Enemy(1600, 200));

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
        
        // 地面
        this.platforms.push(new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, stageWidth, 20));
        
        // 最終ステージの困難な配置
        this.platforms.push(new Platform(100, 450, 60, 20));
        this.platforms.push(new Platform(300, 350, 60, 20));
        this.platforms.push(new Platform(500, 250, 60, 20));
        this.platforms.push(new Platform(700, 150, 60, 20));
        this.platforms.push(new Platform(900, 300, 60, 20));
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
        this.enemies.push(new Enemy(150, 400));
        this.enemies.push(new Enemy(350, 300));
        this.enemies.push(new Enemy(550, 200));
        this.enemies.push(new Enemy(750, 100));
        this.enemies.push(new Enemy(950, 250));
        this.enemies.push(new Enemy(1150, 150));
        this.enemies.push(new Enemy(1350, 350));
        this.enemies.push(new Enemy(1550, 200));
        this.enemies.push(new Enemy(1750, 300));
        this.enemies.push(new Enemy(1950, 150));

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
        // 背景更新
        if (this.background) {
            this.background.update(this.deltaTime, this.player ? this.player.velocity.x : 0);
        }

        // カメラスクロール更新
        this.updateCamera();

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
                    enemy.update(this.deltaTime, this.platforms);
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
        let currentStageWidth = GAME_CONFIG.CANVAS_WIDTH;
        if (this.currentStage === 2) currentStageWidth = 1600;
        else if (this.currentStage === 3) currentStageWidth = 2000;
        else if (this.currentStage === 4) currentStageWidth = 2400;
        else if (this.currentStage === 5) currentStageWidth = 2800;

        // プレイヤーがステージの右端に到達したら次のステージへ
        if (this.player.x >= currentStageWidth - 100) {
            this.nextStage();
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
        clearDiv.innerHTML = `
            <h2>🎉 ゲームクリア！ 🎉</h2>
            <p>最終スコア: ${this.player.score}</p>
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

        // カメラ変換を適用
        this.ctx.save();
        this.ctx.translate(-this.cameraX, -this.cameraY);

        // 背景描画
        if (this.background && typeof this.background.render === 'function') {
            this.background.render(this.ctx);
        }

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

        // カメラ変換を復元
        this.ctx.restore();

        // UI要素（カメラ変換の影響を受けない）
        this.renderUI();
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
