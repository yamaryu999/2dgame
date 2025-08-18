/**
 * ユーティリティ関数とヘルパークラス
 * 物理演算、コリジョン検出、アニメーションなどの共通機能を提供
 */

// 物理定数
const PHYSICS = {
    GRAVITY: 0.5,          // 重力をさらに軽減
    FRICTION: 0.8,         // 摩擦を調整
    AIR_RESISTANCE: 0.98,  // 空中抵抗を緩和
    ACCELERATION: 0.4,     // 加速度を小さく（より滑らかに）
    DECELERATION: 0.6,     // 減速度を調整
    JUMP_FORCE: -15,       // ジャンプ力を大幅に向上
    MAX_FALL_SPEED: 12,    // 最大落下速度を調整
    MAX_SPEED: 4,          // 最大速度を下げて制御しやすく
    // 追加: アクション系
    DASH_SPEED: 10,
    WALL_SLIDE_SPEED: 2.5,
    WALL_JUMP_X: 6,
    MAGNET_RADIUS: 110
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
 * カラーパレット（色彩理論ベース: クール基調 + ウォームアクセント）
 * - ベースはインディゴ/シアン系（視認性と落ち着き）
 * - アクセントにアンバー（注目要素: コイン/無敵）
 * - 状態色はエメラルド/レッドで直感的に
 */
const PALETTE = {
    role: {
        primary: '#6366F1',          // Indigo-500
        secondary: '#06B6D4',        // Cyan-500
        accent: '#F59E0B',           // Amber-500
        success: '#10B981',          // Emerald-500
        danger: '#EF4444',           // Red-500
        outline: 'rgba(0,0,0,0.35)'
    },
    entity: {
        player: '#F59E0B',           // プレイヤー（温かみのある橙）
        coin: '#FBBF24',             // コイン（アンバー-400）
        powerJump: '#22C55E',        // ジャンプ強化（Green-500）
        powerInvincible: '#FBBF24'   // 無敵（ゴールド系）
    },
    enemy: {
        basic: ['#94A3B8', '#B0BEC5', '#94A3B8', '#64748B'],   // ブルーグレー系
        jumper: ['#34D399', '#6EE7B7', '#34D399', '#10B981'], // グリーン系（動きの軽快さ）
        chaser: ['#A78BFA', '#C4B5FD', '#A78BFA', '#8B5CF6'], // バイオレット系（俊敏）
        flyer: ['#60A5FA', '#93C5FD', '#06B6D4', '#0EA5E9'],  // ブルー/シアン（空）
        tank: ['#9CA3AF', '#6B7280', '#9CA3AF', '#4B5563']    // ニュートラルグレー（重厚）
    },
    platform: {
        normal: '#8B5E3C',
        moving: '#A06B42',
        breakableHigh: '#CD853F',
        breakableLow: '#8B4513',
        ice: '#93C5FD',
        mud: '#6B4F3A',
        bounce: '#22C55E',
        spike: '#EF4444'
    },
    background: {
        day: ['#E0F2FE', '#BAE6FD'],
        breeze: ['#CCFBF1', '#A7F3D0'],
        snow: ['#E6F0FF', '#F8FBFF'],
        swamp: ['#D1FAE5', '#A7F3D0'],
        volcano: ['#FDE68A', '#FDBA74'],
        night: ['#0B1220', '#111827'],
        dusk: ['#FDE1D3', '#C7D2FE']
    }
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
        // NaN/Infinity混入の被害を抑えるためのサニタイズ
        const toNum = (v, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
        this.x = toNum(x, 0);
        this.y = toNum(y, 0);
        this.width = Math.max(0, toNum(width, 0));
        this.height = Math.max(0, toNum(height, 0));
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
        
        // 前フレーム位置（速度から逆算）
        const prevX = player.x - player.velocity.x;
        const prevY = player.y - player.velocity.y;
        const prevBottom = prevY + player.height;
        const currentBottom = player.y + player.height;
        const platformTop = platform.y;
        const currentHorizOverlap = playerRect.right > platformRect.left && playerRect.left < platformRect.right;
        const prevHorizOverlap = (prevX + player.width) > platformRect.left && prevX < platformRect.right;

        // 衝突矩形が重ならない場合でも、前フレームから今フレームで床の上面を跨いだら着地とみなす
        if (!this.checkCollision(playerRect, platformRect)) {
            if (player.velocity.y >= 0 && prevBottom <= platformTop && currentBottom >= platformTop && (currentHorizOverlap || prevHorizOverlap)) {
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

        // プレイヤーがプラットフォームの上にいるかチェック
        const playerBottom = player.y + player.height;
        // 許容誤差を落下速度に応じて自動拡大（最大落下速度に基づく）
        const dynamicTolerance = Math.max(8, Math.abs(player.velocity.y)) + 2;

        // 前フレームが床上面より上、かつ現在は床上面近傍以下（上からの接触）
        if (player.velocity.y >= 0 && prevBottom <= platformTop + dynamicTolerance && playerBottom <= platformTop + dynamicTolerance) {
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
        // 無効サイズ（幅/高さゼロ）やNaNが来た時は衝突にしない
        if (playerRect.width <= 0 || playerRect.height <= 0 || enemyRect.width <= 0 || enemyRect.height <= 0) {
            return false;
        }
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
            jump: false,
            down: false,
            dash: false
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
        let down = this.isKeyPressed('ArrowDown') || this.isKeyPressed('KeyS') || this.isTouchControlActive('down');
        // ダッシュはShiftでトグル（モバイルは現状なし）
        let dash = this.isKeyPressed('ShiftLeft') || this.isKeyPressed('ShiftRight') || this.isTouchControlActive('dash');

        // 左右の入力を同時に押した場合の処理（両方無効にする）
        if (left && right) {
            left = false;
            right = false;
        }

        return { left, right, jump, down, dash };
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
        // 発光（加算合成）
        ctx.globalCompositeOperation = 'lighter';
        this.particles.forEach(particle => {
            const alpha = particle.life / particle.maxLife;
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = particle.size * 1.5;
            ctx.shadowColor = particle.color;
            ctx.fillStyle = particle.color;
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            ctx.fill();
        });
        // 後始末
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
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
    },

    /**
     * 安全なラジアルグラデーション生成（非有限値・半径不正をガード）
     */
    createSafeRadialGradient(ctx, x0, y0, r0, x1, y1, r1) {
        const toNum = (v, def = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : def);
        let _x0 = toNum(x0, 0);
        let _y0 = toNum(y0, 0);
        let _r0 = toNum(r0, 1);
        let _x1 = toNum(x1, 0);
        let _y1 = toNum(y1, 0);
        let _r1 = toNum(r1, _r0 + 1);
        if (!Number.isFinite(_r0) || _r0 <= 0) _r0 = 1;
        if (!Number.isFinite(_r1) || _r1 <= _r0) _r1 = _r0 + 1;
        try {
            return ctx.createRadialGradient(_x0, _y0, _r0, _x1, _y1, _r1);
        } catch (e) {
            // 失敗時は線形でフォールバックして描画継続
            const lg = ctx.createLinearGradient(0, 0, 0, 1);
            lg.addColorStop(0, 'rgba(0,0,0,0)');
            lg.addColorStop(1, 'rgba(0,0,0,0)');
            return lg;
        }
    }
};

// アニメーション用Easing関数集
const Easings = {
    linear(t) { return t; },
    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); },
    easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    easeOutBack(t, s = 1.70158) {
        const u = t - 1;
        return 1 + (s + 1) * (u * u * u) + s * (u * u);
    },
    easeOutElastic(t) {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
};
