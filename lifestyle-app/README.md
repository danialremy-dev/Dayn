# Lifestyle App (local-only)

An Expo (React Native) app for lifestyle management:

- Appointments calendar (basic)
- Habit tracking (basic)
- Daily to-do list (basic)
- Sports management (Strava import + weekly distance goal)
- Finance management (manual savings goals + debts)

## Run

From `lifestyle-app/`:

```bash
npm install
npm run start
```

Then open it on:
- **iPhone / Expo Go:** scan the QR code with your camera or Expo Go
- **iOS Simulator (Mac):** press `i` in the terminal
- **Android emulator:** press `a` in the terminal

**"There was a problem running the requested app"?**  
This project uses **Expo SDK 55**. Your Expo Go app must match: install the **latest Expo Go** from the [App Store](https://apps.apple.com/app/expo-go/id982107779) or [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent), or get a specific build from [expo.dev/go](https://expo.dev/go). Older Expo Go (e.g. SDK 54) cannot run SDK 55 projects.

## Run without Expo Go (iOS)

You can run the app on iPhone or iPad without installing or updating Expo Go:

### 1. In the browser (quickest, any computer)

```bash
npm run web
```

Opens the app at `http://localhost:8082` (or the port shown). **Note:** SQLite and SecureStore may not work the same on web, so some features (e.g. saving data, Strava) might be limited.

### 2. iOS Simulator or iPhone (Mac with Xcode)

You get an app installed on your phone that does **not** use Expo Go.

**Requirements:** A **Mac** with [Xcode](https://developer.apple.com/xcode/) installed (from the Mac App Store).

**One-time setup:**

1. Install **Xcode** from the Mac App Store and open it once to accept the license.
2. For a **physical iPhone**: connect it with a USB cable, tap "Trust" on the phone, and in Xcode add your Apple ID under **Xcode → Settings → Accounts** (needed for signing).

**Build and run:**

```bash
cd lifestyle-app
npm install
npx expo run:ios
```

- With **no device connected**, the app opens in the **iOS Simulator**.
- With your **iPhone connected**, choose your device when prompted; the app installs on the phone.

The first build can take several minutes. After that you open the app like any other; no Expo Go or QR code.

### 3. Install on iPhone via EAS Build (no Mac required)

Expo can build your app for iOS in the cloud. You then install it on your iPhone via **TestFlight**.

**Requirements:** Free [Expo](https://expo.dev) account. **Apple Developer account** ($99/year) is required to install on a physical iPhone.

1. Create a free account at [expo.dev](https://expo.dev).
2. Install EAS CLI and log in:

   ```bash
   npm install -g eas-cli
   eas login
   ```

3. From the project folder, create a build:

   ```bash
   cd lifestyle-app
   eas build --platform ios --profile preview
   ```

   When prompted, create an `eas.json` with a **preview** profile if you don’t have one. The first build can take 10–20 minutes.

4. When the build finishes (with an Apple Developer account, $99/year): Expo can submit to **TestFlight**. Open the build link (or [expo.dev](https://expo.dev) → your project → Builds), install **TestFlight** on your iPhone, and open the build link on your phone to install the app.

**Summary:** For **iPhone without a Mac**, use **EAS Build for iOS** and an **Apple Developer account** ($99/year), then install via TestFlight. For **no cost and no Expo Go**, use a **Mac** with **Xcode** and run `npx expo run:ios` (Simulator or connected iPhone).

## Strava setup (personal use)

In the **Sports** tab:

1. Create a Strava API application (Client ID + Client Secret).
2. Paste **Client ID** and **Client Secret** into the app and save.
3. Tap **Connect Strava**, authorize, then tap **Import from Strava**.

Notes:
- Tokens and Strava app credentials are stored **on-device** using `expo-secure-store`.
- This is intended for **personal/local-only** usage.

## Review and turn into a real app

See **[REVIEW.md](./REVIEW.md)** for a step-by-step guide to:
- Understanding the codebase (where each feature lives)
- Running and testing the app
- Improving it (reliability, UX, edit/delete, builds) so it feels like a real app

