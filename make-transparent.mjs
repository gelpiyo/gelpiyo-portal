import sharp from 'sharp';

async function processImage() {
  const inputPath = 'public/assets/factory/characters/gelpiyo.webp';
  const outputPath = 'public/assets/factory/characters/gelpiyo_transparent.png';

  const { data, info } = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const numPixels = info.width * info.height;
  for (let i = 0; i < numPixels; i++) {
    const idx = i * info.channels;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    
    // RGBの平均（明度）
    const luminance = (r + g + b) / 3;
    
    // R,G,Bの差（彩度の指標）
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const chroma = maxC - minC;

    // ゲルぴよ本体は黄色（RとGが高く、Bが低い）なので、chroma が大きい。
    // 背景の白や、足元の影（グレー）は無彩色に近いので、chroma が小さい。
    
    // 無彩色（彩度が低く）かつ、明るさが中程度（影）〜最大（白背景）のものを透過の対象にする
    if (chroma < 40 && luminance > 160) {
      // luminance = 160 の時は alpha = 255(不透明)
      // luminance = 255 の時は alpha = 0(透明)
      // ただし、影をしっかり消すために、少し下限を引き上げる
      const threshold = 160;
      let alpha = 255 - ((luminance - threshold) / (255 - threshold)) * 255;
      
      // さらに彩度が低いほど（完全なグレーに近いほど）透明度を上げる
      const grayFactor = 1.0 - (chroma / 40); 
      alpha = alpha * (1 - grayFactor * 0.8); // 最大80%さらに薄くする

      alpha = Math.max(0, Math.min(255, Math.floor(alpha)));
      
      // 元のアルファ値を超えないようにする
      data[idx + 3] = Math.min(data[idx + 3], alpha);
    } else if (r > 240 && g > 240 && b > 240) {
      // 念のため、非常に明るい（ほぼ白）部分は強制的に透明に
      data[idx + 3] = 0;
    }
  }

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels
    }
  }).png().toFile(outputPath);

  console.log('Image processed successfully!');
}

processImage().catch(console.error);
