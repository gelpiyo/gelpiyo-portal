import type { GelpiyoType, DragState, LadleAnim } from './types';
import { Customer, Pot, Mold } from './entity';

const COLORS = {
  bgDark: 'hsl(240, 30%, 10%)',
  bgPanel: 'hsla(240, 25%, 18%, 0.9)',
  neonPink: 'hsl(330, 80%, 60%)',
  neonCyan: 'hsl(180, 80%, 55%)',
  neonYellow: 'hsl(50, 90%, 60%)',
  neonGreen: 'hsl(140, 70%, 55%)',
  neonOrange: 'hsl(25, 90%, 60%)',
  neonPurple: 'hsl(270, 75%, 65%)',
  white: 'hsl(0, 0%, 95%)',
  gray: 'hsl(0, 0%, 55%)',
  dimWhite: 'hsla(0, 0%, 95%, 0.7)',
  red: 'hsl(0, 75%, 55%)'
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  private drawPixelRect(x: number, y: number, w: number, h: number, color: string, borderColor: string | null = null) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x + 2, y, w - 4, h);
    this.ctx.fillRect(x, y + 2, w, h - 4);
    this.ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    if (borderColor) {
      this.ctx.strokeStyle = borderColor;
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }
  }

  private drawGlowText(text: string, x: number, y: number, color: string, fontSize: number, align: CanvasTextAlign = 'center') {
    this.ctx.font = `${fontSize}px 'Press Start 2P', 'DotGothic16', monospace`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 12;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = COLORS.white;
    this.ctx.fillText(text, x, y);
  }

  private drawJpText(text: string, x: number, y: number, color: string, fontSize: number, align: CanvasTextAlign = 'center') {
    this.ctx.font = `${fontSize}px 'DotGothic16', sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  }

  public drawTitleScreen(w: number, h: number, time: number) {
    this.ctx.fillStyle = COLORS.bgDark;
    this.ctx.fillRect(0, 0, w, h);
    const starCount = 30;
    for (let i = 0; i < starCount; i++) {
      const sx = ((i * 137.5 + time * 20) % w);
      const sy = ((i * 97.3 + time * 10) % h);
      const brightness = 0.3 + 0.3 * Math.sin(time * 2 + i);
      this.ctx.fillStyle = `hsla(${(i * 40) % 360}, 80%, 70%, ${brightness})`;
      this.ctx.fillRect(sx, sy, 3, 3);
    }
    const titleY = h * 0.25;
    const logoSize = Math.min(w * 0.08, 36);
    this.drawGlowText('GELPIYO', w / 2, titleY - logoSize * 1.2, COLORS.neonPink, logoSize);
    const subSize = Math.min(w * 0.06, 24);
    this.drawGlowText('FACTORY', w / 2, titleY + subSize * 0.5, COLORS.neonCyan, subSize);
    const jpSize = Math.min(w * 0.045, 18);
    this.drawJpText('〜 ゲルぴよ製造ゲーム 〜', w / 2, titleY + subSize * 2.5, COLORS.dimWhite, jpSize);

    const blinkAlpha = 0.5 + 0.5 * Math.sin(time * 4);
    this.ctx.globalAlpha = blinkAlpha;
    const tapSize = Math.min(w * 0.04, 16);
    this.drawGlowText('TAP TO START', w / 2, h * 0.6, COLORS.neonYellow, tapSize);
    this.ctx.globalAlpha = 1;

    const helpY = h * 0.85;
    const helpSize = Math.min(w * 0.03, 12);
    this.drawJpText('指で直接モノを運んで調理！', w / 2, helpY, COLORS.neonCyan, helpSize);
  }

  public drawHUD(w: number, h: number, gameState: { timeLeft: number; score: number; combo: number }) {
    const hudH = h * 0.06;
    const pad = w * 0.03;
    const fontSize = Math.min(w * 0.035, 14);
    this.drawPixelRect(0, 0, w, hudH, 'hsla(240, 30%, 8%, 0.9)');
    const timeColor = gameState.timeLeft <= 10 ? COLORS.red : COLORS.neonCyan;
    this.drawJpText(`⏱ ${Math.ceil(gameState.timeLeft)}`, pad, hudH / 2, timeColor, fontSize, 'left');
    this.drawJpText(`💰 ${gameState.score}`, w / 2, hudH / 2, COLORS.neonYellow, fontSize, 'center');
    if (gameState.combo > 1) {
      this.drawJpText(`x${gameState.combo}`, w - pad, hudH / 2, gameState.combo >= 10 ? COLORS.neonPink : COLORS.neonGreen, fontSize, 'right');
    }
  }

  public drawCustomerArea(w: number, h: number, customers: Customer[], customerSlots: number): Array<{ x: number; y: number; w: number; h: number; slotIndex: number }> {
    const areaTop = h * 0.06;
    const areaH = h * 0.28;
    this.drawPixelRect(0, areaTop, w, areaH, 'hsla(240, 20%, 14%, 0.95)');
    const labelSize = Math.min(w * 0.028, 11);
    this.drawJpText('─── お客さん (ココにゲルぴよを渡す) ───', w / 2, areaTop + labelSize * 1.2, COLORS.gray, labelSize);

    const slotH = (areaH - labelSize * 3) / customerSlots;
    const slotStartY = areaTop + labelSize * 3;
    const hitAreas = [];

    for (const customer of customers) {
      if (!customer.active) continue;
      const sy = slotStartY + customer.slotIndex * slotH;
      const slotCenterY = sy + slotH / 2;

      const offsetX = (customer.state === 'entering' ? w * (1 - customer.enterProgress) : 0) - (customer.state === 'served' ? w * (1 - customer.servedTimer / 0.6) : 0);
      this.ctx.save();
      this.ctx.translate(offsetX, 0);

      const bodySize = Math.min(slotH * 0.6, w * 0.1);
      const bodyX = w * 0.12;
      const bounce = Math.sin(customer.bouncePhase) * 2;
      this.ctx.fillStyle = `hsl(${[200, 30, 120, 300, 60][customer.appearance % 5]}, 60%, 55%)`;
      this.ctx.fillRect(bodyX - bodySize / 2, slotCenterY - bodySize / 2 + bounce, bodySize, bodySize);

      if (customer.order) {
        const bubbleX = bodyX + bodySize;
        const bubbleW = w * 0.18;
        const bubbleH = slotH * 0.6;
        this.drawPixelRect(bubbleX, slotCenterY - bubbleH / 2, bubbleW, bubbleH, 'hsla(0,0%,100%,0.9)', customer.order.color);
        this.ctx.fillStyle = customer.order.color;
        this.ctx.beginPath();
        this.ctx.arc(bubbleX + bubbleW / 2, slotCenterY, bubbleH * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
      }

      if (customer.state === 'waiting') {
        const gaugeW = w * 0.35;
        const gaugeH = 6;
        const gaugeX = w * 0.55;
        const gaugeY = slotCenterY - gaugeH / 2;
        this.ctx.fillStyle = 'hsla(0, 0%, 20%, 0.8)';
        this.ctx.fillRect(gaugeX, gaugeY, gaugeW, gaugeH);
        this.ctx.fillStyle = customer.patience > 0.5 ? COLORS.neonGreen : (customer.patience > 0.25 ? COLORS.neonOrange : COLORS.red);
        this.ctx.fillRect(gaugeX, gaugeY, gaugeW * customer.patience, gaugeH);

        hitAreas.push({ x: 0, y: sy, w: w, h: slotH, slotIndex: customer.slotIndex });
      }
      this.ctx.restore();
    }
    return hitAreas;
  }

  public drawPotArea(w: number, h: number, pots: Pot[], images: Record<string, HTMLCanvasElement>, time: number) {
    const areaTop = h * 0.34;
    const areaH = h * 0.21;
    this.drawPixelRect(0, areaTop, w, areaH, 'hsla(20, 20%, 14%, 0.95)', COLORS.neonOrange);
    const labelSize = Math.min(w * 0.025, 10);
    this.drawJpText('─── 鍋 (ペレットやお玉を入れる) ───', w / 2, areaTop + labelSize * 1.5, COLORS.neonOrange, labelSize);

    const itemW = (w - w * 0.2) / pots.length;
    const itemH = itemW;
    const itemY = areaTop + (areaH - itemH) / 2;
    const hitAreas = [];

    for (let i = 0; i < pots.length; i++) {
      const p = pots[i];
      const px = w * 0.05 + i * (itemW + w * 0.1);

      let currentImage = images.pot || null;
      if (p.state === 'melting' && images.pot_solid) {
        currentImage = images.pot_solid;
      } else if (p.state === 'melted' && images.pot_melted) {
        currentImage = images.pot_melted;
      }

      if (currentImage) {
        this.ctx.drawImage(currentImage, px, itemY, itemW, itemH);
      } else {
        this.ctx.fillStyle = 'hsl(0, 0%, 30%)';
        this.ctx.fillRect(px, itemY + itemH * 0.3, itemW, itemH * 0.7);
        this.ctx.fillStyle = 'hsl(0, 0%, 20%)';
        this.ctx.beginPath();
        this.ctx.ellipse(px + itemW / 2, itemY + itemH * 0.3, itemW / 2, itemH * 0.2, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }

      const centerX = px + itemW / 2;
      const centerY = itemY + itemH * 0.4;
      const mouthRX = itemW * 0.35;
      const mouthRY = itemH * 0.15;

      if (p.state === 'melting') {
        const gaugeR = Math.max(mouthRX, mouthRY) * 1.1;
        this.ctx.strokeStyle = 'hsla(0, 0%, 20%, 0.6)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, gaugeR, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = COLORS.neonYellow;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, gaugeR, -Math.PI / 2, -Math.PI / 2 + p.meltProgress * Math.PI * 2);
        this.ctx.stroke();
      } else if (p.state === 'melted') {
        const bounce = Math.sin((time || 0) * 4) * 4;
        this.drawGlowText('SCOOP!', centerX, centerY - 15 + bounce, COLORS.neonCyan, 11);
      }

      hitAreas.push({ x: px, y: itemY, w: itemW, h: itemH });
    }
    return hitAreas;
  }

  public drawMoldArea(w: number, h: number, molds: Mold[], images: Record<string, HTMLCanvasElement>) {
    const areaTop = h * 0.55;
    const areaH = h * 0.21;
    this.drawPixelRect(0, areaTop, w, areaH, 'hsla(240, 15%, 12%, 0.95)', COLORS.neonPurple);
    const labelSize = Math.min(w * 0.025, 10);
    this.drawJpText('─── 型 (トッピングを入れる) ───', w / 2, areaTop + labelSize * 1.5, COLORS.neonPurple, labelSize);

    const moldW = (w - w * 0.15) / molds.length;
    const moldH = areaH * 0.65;
    const moldY = areaTop + areaH * 0.28;
    const hitAreas = [];

    for (let i = 0; i < molds.length; i++) {
      const mold = molds[i];
      const mx = w * 0.05 + i * (moldW + w * 0.02);
      const centerX = mx + moldW / 2;
      const centerY = moldY + moldH * 0.45;
      const imgSize = Math.min(moldW, moldH) * 0.95;
      const imgX = centerX - imgSize / 2;
      const imgY = moldY + (moldH - imgSize) / 2;

      if (mold.state === 'empty') {
        if (images.mold_empty) {
          this.ctx.drawImage(images.mold_empty, imgX, imgY, imgSize, imgSize);
        } else {
          this.drawPixelRect(mx, moldY, moldW, moldH, 'hsla(240, 20%, 16%, 0.9)', 'hsla(240, 20%, 30%, 0.6)');
          this.ctx.strokeStyle = 'hsla(0, 0%, 40%, 0.5)';
          this.ctx.lineWidth = 2;
          this.ctx.setLineDash([4, 4]);
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, imgSize * 0.3, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
          this.drawJpText('空', centerX, centerY, COLORS.gray, 10);
        }
      } else if (mold.state === 'filled') {
        if (images.mold_filled) {
          this.ctx.drawImage(images.mold_filled, imgX, imgY, imgSize, imgSize);
        } else {
          this.drawPixelRect(mx, moldY, moldW, moldH, 'hsla(240, 20%, 16%, 0.9)', 'hsla(240, 20%, 30%, 0.6)');
          this.ctx.fillStyle = 'hsla(180, 20%, 80%, 0.5)';
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, imgSize * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.drawJpText('ADD+', centerX, moldY + moldH - 8, COLORS.neonCyan, 10);
      } else if (mold.state === 'setting') {
        if (images.mold_solid) {
          this.ctx.drawImage(images.mold_solid, imgX, imgY, imgSize, imgSize);
        } else {
          this.drawPixelRect(mx, moldY, moldW, moldH, 'hsla(240, 20%, 16%, 0.9)', 'hsla(240, 20%, 30%, 0.6)');
          this.ctx.fillStyle = 'hsla(0, 0%, 60%, 0.6)';
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, imgSize * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
        }
        
        const gaugeR = imgSize * 0.4;
        this.ctx.strokeStyle = 'hsla(0, 0%, 20%, 0.6)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, gaugeR, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.strokeStyle = COLORS.neonGreen;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, gaugeR, -Math.PI / 2, -Math.PI / 2 + mold.progress * Math.PI * 2);
        this.ctx.stroke();

        this.drawGlowText('???', centerX, centerY, COLORS.neonYellow, 12);
      } else if (mold.state === 'done') {
        const flash = mold.doneFlash > 0 ? 1 + Math.sin(mold.doneFlash * 20) * 0.15 : 1;
        const gelpiyoSize = imgSize * 0.8 * flash;
        const img = mold.gelpiyoType ? images[mold.gelpiyoType.id] : null;
        
        if (img) {
          this.ctx.drawImage(img, centerX - gelpiyoSize / 2, centerY - gelpiyoSize / 2, gelpiyoSize, gelpiyoSize);
        } else {
          this.ctx.fillStyle = mold.gelpiyoType ? mold.gelpiyoType.color : COLORS.neonYellow;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, gelpiyoSize / 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
        this.drawJpText('完成!', centerX, moldY + moldH - 8, COLORS.neonYellow, 10);
      }

      hitAreas.push({ x: mx, y: moldY, w: moldW, h: moldH });
    }
    return hitAreas;
  }

  public drawPaletteArea(w: number, h: number, ingredients: GelpiyoType[], images: Record<string, HTMLCanvasElement>) {
    const btnTop = h * 0.76;
    const btnH = h * 0.24;
    this.drawPixelRect(0, btnTop, w, btnH, 'hsla(240, 15%, 10%, 0.95)');
    
    const toolW = w * 0.18;
    const toolH = btnH * 0.6;
    const toolY = btnTop + btnH * 0.2;
    const margin = w * 0.03;
    
    const pX = margin;
    this.drawPixelRect(pX, toolY, toolW, toolH, 'hsla(180, 30%, 18%, 0.9)', COLORS.neonCyan);
    if (images.pellet_icon) {
      const iconSize = Math.min(toolW * 0.6, toolH * 0.5);
      this.ctx.drawImage(images.pellet_icon, pX + (toolW - iconSize) / 2, toolY + (toolH - iconSize) / 2 - 8, iconSize, iconSize);
    } else {
      this.ctx.fillStyle = 'hsl(0, 0%, 80%)';
      this.ctx.beginPath();
      this.ctx.arc(pX + toolW / 2, toolY + toolH / 2 - 8, toolW * 0.15, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.drawJpText('ペレット', pX + toolW / 2, toolY + toolH - 12, COLORS.neonCyan, 9);

    const lX = pX + toolW + margin;
    this.drawPixelRect(lX, toolY, toolW, toolH, 'hsla(30, 30%, 18%, 0.9)', COLORS.neonYellow);
    if (images.ladle_empty) {
      const iconSize = Math.min(toolW * 0.7, toolH * 0.55);
      this.ctx.drawImage(images.ladle_empty, lX + (toolW - iconSize) / 2, toolY + (toolH - iconSize) / 2 - 8, iconSize, iconSize);
    } else {
      this.ctx.fillStyle = 'hsl(180, 30%, 70%)';
      this.ctx.beginPath();
      this.ctx.ellipse(lX + toolW / 2, toolY + toolH / 2 - 8, toolW * 0.2, toolW * 0.15, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
    this.drawJpText('お玉', lX + toolW / 2, toolY + toolH - 12, COLORS.neonYellow, 9);

    const tStartX = lX + toolW + margin;
    const availableW = w - tStartX - margin;
    const tW = availableW / ingredients.length;
    const tH = toolH;
    const tY = toolY;
    const toppingAreas = [];

    for (let i = 0; i < ingredients.length; i++) {
      const ing = ingredients[i];
      const tx = tStartX + i * tW;
      const innerW = tW - 4;
      this.drawPixelRect(tx, tY, innerW, tH, 'hsla(0, 0%, 15%, 0.9)', ing.ingredientColor);
      this.drawJpText(ing.ingredientEmoji, tx + innerW / 2, tY + tH / 2 - 8, ing.ingredientColor, 18);
      this.drawJpText(ing.ingredient, tx + innerW / 2, tY + tH - 12, ing.ingredientColor, 9);
      toppingAreas.push({ x: tx, y: tY, w: innerW, h: tH });
    }

    return {
      pellet: { x: pX, y: toolY, w: toolW, h: toolH },
      ladle: { x: lX, y: toolY, w: toolW, h: toolH },
      toppings: toppingAreas
    };
  }

  public drawLadleAnimation(ladleAnim: LadleAnim, images: Record<string, HTMLCanvasElement>) {
    const { startX, startY, endX, endY, progress } = ladleAnim;
    
    const t = progress;
    const cpX = (startX + endX) / 2;
    const cpY = Math.min(startY, endY) - 80;
    
    const x = (1 - t) * (1 - t) * startX + 2 * (1 - t) * t * cpX + t * t * endX;
    const y = (1 - t) * (1 - t) * startY + 2 * (1 - t) * t * cpY + t * t * endY;
    
    this.ctx.save();
    this.ctx.globalAlpha = 0.9;
    
    const ladleSize = 60;
    if (images.ladle_filled) {
      this.ctx.drawImage(images.ladle_filled, x - ladleSize / 2, y - ladleSize / 2, ladleSize, ladleSize);
    } else {
      this.ctx.fillStyle = COLORS.neonYellow;
      this.ctx.beginPath();
      this.ctx.arc(x, y, 20, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    this.ctx.restore();
  }

  public drawDraggedItem(dragState: DragState, gelpiyoImages: Record<string, HTMLCanvasElement>) {
    const { x, y, type, payload } = dragState;
    this.ctx.save();
    this.ctx.globalAlpha = 0.8;
    
    if (type === 'pellet') {
      if (gelpiyoImages.pellet_icon) {
        this.ctx.drawImage(gelpiyoImages.pellet_icon, x - 25, y - 25, 50, 50);
      } else {
        this.ctx.fillStyle = 'hsl(0, 0%, 80%)';
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (type === 'ladle') {
      if (gelpiyoImages.ladle_empty) {
        this.ctx.drawImage(gelpiyoImages.ladle_empty, x - 30, y - 30, 60, 60);
      } else {
        this.ctx.fillStyle = 'hsl(180, 30%, 70%)';
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, 25, 15, 0, 0, Math.PI * 2);
        this.ctx.fill();
      }
    } else if (type === 'topping' && payload) {
      this.drawJpText(payload.ingredientEmoji, x, y, payload.ingredientColor, 40);
    } else if (type === 'gelpiyo' && payload) {
      const img = gelpiyoImages[payload.id];
      if (img) {
        this.ctx.drawImage(img, x - 30, y - 30, 60, 60);
      } else {
        this.ctx.fillStyle = payload.color;
        this.ctx.beginPath();
        this.ctx.arc(x, y, 30, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  public drawStunOverlay(w: number, h: number, stunTimer: number) {
    if (stunTimer <= 0) return;
    this.ctx.fillStyle = `hsla(0, 60%, 20%, ${0.4 * (stunTimer / 2)})`;
    this.ctx.fillRect(0, 0, w, h);
    const shake = Math.sin(stunTimer * 30) * 5;
    this.drawGlowText('MISS!', w / 2 + shake, h * 0.5, COLORS.red, 24);
  }

  public drawComboPopup(w: number, h: number, comboPopup: { combo: number; bonus: number; timer: number }) {
    if (!comboPopup || comboPopup.timer <= 0) return;
    this.ctx.save();
    this.ctx.globalAlpha = Math.min(1, comboPopup.timer * 3);
    const scale = 1 + (1 - comboPopup.timer) * 0.5;
    this.ctx.translate(w * 0.7, h * 0.3);
    this.ctx.scale(scale, scale);
    this.drawGlowText(`${comboPopup.combo} COMBO!`, 0, 0, COLORS.neonPink, 20);
    this.drawJpText(`+${comboPopup.bonus}`, 0, 20, COLORS.neonYellow, 12);
    this.ctx.restore();
  }

  public drawResultScreen(w: number, h: number, result: any, time: number) {
    this.ctx.fillStyle = 'hsla(240, 30%, 5%, 0.92)';
    this.ctx.fillRect(0, 0, w, h);
    const centerX = w / 2;
    this.drawGlowText('TIME UP!', centerX, h * 0.12, COLORS.neonPink, 24);
    this.drawPixelRect(w * 0.08, h * 0.2, w * 0.84, h * 0.5, COLORS.bgPanel, COLORS.neonCyan);
    
    let lineY = h * 0.2 + h * 0.5 * 0.12;
    const lineSpacing = h * 0.5 * 0.13;
    this.drawJpText('スコア', centerX, lineY, COLORS.dimWhite, 14); lineY += lineSpacing * 0.7;
    this.drawGlowText(`${result.score}`, centerX, lineY, COLORS.neonYellow, 20); lineY += lineSpacing;
    if (result.isNewRecord) {
      this.ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 6);
      this.drawGlowText('NEW RECORD!', centerX, lineY, COLORS.neonPink, 16);
      this.ctx.globalAlpha = 1;
      lineY += lineSpacing;
    }
    this.drawJpText(`接客成功: ${result.served}人`, centerX, lineY, COLORS.neonGreen, 14); lineY += lineSpacing * 0.8;
    this.drawJpText(`最大コンボ: x${result.maxCombo}`, centerX, lineY, COLORS.neonOrange, 14); lineY += lineSpacing * 0.8;
    this.drawJpText(`失客: ${result.missed}人`, centerX, lineY, COLORS.red, 14); lineY += lineSpacing;
    this.drawJpText(`ランキング: ${result.rank}位`, centerX, lineY, COLORS.neonPurple, 14);

    const btnY = h * 0.78;
    this.ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 4);
    this.drawPixelRect(centerX - w * 0.25, btnY, w * 0.5, h * 0.06, 'hsla(180, 40%, 20%, 0.9)', COLORS.neonCyan);
    this.drawJpText('TAP TO RETRY', centerX, btnY + h * 0.03, COLORS.neonCyan, 14);
    this.ctx.globalAlpha = 1;
  }
}
