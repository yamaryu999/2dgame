/**
 * ユーティリティ関数とヘルパークラス
 * 物理演算、コリジョン検出、アニメーションなどの共通機能を提供
 */

// 物理定数
const PHYSICS = {
    GRAVITY: 0.6,          // 重力を軽減
    FRICTION: 0.8,         // 摩擦を調整
    AIR_RESISTANCE: 0.98,  // 空中抵抗を緩和
    ACCELERATION: 0.4,     // 加速度を小さく（より滑らかに）
    DECELERATION: 0.6,     // 減速度を調整
    JUMP_FORCE: -12,       // ジャンプ力を調整
    MAX_FALL_SPEED: 10,    // 最大落下速度を調整
    MAX_SPEED: 4           // 最大速度を下げて制御しやすく
};

// ゲーム設定
const GAME_CONFIG = {
    FPS: 60,
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 600,
    PLAYER_SPEED: 6,       // プレイヤー速度を向上
    ENEMY_SPEED: 2
};

/**
 * ベクトル2Dクラス
 */
class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    add(vector) {
        return new Vector2(this.x + vector.x, this.y + vector.y);
    }

    subtract(vector) {
        return new Vector2(this.x - vector.x, this.y - vector.y);
    }

    multiply(scalar) {
        return new Vector2(this.x * scalar, this.y * scalar);
    }

    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    normalize() {
        const mag = this.magnitude();
        if (mag === 0) return new Vector2(0, 0);
        return new Vector2(this.x / mag, this.y / mag);
    }

    distance(vector) {
        return this.subtract(vector).magnitude();
    }
}

/**
 * 矩形クラス（コリジョン検出用）
 */
class Rectangle {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get top() { return this.y; }
    get bottom() { return this.y + this.height; }

    intersects(rect) {
        return !(this.left > rect.right || 
                this.right < rect.left || 
                this.top > rect.bottom || 
                this.bottom < rect.top);
    }

    contains(point) {
        return point.x >= this.left && point.x <= this.right &&
               point.y >= this.top && point.y <= this.bottom;
    }
}

/**
 * コリジョン検出ユーティリティ
 */
class CollisionDetector {
    /**
     * AABB（Axis-Aligned Bounding Box）コリジョン検出
     */
    static checkCollision(rect1, rect2) {
        return rect1.intersects(rect2);
    }

    /**
     * プレイヤーとプラットフォームのコリジョン検出
     */
    static checkPlatformCollision(player, platform) {
        const playerRect = new Rectangle(player.x, player.y, player.width, player.height);
        const platformRect = new Rectangle(platform.x, platform.y, platform.width, platform.height);
        
        if (!this.checkCollision(playerRect, platformRect)) {
            return { isOnGround: false, collision: null };
        }

        // プレイヤーがプラットフォームの上にいるかチェック
        const playerBottom = player.y + player.height;
        const platformTop = platform.y;
        const tolerance = 8; // 許容誤差を増加

        if (playerBottom <= platformTop + tolerance && player.velocity.y >= 0) {
            return { 
                isOnGround: true, 
                collision: { 
                    type: 'ground',
                    y: platformTop - player.height 
                }
            };
        }

        return { isOnGround: false, collision: null };
    }

    /**
     * プレイヤーと敵のコリジョン検出
     */
    static checkEnemyCollision(player, enemy) {
        const playerRect = new Rectangle(player.x, player.y, player.width, player.height);
        const enemyRect = new Rectangle(enemy.x, enemy.y, enemy.width, enemy.height);
        
        return this.checkCollision(playerRect, enemyRect);
    }

    /**
     * プレイヤーとコインのコリジョン検出
     */
    static checkCoinCollision(player, coin) {
        const playerRect = new Rectangle(player.x, player.y, player.width, player.height);
        const coinRect = new Rectangle(coin.x, coin.y, coin.width, coin.height);
        
        return this.checkCollision(playerRect, coinRect);
    }

    /**
     * プレイヤーとパワーアップのコリジョン検出
     */
    static checkPowerUpCollision(player, powerUp) {
        const playerRect = new Rectangle(player.x, player.y, player.width, player.height);
        const powerUpRect = new Rectangle(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
        
        return this.checkCollision(playerRect, powerUpRect);
    }
}

/**
 * アニメーション管理クラス
 */
class Animation {
    constructor(frames, frameDuration = 100) {
        this.frames = frames;
        this.frameDuration = frameDuration;
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.isPlaying = true;
        this.loop = true;
    }

    update(deltaTime) {
        if (!this.isPlaying) return;

        this.frameTimer += deltaTime;
        if (this.frameTimer >= this.frameDuration) {
            this.frameTimer = 0;
            this.currentFrame++;
            
            if (this.currentFrame >= this.frames.length) {
                if (this.loop) {
                    this.currentFrame = 0;
                } else {
                    this.currentFrame = this.frames.length - 1;
                    this.isPlaying = false;
                }
            }
        }
    }

    getCurrentFrame() {
        return this.frames[this.currentFrame];
    }

    reset() {
        this.currentFrame = 0;
        this.frameTimer = 0;
        this.isPlaying = true;
    }

    play() {
        this.isPlaying = true;
    }

    pause() {
        this.isPlaying = false;
    }
}

/**
 * 入力管理クラス
 */
class InputManager {
    constructor() {
        this.keys = {};
        this.touchControls = {
            left: false,
            right: false,
            jump: false
        };
        
        this.setupKeyboardEvents();
        this.setupTouchEvents();
    }

    setupKeyboardEvents() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    setupTouchEvents() {
        const leftBtn = document.getElementById('leftBtn');
        const rightBtn = document.getElementById('rightBtn');
        const jumpBtn = document.getElementById('jumpBtn');

        // DOM要素の存在チェック
        if (!leftBtn || !rightBtn || !jumpBtn) {
            console.warn('Touch control buttons not found, touch controls disabled');
            return;
        }

        // 左ボタン
        leftBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchControls.left = true;
        });
        leftBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchControls.left = false;
        });

        // 右ボタン
        rightBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchControls.right = true;
        });
        rightBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchControls.right = false;
        });

        // ジャンプボタン
        jumpBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.touchControls.jump = true;
        });
        jumpBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touchControls.jump = false;
        });

        // マウスイベント（デスクトップ用）
        leftBtn.addEventListener('mousedown', () => this.touchControls.left = true);
        leftBtn.addEventListener('mouseup', () => this.touchControls.left = false);
        leftBtn.addEventListener('mouseleave', () => this.touchControls.left = false);

        rightBtn.addEventListener('mousedown', () => this.touchControls.right = true);
        rightBtn.addEventListener('mouseup', () => this.touchControls.right = false);
        rightBtn.addEventListener('mouseleave', () => this.touchControls.right = false);

        jumpBtn.addEventListener('mousedown', () => this.touchControls.jump = true);
        jumpBtn.addEventListener('mouseup', () => this.touchControls.jump = false);
        jumpBtn.addEventListener('mouseleave', () => this.touchControls.jump = false);
    }

    isKeyPressed(keyCode) {
        return this.keys[keyCode] || false;
    }

    isTouchControlActive(control) {
        return this.touchControls[control] || false;
    }

    getMovementInput() {
        let left = this.isKeyPressed('ArrowLeft') || this.isKeyPressed('KeyA') || this.isTouchControlActive('left');
        let right = this.isKeyPressed('ArrowRight') || this.isKeyPressed('KeyD') || this.isTouchControlActive('right');
        let jump = this.isKeyPressed('Space') || this.isKeyPressed('ArrowUp') || this.isKeyPressed('KeyW') || this.isTouchControlActive('jump');

        // 左右の入力を同時に押した場合の処理（両方無効にする）
        if (left && right) {
            left = false;
            right = false;
        }

        return { left, right, jump };
    }

    /**
     * 最後に押された方向キーを取得
     */
    getLastPressedDirection() {
        if (this.isKeyPressed('ArrowLeft') || this.isKeyPressed('KeyA')) return 'left';
        if (this.isKeyPressed('ArrowRight') || this.isKeyPressed('KeyD')) return 'right';
        if (this.isTouchControlActive('left')) return 'left';
        if (this.isTouchControlActive('right')) return 'right';
        return null;
    }
}

/**
 * パーティクルシステム
 */
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    createParticle(x, y, color = '#FFD700', velocity = new Vector2(0, -5)) {
        this.particles.push({
            x: x,
            y: y,
            vx: velocity.x + (Math.random() - 0.5) * 4,
            vy: velocity.y + (Math.random() - 0.5) * 2,
            life: 1.0,
            maxLife: 1.0,
            color: color,
            size: Math.random() * 3 + 2
        });
    }

    update(deltaTime) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.1; // 重力
            particle.life -= deltaTime / 1000;
            
            if (particle.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        ctx.save();
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
}

/**
 * サウンド管理クラス（Web Audio API対応）
 */
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.enabled = true;
        this.masterVolume = 0.5;
        
        this.initAudioContext();
    }

    /**
     * Web Audio APIの初期化
     */
    initAudioContext() {
        try {
            // Web Audio APIのサポートチェック
            if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                this.audioContext = new AudioContextClass();
                console.log('Web Audio API initialized successfully');
            } else {
                console.warn('Web Audio API not supported');
            }
        } catch (error) {
            console.error('Failed to initialize Web Audio API:', error);
        }
    }

    /**
     * 音声ファイルの読み込み
     */
    async loadSound(name, url) {
        if (!this.audioContext) return;

        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.sounds[name] = audioBuffer;
            console.log(`Sound loaded: ${name}`);
        } catch (error) {
            console.error(`Failed to load sound ${name}:`, error);
        }
    }

    /**
     * 音声の再生
     */
    playSound(name, options = {}) {
        if (!this.enabled || !this.audioContext || !this.sounds[name]) {
            console.log(`Playing sound: ${name}`);
            return;
        }

        try {
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = this.sounds[name];
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 音量設定
            const volume = options.volume !== undefined ? options.volume : this.masterVolume;
            gainNode.gain.value = volume;
            
            // ループ設定
            if (options.loop) {
                source.loop = true;
            }
            
            source.start(0);
            console.log(`Playing sound: ${name}`);
        } catch (error) {
            console.error(`Failed to play sound ${name}:`, error);
        }
    }

    /**
     * 効果音の生成（Web Audio API使用）
     */
    generateSound(type, options = {}) {
        if (!this.enabled || !this.audioContext) return;

        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 音の種類に応じた設定
            switch (type) {
                case 'coin':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                    break;
                    
                case 'jump':
                    oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                    break;
                    
                case 'powerup':
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(1000, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    break;
                    
                case 'enemy_defeat':
                    oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(100, this.audioContext.currentTime + 0.3);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    break;
                    
                default:
                    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
            }
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + (options.duration || 0.1));
            
        } catch (error) {
            console.error(`Failed to generate sound ${type}:`, error);
        }
    }

    /**
     * 音量設定
     */
    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * サウンドの有効/無効切り替え
     */
    toggleSound() {
        this.enabled = !this.enabled;
        console.log(`Sound ${this.enabled ? 'enabled' : 'disabled'}`);
    }

    /**
     * オーディオコンテキストの再開（ブラウザの制限対応）
     */
    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
}

/**
 * ユーティリティ関数
 */
const Utils = {
    /**
     * 数値を指定範囲内に制限
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },

    /**
     * 線形補間
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },

    /**
     * ランダムな整数を生成
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    },

    /**
     * ランダムな浮動小数点数を生成
     */
    randomFloat(min, max) {
        return Math.random() * (max - min) + min;
    },

    /**
     * 2点間の距離を計算
     */
    distance(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * 角度をラジアンに変換
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    },

    /**
     * ラジアンを角度に変換
     */
    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
};
