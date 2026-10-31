# 🚀 ZunoSpark Google Play Store Publishing Guide

This guide contains everything you need to publish **ZunoSpark** to the **Google Play Store**.

---

## 📦 Generated Release Artifacts

| Asset | Location | Purpose |
| :--- | :--- | :--- |
| **Android App Bundle (.aab)** | `android/app/build/outputs/bundle/release/app-release.aab` | **Primary upload file** required by Google Play Console (3.8 MB). |
| **Debug Test APK (.apk)** | `android/app/build/outputs/apk/debug/app-debug.apk` | Sideload directly onto any Android phone or tablet to test. |
| **Hi-Res App Icon** | `android/play-store-icon-512.png` | 512x512 PNG (32-bit color, no transparency), required for store listing. |
| **Feature Graphic** | `android/play-store-feature-graphic-1024x500.png` | 1024x500 PNG banner with Zuno & typography, required for store listing. |

---

## 🛠 Useful NPM Commands

- **Build Google Play Bundle**:
  ```bash
  npm run cap:build:release
  ```
- **Build Local Test APK**:
  ```bash
  npm run cap:build:debug
  ```
- **Sync Web Changes to Android**:
  ```bash
  npm run cap:sync
  ```
- **Open in Android Studio**:
  ```bash
  npm run cap:open
  ```
- **Regenerate App Icons & Splash Graphics**:
  ```bash
  npm run cap:assets
  ```

---

## 📋 Google Play Store Listing Metadata

### 1. App Title (Max 30 characters)
```text
ZunoSpark: Wait-Power & Focus
```

### 2. Short Description (Max 80 characters)
```text
Help Zuno the Spark-Fox calm his tail with Wait-Power & focus games for ages 3–6.
```

### 3. Full Description
```markdown
Help Zuno the Spark-Fox calm his crackling electric tail! 🦊⚡

ZunoSpark is a gentle, science-inspired executive-function trainer created specifically for young minds (ages 3–6). Through playful micro-games, children build real-world inhibitory control, working memory, and bilateral hand coordination.

🌟 3 ADVENTURE ZONES & PROGRESSION TRAILS:
• 🫐 Spark Berry Grove (Inhibitory Control & Impulse Power):
  Watch the berry bush turn ripe gold — resist the urge to tap early, and wait for the golden glow!
• 🔔 Thunder Chimes (Working Memory & Auditory Attention):
  Listen and watch crystal bells chime in rhythm, then tap them back in sequence.
• ⚡ Twin Currents (Two-Hand Bilateral Motor Control):
  Steer left and right electric charge streams simultaneously to guide Sparks into the battery node!

🌱 DESIGNED SPECIFICALLY FOR CHILDREN & FAMILIES:
• 100% Offline-First: Play anywhere — on road trips, airplanes, or waiting rooms — without Wi-Fi.
• Cozy Cool-Downs: Built-in gentle breaks celebrate effort and encourage real-world active play after a few rounds.
• Zero Ads & Zero Tracking: No banners, no popups, no third-party analytics, and no in-app purchases.
• Private Parent Spark Dashboard: PIN-protected grown-up view with session logs and progress insights stored only on your device.
• Multi-Child Profiles: Easily switch between explorers with custom animal badges.
```

---

## 💰 In-App Products Setup (Google Play Console)

ZunoSpark uses a **freemium one-time purchase** model with **zero ads** and **zero subscriptions**:
- **Spot 1 (Level 1)** in all 3 adventure clearings is **100% free forever**.
- **Spots 2 through 5 (Levels 2–5)** are unlocked across the entire game via a single **$19.00 USD one-time purchase** ("Full Adventure Pass").

### Setting up the Product in Play Console:
1. In Google Play Console, navigate to **Monetize with Play** > **Products** > **In-app products**.
2. Click **Create product**.
3. Fill in the product configuration:
   - **Product ID**: `zunospark_full_adventure_19` *(must match exactly)*
   - **Product Name**: `ZunoSpark Full Adventure Pass`
   - **Description**: `One-time unlock for Spots 2 through 5 across all clearings. Lifetime family access, zero ads, zero recurring subscriptions.`
   - **Default Price**: `$19.00 USD` (or equivalent in local currencies)
   - **Status**: Set to **Active**
4. Click **Save** and then **Activate**.

### 🛡 Parental Gate Compliance (Google Play Families Policy)
Under Google Play's Families Policy (target audience ages 3–6), **all in-app purchase triggers must be protected by an effective Parental Gate**.
- ZunoSpark features an automatic, neutral math arithmetic challenge (e.g., `8 + 5 = 13`) before opening the Google Play billing sheet.
- A "Restore Purchases" button is readily available in both the unlock modal and the Parent ROI Dashboard.
- Offline caching persists the purchase state locally via Android `SharedPreferences` and Web `localStorage`, ensuring children can play unlocked levels on road trips and airplanes without an internet connection.

---

## 🛡 Google Play Console Policy Answers

### Target Audience & Content
1. **Target Age Group**: Select **Ages 5 and under** and **Ages 6–8**.
2. **App Category**: **Education** / **Casual** / **Family**.
3. **Ads**: Select **No, my app does not contain ads**.
4. **In-App Purchases**: Select **Yes, my app contains in-app purchases**.
5. **Data Safety Questionnaire**:
   - **Does your app collect or share user data?** Select **No**.
   - All profile data and game progress are stored **100% locally on device** (IndexedDB / SharedPreferences) and never transmitted to external servers. Google Play Billing handles transactions directly via Google Play Services.
6. **Government Apps**: No.
7. **Financial Features**: None.

---

## 🔐 Keystore & App Signing

Google Play uses **Play App Signing**:
1. When creating your app in the Google Play Console, accept the default **Google Play App Signing**.
2. To sign your bundle with an upload key, you can run:
   ```bash
   node scripts/generate-release-keystore.cjs
   ```
   This generates `android/zunospark-upload.keystore` with alias `zunospark-upload`.
3. Upload `app-release.aab` directly to Google Play Console under **Production** or **Internal Testing**.
