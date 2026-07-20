import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    
    // UIボタンの状態
    private isLeftPressed = false;
    private isRightPressed = false;
    
    // アクション用のキーボード
    private keyA!: Phaser.Input.Keyboard.Key;
    private keyS!: Phaser.Input.Keyboard.Key;
    private keyD!: Phaser.Input.Keyboard.Key;
    private keyF!: Phaser.Input.Keyboard.Key;
    private keyC!: Phaser.Input.Keyboard.Key;

    // 現在再生中の特殊アクション
    private isPlayingAction = false;
    
    constructor() {
        super('MainScene');
    }

    preload() {
        const baseUrl = import.meta.env.BASE_URL;
        const spriteConfig = { frameWidth: 512, frameHeight: 512 };
        
        this.load.spritesheet('idle', `${baseUrl}assets/gelpiyo-action/gelpiyo_idle.png`, spriteConfig);
        this.load.spritesheet('walk', `${baseUrl}assets/gelpiyo-action/gelpiyo_walk.png`, spriteConfig);
        this.load.spritesheet('jump', `${baseUrl}assets/gelpiyo-action/gelpiyo_jump.png`, spriteConfig);
        this.load.spritesheet('attack', `${baseUrl}assets/gelpiyo-action/gelpiyo_attack_sheet.png`, spriteConfig);
        this.load.spritesheet('celebrate', `${baseUrl}assets/gelpiyo-action/gelpiyo_celebrate_sheet.png`, spriteConfig);
        this.load.spritesheet('damage', `${baseUrl}assets/gelpiyo-action/gelpiyo_damage_sheet.png`, spriteConfig);
        this.load.spritesheet('defeat', `${baseUrl}assets/gelpiyo-action/gelpiyo_defeat_sheet.png`, spriteConfig);
        this.load.spritesheet('sleep', `${baseUrl}assets/gelpiyo-action/gelpiyo_sleep_sheet.png`, spriteConfig);
    }

    create() {
        const worldWidth = 3200;
        const worldHeight = 600;

        // ワールドとカメラの境界設定
        this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
        this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);

        // --- 背景（パララックススクロール） ---
        // 遠景（空） scrollFactor: 0 -> カメラと一緒に動くため、画面サイズ分だけ描画
        const sky = this.add.graphics();
        sky.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x4682B4, 0x4682B4, 1);
        sky.fillRect(0, 0, 800, 600); // ウィンドウサイズ固定
        sky.setScrollFactor(0);

        // 中景（山） scrollFactor: 0.3 -> ゆっくり動く
        const mountains = this.add.graphics();
        mountains.fillStyle(0x3CB371);
        // カメラの動きより遅いので、(worldWidth * 0.3 + 800) 程度カバーすればよい
        for (let i = 0; i < 6; i++) {
            mountains.fillTriangle(100 + i*500, 600, 400 + i*500, 200, 700 + i*500, 600);
            mountains.fillTriangle(300 + i*500, 600, 550 + i*500, 300, 800 + i*500, 600);
        }
        mountains.setScrollFactor(0.3);

        // 近景（丘/森） scrollFactor: 0.6 -> やや早く動く
        const hills = this.add.graphics();
        hills.fillStyle(0x2E8B57);
        for (let i = 0; i < 15; i++) {
            hills.fillCircle(i * 300, 600, 250);
        }
        hills.setScrollFactor(0.6);

        // --- アニメーション作成 ---
        const createAnim = (key: string, sprite: string, repeat: number = -1, frameRate: number = 10) => {
            this.anims.create({
                key: key,
                frames: this.anims.generateFrameNumbers(sprite, { start: 0, end: 7 }),
                frameRate: frameRate,
                repeat: repeat
            });
        };

        createAnim('idle_anim', 'idle');
        createAnim('walk_anim', 'walk', -1, 15);
        createAnim('jump_anim', 'jump');
        createAnim('attack_anim', 'attack', 0, 15);
        createAnim('celebrate_anim', 'celebrate', -1, 10);
        createAnim('damage_anim', 'damage', 0, 15);
        createAnim('defeat_anim', 'defeat', 0, 10);
        
        // sleep_anim
        this.anims.create({
            key: 'sleep_anim_intro',
            frames: this.anims.generateFrameNumbers('sleep', { start: 0, end: 7 }),
            frameRate: 5,
            repeat: 0
        });
        this.anims.create({
            key: 'sleep_anim_loop',
            frames: this.anims.generateFrameNumbers('sleep', { frames: [6, 7] }),
            frameRate: 5,
            repeat: -1
        });

        // --- 地面と足場 ---
        const groundGraphics = this.add.graphics();
        // 土台の上に草が生えているようなイメージの描画
        groundGraphics.fillStyle(0x8B4513); // 茶色(土)
        groundGraphics.fillRect(0, 0, 800, 100);
        groundGraphics.fillStyle(0x228B22); // 緑色(草)
        groundGraphics.fillRect(0, 0, 800, 20);
        groundGraphics.generateTexture('ground', 800, 100);
        groundGraphics.destroy();

        const platforms = this.physics.add.staticGroup();
        
        // メインの地面（横に長く敷き詰める）
        for (let i = 0; i < Math.ceil(worldWidth / 800); i++) {
            platforms.create(400 + i * 800, 580, 'ground').setScale(1).refreshBody();
        }

        // アスレチックのような足場の配置
        const addPlatform = (x: number, y: number, scaleX: number, scaleY: number = 0.5) => {
            platforms.create(x, y, 'ground').setScale(scaleX, scaleY).refreshBody();
        };

        addPlatform(800, 450, 0.5); // 段差1
        addPlatform(1100, 320, 0.3); // 段差2
        addPlatform(1400, 200, 0.5); // 段差3
        
        // 高台エリア
        addPlatform(1900, 450, 0.4);
        addPlatform(2200, 350, 0.4);
        addPlatform(2500, 250, 0.4);
        addPlatform(2800, 150, 0.4);

        // --- プレイヤーの作成 ---
        this.player = this.physics.add.sprite(200, 300, 'idle');
        this.player.setScale(0.3); 
        
        if (this.player.body) {
            this.player.body.setSize(256, 400); 
            this.player.body.setOffset(128, 112);
        }
        
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, platforms);

        // カメラの追従
        this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

        // --- イベントと入力 ---
        this.player.on('animationcomplete', (anim: Phaser.Animations.Animation) => {
            if (['attack_anim', 'damage_anim', 'defeat_anim'].includes(anim.key)) {
                this.isPlayingAction = false;
            }
            if (anim.key === 'sleep_anim_intro') {
                this.player.anims.play('sleep_anim_loop', true);
            }
        });

        if(this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
            this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
            this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
            this.keyF = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
            this.keyC = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        }

        this.setupVirtualPad();
    }
    
    setupVirtualPad() {
        const bindButton = (id: string, onDown: () => void, onUp?: () => void) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('pointerdown', onDown);
                if (onUp) {
                    btn.addEventListener('pointerup', onUp);
                    btn.addEventListener('pointerleave', onUp);
                }
            }
        };

        bindButton('btn-left', () => { this.isLeftPressed = true; }, () => { this.isLeftPressed = false; });
        bindButton('btn-right', () => { this.isRightPressed = true; }, () => { this.isRightPressed = false; });
        bindButton('btn-jump', () => { this.doJump(); });

        bindButton('btn-attack', () => { this.playAction('attack_anim'); });
        bindButton('btn-damage', () => { this.playAction('damage_anim'); });
        bindButton('btn-sleep', () => { this.playAction('sleep_anim_intro'); });
        bindButton('btn-defeat', () => { this.playAction('defeat_anim'); });
        bindButton('btn-celebrate', () => { this.playAction('celebrate_anim'); });
    }
    
    playAction(animKey: string) {
        if (!this.player) return;
        this.player.anims.play(animKey, true);
        this.isPlayingAction = true;
    }

    doJump() {
        if (this.player.body && this.player.body.touching.down) {
            this.player.setVelocityY(-600);
            this.isPlayingAction = false;
        }
    }

    update() {
        if (!this.player || !this.player.body) return;

        if (Phaser.Input.Keyboard.JustDown(this.keyA)) this.playAction('attack_anim');
        if (Phaser.Input.Keyboard.JustDown(this.keyD)) this.playAction('damage_anim');
        if (Phaser.Input.Keyboard.JustDown(this.keyF)) this.playAction('defeat_anim');
        if (Phaser.Input.Keyboard.JustDown(this.keyS)) this.playAction('sleep_anim_intro');
        if (Phaser.Input.Keyboard.JustDown(this.keyC)) this.playAction('celebrate_anim');

        const speed = 400; // 少し早くする
        let isMoving = false;

        if ((this.cursors?.left.isDown || this.isLeftPressed)) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
            isMoving = true;
            this.isPlayingAction = false;
        }
        else if ((this.cursors?.right.isDown || this.isRightPressed)) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
            isMoving = true;
            this.isPlayingAction = false;
        }
        else {
            this.player.setVelocityX(0);
        }

        if (this.cursors?.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-600);
            this.isPlayingAction = false;
        }

        if (this.isPlayingAction) {
            return;
        }

        if (!this.player.body.touching.down) {
            this.player.anims.play('jump_anim', true);
        } else if (isMoving) {
            this.player.anims.play('walk_anim', true);
        } else {
            this.player.anims.play('idle_anim', true);
        }
    }
}
