import type { GelpiyoType, PotState, MoldState, CustomerState } from './types';
import { POT_STATE, MOLD_STATE, CUSTOMER_STATE } from './types';

// ===================================================
// Pot (鍋) クラス
// ===================================================
export class Pot {
  public state: PotState;
  public meltProgress: number;
  public meltTime: number;

  constructor() {
    this.state = POT_STATE.EMPTY;
    this.meltProgress = 0;
    this.meltTime = 2.0;
  }

  reset(): void {
    this.state = POT_STATE.EMPTY;
    this.meltProgress = 0;
    this.meltTime = 2.0;
  }

  addPellet(): boolean {
    if (this.state !== POT_STATE.EMPTY) return false;
    this.state = POT_STATE.MELTING;
    this.meltProgress = 0;
    return true;
  }

  update(dt: number): void {
    if (this.state === POT_STATE.MELTING) {
      this.meltProgress += dt / this.meltTime;
      if (this.meltProgress >= 1) {
        this.meltProgress = 1;
        this.state = POT_STATE.MELTED;
      }
    }
  }

  scoop(): boolean {
    if (this.state !== POT_STATE.MELTED) return false;
    this.reset();
    return true;
  }
}

// ===================================================
// Mold (製造モールド) クラス
// ===================================================
export class Mold {
  public state: MoldState;
  public gelpiyoType: GelpiyoType | null;
  public progress: number;
  public settingTime: number;
  public doneFlash: number;

  constructor() {
    this.state = MOLD_STATE.EMPTY;
    this.gelpiyoType = null;
    this.progress = 0;
    this.settingTime = 3.0;
    this.doneFlash = 0;
  }

  reset(): void {
    this.state = MOLD_STATE.EMPTY;
    this.gelpiyoType = null;
    this.progress = 0;
    this.settingTime = 3.0;
    this.doneFlash = 0;
  }

  fillGel(): boolean {
    if (this.state !== MOLD_STATE.EMPTY) return false;
    this.state = MOLD_STATE.FILLED;
    this.gelpiyoType = null;
    this.progress = 0;
    return true;
  }

  addTopping(type: GelpiyoType): boolean {
    if (this.state !== MOLD_STATE.FILLED) return false;
    this.gelpiyoType = type;
    this.state = MOLD_STATE.SETTING;
    this.progress = 0;
    return true;
  }

  update(dt: number): boolean {
    if (this.state === MOLD_STATE.SETTING) {
      this.progress += dt / this.settingTime;
      if (this.progress >= 1) {
        this.progress = 1;
        this.state = MOLD_STATE.DONE;
        this.doneFlash = 0.5;
        return true;
      }
    }
    if (this.state === MOLD_STATE.DONE) {
      this.doneFlash = Math.max(0, this.doneFlash - dt);
    }
    return false;
  }

  collect(): GelpiyoType | null {
    if (this.state !== MOLD_STATE.DONE) return null;
    const type = this.gelpiyoType;
    this.reset();
    return type;
  }
}

// ===================================================
// Customer (お客さん) クラス
// ===================================================
export class Customer {
  public state: CustomerState;
  public order: GelpiyoType | null;
  public patience: number;
  public maxPatience: number;
  public enterProgress: number;
  public servedTimer: number;
  public slotIndex: number;
  public active: boolean;
  public appearance: number;
  public bouncePhase: number;

  constructor() {
    this.state = CUSTOMER_STATE.ENTERING;
    this.order = null;
    this.patience = 1;
    this.maxPatience = 35;
    this.enterProgress = 0;
    this.servedTimer = 0;
    this.slotIndex = 0;
    this.active = false;
    this.appearance = 0;
    this.bouncePhase = 0;
  }

  reset(): void {
    this.state = CUSTOMER_STATE.ENTERING;
    this.order = null;
    this.patience = 1;
    this.maxPatience = 35;
    this.enterProgress = 0;
    this.servedTimer = 0;
    this.slotIndex = 0;
    this.active = false;
    this.appearance = 0;
    this.bouncePhase = Math.random() * Math.PI * 2;
  }

  spawn(order: GelpiyoType, slotIndex: number, maxPatience: number = 35): void {
    this.reset();
    this.order = order;
    this.slotIndex = slotIndex;
    this.maxPatience = maxPatience;
    this.patience = 1;
    this.active = true;
    this.appearance = Math.floor(Math.random() * 5);
    this.bouncePhase = Math.random() * Math.PI * 2;
  }

  update(dt: number): string | null {
    if (!this.active) return null;

    this.bouncePhase += dt * 3;

    if (this.state === CUSTOMER_STATE.ENTERING) {
      this.enterProgress += dt * 3;
      if (this.enterProgress >= 1) {
        this.enterProgress = 1;
        this.state = CUSTOMER_STATE.WAITING;
      }
      return null;
    }

    if (this.state === CUSTOMER_STATE.WAITING) {
      this.patience -= dt / this.maxPatience;
      if (this.patience <= 0) {
        this.patience = 0;
        this.state = CUSTOMER_STATE.LEFT;
        return 'left';
      }
      return null;
    }

    if (this.state === CUSTOMER_STATE.SERVED) {
      this.servedTimer += dt;
      if (this.servedTimer >= 0.6) {
        this.active = false;
      }
      return null;
    }

    if (this.state === CUSTOMER_STATE.LEFT) {
      this.active = false;
      return null;
    }

    return null;
  }

  serve(itemId: string): boolean {
    if (this.state !== CUSTOMER_STATE.WAITING || !this.order) return false;
    if (this.order.id === itemId) {
      this.state = CUSTOMER_STATE.SERVED;
      this.servedTimer = 0;
      return true;
    }
    return false;
  }
}

// ===================================================
// CustomerPool (お客さんプーリング)
// ===================================================
export class CustomerPool {
  private pool: Customer[];

  constructor(size: number) {
    this.pool = [];
    for (let i = 0; i < size; i++) {
      this.pool.push(new Customer());
    }
  }

  acquire(): Customer | null {
    for (const c of this.pool) {
      if (!c.active) return c;
    }
    return null;
  }

  getActive(): Customer[] {
    return this.pool.filter(c => c.active);
  }

  resetAll(): void {
    for (const c of this.pool) {
      c.reset();
    }
  }
}
