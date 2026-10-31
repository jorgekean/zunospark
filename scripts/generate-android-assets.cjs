const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const svgPath = path.join(root, 'public', 'zuno-icon.svg');
  const resDir = path.join(root, 'android', 'app', 'src', 'main', 'res');

  if (!fs.existsSync(svgPath)) {
    console.error('SVG not found:', svgPath);
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(svgPath);

  // 1. Google Play Store Assets
  console.log('Generating Google Play Store 512x512 icon...');
  const playStoreIcon = await sharp(svgBuffer).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(root, 'android', 'play-store-icon-512.png'), playStoreIcon);
  fs.writeFileSync(path.join(root, 'public', 'play-store-icon-512.png'), playStoreIcon);

  console.log('Generating Google Play Store 1024x500 Feature Graphic...');
  // Render Zuno at 380x380 for the feature banner
  const zunoGraphic = await sharp(svgBuffer).resize(360, 360).png().toBuffer();

  const featureBannerSvg = `
    <svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="bgGlow" cx="25%" cy="50%" r="65%">
          <stop offset="0%" stop-color="#2a126d" />
          <stop offset="45%" stop-color="#140b3b" />
          <stop offset="100%" stop-color="#070417" />
        </radialGradient>
        <radialGradient id="sparkGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#00f2fe" stop-opacity="0.4" />
          <stop offset="100%" stop-color="#00f2fe" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ffd166" />
          <stop offset="50%" stop-color="#00f2fe" />
          <stop offset="100%" stop-color="#c77dff" />
        </linearGradient>
      </defs>
      <rect width="1024" height="500" fill="url(#bgGlow)" />
      <circle cx="250" cy="250" r="230" fill="url(#sparkGlow)" />
      
      <!-- Ambient sparks -->
      <circle cx="120" cy="90" r="4" fill="#ffd166" opacity="0.8" />
      <circle cx="480" cy="70" r="6" fill="#00f2fe" opacity="0.9" />
      <circle cx="920" cy="140" r="5" fill="#ffd166" opacity="0.7" />
      <circle cx="580" cy="420" r="4" fill="#c77dff" opacity="0.8" />
      <circle cx="890" cy="400" r="7" fill="#00f2fe" opacity="0.8" />
      <circle cx="950" cy="290" r="3" fill="#ffffff" opacity="0.9" />

      <!-- Typography -->
      <text x="490" y="210" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="74" fill="url(#textGrad)" letter-spacing="1.5">ZunoSpark</text>
      <text x="495" y="275" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="28" fill="#e0d4ff" letter-spacing="1">Wait-Power &amp; Focus Trainer</text>
      <text x="495" y="325" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#9ca3af">Ages 3–6 • Offline-First • 100% Kid Safe</text>
      
      <!-- Badges -->
      <rect x="495" y="360" width="165" height="42" rx="21" fill="#00f2fe" fill-opacity="0.15" stroke="#00f2fe" stroke-width="1.5" />
      <text x="577" y="387" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="15" fill="#00f2fe">NO ADS • PRIVATE</text>

      <rect x="675" y="360" width="180" height="42" rx="21" fill="#ffd166" fill-opacity="0.15" stroke="#ffd166" stroke-width="1.5" />
      <text x="765" y="387" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="15" fill="#ffd166">CALM COZY TIMERS</text>
    </svg>
  `;

  const bannerBase = await sharp(Buffer.from(featureBannerSvg)).png().toBuffer();
  const featureGraphic = await sharp(bannerBase)
    .composite([
      {
        input: zunoGraphic,
        top: 70,
        left: 80,
      },
    ])
    .png()
    .toBuffer();

  fs.writeFileSync(path.join(root, 'android', 'play-store-feature-graphic-1024x500.png'), featureGraphic);
  fs.writeFileSync(path.join(root, 'public', 'play-store-feature-graphic.png'), featureGraphic);

  // 2. Android Mipmap Launcher Icons
  const mipmapSizes = [
    { dir: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  // Create foreground SVG (Zuno on transparent background scaled to safe area inner 66%)
  // We remove the outer background rect and keep Zuno character
  const fgSvg = svgBuffer.toString('utf-8').replace('<rect width="512" height="512" rx="112" fill="#0f0a2c"/>', '');
  const fgSvgBuffer = Buffer.from(fgSvg);

  for (const m of mipmapSizes) {
    const targetDir = path.join(resDir, m.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png (standard square with rounded corners)
    const iconBuf = await sharp(svgBuffer).resize(m.iconSize, m.iconSize).png().toBuffer();
    fs.writeFileSync(path.join(targetDir, 'ic_launcher.png'), iconBuf);

    // ic_launcher_round.png (circular mask)
    const circleMask = Buffer.from(
      `<svg><circle cx="${m.iconSize / 2}" cy="${m.iconSize / 2}" r="${m.iconSize / 2}" fill="white"/></svg>`
    );
    const roundIconBuf = await sharp(iconBuf)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(targetDir, 'ic_launcher_round.png'), roundIconBuf);

    // ic_launcher_foreground.png (transparent foreground padded so it fits inside safe zone)
    const innerSize = Math.round(m.fgSize * 0.72);
    const margin = Math.round((m.fgSize - innerSize) / 2);
    const innerBuf = await sharp(fgSvgBuffer).resize(innerSize, innerSize).png().toBuffer();

    const fgBuf = await sharp({
      create: {
        width: m.fgSize,
        height: m.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: innerBuf, top: margin, left: margin }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(targetDir, 'ic_launcher_foreground.png'), fgBuf);
  }

  // 3. Splash Screens
  console.log('Generating Splash screens...');
  const splashDrawables = [
    { dir: 'drawable', w: 480, h: 800, icon: 200 },
    { dir: 'drawable-port-mdpi', w: 320, h: 480, icon: 140 },
    { dir: 'drawable-port-hdpi', w: 480, h: 800, icon: 200 },
    { dir: 'drawable-port-xhdpi', w: 720, h: 1280, icon: 300 },
    { dir: 'drawable-port-xxhdpi', w: 960, h: 1600, icon: 420 },
    { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920, icon: 520 },
    { dir: 'drawable-land-mdpi', w: 480, h: 320, icon: 140 },
    { dir: 'drawable-land-hdpi', w: 800, h: 480, icon: 190 },
    { dir: 'drawable-land-xhdpi', w: 1280, h: 720, icon: 260 },
    { dir: 'drawable-land-xxhdpi', w: 1600, h: 960, icon: 340 },
    { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280, icon: 420 },
  ];

  for (const s of splashDrawables) {
    const targetDir = path.join(resDir, s.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const iconImg = await sharp(svgBuffer).resize(s.icon, s.icon).png().toBuffer();
    const top = Math.round((s.h - s.icon) / 2);
    const left = Math.round((s.w - s.icon) / 2);

    const splashBuf = await sharp({
      create: {
        width: s.w,
        height: s.h,
        channels: 4,
        background: { r: 15, g: 10, b: 44, alpha: 1 }, // #0f0a2c
      },
    })
      .composite([{ input: iconImg, top, left }])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(targetDir, 'splash.png'), splashBuf);
  }

  console.log('All Android assets and Google Play graphics generated successfully!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
