import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private baseVelocity: number = 300;
  private jumpVelocity: number = -600;
  private isTackling: boolean = false;
  private tackleTime: number = 0;
  private tackleDuration: number = 300; // ms
  private tackleVelocity: number = 800;
  
  public virtualInput = {
    left: false,
    right: false,
    jump: false,
    tackle: false,
  };
  
  public keyboardInput = {
    left: false,
    right: false,
    jump: false,
    tackle: false,
  };

  private canJump: boolean = true;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'gelpiyo');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setBounce(0.1);
    
    // Scale down a bit if the image is large
    this.setDisplaySize(60, 60);
    // Use circular body for slime-like tackle
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCircle(30);
    body.setOffset((this.width - 60) / 2, (this.height - 60) / 2);
  }

  update(time: number, _delta: number) {
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    const isLeft = this.virtualInput.left || this.keyboardInput.left;
    const isRight = this.virtualInput.right || this.keyboardInput.right;
    const isJump = this.virtualInput.jump || this.keyboardInput.jump;
    const isTackle = this.virtualInput.tackle || this.keyboardInput.tackle;

    // Handle tackling state
    if (this.isTackling) {
      if (time > this.tackleTime) {
        this.isTackling = false;
        this.setTint(0xffffff); // Reset color
        body.setAllowGravity(true);
      } else {
        // Keep moving at tackle velocity
        return;
      }
    }

    // Normal movement
    if (isLeft) {
      this.setVelocityX(-this.baseVelocity);
      this.setFlipX(true);
    } else if (isRight) {
      this.setVelocityX(this.baseVelocity);
      this.setFlipX(false);
    } else {
      this.setVelocityX(0);
    }

    // Jump
    if (isJump && body.blocked.down && this.canJump) {
      this.setVelocityY(this.jumpVelocity);
      this.canJump = false; // Prevent auto-hopping
    }
    if (!isJump && body.blocked.down) {
      this.canJump = true;
    }

    // Tackle
    if (isTackle && !this.isTackling) {
      this.startTackle(time);
      // Consume virtual input so it doesn't get stuck if touch is held
      this.virtualInput.tackle = false; 
    }
  }

  private startTackle(time: number) {
    this.isTackling = true;
    this.tackleTime = time + this.tackleDuration;
    
    // Disable gravity briefly during dash
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    this.setVelocityY(0);

    const direction = this.flipX ? -1 : 1;
    this.setVelocityX(this.tackleVelocity * direction);

    // Visual feedback
    this.setTint(0xffa500); // Orange tint when tackling
  }

  public isCurrentlyTackling(): boolean {
    return this.isTackling;
  }
}
