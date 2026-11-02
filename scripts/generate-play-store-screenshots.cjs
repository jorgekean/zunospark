const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'android', 'screenshots');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function xmlSafe(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

async function main() {
  const zunoSvgPath = path.join(root, 'public', 'zuno-icon.svg');
  const zunoSvgBuf = fs.readFileSync(zunoSvgPath);
  
  // Render Zuno icon at 280x280 and 400x400 PNG buffers for compositing
  const zuno400 = await sharp(zunoSvgBuf).resize(400, 400).png().toBuffer();
  const zuno240 = await sharp(zunoSvgBuf).resize(240, 240).png().toBuffer();

  const screenshots = [
    {
      filename: 'screenshot-1-hub.png',
      badge: '🦊 ADVENTURE HUB',
      title: 'BUILD WAIT-POWER & FOCUS',
      subtitle: 'Gentle Executive Function Micro-Games for Ages 3–6',
      accentColor: '#00f2fe',
      composites: [
        { input: zuno400, top: 620, left: 340 }
      ],
      svgContent: `
        <!-- Phone Frame Outer Container -->
        <g transform="translate(100, 460)">
          <rect width="880" height="1380" rx="56" fill="#0c0724" stroke="rgba(0, 242, 254, 0.4)" stroke-width="4" />
          <rect x="350" y="20" width="180" height="22" rx="11" fill="#1b1242" />
          
          <!-- Top App Bar -->
          <text x="60" y="95" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="40" fill="#ffd166">ZunoSpark</text>
          <rect x="660" y="60" width="160" height="46" rx="23" fill="rgba(255,209,102,0.15)" stroke="#ffd166" stroke-width="2" />
          <text x="740" y="92" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#ffd166" text-anchor="middle">⚡ 45 Sparks</text>

          <!-- Dialogue Box below Zuno (Zuno composited at y:620, x:340 -> inside phone y: 160) -->
          <rect x="80" y="580" width="720" height="110" rx="24" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.12)" stroke-width="2" />
          <text x="440" y="628" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="26" fill="#e0d4ff" text-anchor="middle">&quot;Ready to calm my electric tail today?&quot;</text>
          <text x="440" y="665" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#38bdf8" text-anchor="middle">Choose an adventure trail below ⬇</text>

          <!-- Trail 1 Card -->
          <g transform="translate(80, 720)">
            <rect width="720" height="130" rx="24" fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" stroke-width="2" />
            <circle cx="70" cy="65" r="40" fill="#00f2fe" fill-opacity="0.2" />
            <text x="70" y="78" font-size="38" text-anchor="middle">🫐</text>
            <text x="140" y="55" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffffff">Spark Berry Grove</text>
            <text x="140" y="92" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#93c5fd">Inhibitory Control • Spot 1-5 Trail</text>
            <rect x="580" y="40" width="100" height="50" rx="16" fill="#00f2fe" />
            <text x="630" y="73" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22" fill="#0b0826" text-anchor="middle">PLAY</text>
          </g>

          <!-- Trail 2 Card -->
          <g transform="translate(80, 880)">
            <rect width="720" height="130" rx="24" fill="rgba(255, 209, 102, 0.12)" stroke="#ffd166" stroke-width="2" />
            <circle cx="70" cy="65" r="40" fill="#ffd166" fill-opacity="0.2" />
            <text x="70" y="78" font-size="38" text-anchor="middle">🔔</text>
            <text x="140" y="55" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffffff">Thunder Chimes</text>
            <text x="140" y="92" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#fde047">Working Memory • Melody Sequences</text>
            <rect x="580" y="40" width="100" height="50" rx="16" fill="#ffd166" />
            <text x="630" y="73" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22" fill="#0b0826" text-anchor="middle">PLAY</text>
          </g>

          <!-- Trail 3 Card -->
          <g transform="translate(80, 1040)">
            <rect width="720" height="130" rx="24" fill="rgba(199, 125, 255, 0.12)" stroke="#c77dff" stroke-width="2" />
            <circle cx="70" cy="65" r="40" fill="#c77dff" fill-opacity="0.2" />
            <text x="70" y="78" font-size="38" text-anchor="middle">⚡</text>
            <text x="140" y="55" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffffff">Twin Currents</text>
            <text x="140" y="92" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#d8b4fe">Bilateral Coordination • Dual Steer</text>
            <rect x="580" y="40" width="100" height="50" rx="16" fill="#c77dff" />
            <text x="630" y="73" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22" fill="#0b0826" text-anchor="middle">PLAY</text>
          </g>

          <!-- Bottom Nav / Parent Gate button -->
          <g transform="translate(80, 1200)">
            <rect width="720" height="80" rx="20" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.1)" stroke-width="1.5" />
            <text x="360" y="50" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#94a3b8" text-anchor="middle">🔒 Parent Dashboard (Hold 3 Seconds)</text>
          </g>
        </g>
      `
    },
    {
      filename: 'screenshot-2-berry-grove.png',
      badge: '🫐 INHIBITORY CONTROL',
      title: 'SPARK BERRY GROVE',
      subtitle: 'Build Impulse Control: Wait for the Golden Glow to Harvest!',
      accentColor: '#ffd166',
      composites: [
        { input: zuno240, top: 1480, left: 420 }
      ],
      svgContent: `
        <!-- Phone Frame Container -->
        <g transform="translate(100, 460)">
          <rect width="880" height="1380" rx="56" fill="#0c0724" stroke="rgba(255, 209, 102, 0.4)" stroke-width="4" />
          <rect x="350" y="20" width="180" height="22" rx="11" fill="#1b1242" />

          <!-- Game Header -->
          <text x="440" y="100" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#ffd166" text-anchor="middle">Spark Berry Grove</text>
          <text x="440" y="145" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="22" fill="#93c5fd" text-anchor="middle">Spot 3: Golden Patience Trial</text>

          <!-- Outer Glow Rings -->
          <circle cx="440" cy="540" r="300" fill="rgba(255, 209, 102, 0.08)" stroke="#ffd166" stroke-width="3" stroke-dasharray="16 12" />
          <circle cx="440" cy="540" r="220" fill="rgba(255, 209, 102, 0.15)" />

          <!-- Center Ripe Berry Bush -->
          <circle cx="440" cy="540" r="150" fill="#ffd166" />
          <circle cx="440" cy="540" r="130" fill="#f59e0b" />
          <text x="440" y="580" font-size="110" text-anchor="middle">🫐</text>

          <!-- Impulse Control Prompt Bar -->
          <rect x="100" y="860" width="680" height="110" rx="28" fill="#150f38" stroke="#ffd166" stroke-width="3" />
          <text x="440" y="910" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="32" fill="#ffd166" text-anchor="middle">✨ GOLDEN GLOW! TAP NOW! ✨</text>
          <text x="440" y="946" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="20" fill="#fef08a" text-anchor="middle">Wait-Power Succeeded: +5 Gold Sparks Earned!</text>
        </g>
      `
    },
    {
      filename: 'screenshot-3-thunder-chimes.png',
      badge: '🔔 WORKING MEMORY',
      title: 'THUNDER CHIMES',
      subtitle: 'Strengthen Auditory Working Memory & Sequential Recall',
      accentColor: '#38bdf8',
      composites: [],
      svgContent: `
        <!-- Phone Frame Container -->
        <g transform="translate(100, 460)">
          <rect width="880" height="1380" rx="56" fill="#0c0724" stroke="rgba(56, 189, 248, 0.4)" stroke-width="4" />
          <rect x="350" y="20" width="180" height="22" rx="11" fill="#1b1242" />

          <!-- Game Header -->
          <text x="440" y="100" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#38bdf8" text-anchor="middle">Thunder Chimes</text>
          <text x="440" y="145" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="22" fill="#bae6fd" text-anchor="middle">Spot 2: 3-Bell Harmony Sequence</text>

          <!-- Prompt Banner -->
          <rect x="100" y="200" width="680" height="80" rx="20" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" stroke-width="2" />
          <text x="440" y="250" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="24" fill="#e0f2fe" text-anchor="middle">Listen to Zuno&apos;s melody, then chime back!</text>

          <!-- 4 Chimes -->
          <!-- Bell 1 -->
          <g transform="translate(140, 340)">
            <rect width="270" height="270" rx="36" fill="rgba(56, 189, 248, 0.15)" stroke="#38bdf8" stroke-width="4" />
            <circle cx="135" cy="115" r="55" fill="#38bdf8" fill-opacity="0.3" />
            <text x="135" y="135" font-size="56" text-anchor="middle">🔔</text>
            <text x="135" y="220" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="#38bdf8" text-anchor="middle">High Spark (C)</text>
          </g>
          <!-- Bell 2 (Active) -->
          <g transform="translate(470, 340)">
            <rect width="270" height="270" rx="36" fill="rgba(251, 191, 36, 0.25)" stroke="#fbbf24" stroke-width="5" />
            <circle cx="135" cy="115" r="60" fill="#fbbf24" fill-opacity="0.5" />
            <text x="135" y="135" font-size="56" text-anchor="middle">✨</text>
            <text x="135" y="220" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="26" fill="#fbbf24" text-anchor="middle">Sun Chime (E)</text>
          </g>
          <!-- Bell 3 -->
          <g transform="translate(140, 660)">
            <rect width="270" height="270" rx="36" fill="rgba(192, 132, 252, 0.15)" stroke="#c084fc" stroke-width="4" />
            <circle cx="135" cy="115" r="55" fill="#c084fc" fill-opacity="0.3" />
            <text x="135" y="135" font-size="56" text-anchor="middle">🔔</text>
            <text x="135" y="220" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="#c084fc" text-anchor="middle">Moon Ring (G)</text>
          </g>
          <!-- Bell 4 -->
          <g transform="translate(470, 660)">
            <rect width="270" height="270" rx="36" fill="rgba(52, 211, 153, 0.15)" stroke="#34d399" stroke-width="4" />
            <circle cx="135" cy="115" r="55" fill="#34d399" fill-opacity="0.3" />
            <text x="135" y="135" font-size="56" text-anchor="middle">🔔</text>
            <text x="135" y="220" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="#34d399" text-anchor="middle">Deep Echo (C)</text>
          </g>

          <!-- Sequence Recalled Progress Indicator -->
          <g transform="translate(290, 1020)">
            <rect x="0" y="0" width="70" height="22" rx="11" fill="#fbbf24" />
            <rect x="110" y="0" width="70" height="22" rx="11" fill="#38bdf8" />
            <rect x="220" y="0" width="70" height="22" rx="11" fill="rgba(255,255,255,0.2)" />
          </g>
          <text x="440" y="1100" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="22" fill="#93c5fd" text-anchor="middle">2 of 3 Sequence Recalled Correctly</text>
        </g>
      `
    },
    {
      filename: 'screenshot-4-twin-currents.png',
      badge: '⚡ BILATERAL COORDINATION',
      title: 'TWIN CURRENTS',
      subtitle: 'Two-Hand Bilateral Motor Control: Steer Dual Electric Streams',
      accentColor: '#c084fc',
      composites: [],
      svgContent: `
        <!-- Phone Frame Container -->
        <g transform="translate(100, 460)">
          <rect width="880" height="1380" rx="56" fill="#0c0724" stroke="rgba(192, 132, 252, 0.4)" stroke-width="4" />
          <rect x="350" y="20" width="180" height="22" rx="11" fill="#1b1242" />

          <!-- Header -->
          <text x="440" y="100" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="34" fill="#c084fc" text-anchor="middle">Twin Currents</text>
          <text x="440" y="145" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="22" fill="#e9d5ff" text-anchor="middle">Two-Hand Simultaneous Stream Balancing</text>

          <!-- Center Battery Core -->
          <circle cx="440" cy="500" r="140" fill="rgba(0, 242, 254, 0.15)" stroke="#00f2fe" stroke-width="4" />
          <circle cx="440" cy="500" r="85" fill="#00f2fe" fill-opacity="0.3" />
          <text x="440" y="530" font-size="76" text-anchor="middle">🔋</text>
          <text x="440" y="685" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#ffd166" text-anchor="middle">85% Charged!</text>

          <!-- Stream Left (Cyan) -->
          <path d="M140 880 Q220 720 380 560" stroke="#00f2fe" stroke-width="18" fill="none" stroke-linecap="round" />
          <!-- Stream Right (Amber) -->
          <path d="M740 880 Q660 720 500 560" stroke="#ffd166" stroke-width="18" fill="none" stroke-linecap="round" />

          <!-- Left Touch Dial Control -->
          <g transform="translate(110, 920)">
            <circle cx="90" cy="90" r="90" fill="rgba(0, 242, 254, 0.15)" stroke="#00f2fe" stroke-width="4" />
            <circle cx="90" cy="90" r="45" fill="#00f2fe" />
            <text x="90" y="225" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#00f2fe" text-anchor="middle">👈 Left Thumb</text>
          </g>

          <!-- Right Touch Dial Control -->
          <g transform="translate(590, 920)">
            <circle cx="90" cy="90" r="90" fill="rgba(255, 209, 102, 0.15)" stroke="#ffd166" stroke-width="4" />
            <circle cx="90" cy="90" r="45" fill="#ffd166" />
            <text x="90" y="225" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#ffd166" text-anchor="middle">Right Thumb 👉</text>
          </g>

          <!-- Science Note -->
          <rect x="100" y="1220" width="680" height="70" rx="18" fill="rgba(255,255,255,0.06)" />
          <text x="440" y="1265" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#c4b5fd" text-anchor="middle">Cross-hemisphere brain bilateral motor exercise</text>
        </g>
      `
    },
    {
      filename: 'screenshot-5-parent-dashboard.png',
      badge: '🛡️ FAMILY PRIVACY & SAFETY',
      title: 'PARENT DASHBOARD & COZY BREAKS',
      subtitle: 'Zero Ads • Zero Trackers • Screen-Free Smooth Hand-Offs',
      accentColor: '#34d399',
      composites: [],
      svgContent: `
        <!-- Phone Frame Container -->
        <g transform="translate(100, 460)">
          <rect width="880" height="1380" rx="56" fill="#0c0724" stroke="rgba(52, 211, 153, 0.4)" stroke-width="4" />
          <rect x="350" y="20" width="180" height="22" rx="11" fill="#1b1242" />

          <!-- Dashboard Header -->
          <text x="440" y="95" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="32" fill="#34d399" text-anchor="middle">Parent Spark Dashboard</text>
          <text x="440" y="135" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="20" fill="#a7f3d0" text-anchor="middle">PIN-Protected • Device-Only Private Analytics</text>

          <!-- Metric 1: Impulse Control Stat -->
          <g transform="translate(80, 180)">
            <rect width="720" height="140" rx="24" fill="rgba(52, 211, 153, 0.12)" stroke="#34d399" stroke-width="2" />
            <text x="50" y="60" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="26" fill="#e0d4ff">Inhibitory Control Ratio</text>
            <text x="50" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="36" fill="#34d399">91% Successful Waits</text>
            <rect x="520" y="40" width="150" height="55" rx="18" fill="rgba(52,211,153,0.2)" />
            <text x="595" y="76" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="20" fill="#34d399" text-anchor="middle">+14% This Wk</text>
          </g>

          <!-- Metric 2: Working Memory Span -->
          <g transform="translate(80, 350)">
            <rect width="720" height="140" rx="24" fill="rgba(56, 189, 248, 0.12)" stroke="#38bdf8" stroke-width="2" />
            <text x="50" y="60" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="26" fill="#e0d4ff">Working Memory Sequence</text>
            <text x="50" y="105" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="36" fill="#38bdf8">3.8 Items Average</text>
            <rect x="520" y="40" width="150" height="55" rx="18" fill="rgba(56,189,248,0.2)" />
            <text x="595" y="76" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="20" fill="#38bdf8" text-anchor="middle">Age Peak</text>
          </g>

          <!-- Cozy Cool-Down Feature Card -->
          <g transform="translate(80, 520)">
            <rect width="720" height="200" rx="28" fill="rgba(255, 209, 102, 0.12)" stroke="#ffd166" stroke-width="2" />
            <text x="60" y="65" font-size="44">🌙</text>
            <text x="130" y="60" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="26" fill="#ffd166">Cozy Cool-Down Limit</text>
            <text x="60" y="115" font-family="system-ui, -apple-system, sans-serif" font-weight="500" font-size="20" fill="#e2e8f0">After 3 gentle rounds, Zuno happily asks to rest his tail.</text>
            <text x="60" y="155" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="22" fill="#fde047">&quot;Zero screen-time meltdowns, easy transitions!&quot;</text>
          </g>

          <!-- Trust Badges -->
          <g transform="translate(80, 750)">
            <rect width="720" height="420" rx="28" fill="#130b35" stroke="rgba(255,255,255,0.15)" stroke-width="2" />
            <text x="360" y="55" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="26" fill="#ffffff" text-anchor="middle">CHILD PRIVACY PROMISE</text>
            
            <text x="80" y="125" font-size="30">🛡️</text>
            <text x="140" y="125" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#a7f3d0">100% Offline-First (No Wi-Fi Needed)</text>
            
            <text x="80" y="195" font-size="30">🚫</text>
            <text x="140" y="195" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#a7f3d0">Zero Ads, Zero Trackers, Zero Data Selling</text>

            <text x="80" y="265" font-size="30">🔒</text>
            <text x="140" y="265" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="24" fill="#a7f3d0">Parental Math Gate on all Purchases</text>

            <text x="80" y="335" font-size="30">🦊</text>
            <text x="140" y="335" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#a7f3d0">Multiple Child Profiles with Custom Avatars</text>
          </g>
        </g>
      `
    }
  ];

  for (let i = 0; i < screenshots.length; i++) {
    const s = screenshots[i];
    const filePath = path.join(outDir, s.filename);

    const fullSvg = `
      <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="20%" r="90%">
            <stop offset="0%" stop-color="#1f144a" />
            <stop offset="50%" stop-color="#100a2d" />
            <stop offset="100%" stop-color="#060312" />
          </radialGradient>
          <linearGradient id="glowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${s.accentColor}" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#9810fa" stop-opacity="0.0" />
          </linearGradient>
        </defs>

        <!-- Master Background -->
        <rect width="1080" height="1920" fill="url(#bgGrad)" />
        <circle cx="540" cy="200" r="450" fill="url(#glowGrad)" />

        <!-- Ambient decorative particles -->
        <circle cx="120" cy="180" r="8" fill="${s.accentColor}" opacity="0.6" />
        <circle cx="960" cy="240" r="10" fill="#ffd166" opacity="0.7" />
        <circle cx="80" cy="420" r="6" fill="#c77dff" opacity="0.5" />
        <circle cx="1000" cy="460" r="8" fill="${s.accentColor}" opacity="0.5" />

        <!-- Header Category Badge -->
        <g transform="translate(540, 90)">
          <rect x="-210" y="0" width="420" height="52" rx="26" fill="rgba(255,255,255,0.08)" stroke="${s.accentColor}" stroke-width="2" />
          <text x="0" y="35" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="22" fill="${s.accentColor}" text-anchor="middle" letter-spacing="1">${xmlSafe(s.badge)}</text>
        </g>

        <!-- Main Headline -->
        <text x="540" y="230" font-family="system-ui, -apple-system, sans-serif" font-weight="900" font-size="50" fill="#ffffff" text-anchor="middle" letter-spacing="0.5">${xmlSafe(s.title)}</text>
        
        <!-- Subtitle -->
        <text x="540" y="310" font-family="system-ui, -apple-system, sans-serif" font-weight="600" font-size="26" fill="#c4b5fd" text-anchor="middle">${xmlSafe(s.subtitle)}</text>

        <!-- Main Phone UI -->
        ${s.svgContent}
      </svg>
    `;

    console.log(`Writing screenshot ${i + 1}/${screenshots.length}: ${s.filename}...`);
    let pipeline = sharp(Buffer.from(fullSvg)).resize(1080, 1920);
    if (s.composites && s.composites.length > 0) {
      pipeline = pipeline.composite(s.composites);
    }
    const pngBuffer = await pipeline.png({ quality: 95 }).toBuffer();
    fs.writeFileSync(filePath, pngBuffer);
  }

  console.log(`\n🎉 Generated all 5 screenshots in ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
