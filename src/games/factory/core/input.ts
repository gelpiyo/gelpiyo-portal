// ============================================
// input.ts - Touch/Mouse Input Management
// ============================================

export interface InputEvent {
  id: string;
  x: number;
  y: number;
  type: 'start' | 'end';
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private pendingInputs: InputEvent[] = [];
  private currentPointer: { x: number; y: number } | null = null;
  private isPointerDown = false;
  private logicalW: number;
  private logicalH: number;

  constructor(canvas: HTMLCanvasElement, logicalWidth: number = 390, logicalHeight: number = 844) {
    this.canvas = canvas;
    this.logicalW = logicalWidth;
    this.logicalH = logicalHeight;

    this.bindEvents();
  }

  public destroy() {
    this.unbindEvents();
  }

  private bindEvents() {
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });

    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('mouseleave', this.onMouseUp);
  }

  private unbindEvents() {
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.onTouchEnd);

    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('mouseup', this.onMouseUp);
    this.canvas.removeEventListener('mouseleave', this.onMouseUp);
  }

  private toCanvasCoords(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.logicalW / rect.width;
    const scaleY = this.logicalH / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const pos = this.toCanvasCoords(touch.clientX, touch.clientY);
    this.currentPointer = pos;
    this.isPointerDown = true;
    this.pendingInputs.push({ id: 'touch_start', x: pos.x, y: pos.y, type: 'start' });
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    this.currentPointer = this.toCanvasCoords(touch.clientX, touch.clientY);
  };

  private onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.changedTouches[0];
    if (!touch) return;
    const pos = this.toCanvasCoords(touch.clientX, touch.clientY);
    this.isPointerDown = false;
    this.pendingInputs.push({ id: 'touch_end', x: pos.x, y: pos.y, type: 'end' });
  };

  private onMouseDown = (e: MouseEvent) => {
    const pos = this.toCanvasCoords(e.clientX, e.clientY);
    this.currentPointer = pos;
    this.isPointerDown = true;
    this.pendingInputs.push({ id: 'mouse_down', x: pos.x, y: pos.y, type: 'start' });
  };

  private onMouseMove = (e: MouseEvent) => {
    if (!this.isPointerDown) return;
    this.currentPointer = this.toCanvasCoords(e.clientX, e.clientY);
  };

  private onMouseUp = (e: MouseEvent) => {
    if (!this.isPointerDown) return;
    const pos = this.toCanvasCoords(e.clientX, e.clientY);
    this.isPointerDown = false;
    this.pendingInputs.push({ id: 'mouse_up', x: pos.x, y: pos.y, type: 'end' });
  };

  public flushInputs(): InputEvent[] {
    const copy = [...this.pendingInputs];
    this.pendingInputs = [];
    return copy;
  }

  public getCurrentPointer(): { x: number; y: number } | null {
    return this.isPointerDown ? this.currentPointer : null;
  }
}
