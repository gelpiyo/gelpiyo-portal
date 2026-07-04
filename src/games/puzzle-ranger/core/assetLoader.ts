// ============================================
// assetLoader.ts - Image Loader with Chroma Keying
// ============================================

const baseUrl = import.meta.env.BASE_URL;
const ASSET_MAP: Record<string, { src: string; isJpg: boolean }> = {
  ranger_red:    { src: `${baseUrl}assets/puzzle-ranger/characters/ranger_red.jpg`,    isJpg: true },
  ranger_blue:   { src: `${baseUrl}assets/puzzle-ranger/characters/ranger_blue.jpg`,   isJpg: true },
  ranger_green:  { src: `${baseUrl}assets/puzzle-ranger/characters/ranger_green.jpg`,  isJpg: true },
  ranger_yellow: { src: `${baseUrl}assets/puzzle-ranger/characters/ranger_yellow.jpg`, isJpg: true },
  ranger_pink:   { src: `${baseUrl}assets/puzzle-ranger/characters/ranger_pink.jpg`,   isJpg: true },
  waru_piyo:     { src: `${baseUrl}assets/puzzle-ranger/characters/waru_piyo.jpg`,     isJpg: true },
  kuro_piyo:     { src: `${baseUrl}assets/puzzle-ranger/characters/kuro_piyo.jpg`,     isJpg: true },
  mecha_piyo:    { src: `${baseUrl}assets/puzzle-ranger/characters/mecha_piyo.png`,    isJpg: false },
  bura_piyo:     { src: `${baseUrl}assets/puzzle-ranger/characters/bura_piyo.png`,     isJpg: false },
  gold_piyo:     { src: `${baseUrl}assets/puzzle-ranger/characters/gold_piyo.png`,     isJpg: false },
};

function processTransparency(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 4 corners background color estimation
  const bgSamples = [
    [0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [sx, sy] of bgSamples) {
    const idx = (sy * canvas.width + sx) * 4;
    bgR += data[idx];
    bgG += data[idx + 1];
    bgB += data[idx + 2];
  }
  bgR = Math.round(bgR / 4);
  bgG = Math.round(bgG / 4);
  bgB = Math.round(bgB / 4);

  const threshold = 60;
  for (let i = 0; i < data.length; i += 4) {
    const dr = Math.abs(data[i] - bgR);
    const dg = Math.abs(data[i + 1] - bgG);
    const db = Math.abs(data[i + 2] - bgB);
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist < threshold) {
      data[i + 3] = 0;
    } else if (dist < threshold + 20) {
      const edgeAlpha = Math.min(255, ((dist - threshold) / 20) * 255);
      data[i + 3] = Math.round(edgeAlpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

export async function loadPuzzleRangerAssets(): Promise<Record<string, HTMLCanvasElement | HTMLImageElement>> {
  const images: Record<string, HTMLCanvasElement | HTMLImageElement> = {};

  const loadImage = (key: string, src: string, isJpg: boolean): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (isJpg) {
          images[key] = processTransparency(img);
        } else {
          images[key] = img;
        }
        resolve();
      };
      img.onerror = () => {
        console.warn(`[Assets] Failed to load image: ${key} (${src})`);
        resolve();
      };
      img.src = src;
    });
  };

  await Promise.all(
    Object.entries(ASSET_MAP).map(([key, { src, isJpg }]) => loadImage(key, src, isJpg))
  );

  return images;
}
