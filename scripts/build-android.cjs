const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const mode = process.argv[2] || 'debug';
const root = path.resolve(__dirname, '..');
const androidDir = path.join(root, 'android');

const jdkPath = 'C:\\Users\\Jorge\\.jdk\\jdk-21.0.13+9';
const sdkPath = 'C:\\Users\\Jorge\\AppData\\Local\\Android\\Sdk';

const env = {
  ...process.env,
  JAVA_HOME: jdkPath,
  ANDROID_HOME: sdkPath,
  PATH: `${path.join(jdkPath, 'bin')};${process.env.PATH}`,
};

const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const gradleTask = mode === 'release' ? 'bundleRelease' : 'assembleDebug';

console.log(`===============================================`);
console.log(` Building Android for ZunoSpark [${mode.toUpperCase()}]`);
console.log(` Target Task: ${gradleTask}`);
console.log(` JAVA_HOME: ${jdkPath}`);
console.log(` ANDROID_HOME: ${sdkPath}`);
console.log(`===============================================\n`);

const gradleArgs = [
  gradleTask,
  '-x', 'lint',
  '-x', 'lintVitalRelease',
  '-x', 'extractDebugAnnotations',
  '-x', 'extractReleaseAnnotations',
  '--no-daemon'
];

const result = spawnSync(gradlew, gradleArgs, {
  cwd: androidDir,
  env,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  console.error(`\n❌ Android build failed with code ${result.status}`);
  process.exit(result.status || 1);
}

console.log(`\n===============================================`);
console.log(`🎉 BUILD SUCCESSFUL!`);
if (mode === 'release') {
  const aabPath = path.join(androidDir, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
  console.log(`📦 Play Store Bundle (.aab):`);
  console.log(`   ${aabPath}`);
} else {
  const apkPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  console.log(`📱 Test Debug APK:`);
  console.log(`   ${apkPath}`);
}
console.log(`===============================================\n`);
