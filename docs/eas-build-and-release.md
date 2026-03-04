## EAS build & release flow for PoseTracker AI

This document summarizes the commands you need to:

- log into EAS,
- build the iOS & Android apps,
- submit them to the App Store and Google Play.

All commands are run from the `app/` directory.

---

### 1. Login to EAS (once per machine)

```bash
cd /path/to/PoseTracker Demo App/app
npx eas-cli login
```

Make sure you authenticate with the Expo account that owns the project.

---

### 2. Build both platforms for production

```bash
npx eas-cli build --platform all --profile production
```

If the build starts on EAS servers without configuration errors, your config is OK.

You can also build per platform:

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli build --platform android --profile production
```

At the end of each build, EAS gives you a link to:

- an **IPA** for iOS (for TestFlight / App Store),
- an **AAB** for Android (for Google Play).

---

### 3. Submit the latest successful build

After a successful build, you can submit directly from the CLI:

```bash
# iOS
npx eas-cli submit --platform ios --profile production --latest

# Android
npx eas-cli submit --platform android --profile production --latest
```

Requirements:

- **iOS**:
  - `eas.json` must contain your Apple ID email, App Store Connect app ID, and Apple Team ID (or you keep those in a private `eas.local.json`).
  - The app must already exist in App Store Connect with the same bundle identifier as in `app.json`.

- **Android**:
  - `play-store-key.json` present in `app/`, or a service account key uploaded on `expo.dev`.
  - `eas.json` submit profile must point to the right service account key path (or use credentials stored on EAS).

---

### 4. Local notes vs. public repo

- This repo’s `eas.json` only contains **placeholders** so it can be published to GitHub safely.
- Your real values live in a local, git-ignored `eas.local.json` on your machine.
- The simple “cheat sheet” that used to be `eas builds and release.txt` is now captured here in this doc.

Use this file as the authoritative reference for future PoseTracker AI releases.

