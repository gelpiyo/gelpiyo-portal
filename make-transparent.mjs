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
    
    // Check for white or near white
    if (r > 240 && g > 240 && b > 240) {
      data[idx + 3] = 0; // alpha
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
