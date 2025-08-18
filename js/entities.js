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
        
        // 接地猶予＆ジャンプバッファ（ms）
        this.coyoteTime = 0;
        this.coyoteTimeMax = 120;
        this.jumpBuffer = 0;
        this.jumpBufferMax = 120;

        // 二段ジャンプ（空中での追加ジャンプ回数）
        this.maxAirJumps = 1;
        this.airJumpsRemaining = this.maxAirJumps;
        
        // ダッシュ
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldownTimer = 0;
        this.dashDurationMs = 180;
        this.dashCooldownMs = 700;
        this.dashSpeed = (typeof PHYSICS !== 'undefined' && PHYSICS.DASH_SPEED) ? PHYSICS.DASH_SPEED : 10;
        this.dashDirection = 1; // 1: 右, -1: 左

        // 壁スライド/壁ジャンプ
        this.isTouchingWallLeft = false;
        this.isTouchingWallRight = false;
        this.isWallSliding = false;
        this.wallJumpLockTimer = 0;
        
        // パワーアップ状態
        this.powerUps = {
            jumpBoost: false,
            jumpBoostTime: 0,
            invincible: false,
            invincibleTime: 0,
            dash: false,
            dashTime: 0,
            magnet: false,
            magnetTime: 0
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

        // 尻尾アニメーション状態
        this.tailAnimation = {
            phase: 0,
            amplitude: 2 // ピクセル単位の振幅
        };

        // 体バウンス・耳ゆれ・体の傾き
        this.bodyAnimation = { phase: 0, amplitude: 1.5 };
        this.earAnimation = { phase: 0, amplitude: 1.5 };
        this.bodyTiltAngle = 0; // ラジアン

        // 接地面の摩擦係数スケール（床タイプで更新）
        this.surfaceFrictionScale = 1.0;

        // 表現: 状態管理・補間・アンティシペーション
        this.state = 'idle';
        this.prevState = 'idle';
        this.stateTime = 0;
        this.squash = { x: 1, y: 1 };
        this.anticipation = { jumpTimer: 0, dashTimer: 0 };
        // アイドル微動
        this.idleAnim = { breath: 0, blinkTimer: Utils.randomInt(1400, 2800), blinking: false, blinkPhase: 0 };
    }

    createAnimation() {
        // プレイヤーのアニメーションフレーム（簡易版）
        const base = (typeof PALETTE !== 'undefined' && PALETTE.entity) ? PALETTE.entity.player : '#F4A261';
        const frames = [
            { color: base, offset: 0 },
            { color: base, offset: 2 },
            { color: base, offset: 0 },
            { color: base, offset: -2 }
        ];
        return new Animation(frames, 150);
    }

    /**
     * 改善された水平移動処理
     */
    handleHorizontalMovement(input, deltaTime) {
        const targetSpeed = GAME_CONFIG.PLAYER_SPEED;
        const dtScale = (deltaTime / (1000 / GAME_CONFIG.FPS) || 1);
        const acceleration = PHYSICS.ACCELERATION * dtScale;
        const deceleration = PHYSICS.DECELERATION * dtScale;
        
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
                // 環境と床タイプを考慮した摩擦
                const env = (typeof window !== 'undefined' && window.game && window.game.environment) ? window.game.environment : null;
                const baseDamp = 1 - PHYSICS.FRICTION; // 例: 0.2
                const envScale = env ? env.frictionScale : 1.0;
                const totalDamp = baseDamp * envScale * this.surfaceFrictionScale;
                const effectiveFriction = 1 - Utils.clamp(totalDamp, 0, 0.9);
                this.velocity.x *= effectiveFriction;
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
    handleJump(input, deltaTime) {
        // タイマー更新
        this.coyoteTime = this.isOnGround ? this.coyoteTimeMax : Math.max(0, this.coyoteTime - deltaTime);
        if (input.jump) {
            this.jumpBuffer = this.jumpBufferMax;
        } else {
            this.jumpBuffer = Math.max(0, this.jumpBuffer - deltaTime);
        }

        // ジャンプ開始判定（地上/コヨーテ または 二段ジャンプ）
        const wantsJump = this.jumpBuffer > 0 && !this.jumpPressed;
        if (wantsJump) {
            const canGroundJump = (this.isOnGround || this.coyoteTime > 0);
            const canWallJump = this.isWallSliding;
            const canAirJump = !canGroundJump && !canWallJump && this.airJumpsRemaining > 0;
            if (canGroundJump || canWallJump || canAirJump) {
            // パワーアップ状態に応じてジャンプ力を調整
            let jumpForce = PHYSICS.JUMP_FORCE;
            if (this.powerUps.jumpBoost) {
                jumpForce *= 1.5; // ジャンプ力1.5倍
            }
            
            this.velocity.y = jumpForce;
            this.isOnGround = false;
            this.jumpPressed = true;
                this.coyoteTime = 0;
                this.jumpBuffer = 0;
                if (canWallJump) {
                    // 壁から離れる方向に速度付与
                    const away = this.isTouchingWallLeft ? 1 : (this.isTouchingWallRight ? -1 : (this.facingRight ? 1 : -1));
                    this.velocity.x = (typeof PHYSICS !== 'undefined' && PHYSICS.WALL_JUMP_X) ? PHYSICS.WALL_JUMP_X * away : 6 * away;
                    this.wallJumpLockTimer = 120; // しばらく壁再接触を無効
                    this.isWallSliding = false;
                } else if (canAirJump) {
                    this.airJumpsRemaining = Math.max(0, this.airJumpsRemaining - 1);
                }

                // ジャンプエフェクト（空中ジャンプは色を変える）
                const isAir = !canGroundJump && !canWallJump;
                const effectColor = isAir ? '#4FC3F7' : (this.powerUps.jumpBoost ? '#00FF00' : '#FFD700');
                this.particleSystem.createParticle(
                    this.x + this.width / 2, 
                    this.y + this.height, 
                    effectColor
                );

                // 簡易ジャンプSFX
                try { if (typeof window !== 'undefined' && window.game && window.game.soundManager) window.game.soundManager.generateSound('jump'); } catch (e) { /* noop */ }

                // アンティシペーション演出開始
                this.anticipation.jumpTimer = 120;
            }
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

    handleDash(input, deltaTime) {
        // 発動
        if (!this.isDashing && input.dash && this.dashCooldownTimer <= 0) {
            // 方向決定
            if (input.left) this.dashDirection = -1; else if (input.right) this.dashDirection = 1; else this.dashDirection = this.facingRight ? 1 : -1;
            this.isDashing = true;
            this.dashTimer = this.dashDurationMs * (this.powerUps.dash ? 1.3 : 1);
            // 初速
            this.velocity.x = this.dashSpeed * this.dashDirection;
            // 垂直速度を少し抑える
            if (this.velocity.y > 0) this.velocity.y *= 0.5;
        }
        // 継続中の挙動
        if (this.isDashing) {
            this.velocity.x = this.dashSpeed * this.dashDirection;
        }
        // クールダウン
        if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;
        if (this.isDashing) {
            this.dashTimer -= deltaTime;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
                this.dashCooldownTimer = this.dashCooldownMs * (this.powerUps.dash ? 0.5 : 1);
            }
        }
    }

    updateWallSlide(input, deltaTime) {
        // 入力方向に押し付けていて、空中で、接触中ならスライド
        const pressingLeftWall = this.isTouchingWallLeft && input.left;
        const pressingRightWall = this.isTouchingWallRight && input.right;
        this.isWallSliding = !this.isOnGround && (pressingLeftWall || pressingRightWall) && this.velocity.y > 0.05 && this.wallJumpLockTimer <= 0;
        if (this.isWallSliding) {
            const maxSlide = (typeof PHYSICS !== 'undefined' && PHYSICS.WALL_SLIDE_SPEED) ? PHYSICS.WALL_SLIDE_SPEED : 2.5;
            this.velocity.y = Math.min(this.velocity.y, maxSlide);
            // スライド中は接地扱いしない
            this.isOnGround = false;
        }
        // 次フレーム用に壁接触フラグをリセット（再検出）
        this.isTouchingWallLeft = false;
        this.isTouchingWallRight = false;
        if (this.wallJumpLockTimer > 0) this.wallJumpLockTimer -= deltaTime;
    }

    update(deltaTime, platforms, enemies, coins, powerUps, inputManager) {
        // アニメーション更新
        this.animation.update(deltaTime);

        // 入力処理（エラーハンドリング付き）
        let input = { left: false, right: false, jump: false, down: false, dash: false };
        try {
            if (inputManager && typeof inputManager.getMovementInput === 'function') {
                input = inputManager.getMovementInput();
            } else {
                console.warn('InputManager not properly initialized');
            }
        } catch (error) {
            console.error('Error getting movement input:', error);
        }
        
        // ダッシュ処理と水平移動
        this.handleDash?.(input, deltaTime);
        if (!this.isDashing) {
        this.handleHorizontalMovement(input, deltaTime);
        }

        // 改善されたジャンプシステム
        this.handleJump(input, deltaTime);

        // 重力適用（環境スケール）
        const env = (typeof window !== 'undefined' && window.game && window.game.environment) ? window.game.environment : null;
        const gravityScale = env ? env.gravityScale : 1.0;
        this.velocity.y += PHYSICS.GRAVITY * gravityScale;
        this.velocity.y = Utils.clamp(this.velocity.y, -20, PHYSICS.MAX_FALL_SPEED);

        // 風（環境）
        const windX = env ? env.windX : 0;
        const dtScale = (deltaTime / (1000 / GAME_CONFIG.FPS) || 1);
        if (windX !== 0) {
            this.velocity.x += windX * dtScale;
            this.velocity.x = Utils.clamp(this.velocity.x, -PHYSICS.MAX_SPEED, PHYSICS.MAX_SPEED);
        }

        // 位置更新
        this.x += this.velocity.x;
        this.y += this.velocity.y;

        // プラットフォームコリジョン（境界チェックより先に実行）
        this.checkPlatformCollisions(platforms);
        this.updateWallSlide?.(input, deltaTime);

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

        // 尻尾アニメーション更新
        this.updateTailAnimation(deltaTime);

        // 体バウンス・耳・傾き更新
        this.updateMovementAnimations(deltaTime);

        // 状態と演出の更新
        this.updateStateAndVisuals(deltaTime, input);
    }

    /**
     * 現在の状態判定と見た目の補間更新
     */
    updateStateAndVisuals(deltaTime, input) {
        // 状態推定
        let next = this.state;
        if (this.celebrate.active) next = 'celebrate';
        else if (this.isDashing) next = 'dash';
        else if (this.isWallSliding) next = 'wallslide';
        else if (!this.isOnGround && this.velocity.y < -0.1) next = 'jump';
        else if (!this.isOnGround && this.velocity.y >= -0.1) next = 'fall';
        else if (Math.abs(this.velocity.x) > 0.15) next = 'run';
        else next = 'idle';

        if (next !== this.state) {
            this.prevState = this.state;
            this.state = next;
            this.stateTime = 0;
        } else {
            this.stateTime += deltaTime;
        }

        // アンティシペーションのタイマ更新（視覚のみ）
        if (this.anticipation.jumpTimer > 0) this.anticipation.jumpTimer = Math.max(0, this.anticipation.jumpTimer - deltaTime);
        if (this.anticipation.dashTimer > 0) this.anticipation.dashTimer = Math.max(0, this.anticipation.dashTimer - deltaTime);

        // アイドル微動（呼吸/瞬き）
        if (this.state === 'idle') {
            this.idleAnim.breath += deltaTime * 0.0025; // ゆっくり
            this.idleAnim.breath = this.idleAnim.breath % (Math.PI * 2);
            this.idleAnim.blinkTimer -= deltaTime;
            if (this.idleAnim.blinkTimer <= 0 && !this.idleAnim.blinking) {
                this.idleAnim.blinking = true;
                this.idleAnim.blinkPhase = 0;
                this.idleAnim.blinkTimer = Utils.randomInt(1400, 2800);
            }
            if (this.idleAnim.blinking) {
                this.idleAnim.blinkPhase += deltaTime;
                if (this.idleAnim.blinkPhase > 140) this.idleAnim.blinking = false; // 140ms まばたき
            }
        }

        // スカッシュ＆ストレッチ目標
        let targetX = 1, targetY = 1;
        const spd = Math.min(1, Math.abs(this.velocity.x) / PHYSICS.MAX_SPEED);
        if (this.state === 'run') {
            // 走りの上下動に合わせた軽い伸縮
            const runWave = Math.sin(this.bodyAnimation.phase) * 0.06;
            targetX = 1 + (-runWave) * 0.5;
            targetY = 1 + (runWave);
        } else if (this.state === 'dash') {
            targetX = 1.15;
            targetY = 0.9;
        } else if (this.state === 'jump') {
            targetX = 0.96;
            targetY = 1.04;
        } else if (this.state === 'fall') {
            targetX = 1.02;
            targetY = 0.98;
        } else if (this.state === 'wallslide') {
            targetX = 0.98;
            targetY = 1.05;
        } else if (this.state === 'idle') {
            const breath = Math.sin(this.idleAnim.breath) * 0.03;
            targetX = 1 - breath * 0.4;
            targetY = 1 + breath;
        }

        // ジャンプのアンティシペーション（発動後の短いスクワッシュ→ストレッチ）
        if (this.anticipation.jumpTimer > 0) {
            const d = 120; // ms
            const t = 1 - (this.anticipation.jumpTimer / d);
            if (t < 0.35) {
                // 予備動作: しゃがみ
                const k = Easings.easeOutCubic(t / 0.35);
                targetX = 1 + 0.08 * k;
                targetY = 1 - 0.12 * k;
            } else {
                // 伸び
                const k = Easings.easeOutBack((t - 0.35) / 0.65);
                targetX = 1 - 0.06 * k;
                targetY = 1 + 0.08 * k;
            }
        }
        // ダッシュの予備動作（短い）
        if (this.anticipation.dashTimer > 0) {
            const d = 100;
            const t = 1 - (this.anticipation.dashTimer / d);
            const k = Easings.easeOutCubic(Math.min(1, t));
            targetX = Utils.lerp(targetX, 1.12, k);
            targetY = Utils.lerp(targetY, 0.92, k);
        }

        // なめらかに補間
        const lerpK = 0.18;
        this.squash.x = Utils.lerp(this.squash.x, targetX, lerpK);
        this.squash.y = Utils.lerp(this.squash.y, targetY, lerpK);

        // セカンダリアニメーション（スカーフ）は無効化
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
        this.surfaceFrictionScale = 1.0;
        
        if (!platforms || !Array.isArray(platforms)) return;
        
        platforms.forEach(platform => {
            if (!platform) return;
            
            const collision = CollisionDetector.checkPlatformCollision(this, platform);
            
            if (collision.isOnGround) {
                this.isOnGround = true;
                // より正確な位置修正
                this.y = Math.min(this.y, collision.collision.y);
                // 地上に触れたので空中ジャンプ回数を回復
                this.airJumpsRemaining = this.maxAirJumps;
                // 床タイプの効果
                switch (platform.type) {
                    case 'ice':
                        // ステージ3は滑りを緩和
                        this.surfaceFrictionScale = (typeof window !== 'undefined' && window.game && window.game.currentStage === 3) ? 0.8 : 0.5;
                        this.velocity.y = 0;
                        break;
                    case 'mud':
                        this.surfaceFrictionScale = 2.0; // 止まりやすい
                        this.velocity.y = 0;
                        break;
                    case 'bounce':
                        // バウンドして接地しない
                        this.velocity.y = PHYSICS.JUMP_FORCE * 0.9;
                        this.isOnGround = false;
                        break;
                    case 'spike':
                        // ダメージを受ける（接地はする）
                        this.velocity.y = 0;
                        this.takeDamage();
                        break;
                    default:
                        this.velocity.y = 0;
                }
            }

            // 壁接触の簡易検出
            const playerRect = new Rectangle(this.x, this.y, this.width, this.height);
            const platformRect = new Rectangle(platform.x, platform.y, platform.width, platform.height);
            const yOverlap = playerRect.bottom > platformRect.top && playerRect.top < platformRect.bottom;
            const nearLeft = Math.abs(playerRect.right - platformRect.left) < 4;
            const nearRight = Math.abs(playerRect.left - platformRect.right) < 4;
            if (!this.isOnGround && yOverlap && this.wallJumpLockTimer <= 0) {
                if (nearLeft) this.isTouchingWallRight = true;
                if (nearRight) this.isTouchingWallLeft = true;
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
            if (!coin || coin.collected) continue;
            let collected = false;
            // マグネット収集
            if (this.powerUps.magnet) {
                const cx = this.x + this.width / 2;
                const cy = this.y + this.height / 2;
                const radius = (typeof PHYSICS !== 'undefined' && PHYSICS.MAGNET_RADIUS) ? PHYSICS.MAGNET_RADIUS : 100;
                const dist = Utils.distance(cx, cy, coin.x + coin.width / 2, coin.y + coin.height / 2);
                if (dist <= radius) {
                    collected = true;
                }
            }
            if (!collected && CollisionDetector.checkCoinCollision(this, coin)) {
                collected = true;
            }
            if (collected) {
                try { if (window.game && typeof window.game.bumpCombo === 'function') window.game.bumpCombo('coin'); } catch (e) { /* noop */ }
                this.addScore?.(10);
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
            } else if (powerUp.type === 'dash') {
                this.powerUps.dash = true;
                this.powerUps.dashTime = 10000;
            } else if (powerUp.type === 'magnet') {
                this.powerUps.magnet = true;
                this.powerUps.magnetTime = 10000;
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
        
        // 演出トリガ（ゲーム側） - 位置がリセットされる前に呼ぶ
        try {
            if (typeof window !== 'undefined' && window.game && typeof window.game.onPlayerDamaged === 'function') {
                window.game.onPlayerDamaged(this);
            }
        } catch (e) { /* noop */ }

        this.lives--;
        this.invulnerable = true;
        this.invulnerableTime = 2000; // 2秒間無敵
        
        // プレイヤーを初期位置にリセット（ライフが残っている場合）
        if (this.lives > 0) {
            try {
                if (typeof window !== 'undefined' && window.game && typeof window.game.getRespawnPosition === 'function') {
                    const rp = window.game.getRespawnPosition();
                    this.x = rp.x;
                    this.y = rp.y;
                } else {
            this.x = 100;
            this.y = 500;
                }
            } catch (e) { this.x = 100; this.y = 500; }
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
        this.addScore?.(20);
        
        if (enemy) {
            // 体力制の敵に対応
            const died = typeof enemy.takeHit === 'function' ? enemy.takeHit() : true;
            if (died) {
                // ヒットストップ & SFX
                try {
                    if (typeof window !== 'undefined' && window.game) {
                        if (typeof window.game.applyHitstop === 'function') window.game.applyHitstop(90);
                        if (window.game.soundManager) window.game.soundManager.generateSound('enemy_defeat');
                        if (typeof window.game.bumpCombo === 'function') window.game.bumpCombo('enemy');
                    }
                } catch (e) { /* noop */ }
        // 敵撃破エフェクト
        this.createEnemyDefeatEffect(enemy);
            }
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
        let playerColor = (typeof PALETTE !== 'undefined' && PALETTE.entity) ? PALETTE.entity.player : '#F4A261';
        
        // パワーアップ状態に応じて色を変更
        if (this.powerUps.jumpBoost) {
            playerColor = (typeof PALETTE !== 'undefined' && PALETTE.entity) ? PALETTE.entity.powerJump : '#00FF00';
        } else if (this.powerUps.invincible) {
            playerColor = (typeof PALETTE !== 'undefined' && PALETTE.entity) ? PALETTE.entity.powerInvincible : '#FFD700';
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
        const w = this.width;
        const h = this.height;
        // 祝福中は上下に軽くバウンド + 移動バウンス
        const celebrateOffset = this.celebrate.active ? Math.sin(this.celebrate.wave * Math.PI * 2) * -3 : 0;
        const moveBounce = Math.sin(this.bodyAnimation.phase) * (this.bodyAnimation.amplitude * 0.5);
        const y = this.y + frame.offset + celebrateOffset + moveBounce;

        // 体の前傾（進行方向へ）
        const cx2 = x + w / 2;
        const cy2 = y + h / 2;
        this.bodyTiltAngle = this.bodyTiltAngle || 0;
        const signedTilt = this.bodyTiltAngle * (this.facingRight ? 1 : -1);
        ctx.translate(cx2, cy2);
        // スカッシュ＆ストレッチ
        ctx.scale(this.squash.x, this.squash.y);
        ctx.rotate(signedTilt);
        ctx.translate(-cx2, -cy2);

        // 尻尾（曲線：移動時に揺れる）
        const amp = this.tailAnimation.amplitude;
        const phase = this.tailAnimation.phase;
        const waveX = Math.sin(phase) * amp;            // 左右揺れ
        const waveY = Math.cos(phase * 1.2) * amp * 0.4; // 上下揺れ
        ctx.strokeStyle = '#D17C45';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const baseX = x + w - 2;
        const baseY = y + h * 0.6;
        const cpX = x + w + 10 + waveX;
        const cpY = y + h * 0.5 + waveY;
        const endX = x + w + 14 + waveX * 0.5;
        const endY = y + h * 0.2 + waveY * 0.6;
        ctx.moveTo(baseX, baseY);
        ctx.quadraticCurveTo(cpX, cpY, endX, endY);
        ctx.stroke();

        // 体（楕円）
        ctx.fillStyle = playerColor;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // 耳（三角形） - 祝福中は少し傾ける + 移動でゆれる
        const earWiggle = Math.sin(this.earAnimation.phase) * this.earAnimation.amplitude;
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, y + h * 0.15 + (this.celebrate.active ? -1 : 0) + earWiggle);
        ctx.lineTo(x + w * 0.35, y + h * 0.05 + (this.celebrate.active ? -2 : 0) + earWiggle);
        ctx.lineTo(x + w * 0.35, y + h * 0.25 + earWiggle * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + w * 0.8, y + h * 0.15 + (this.celebrate.active ? -1 : 0) - earWiggle);
        ctx.lineTo(x + w * 0.65, y + h * 0.05 + (this.celebrate.active ? -2 : 0) - earWiggle);
        ctx.lineTo(x + w * 0.65, y + h * 0.25 - earWiggle * 0.3);
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
        
        // セカンダリ: スカーフ描画は不要のため非表示
        
        ctx.restore();
        
        // パーティクル描画
        this.particleSystem.render(ctx);
    }

    /**
     * 尻尾アニメーションの更新（移動速度に応じて振幅・速度を調整）
     */
    updateTailAnimation(deltaTime) {
        const speedRatio = Utils.clamp(Math.abs(this.velocity.x) / PHYSICS.MAX_SPEED, 0, 1);
        // 目標振幅：停止時は小さく、移動時は大きく。空中では控えめ
        let targetAmp = this.isOnGround ? Utils.lerp(2, 10, speedRatio) : 4;
        if (this.celebrate.active) targetAmp = Math.max(targetAmp, 8);
        // なめらかに追従
        this.tailAnimation.amplitude = Utils.lerp(this.tailAnimation.amplitude, targetAmp, 0.12);
        // 角速度（Hz）を移動速度で可変
        const dt = deltaTime / 1000;
        const freqHz = 1.2 + speedRatio * 2.0 + (this.celebrate.active ? 0.4 : 0);
        this.tailAnimation.phase += 2 * Math.PI * freqHz * dt;
        // 位相の発散防止
        if (this.tailAnimation.phase > Math.PI * 4) {
            this.tailAnimation.phase -= Math.PI * 4;
        }
    }

    /**
     * 体のバウンス・耳ゆれ・体の傾きの更新
     */
    updateMovementAnimations(deltaTime) {
        const dt = deltaTime / 1000;
        const speedRatio = Utils.clamp(Math.abs(this.velocity.x) / PHYSICS.MAX_SPEED, 0, 1);

        // バウンス（上下）
        const targetBounceAmp = this.isOnGround ? Utils.lerp(1.5, 6.0, speedRatio) : 2.5;
        this.bodyAnimation.amplitude = Utils.lerp(this.bodyAnimation.amplitude, targetBounceAmp, 0.12);
        const bounceFreq = 3 + speedRatio * 6; // 3〜9Hz
        this.bodyAnimation.phase += 2 * Math.PI * bounceFreq * dt;
        if (this.bodyAnimation.phase > Math.PI * 4) this.bodyAnimation.phase -= Math.PI * 4;

        // 耳ゆれ
        const targetEarAmp = this.isOnGround ? Utils.lerp(1.5, 4.0, speedRatio) : 2.0;
        this.earAnimation.amplitude = Utils.lerp(this.earAnimation.amplitude, targetEarAmp, 0.12);
        const earFreq = 2 + speedRatio * 4; // 2〜6Hz
        this.earAnimation.phase += 2 * Math.PI * earFreq * dt;
        if (this.earAnimation.phase > Math.PI * 4) this.earAnimation.phase -= Math.PI * 4;

        // 体の傾き（進行方向へ前傾）
        const maxTiltRad = Utils.toRadians(6); // 最大6度
        const targetTilt = maxTiltRad * speedRatio;
        this.bodyTiltAngle = Utils.lerp(this.bodyTiltAngle, targetTilt, 0.12);
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
        
        // コヨーテタイム/ジャンプバッファをリセット
        this.coyoteTime = 0;
        this.jumpBuffer = 0;
        // 二段ジャンプ回数を回復
        this.maxAirJumps = 1;
        this.airJumpsRemaining = this.maxAirJumps;
        
        // パワーアップ状態をリセット
        this.powerUps = {
            jumpBoost: false,
            jumpBoostTime: 0,
            invincible: false,
            invincibleTime: 0,
            dash: false,
            dashTime: 0,
            magnet: false,
            magnetTime: 0
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
        this.originalY = y; // flyer 用の基準Y（未初期化対策）
        this.width = 24;
        this.height = 24;
        this.velocity = new Vector2(-GAME_CONFIG.ENEMY_SPEED, 0);
        this.type = type;
        this.direction = -1; // -1: 左, 1: 右
        this.patrolDistance = 100;
        this.startX = x;
        this.animation = this.createAnimation();
        this.isDead = false;
        // タイプ別パラメータ
        this.health = this.type === 'tank' ? 3 : 1;
        this.jumpCooldown = 1000 + Math.random() * 800; // jumper用
        this.jumpTimer = 0;
        this.detectionRange = 220; // chaser用
        this.flyTime = 0;          // flyer用
        this.amplitude = 28;       // flyerの上下振幅
        this.flySpeed = GAME_CONFIG.ENEMY_SPEED * 0.9;
    }

    createAnimation() {
        // タイプに応じた色味
        let palette;
        if (typeof PALETTE !== 'undefined' && PALETTE.enemy) {
            switch (this.type) {
                case 'jumper': palette = PALETTE.enemy.jumper; break;
                case 'chaser': palette = PALETTE.enemy.chaser; break;
                case 'flyer': palette = PALETTE.enemy.flyer; break;
                case 'tank': palette = PALETTE.enemy.tank; break;
                default: palette = PALETTE.enemy.basic;
            }
        } else {
            switch (this.type) {
                case 'jumper':
                    palette = ['#8ED1C4', '#A7E3D5', '#8ED1C4', '#76BDAF'];
                    break;
                case 'chaser':
                    palette = ['#C39BD3', '#D2B7E5', '#C39BD3', '#A66BBE'];
                    break;
                case 'flyer':
                    palette = ['#93C5FD', '#BFDBFE', '#93C5FD', '#60A5FA'];
                    break;
                case 'tank':
                    palette = ['#7D8590', '#9AA1AA', '#7D8590', '#5D636B'];
                    break;
                default:
                    palette = ['#A3A7AE', '#B5BAC3', '#A3A7AE', '#8F949C'];
            }
        }
        const frames = [
            { color: palette[0], offset: 0 },
            { color: palette[1], offset: 0 },
            { color: palette[2], offset: 0 },
            { color: palette[3], offset: 0 }
        ];
        return new Animation(frames, 200);
    }

    update(deltaTime, platforms, player) {
        if (this.isDead) return;

        this.animation.update(deltaTime);

        switch (this.type) {
            case 'jumper': {
                // パトロール + 定期ジャンプ
                this.x += GAME_CONFIG.ENEMY_SPEED * 0.8 * this.direction;
                if (this.x <= this.startX - this.patrolDistance || this.x >= this.startX + this.patrolDistance) {
                    this.direction *= -1;
                }
                this.jumpTimer += deltaTime;
                if (this.jumpTimer >= this.jumpCooldown) {
                    this.jumpTimer = 0;
                    this.velocity.y = PHYSICS.JUMP_FORCE * 0.7;
                }
                this.velocity.y += PHYSICS.GRAVITY;
                this.velocity.y = Utils.clamp(this.velocity.y, -10, PHYSICS.MAX_FALL_SPEED);
                this.y += this.velocity.y;
                this.checkPlatformCollisions(platforms);
                this.checkBounds();
                break;
            }
            case 'chaser': {
                // プレイヤーを検知したら加速して追尾
                let speed = GAME_CONFIG.ENEMY_SPEED * 1.1;
                if (player) {
                    const dx = player.x - this.x;
                    const dy = Math.abs(player.y - this.y);
                    if (Math.abs(dx) < this.detectionRange && dy < 80) {
                        this.direction = dx >= 0 ? 1 : -1;
                        speed = GAME_CONFIG.ENEMY_SPEED * 1.6;
                    } else if (this.x <= this.startX - this.patrolDistance || this.x >= this.startX + this.patrolDistance) {
                        this.direction *= -1;
                    }
                }
                this.x += speed * this.direction;
                this.velocity.y += PHYSICS.GRAVITY;
                this.velocity.y = Utils.clamp(this.velocity.y, -10, PHYSICS.MAX_FALL_SPEED);
                this.y += this.velocity.y;
                this.checkPlatformCollisions(platforms);
                this.checkBounds();
                break;
            }
            case 'flyer': {
                // ふわふわ飛行（重力なし）
                this.flyTime += deltaTime;
                this.x += this.flySpeed * this.direction;
                this.y = this.originalY + Math.sin(this.flyTime * 0.005) * this.amplitude;
                if (this.x <= this.startX - this.patrolDistance || this.x >= this.startX + this.patrolDistance) {
                    this.direction *= -1;
                }
                this.checkBounds();
                break;
            }
            case 'tank': {
                // 低速・高耐久
                this.x += (GAME_CONFIG.ENEMY_SPEED * 0.6) * this.direction;
                if (this.x <= this.startX - (this.patrolDistance * 0.8) || this.x >= this.startX + (this.patrolDistance * 0.8)) {
                    this.direction *= -1;
                }
                this.velocity.y += PHYSICS.GRAVITY;
                this.velocity.y = Utils.clamp(this.velocity.y, -10, PHYSICS.MAX_FALL_SPEED);
                this.y += this.velocity.y;
                this.checkPlatformCollisions(platforms);
                this.checkBounds();
                break;
            }
            default: {
                // basic: 既存のパトロール
        this.x += this.velocity.x * this.direction;
                if (this.x <= this.startX - this.patrolDistance || this.x >= this.startX + this.patrolDistance) {
            this.direction *= -1;
        }
        this.velocity.y += PHYSICS.GRAVITY;
        this.velocity.y = Utils.clamp(this.velocity.y, -10, PHYSICS.MAX_FALL_SPEED);
        this.y += this.velocity.y;
        this.checkPlatformCollisions(platforms);
        this.checkBounds();
            }
        }
    }

    checkPlatformCollisions(platforms) {
        if (!platforms || !Array.isArray(platforms)) return;
        if (this.type === 'flyer') return;
        
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
        if (this.type !== 'flyer' && this.y > GAME_CONFIG.CANVAS_HEIGHT) {
            this.isDead = true;
        }
    }

    takeHit() {
        if (this.isDead) return true;
        this.health -= 1;
        if (this.health <= 0) {
            this.isDead = true;
            return true;
        }
        return false;
    }

    render(ctx) {
        if (this.isDead) return;

        const frame = this.animation.getCurrentFrame();
        const x = this.x;
        const y = this.y + frame.offset;
        const w = this.width;
        const h = this.height;

        // 足元影
        {
            const shadowAlpha = 0.18;
            ctx.save();
            ctx.globalAlpha = shadowAlpha;
            ctx.fillStyle = 'black';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h + 2, w * 0.45, h * 0.18, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 体（楕円）
        ctx.fillStyle = frame.color;
        ctx.beginPath();
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // アウトライン
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // ハイライト
        {
            const gx = x + w * 0.35, gy = y + h * 0.35;
            const rOuter = Math.max(4, w * 0.6);
            const grad = (typeof Utils !== 'undefined' && Utils.createSafeRadialGradient)
                ? Utils.createSafeRadialGradient(ctx, gx, gy, 2, gx, gy, rOuter)
                : ctx.createRadialGradient(gx, gy, 2, gx, gy, rOuter);
            grad.addColorStop(0, 'rgba(255,255,255,0.35)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        }

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

        // 発光ハロー
        ctx.globalCompositeOperation = 'lighter';
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#FFD166';
        
        // 魚トークンの描画
        const bodyW = this.width * 0.8;
        const bodyH = this.height * 0.45;
        
        // 身体（楕円）
        ctx.fillStyle = (typeof PALETTE !== 'undefined' && PALETTE.entity) ? PALETTE.entity.coin : '#FFD166';
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

        // 後始末
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        
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
        this.type = type; // 'normal', 'moving', 'breakable', 'ice', 'mud', 'bounce', 'spike'
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
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.normal : '#8B4513';
                break;
            case 'moving':
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.moving : '#A0522D';
                break;
            case 'breakable':
                if (typeof PALETTE !== 'undefined' && PALETTE.platform) {
                    color = this.health > 1 ? PALETTE.platform.breakableHigh : PALETTE.platform.breakableLow;
                } else {
                    color = this.health > 1 ? '#CD853F' : '#8B4513';
                }
                break;
            case 'ice':
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.ice : '#9DD6F9';
                break;
            case 'mud':
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.mud : '#6B4F3A';
                break;
            case 'bounce':
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.bounce : '#4ADE80';
                break;
            case 'spike':
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.spike : '#B91C1C';
                break;
            default:
                color = (typeof PALETTE !== 'undefined' && PALETTE.platform) ? PALETTE.platform.normal : '#8B4513';
        }

        // 側面に向かって暗くなるグラデーションで立体感
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0.22)');
        ctx.fillStyle = grad;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // 天面ハイライト
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(this.x, this.y, this.width, 2);

        // エッジの軽いアウトライン
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(this.x, this.y, this.width, this.height);

        // プラットフォームの装飾
        if (this.type === 'ice') {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillRect(this.x, this.y, this.width, 3);
        } else if (this.type === 'mud') {
            ctx.fillStyle = '#4E3827';
            ctx.fillRect(this.x, this.y + this.height - 5, this.width, 5);
        } else if (this.type === 'bounce') {
            ctx.fillStyle = '#16A34A';
            ctx.fillRect(this.x, this.y + this.height - 3, this.width, 3);
        } else if (this.type === 'spike') {
            ctx.fillStyle = '#7F1D1D';
            for (let i = 0; i < this.width; i += 8) {
                ctx.beginPath();
                ctx.moveTo(this.x + i, this.y + this.height);
                ctx.lineTo(this.x + i + 4, this.y + this.height - 8);
                ctx.lineTo(this.x + i + 8, this.y + this.height);
                ctx.closePath();
                ctx.fill();
            }
        }
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
        // テーマに応じて背景色を変更
        const env = (typeof window !== 'undefined' && window.game && window.game.environment) ? window.game.environment : { theme: 'day' };
        let top = '#FFE5EC', bottom = '#CDEFFF';
        switch (env.theme) {
            case 'breeze':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.breeze[0]; bottom = PALETTE.background.breeze[1]; }
                break;
            case 'snow':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.snow[0]; bottom = PALETTE.background.snow[1]; }
                break;
            case 'swamp':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.swamp[0]; bottom = PALETTE.background.swamp[1]; }
                break;
            case 'volcano':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.volcano[0]; bottom = PALETTE.background.volcano[1]; }
                break;
            case 'night':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.night[0]; bottom = PALETTE.background.night[1]; }
                break;
            case 'dusk':
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.dusk[0]; bottom = PALETTE.background.dusk[1]; }
                break;
            default:
                if (typeof PALETTE !== 'undefined' && PALETTE.background) { top = PALETTE.background.day[0]; bottom = PALETTE.background.day[1]; }
        }
        const gradient = ctx.createLinearGradient(0, 0, 0, GAME_CONFIG.CANVAS_HEIGHT);
        gradient.addColorStop(0, top);
        gradient.addColorStop(1, bottom);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

        // 天体（太陽・月と星）
        if (env.theme === 'night') {
            // 星
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            for (let i = 0; i < 30; i++) {
                const sx = (i * 137) % GAME_CONFIG.CANVAS_WIDTH;
                const sy = (i * 97) % 220;
                ctx.fillRect(sx, 20 + (sy % 180), 2, 2);
            }
            // 月
            const mx = GAME_CONFIG.CANVAS_WIDTH - 80, my = 70;
            const mg = (typeof Utils !== 'undefined' && Utils.createSafeRadialGradient)
                ? Utils.createSafeRadialGradient(ctx, mx - 8, my - 8, 4, mx, my, 26)
                : ctx.createRadialGradient(mx - 8, my - 8, 4, mx, my, 26);
            mg.addColorStop(0, 'rgba(255,255,210,0.9)');
            mg.addColorStop(1, 'rgba(255,255,210,0)');
            ctx.fillStyle = mg;
            ctx.beginPath();
            ctx.arc(mx, my, 26, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // 太陽
            const sx = GAME_CONFIG.CANVAS_WIDTH - 70, sy = 60;
            const sg = (typeof Utils !== 'undefined' && Utils.createSafeRadialGradient)
                ? Utils.createSafeRadialGradient(ctx, sx - 10, sy - 10, 6, sx, sy, 28)
                : ctx.createRadialGradient(sx - 10, sy - 10, 6, sx, sy, 28);
            sg.addColorStop(0, 'rgba(255,240,180,0.9)');
            sg.addColorStop(1, 'rgba(255,240,180,0)');
            ctx.fillStyle = sg;
            ctx.beginPath();
            ctx.arc(sx, sy, 28, 0, Math.PI * 2);
            ctx.fill();
        }

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

