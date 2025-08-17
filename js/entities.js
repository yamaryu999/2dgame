/**
 * ゲームエンティティクラス
 * プレイヤー、敵、コイン、プラットフォームなどのゲームオブジェクトを定義
 */

/**
 * プレイヤークラス
 */
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 32;
        this.height = 32;
        this.velocity = new Vector2(0, 0);
        this.isOnGround = false;
        this.facingRight = true;
        this.lives = 3;
        this.score = 0;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.jumpPressed = false;  // ジャンプボタンの状態
        
        // パワーアップ状態
        this.powerUps = {
            jumpBoost: false,
            jumpBoostTime: 0,
            invincible: false,
            invincibleTime: 0
        };
        
        this.animation = this.createAnimation();
        this.particleSystem = new ParticleSystem();

        // 祝福アニメーション状態
        this.celebrate = {
            active: false,
            timer: 0,
            duration: 2000,
            wave: 0
        };
    }

    createAnimation() {
        // プレイヤーのアニメーションフレーム（簡易版）
        const frames = [
            { color: '#4A90E2', offset: 0 },
            { color: '#4A90E2', offset: 2 },
            { color: '#4A90E2', offset: 0 },
            { color: '#4A90E2', offset: -2 }
        ];
        return new Animation(frames, 150);
    }

    /**
     * 改善された水平移動処理
     */
    handleHorizontalMovement(input, deltaTime) {
        const targetSpeed = GAME_CONFIG.PLAYER_SPEED;
        const acceleration = PHYSICS.ACCELERATION * (deltaTime / (1000 / GAME_CONFIG.FPS) || 1);
        const deceleration = PHYSICS.DECELERATION * (deltaTime / (1000 / GAME_CONFIG.FPS) || 1);
        
        // 左右の入力に応じて目標速度を設定
        let targetVelocityX = 0;
        
        if (input.left) {
            targetVelocityX = -targetSpeed;
            this.facingRight = false;
        } else if (input.right) {
            targetVelocityX = targetSpeed;
            this.facingRight = true;
        }
        
        // 現在の速度を目標速度に向けて徐々に調整
        if (targetVelocityX !== 0) {
            // 入力がある場合：目標速度に向けて加速
            if (this.velocity.x < targetVelocityX) {
                this.velocity.x += acceleration;
                if (this.velocity.x > targetVelocityX) {
                    this.velocity.x = targetVelocityX;
                }
            } else if (this.velocity.x > targetVelocityX) {
                this.velocity.x -= acceleration;
                if (this.velocity.x < targetVelocityX) {
                    this.velocity.x = targetVelocityX;
                }
            }
        } else {
            // 入力がない場合：徐々に減速
            if (this.velocity.x > 0) {
                this.velocity.x -= deceleration;
                if (this.velocity.x < 0) this.velocity.x = 0;
            } else if (this.velocity.x < 0) {
                this.velocity.x += deceleration;
                if (this.velocity.x > 0) this.velocity.x = 0;
            }
        }
        
        // 最大速度を制限（より厳密に）
        this.velocity.x = Utils.clamp(this.velocity.x, -PHYSICS.MAX_SPEED, PHYSICS.MAX_SPEED);
        
        // 入力がない時のみ摩擦/空気抵抗を適用（暴走防止）
        if (targetVelocityX === 0) {
        if (this.isOnGround) {
            this.velocity.x *= PHYSICS.FRICTION;
        } else {
            this.velocity.x *= PHYSICS.AIR_RESISTANCE;
            }
        }
        
        // 極小速度の場合は0にする
        if (Math.abs(this.velocity.x) < 0.05) {
            this.velocity.x = 0;
        }
    }

    /**
     * 改善されたジャンプ処理
     */
    handleJump(input) {
        // ジャンプ開始
        if (input.jump && this.isOnGround && !this.jumpPressed) {
            // パワーアップ状態に応じてジャンプ力を調整
            let jumpForce = PHYSICS.JUMP_FORCE;
            if (this.powerUps.jumpBoost) {
                jumpForce *= 1.5; // ジャンプ力1.5倍
            }
            
            this.velocity.y = jumpForce;
            this.isOnGround = false;
            this.jumpPressed = true;
            
            // ジャンプエフェクト（パワーアップ状態に応じて色を変更）
            const effectColor = this.powerUps.jumpBoost ? '#00FF00' : '#FFD700';
            this.particleSystem.createParticle(
                this.x + this.width / 2, 
                this.y + this.height, 
                effectColor
            );
        }
        
        // ジャンプボタンを離した時の処理
        if (!input.jump) {
            this.jumpPressed = false;
            
            // 短押しジャンプ（ボタンを早く離すと低いジャンプ）- より緩やかに調整
            if (this.velocity.y < 0) {
                this.velocity.y *= 0.7;
            }
        }
    }

    /**
     * パワーアップ状態の更新
     */
    updatePowerUps(deltaTime) {
        // ジャンプ力向上の更新
        if (this.powerUps.jumpBoost) {
            this.powerUps.jumpBoostTime -= deltaTime;
            if (this.powerUps.jumpBoostTime <= 0) {
                this.powerUps.jumpBoost = false;
                this.powerUps.jumpBoostTime = 0;
            }
        }

        // 無敵状態の更新
        if (this.powerUps.invincible) {
            this.powerUps.invincibleTime -= deltaTime;
            if (this.powerUps.invincibleTime <= 0) {
                this.powerUps.invincible = false;
                this.powerUps.invincibleTime = 0;
            }
        }
    }

    update(deltaTime, platforms, enemies, coins, powerUps, inputManager) {
        // アニメーション更新
        this.animation.update(deltaTime);

        // 入力処理（エラーハンドリング付き）
        let input = { left: false, right: false, jump: false };
        try {
            if (inputManager && typeof inputManager.getMovementInput === 'function') {
                input = inputManager.getMovementInput();
            } else {
                console.warn('InputManager not properly initialized');
            }
        } catch (error) {
            console.error('Error getting movement input:', error);
        }
        
        // 改善された水平移動システム
        this.handleHorizontalMovement(input, deltaTime);

        // 改善されたジャンプシステム
        this.handleJump(input);

        // 重力適用
        this.velocity.y += PHYSICS.GRAVITY;
        this.velocity.y = Utils.clamp(this.velocity.y, -20, PHYSICS.MAX_FALL_SPEED);

        // 位置更新
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // プラットフォームコリジョン（境界チェックより先に実行）
        this.checkPlatformCollisions(platforms);

        // 境界チェック（最後に実行）
        this.checkBounds();

        // 敵とのコリジョン
        this.checkEnemyCollisions(enemies);

        // コイン収集
        this.collectCoins(coins);

        // パワーアップ収集
        this.collectPowerUps(powerUps);

        // 無敵時間更新
        if (this.invulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }

        // パワーアップ時間更新
        this.updatePowerUps(deltaTime);

        // パーティクル更新
        this.particleSystem.update(deltaTime);
    }

    /**
     * 祝福アニメーション開始
     */
    startCelebration(durationMs) {
        this.celebrate.active = true;
        this.celebrate.timer = 0;
        this.celebrate.duration = durationMs || 2000;
        this.celebrate.wave = 0;
        // 停止させる
        this.velocity.x = 0;
        // 小さな花びらパーティクル
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const v = new Vector2(Math.cos(angle) * 1.2, Math.sin(angle) * -0.6 - 0.5);
            this.particleSystem.createParticle(this.x + this.width / 2, this.y + this.height / 2, '#FDE68A', v);
        }
    }

    /**
     * 祝福アニメーション更新（ゲーム側のクリア演出中に呼ばれる）
     */
    updateCelebrate(deltaTime) {
        if (!this.celebrate.active) return;
        this.celebrate.timer += deltaTime;
        this.celebrate.wave += deltaTime * 0.02;
        if (this.celebrate.timer >= this.celebrate.duration) {
            this.celebrate.active = false;
        }
        // パーティクルも更新
        this.particleSystem.update(deltaTime);
    }

    checkBounds() {
        // 左右の境界（より自然な処理）
        const worldWidth = (typeof window !== 'undefined' && window.game && typeof window.game.getCurrentStageWidth === 'function')
            ? window.game.getCurrentStageWidth()
            : GAME_CONFIG.CANVAS_WIDTH;

        if (this.x < 0) {
            this.x = 0;
            // 壁に当たった時の自然な停止
            if (this.velocity.x < 0) {
                this.velocity.x = 0;
            }
        } else if (this.x + this.width > worldWidth) {
            this.x = worldWidth - this.width;
            // 壁に当たった時の自然な停止
            if (this.velocity.x > 0) {
                this.velocity.x = 0;
            }
        }

        // 下の境界（落下判定）- より厳密に
        if (this.y > GAME_CONFIG.CANVAS_HEIGHT + 50) {
            this.takeDamage();
        }
    }

    checkPlatformCollisions(platforms) {
        this.isOnGround = false;
        
        if (!platforms || !Array.isArray(platforms)) return;
        
        platforms.forEach(platform => {
            if (!platform) return;
            
            const collision = CollisionDetector.checkPlatformCollision(this, platform);
            
            if (collision.isOnGround) {
                this.isOnGround = true;
                // より正確な位置修正
                this.y = Math.min(this.y, collision.collision.y);
                this.velocity.y = 0;
            }
        });
    }

    checkEnemyCollisions(enemies) {
        // 無敵状態のチェック（通常の無敵時間とパワーアップ無敵状態の両方をチェック）
        if (this.invulnerable || this.powerUps.invincible) return;

        // 配列の存在チェック
        if (!enemies || !Array.isArray(enemies)) return;

        enemies.forEach(enemy => {
            if (enemy && !enemy.isDead && CollisionDetector.checkEnemyCollision(this, enemy)) {
                // プレイヤーが敵の上にいる場合（敵を倒す）
                if (this.velocity.y > 0 && this.y < enemy.y) {
                    this.defeatEnemy(enemy);
                } else {
                    // プレイヤーがダメージを受ける
                    this.takeDamage();
                }
            }
        });
    }

    collectCoins(coins) {
        if (!coins || !Array.isArray(coins)) return;
        
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            if (coin && !coin.collected && CollisionDetector.checkCoinCollision(this, coin)) {
                this.score += 10;
                coin.collected = true; // 収集済みフラグを設定
                coins.splice(i, 1);
                
                // コイン収集エフェクト
                this.createCoinCollectionEffect();
            }
        }
    }

    /**
     * パワーアップ収集
     */
    collectPowerUps(powerUps) {
        if (!powerUps || !Array.isArray(powerUps)) {
            return;
        }
        
        for (let i = powerUps.length - 1; i >= 0; i--) {
            const powerUp = powerUps[i];
            
            // パワーアップアイテムの存在チェック
            if (!powerUp || typeof powerUp !== 'object') {
                continue;
            }
            
            if (CollisionDetector.checkPowerUpCollision(this, powerUp)) {
                try {
                    // パワーアップの種類を保存（削除前に取得）
                    const powerUpType = powerUp.type || 'unknown';
                    
                    this.applyPowerUp(powerUp);
                    powerUps.splice(i, 1);
                    
                    // パワーアップ収集エフェクト
                    this.createPowerUpCollectionEffect(powerUpType);
                } catch (error) {
                    console.error('Error collecting power-up:', error);
                }
            }
        }
    }

    /**
     * パワーアップ効果の適用
     */
    applyPowerUp(powerUp) {
        if (!powerUp || !powerUp.type) {
            console.warn('Invalid power-up object:', powerUp);
            return;
        }
        
        try {
            if (powerUp.type === 'jump') {
                this.powerUps.jumpBoost = true;
                this.powerUps.jumpBoostTime = 10000; // 10秒間
            } else if (powerUp.type === 'invincible') {
                this.powerUps.invincible = true;
                this.powerUps.invincibleTime = 8000; // 8秒間
            } else {
                console.warn('Unknown power-up type:', powerUp.type);
            }
        } catch (error) {
            console.error('Error applying power-up:', error);
        }
    }

    /**
     * コイン収集エフェクト
     */
    createCoinCollectionEffect() {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const velocity = new Vector2(
                Math.cos(angle) * 3,
                Math.sin(angle) * 3
            );
            this.particleSystem.createParticle(
                this.x + this.width / 2,
                this.y + this.height / 2,
                '#FFD700',
                velocity
            );
        }
    }

    /**
     * パワーアップ収集エフェクト
     */
    createPowerUpCollectionEffect(type) {
        try {
            const color = type === 'jump' ? '#00FF00' : '#FFD700';
            const particleCount = type === 'jump' ? 12 : 15;
            
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2;
                const velocity = new Vector2(
                    Math.cos(angle) * 4,
                    Math.sin(angle) * 4
                );
                this.particleSystem.createParticle(
                    this.x + this.width / 2,
                    this.y + this.height / 2,
                    color,
                    velocity
                );
            }
        } catch (error) {
            console.error('Error creating power-up collection effect:', error);
        }
    }

    takeDamage() {
        // 無敵状態のチェック（通常の無敵時間とパワーアップ無敵状態の両方をチェック）
        if (this.invulnerable || this.powerUps.invincible) return;
        
        this.lives--;
        this.invulnerable = true;
        this.invulnerableTime = 2000; // 2秒間無敵
        
        // プレイヤーを初期位置にリセット（ライフが残っている場合）
        if (this.lives > 0) {
            this.x = 100;
            this.y = 500;
            this.velocity = new Vector2(0, 0);
            this.isOnGround = false;
        }
        
        // ダメージエフェクト
        for (let i = 0; i < 10; i++) {
            this.particleSystem.createParticle(
                this.x + this.width / 2, 
                this.y + this.height / 2, 
                '#FF4444'
            );
        }
    }

    defeatEnemy(enemy) {
        this.velocity.y = PHYSICS.JUMP_FORCE * 0.7; // 小さなジャンプ
        this.score += 20;
        
        // 敵撃破エフェクト
        this.createEnemyDefeatEffect(enemy);
        // 敵を撃破状態にする
        if (enemy) {
            enemy.isDead = true;
        }
    }

    /**
     * 敵撃破エフェクト
     */
    createEnemyDefeatEffect(enemy) {
        // 爆発エフェクト
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const velocity = new Vector2(
                Math.cos(angle) * (Math.random() * 3 + 2),
                Math.sin(angle) * (Math.random() * 3 + 2)
            );
            this.particleSystem.createParticle(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2,
                '#FF6B6B',
                velocity
            );
        }
        
        // スコアエフェクト
        for (let i = 0; i < 5; i++) {
            this.particleSystem.createParticle(
                enemy.x + enemy.width / 2,
                enemy.y + enemy.height / 2 - 20,
                '#FFD700',
                new Vector2((Math.random() - 0.5) * 4, -2)
            );
        }
    }

    render(ctx) {
        ctx.save();
        
        // 無敵時間中の点滅効果
        if ((this.invulnerable && Math.floor(this.invulnerableTime / 100) % 2 === 0) ||
            (this.powerUps.invincible && Math.floor(this.powerUps.invincibleTime / 100) % 2 === 0)) {
            ctx.globalAlpha = 0.5;
        }

        // プレイヤーの描画
        const frame = this.animation.getCurrentFrame();
        // 猫らしいベースカラー（デフォルトはオレンジ系）
        let playerColor = '#F4A261';
        
        // パワーアップ状態に応じて色を変更
        if (this.powerUps.jumpBoost) {
            playerColor = '#00FF00'; // 緑色（ジャンプ力向上）
        } else if (this.powerUps.invincible) {
            playerColor = '#FFD700'; // 金色（無敵状態）
        }
        
        ctx.fillStyle = playerColor;
        
        // 向きに応じて反転（プレイヤー中心を基準に反転）
        if (!this.facingRight) {
            const centerX = this.x + this.width / 2;
            ctx.translate(centerX, 0);
            ctx.scale(-1, 1);
            ctx.translate(-centerX, 0);
        }
        
        // 猫キャラクターの描画（当たり判定サイズは維持）
        const x = this.x;
        // 祝福中は上下に軽くバウンド
        const celebrateOffset = this.celebrate.active ? Math.sin(this.celebrate.wave * Math.PI * 2) * -3 : 0;
        const y = this.y + frame.offset + celebrateOffset;
        const w = this.width;
        const h = this.height;

        // 尻尾（曲線）
        ctx.strokeStyle = '#D17C45';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x + w - 2, y + h * 0.6);
        ctx.quadraticCurveTo(x + w + 10, y + h * 0.5, x + w + 14, y + h * 0.2);
        ctx.stroke();

        // 体（楕円）
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 耳（三角形） - 祝福中は少し傾ける
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, y + h * 0.15 + (this.celebrate.active ? -1 : 0));
        ctx.lineTo(x + w * 0.35, y + h * 0.05 + (this.celebrate.active ? -2 : 0));
        ctx.lineTo(x + w * 0.35, y + h * 0.25);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + w * 0.8, y + h * 0.15 + (this.celebrate.active ? -1 : 0));
        ctx.lineTo(x + w * 0.65, y + h * 0.05 + (this.celebrate.active ? -2 : 0));
        ctx.lineTo(x + w * 0.65, y + h * 0.25);
        ctx.closePath();
        ctx.fill();

        // 顔（目・ひげ）
        const eyeY = y + h * 0.38;
        if (this.celebrate.active) {
            // にっこり目（^ ^）
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x + w * 0.4, eyeY, 3, Math.PI * 0.15, Math.PI * 0.85);
            ctx.arc(x + w * 0.6, eyeY, 3, Math.PI * 0.15, Math.PI * 0.85);
            ctx.stroke();
        } else {
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.arc(x + w * 0.4, eyeY, 3, 0, Math.PI * 2);
            ctx.arc(x + w * 0.6, eyeY, 3, 0, Math.PI * 2);
            ctx.fill();
        }

        // 鼻
        ctx.fillStyle = '#E76F51';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, eyeY + 5, 2, 0, Math.PI * 2);
        ctx.fill();

        // ひげ
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.35, eyeY + 6);
        ctx.lineTo(x + w * 0.18, eyeY + 4);
        ctx.moveTo(x + w * 0.35, eyeY + 8);
        ctx.lineTo(x + w * 0.18, eyeY + 10);
        ctx.moveTo(x + w * 0.65, eyeY + 6);
        ctx.lineTo(x + w * 0.82, eyeY + 4);
        ctx.moveTo(x + w * 0.65, eyeY + 8);
        ctx.lineTo(x + w * 0.82, eyeY + 10);
        ctx.stroke();

        // 祝福中の両手を上げる演出（小さな肉球）
        if (this.celebrate.active) {
            ctx.fillStyle = '#F5CBA7';
            const pawY = y + h * 0.2 + Math.sin(this.celebrate.wave * 8) * 2;
            ctx.beginPath();
            ctx.arc(x + w * 0.25, pawY, 3, 0, Math.PI * 2);
            ctx.arc(x + w * 0.75, pawY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
        
        // パーティクル描画
        this.particleSystem.render(ctx);
    }

    reset(x, y) {
        this.x = x || 100;
        this.y = y || 500;
        this.velocity = new Vector2(0, 0);
        this.isOnGround = false;
        this.facingRight = true;
        this.lives = 3;
        this.score = 0;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.jumpPressed = false;
        
        // パワーアップ状態をリセット
        this.powerUps = {
            jumpBoost: false,
            jumpBoostTime: 0,
            invincible: false,
            invincibleTime: 0
        };
        
        if (this.animation && typeof this.animation.reset === 'function') {
            this.animation.reset();
        }
        
        if (this.particleSystem) {
            this.particleSystem.particles = [];
        }
    }
}

/**
 * 敵クラス
 */
class Enemy {
    constructor(x, y, type = 'basic') {
        this.x = x;
        this.y = y;
        this.width = 24;
        this.height = 24;
        this.velocity = new Vector2(-GAME_CONFIG.ENEMY_SPEED, 0);
        this.type = type;
        this.direction = -1; // -1: 左, 1: 右
        this.patrolDistance = 100;
        this.startX = x;
        this.animation = this.createAnimation();
        this.isDead = false;
    }

    createAnimation() {
        // ネズミ風のグレーカラー
        const frames = [
            { color: '#A3A7AE', offset: 0 },
            { color: '#B5BAC3', offset: 0 },
            { color: '#A3A7AE', offset: 0 },
            { color: '#8F949C', offset: 0 }
        ];
        return new Animation(frames, 200);
    }

    update(deltaTime, platforms) {
        if (this.isDead) return;

        this.animation.update(deltaTime);

        // パトロール移動
        this.x += this.velocity.x * this.direction;

        // パトロール範囲チェック
        if (this.x <= this.startX - this.patrolDistance || 
            this.x >= this.startX + this.patrolDistance) {
            this.direction *= -1;
        }

        // 重力適用
        this.velocity.y += PHYSICS.GRAVITY;
        this.velocity.y = Utils.clamp(this.velocity.y, -10, PHYSICS.MAX_FALL_SPEED);

        this.y += this.velocity.y;

        // プラットフォームコリジョン
        this.checkPlatformCollisions(platforms);

        // 境界チェック
        this.checkBounds();
    }

    checkPlatformCollisions(platforms) {
        if (!platforms || !Array.isArray(platforms)) return;
        
        platforms.forEach(platform => {
            if (!platform) return;
            
            const collision = CollisionDetector.checkPlatformCollision(this, platform);
            
            if (collision.isOnGround) {
                this.y = collision.collision.y;
                this.velocity.y = 0;
            }
        });
    }

    checkBounds() {
        // 左右の境界
        const worldWidth = (typeof window !== 'undefined' && window.game && typeof window.game.getCurrentStageWidth === 'function')
            ? window.game.getCurrentStageWidth()
            : GAME_CONFIG.CANVAS_WIDTH;

        if (this.x < 0) {
            this.x = 0;
            this.direction = 1;
        } else if (this.x + this.width > worldWidth) {
            this.x = worldWidth - this.width;
            this.direction = -1;
        }

        // 下の境界（落下判定）
        if (this.y > GAME_CONFIG.CANVAS_HEIGHT) {
            this.isDead = true;
        }
    }

    render(ctx) {
        if (this.isDead) return;

        const frame = this.animation.getCurrentFrame();
        const x = this.x;
        const y = this.y + frame.offset;
        const w = this.width;
        const h = this.height;

        // 体（楕円）
        ctx.fillStyle = frame.color;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 耳
        ctx.fillStyle = '#C0C4CC';
        ctx.beginPath();
        ctx.arc(x + w * 0.3, y + h * 0.25, 4, 0, Math.PI * 2);
        ctx.arc(x + w * 0.7, y + h * 0.25, 4, 0, Math.PI * 2);
        ctx.fill();

        // 目
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(x + w * 0.4, y + h * 0.45, 2, 0, Math.PI * 2);
        ctx.arc(x + w * 0.6, y + h * 0.45, 2, 0, Math.PI * 2);
        ctx.fill();

        // 鼻
        ctx.fillStyle = '#D87C7C';
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.55, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // しっぽ
        ctx.strokeStyle = '#8F949C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.8, y + h * 0.6);
        ctx.quadraticCurveTo(x + w + 6, y + h * 0.5, x + w + 10, y + h * 0.4);
        ctx.stroke();
    }
}

/**
 * コインクラス
 */
class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 16;
        this.height = 16;
        this.animation = this.createAnimation();
        this.collected = false;
    }

    createAnimation() {
        const frames = [
            { scale: 1.0, rotation: 0 },
            { scale: 1.1, rotation: 45 },
            { scale: 1.0, rotation: 90 },
            { scale: 1.1, rotation: 135 },
            { scale: 1.0, rotation: 180 },
            { scale: 1.1, rotation: 225 },
            { scale: 1.0, rotation: 270 },
            { scale: 1.1, rotation: 315 }
        ];
        return new Animation(frames, 100);
    }

    update(deltaTime) {
        if (this.collected) return;
        this.animation.update(deltaTime);
    }

    render(ctx) {
        if (this.collected) return;

        const frame = this.animation.getCurrentFrame();
        
        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
        ctx.rotate(Utils.toRadians(frame.rotation));
        ctx.scale(frame.scale, frame.scale);
        
        // 魚トークンの描画
        const bodyW = this.width * 0.8;
        const bodyH = this.height * 0.45;
        
        // 身体（楕円）
        ctx.fillStyle = '#FFD166';
        ctx.beginPath();
        ctx.ellipse(0, 0, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // 尾ビレ（三角形）
        ctx.beginPath();
        ctx.moveTo(bodyW / 2, 0);
        ctx.lineTo(bodyW / 2 + 8, 5);
        ctx.lineTo(bodyW / 2 + 8, -5);
        ctx.closePath();
        ctx.fill();
        
        // 背ビレ・腹ビレ
        ctx.beginPath();
        ctx.moveTo(-4, -bodyH / 2);
        ctx.lineTo(4, -bodyH / 2 - 6);
        ctx.lineTo(8, -bodyH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(0, bodyH / 2);
        ctx.lineTo(6, bodyH / 2 + 6);
        ctx.lineTo(10, bodyH / 2);
        ctx.closePath();
        ctx.fill();

        // 目
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(-bodyW * 0.25, -1, 1.6, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

/**
 * プラットフォームクラス
 */
class Platform {
    constructor(x, y, width, height, type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.type = type; // 'normal', 'moving', 'breakable'
        this.originalX = x;
        this.originalY = y;
        // デフォルトで移動距離と速度を設定（moving の場合に利用）
        this.moveDistance = 50;
        this.moveSpeed = 0.001; // sin に掛ける時間係数として使用
        this.health = type === 'breakable' ? 3 : Infinity;
    }

    update(deltaTime) {
        if (this.type === 'moving') {
            // 移動プラットフォーム
            this.x = this.originalX + Math.sin(Date.now() * this.moveSpeed) * this.moveDistance;
        }
    }

    render(ctx) {
        let color;
        switch (this.type) {
            case 'normal':
                color = '#8B4513';
                break;
            case 'moving':
                color = '#A0522D';
                break;
            case 'breakable':
                color = this.health > 1 ? '#CD853F' : '#8B4513';
                break;
            default:
                color = '#8B4513';
        }

        ctx.fillStyle = color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // プラットフォームの装飾
        ctx.fillStyle = '#654321';
        ctx.fillRect(this.x, this.y, this.width, 4);
        ctx.fillRect(this.x, this.y + this.height - 4, this.width, 4);
    }

    takeDamage() {
        if (this.type === 'breakable') {
            this.health--;
            return this.health <= 0;
        }
        return false;
    }
}

/**
 * パワーアップアイテムクラス
 */
class PowerUp {
    constructor(x, y, type = 'jump') {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = type; // 'jump', 'invincible'
        this.collected = false;
        this.animation = this.createAnimation();
        this.floatOffset = 0;
        this.floatSpeed = 0.05;
    }

    createAnimation() {
        const frames = [
            { scale: 1.0, alpha: 1.0 },
            { scale: 1.1, alpha: 0.8 },
            { scale: 1.0, alpha: 1.0 },
            { scale: 1.1, alpha: 0.8 }
        ];
        return new Animation(frames, 200);
    }

    update(deltaTime) {
        if (this.collected) return;
        
        this.animation.update(deltaTime);
        
        // 浮遊アニメーション
        this.floatOffset += this.floatSpeed;
    }

    render(ctx) {
        if (this.collected) return;

        const frame = this.animation.getCurrentFrame();
        const floatY = this.y + Math.sin(this.floatOffset) * 3;
        
        ctx.save();
        ctx.globalAlpha = frame.alpha;
        ctx.translate(this.x + this.width / 2, floatY + this.height / 2);
        ctx.scale(frame.scale, frame.scale);
        
        // パワーアップの種類に応じた描画（猫モチーフ）
        if (this.type === 'jump') {
            // 猫草（キャットニップ）の葉
            this.drawLeaf(ctx, 0, 0, 12);
        } else if (this.type === 'invincible') {
            // 鈴（首輪の鈴）
            this.drawBell(ctx, 0, 0, 10);
        }
        
        ctx.restore();
    }

    drawLeaf(ctx, cx, cy, size) {
        ctx.save();
        ctx.fillStyle = '#34D399';
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(cx, cy - size * 0.8);
        ctx.quadraticCurveTo(cx + size * 0.8, cy - size * 0.2, cx, cy + size * 0.8);
        ctx.quadraticCurveTo(cx - size * 0.8, cy - size * 0.2, cx, cy - size * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 葉脈
        ctx.beginPath();
        ctx.moveTo(cx, cy + size * 0.7);
        ctx.lineTo(cx, cy - size * 0.6);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + size * 0.35, cy - size * 0.15);
        ctx.moveTo(cx, cy + size * 0.1);
        ctx.lineTo(cx - size * 0.35, cy - size * 0.05);
        ctx.stroke();
        ctx.restore();
    }

    drawBell(ctx, cx, cy, radius) {
        ctx.save();
        // 本体
        const gold = '#FBBF24';
        const goldDark = '#D97706';
        ctx.fillStyle = gold;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        // 帯
        ctx.fillStyle = goldDark;
        ctx.fillRect(cx - radius * 0.8, cy - radius * 0.5, radius * 1.6, radius * 0.25);

        // 反射ハイライト
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // りん（舌）
        ctx.fillStyle = goldDark;
        ctx.beginPath();
        ctx.arc(cx, cy + radius * 0.6, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

/**
 * 背景クラス
 */
class Background {
    constructor() {
        this.clouds = this.generateClouds();
        this.parallaxOffset = 0;
    }

    generateClouds() {
        const clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: Utils.randomInt(0, GAME_CONFIG.CANVAS_WIDTH),
                y: Utils.randomInt(50, 200),
                width: Utils.randomInt(60, 120),
                height: Utils.randomInt(30, 60),
                speed: Utils.randomFloat(0.2, 0.5)
            });
        }
        return clouds;
    }

    update(deltaTime, playerVelocityX) {
        // パララックス効果
        this.parallaxOffset += playerVelocityX * 0.1;
        
        // 雲の移動
        this.clouds.forEach(cloud => {
            cloud.x -= cloud.speed;
            if (cloud.x + cloud.width < 0) {
                cloud.x = GAME_CONFIG.CANVAS_WIDTH;
                cloud.y = Utils.randomInt(50, 200);
            }
        });
    }

    render(ctx) {
        // 柔らかなパステル空
        const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, '#FFE5EC');   // 桜色
        gradient.addColorStop(1, '#CDEFFF');   // 水色
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

        // 肉球雲
        const drawPaw = (cx, cy, s) => {
            ctx.beginPath();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            // 肉球本体
            ctx.arc(cx, cy, s, 0, Math.PI * 2);
            // 指
            ctx.arc(cx - s, cy - s * 1.4, s * 0.45, 0, Math.PI * 2);
            ctx.arc(cx, cy - s * 1.6, s * 0.45, 0, Math.PI * 2);
            ctx.arc(cx + s, cy - s * 1.4, s * 0.45, 0, Math.PI * 2);
            ctx.fill();
        };

        this.clouds.forEach(cloud => {
            drawPaw(cloud.x, cloud.y, Math.min(cloud.width, cloud.height) / 3);
        });
    }
}
