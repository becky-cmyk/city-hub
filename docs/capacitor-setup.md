# Capacitor Native App Setup

This project includes Capacitor for packaging the web app as a native iOS and Android application.

## Prerequisites

- **iOS**: macOS with Xcode 15+ installed, CocoaPods (`sudo gem install cocoapods`)
- **Android**: Android Studio with SDK 34+, Java 17+

## Getting Started

### 1. Clone the repository

Pull the project code to your local machine where Xcode or Android Studio is installed.

### 2. Install dependencies

```bash
npm install
```

### 3. Build the web app

```bash
npm run build
```

This outputs the web bundle to `dist/public`, which Capacitor uses as its web asset source.

### 4. Sync web assets to native projects

```bash
npx cap sync
```

This copies the web build into the native project directories and updates native plugins.

## iOS Build

```bash
npx cap open ios
```

This opens the project in Xcode. From there:

1. Select a development team under **Signing & Capabilities**
2. Choose a simulator or connected device
3. Press **Cmd+R** to build and run

## Android Build

```bash
npx cap open android
```

This opens the project in Android Studio. From there:

1. Wait for Gradle sync to complete
2. Select an emulator or connected device
3. Click the **Run** button (green play icon)

## Common Commands

| npm script | Direct command | Description |
|---|---|---|
| `npm run cap:build` | `npm run build && npx cap sync` | Build web app + sync to native projects |
| `npm run cap:sync` | `npx cap sync` | Copy web assets + update native plugins |
| `npm run cap:copy` | `npx cap copy` | Copy web assets only (no plugin update) |
| `npm run cap:open:ios` | `npx cap open ios` | Open iOS project in Xcode |
| `npm run cap:open:android` | `npx cap open android` | Open Android project in Android Studio |
| — | `npx cap doctor` | Check environment and dependencies |

## Development Workflow

1. Make changes to the web app
2. Run `npm run build` to rebuild
3. Run `npx cap sync` to push changes to native projects
4. Build and run from Xcode or Android Studio

## Configuration

The Capacitor configuration is in `capacitor.config.ts` at the project root. Key settings:

- **appId**: `com.restexpress.app` (change this to your own bundle ID before App Store submission)
- **appName**: `RestExpress`
- **webDir**: `dist/public` (matches the Vite build output)

## Installed Plugins

- `@capacitor/status-bar` — Control the native status bar appearance
- `@capacitor/splash-screen` — Configure the app launch screen
- `@capacitor/keyboard` — Handle native keyboard behavior
- `@capacitor/haptics` — Trigger haptic feedback on supported devices

## Version Notes

This project uses Capacitor v6 (pinned intentionally). Capacitor v8+ requires Node.js 22 or later, which may not be available in all development environments. Capacitor v6 is fully supported and compatible with Node.js 18/20.

## Notes

- Native builds require Xcode (iOS) or Android Studio (Android) on a local machine
- The Replit environment is used for web development only; native builds must be done locally
- App icons and splash screen assets should be added before App Store / Google Play submission
