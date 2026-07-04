// ============================================
// assetLoader.ts - Image Loading & Chroma Keying
// ============================================

export function chromaKeyRemove(
  img: HTMLImageElement,
  threshold: number = 50,
  bgColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const offCanvas = document.createElement('canvas');
  offCanvas.width = w;
  offCanvas.height = h;

  const ctx = offCanvas.getContext('2d');
  if (!ctx) return offCanvas;

  ctx.drawImage(img, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const dr = r - bgColor.r;
    const dg = g - bgColor.g;
    const db = b - bgColor.b;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);

    if (distance < threshold) {
      data[i + 3] = 0;
    } else if (distance < threshold * 1.5) {
      const alpha = ((distance - threshold) / (threshold * 0.5)) * 255;
      data[i + 3] = Math.min(data[i + 3], Math.floor(alpha));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return offCanvas;
}

export function loadAndChromaKey(
  src: string,
  threshold: number = 50,
  bgColor: { r: number; g: number; b: number } = { r: 255, g: 255, b: 255 }
): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const processed = chromaKeyRemove(img, threshold, bgColor);
        resolve(processed);
      } catch (e) {
        console.error('Chromakey processing failed for:', src, e);
        const fallback = document.createElement('canvas');
        fallback.width = img.naturalWidth;
        fallback.height = img.naturalHeight;
        const ctx = fallback.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(fallback);
      }
    };
    img.onerror = () => {
      console.error('Failed to load image:', src);
      const fallback = document.createElement('canvas');
      fallback.width = 64;
      fallback.height = 64;
      resolve(fallback);
    };
    img.src = src;
  });
}

export async function loadFactoryAssets(): Promise<Record<string, HTMLCanvasElement>> {
  const images: Record<string, HTMLCanvasElement> = {};

  const gelpiyos = {
    yellow: '/assets/factory/characters/gelpiyo.webp',
    pink: '/assets/factory/characters/momopiyo.webp',
    green: '/assets/factory/characters/midopiyo.webp'
  };

  for (const [id, path] of Object.entries(gelpiyos)) {
    images[id] = await loadAndChromaKey(path, 60, { r: 255, g: 255, b: 255 });
  }

  images['pot'] = await loadAndChromaKey('/assets/factory/ui/pot_empty.webp', 40, { r: 0, g: 0, b: 0 });
  images['pot_solid'] = await loadAndChromaKey('/assets/factory/ui/pot_solid.webp', 40, { r: 0, g: 0, b: 0 });
  images['pot_melted'] = await loadAndChromaKey('/assets/factory/ui/pot_melted.webp', 40, { r: 0, g: 0, b: 0 });
  images['pellet_icon'] = await loadAndChromaKey('/assets/factory/ui/pellet_icon.webp', 40, { r: 0, g: 0, b: 0 });

  images['ladle_empty'] = await loadAndChromaKey('/assets/factory/ui/ladle_empty.webp', 40, { r: 0, g: 0, b: 0 });
  images['ladle_filled'] = await loadAndChromaKey('/assets/factory/ui/ladle_filled.webp', 40, { r: 0, g: 0, b: 0 });

  images['mold_empty'] = await loadAndChromaKey('/assets/factory/ui/momopiyo_mold.webp', 40, { r: 0, g: 0, b: 0 });
  images['mold_filled'] = await loadAndChromaKey('/assets/factory/ui/momopiyo_mold_filled.webp', 40, { r: 0, g: 0, b: 0 });
  images['mold_solid'] = await loadAndChromaKey('/assets/factory/ui/momopiyo_mold_solid.webp', 40, { r: 0, g: 0, b: 0 });

  return images;
}
