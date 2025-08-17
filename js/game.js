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
        // プラットフォームの生成
        this.platforms = [
            // 地面（位置を修正）
            new Platform(0, GAME_CONFIG.CANVAS_HEIGHT - 20, GAME_CONFIG.CANVAS_WIDTH, 20),
            
            // 浮遊プラットフォーム
            new Platform(200, 450, 120, 20),
            new Platform(400, 350, 120, 20),
            new Platform(600, 250, 120, 20),
            new Platform(300, 150, 120, 20),
            
            // 移動プラットフォーム
            new Platform(100, 300, 100, 20, 'moving'),
            
            // 破壊可能プラットフォーム
            new Platform(500, 400, 80, 20, 'breakable'),
        ];

        // 敵の生成
        this.enemies = [
            new Enemy(300, 400),
            new Enemy(500, 200),
            new Enemy(700, 500),
        ];

        // コインの生成
        this.coins = [
            new Coin(250, 400),
            new Coin(450, 300),
            new Coin(650, 200),
            new Coin(350, 100),
            new Coin(150, 250),
            new Coin(550, 350),
        ];

        // パワーアップアイテムの生成
        this.powerUps = [
            new PowerUp(350, 300, 'jump'),      // ジャンプ力向上
            new PowerUp(550, 150, 'invincible'), // 無敵状態
        ];
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
     * レンダリング
     */
    render() {
        // Canvasをクリア
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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

        // FPS表示（デバッグ用）
        if (this.fps > 0) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(10, 50, 60, 20);
            this.ctx.fillStyle = 'white';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(`FPS: ${this.fps}`, 15, 65);
        }
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
