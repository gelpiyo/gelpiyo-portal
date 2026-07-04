// ============================================
// assetLoader.ts — 画像アセットのロードと白背景透過処理
// ============================================

/** ロードするアセット定義 */
const ASSET_MAP: Record<string, string> = {
  gelpiyo:  '/assets/bounce/characters/gelpiyo.jpg',
  warpiyo:  '/assets/bounce/characters/burapiyo.png',   // ワルぴよ = ブラぴよ画像使用（元のゲームと同じ）
  burapiyo: '/assets/bounce/characters/burapiyo.png',
};

/**
 * 白背景をアルファ透過に変換（クロマキー透過）
 * 元の _processTransparency と同じロジック：全画像に適用
 */
function processTransparency(img: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const size = Math.min(img.width, img.height, 256);
  const scale = size / Math.max(img.width, img.height);
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    // 白に近いピクセルを透過（背景除去）
    const threshold = 235;
    if (r > threshold && g > threshold && b > threshold) {
      data[i + 3] = 0;
    } else {
      // 白に近いほど半透明に（エッジをなめらかに）
      const whiteness = Math.min(r, g, b);
      if (whiteness > 200) {
        const alpha = Math.round(255 * (1 - (whiteness - 200) / 55));
        data[i + 3] = Math.min(data[i + 3], alpha);
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

/**
 * 全画像アセットをロード
 * @returns 画像キーをキーとする画像マップ
 */
export async function loadBounceAssets(): Promise<Record<string, HTMLCanvasElement>> {
  const images: Record<string, HTMLCanvasElement> = {};

  const loadImage = (key: string, src: string): Promise<void> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // 全画像に白背景透過処理を適用（元のゲームと同じ）
        images[key] = processTransparency(img);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[Assets] 画像読み込み失敗: ${key} (${src})`);
        resolve(); // 失敗してもフォールバック描画がある
      };
      img.src = src;
    });
  };

  await Promise.all(
    Object.entries(ASSET_MAP).map(([key, src]) => loadImage(key, src)),
  );

  console.log('[Assets] 全アセット読み込み完了', Object.keys(images));
  return images;
}
