const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');
const keystorePath = path.join(androidDir, 'zunospark-upload.keystore');
const keytoolPath = 'C:\\Users\\Jorge\\.jdk\\jdk-21.0.13+9\\bin\\keytool.exe';

if (fs.existsSync(keystorePath)) {
  console.log(`Keystore already exists at: ${keystorePath}`);
  process.exit(0);
}

console.log('Generating production upload keystore for Google Play Store...');

const args = [
  '-genkeypair',
  '-v',
  '-keystore', keystorePath,
  '-alias', 'zunospark-upload',
  '-keyalg', 'RSA',
  '-keysize', '2048',
  '-validity', '10000',
  '-storepass', 'zunospark2026',
  '-keypass', 'zunospark2026',
  '-dname', 'CN=ZunoSpark Explorer, OU=Mobile, O=ZunoSpark, L=City, ST=State, C=US'
];

const res = spawnSync(keytoolPath, args, { stdio: 'inherit', shell: true });

if (res.status === 0) {
  console.log(`\n✅ Generated Keystore successfully:`);
  console.log(`   Location: ${keystorePath}`);
  console.log(`   Alias: zunospark-upload`);
  console.log(`   Password: zunospark2026`);
  console.log(`\nKeep this keystore safe! Google Play Console requires it to verify your app updates.`);
} else {
  console.error('\n❌ Keystore generation failed.');
  process.exit(res.status || 1);
}
