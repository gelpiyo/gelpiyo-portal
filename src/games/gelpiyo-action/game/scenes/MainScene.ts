import Phaser from 'phaser';

export class MainScene extends Phaser.Scene {
    private player!: Phaser.Physics.Arcade.Sprite;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    
    // UIボタンの状態
    private isLeftPressed = false;
    private isRightPressed = false;
    
    constructor() {
        super('MainScene');
    }

    preload() {
        const baseUrl = import.meta.env.BASE_URL;
        
        // 1フレーム：512×512px
        this.load.spritesheet('idle', `${baseUrl}assets/gelpiyo-action/gelpiyo_idle.png`, {
            frameWidth: 512, frameHeight: 512
        });
        this.load.spritesheet('walk', `${baseUrl}assets/gelpiyo-action/gelpiyo_walk.png`, {
            frameWidth: 512, frameHeight: 512
        });
        this.load.spritesheet('jump', `${baseUrl}assets/gelpiyo-action/gelpiyo_jump.png`, {
            frameWidth: 512, frameHeight: 512
        });
    }

    create() {
        // アニメーション作成 (1動作8フレーム)
        this.anims.create({
            key: 'idle_anim',
            frames: this.anims.generateFrameNumbers('idle', { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: 'walk_anim',
            frames: this.anims.generateFrameNumbers('walk', { start: 0, end: 7 }),
            frameRate: 15,
            repeat: -1
        });
        this.anims.create({
            key: 'jump_anim',
            frames: this.anims.generateFrameNumbers('jump', { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });

        // 地面の作成 (Graphicsを使用してシンプルな緑の矩形を作成)
        const groundGraphics = this.add.graphics();
        groundGraphics.fillStyle(0x228B22);
        groundGraphics.fillRect(0, 0, 800, 100);
        groundGraphics.generateTexture('ground', 800, 100);
        groundGraphics.destroy();

        const platforms = this.physics.add.staticGroup();
        platforms.create(400, 580, 'ground');

        // プレイヤーの作成
        this.player = this.physics.add.sprite(400, 300, 'idle');
        
        // 画像が512x512と大きいのでスケールダウン
        this.player.setScale(0.3); 
        
        // 当たり判定の調整 (適宜調整)
        // 512px * 0.3 = 約153px四方
        if (this.player.body) {
            this.player.body.setSize(256, 400); 
            this.player.body.setOffset(128, 112);
        }
        
        this.player.setBounce(0.1);
        this.player.setCollideWorldBounds(true);

        this.physics.add.collider(this.player, platforms);

        // 入力 (キーボード)
        if(this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
        }

        // DOM UI（バーチャルパッド）のバインディング
        this.setupVirtualPad();
    }
    
    setupVirtualPad() {
        // 左ボタン
        const btnLeft = document.getElementById('btn-left');
        if (btnLeft) {
            btnLeft.addEventListener('pointerdown', () => { this.isLeftPressed = true; });
            btnLeft.addEventListener('pointerup', () => { this.isLeftPressed = false; });
            btnLeft.addEventListener('pointerleave', () => { this.isLeftPressed = false; });
        }
        
        // 右ボタン
        const btnRight = document.getElementById('btn-right');
        if (btnRight) {
            btnRight.addEventListener('pointerdown', () => { this.isRightPressed = true; });
            btnRight.addEventListener('pointerup', () => { this.isRightPressed = false; });
            btnRight.addEventListener('pointerleave', () => { this.isRightPressed = false; });
        }
        
        // ジャンプボタン
        const btnJump = document.getElementById('btn-jump');
        if (btnJump) {
            btnJump.addEventListener('pointerdown', () => { this.doJump(); });
        }
    }
    
    doJump() {
        if (this.player.body && this.player.body.touching.down) {
            this.player.setVelocityY(-600);
        }
    }

    update() {
        if (!this.player || !this.player.body) return;

        const speed = 300;
        let isMoving = false;

        // 左右移動
        if ((this.cursors?.left.isDown || this.isLeftPressed)) {
            this.player.setVelocityX(-speed);
            this.player.setFlipX(true);
            isMoving = true;
        }
        else if ((this.cursors?.right.isDown || this.isRightPressed)) {
            this.player.setVelocityX(speed);
            this.player.setFlipX(false);
            isMoving = true;
        }
        else {
            this.player.setVelocityX(0);
        }

        // キーボードジャンプ
        if (this.cursors?.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-600);
        }

        // アニメーション制御
        if (!this.player.body.touching.down) {
            this.player.anims.play('jump_anim', true);
        } else if (isMoving) {
            this.player.anims.play('walk_anim', true);
        } else {
            this.player.anims.play('idle_anim', true);
        }
    }
}
