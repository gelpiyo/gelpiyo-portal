import Phaser from 'phaser';
import { Player } from '../objects/Player';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private blocksGroup!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private lastTackleBreakTime: number = 0;

  constructor() {
    super('GameScene');
  }

  preload() {
    // ゲルぴよの画像をロード
    this.load.image('gelpiyo', `${import.meta.env.BASE_URL}assets/factory/characters/gelpiyo_transparent.png`);
    // ブロック用のダミー画像（Graphicsで生成）
    const graphics = this.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x8B4513, 1); // Brown dirt
    graphics.fillRect(0, 0, 60, 60);
    graphics.lineStyle(2, 0x654321, 1);
    graphics.strokeRect(0, 0, 60, 60);
    graphics.generateTexture('block', 60, 60);
  }

  create() {
    // 世界の境界線を設定 (幅3000px)
    this.physics.world.setBounds(0, 0, 3000, this.scale.height * 2);

    // ブロックグループの作成
    this.blocksGroup = this.physics.add.staticGroup();

    // テラリア風の地形を生成
    this.generateTerrain();

    // プレイヤーの配置
    this.player = new Player(this, 100, 200);

    // カメラの追従
    this.cameras.main.setBounds(0, 0, 3000, this.scale.height * 2);
    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);

    // 衝突判定
    this.physics.add.collider(this.player, this.blocksGroup, this.handlePlayerBlockCollision as any, undefined, this);

    // キーボード入力（PCデバッグ用）
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }
  }

  update(time: number, delta: number) {
    if (this.cursors && this.player) {
      // PCキーボード入力のマッピング
      this.player.keyboardInput.left = this.cursors.left.isDown;
      this.player.keyboardInput.right = this.cursors.right.isDown;
      this.player.keyboardInput.jump = this.cursors.up.isDown;
      
      // スペースキーは1回押し判定を簡単に
      if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
        this.player.keyboardInput.tackle = true;
      } else {
        this.player.keyboardInput.tackle = false;
      }
    }

    if (this.player) {
      this.player.update(time, delta);
    }
  }

  // バーチャルパッドからの入力を受け取る
  public handleVirtualInput(action: string, isDown: boolean) {
    if (this.player) {
      (this.player.virtualInput as any)[action] = isDown;
    }
  }

  private generateTerrain() {
    const blockSize = 60;
    const worldWidth = 3000;
    const worldHeight = this.scale.height * 2;
    const groundLevelY = worldHeight / 2; // 地面の基準高さ

    for (let x = 0; x < worldWidth; x += blockSize) {
      // なだらかな起伏を作る
      const heightOffset = Math.sin(x / 300) * 120 + Math.random() * 30 - 15;
      const surfaceY = groundLevelY + heightOffset;

      for (let y = surfaceY; y < worldHeight; y += blockSize) {
        // 表面のブロックを少し間引いて洞窟っぽさを出す
        if (y > surfaceY + blockSize * 3 && Math.random() > 0.8) {
          continue; // 空洞
        }

        const block = this.blocksGroup.create(x + blockSize/2, Math.floor(y/blockSize)*blockSize + blockSize/2, 'block') as Phaser.Physics.Arcade.Sprite;
        block.refreshBody();
      }
    }
    
    // 左と右の壁
    for (let y = 0; y < worldHeight; y += blockSize) {
      const leftWall = this.blocksGroup.create(-blockSize/2, y + blockSize/2, 'block');
      leftWall.refreshBody();
      const rightWall = this.blocksGroup.create(worldWidth + blockSize/2, y + blockSize/2, 'block');
      rightWall.refreshBody();
    }
  }

  private handlePlayerBlockCollision(playerObj: any, blockObj: any) {
    const player = playerObj as Player;
    const block = blockObj as Phaser.Physics.Arcade.Sprite;

    // 体当たり中ならブロックを破壊
    if (player.isCurrentlyTackling()) {
      // 連続破壊を防ぐためのクールダウン
      if (this.time.now - this.lastTackleBreakTime > 50) {
        block.destroy();
        this.lastTackleBreakTime = this.time.now;
      }
    }
  }
}
