# Sweep

Sweep is a cross-platform room-inspection companion for iOS and Android, built with Expo and React Native.

## Included in this starter MVP
- Camera preview and flashlight control
- BLE advertisement scan with nearby-device list
- Physical room inspection checklist
- Local inspection history using AsyncStorage
- Clear limitations and privacy messaging

## Important detection limitations
This build does **not** automatically detect hidden cameras, infrared emitters, lens glints, passive RF transmitters, or AirTags. BLE advertisements are clues only; device names and signal strength cannot identify a tracker reliably. Use the operating system's unknown-tracker alerts as a separate safeguard.

iOS does not allow third-party apps to enumerate all devices on the local Wi-Fi network or invoke Apple's private Find My tracker-detection system. Android LAN discovery and deeper camera-frame analysis are not included in this first build.

## Requirements
- Node.js LTS
- Xcode for iOS device builds (macOS)
- Android Studio for Android device builds
- Expo development build (Expo Go is not sufficient for the native BLE module)

## Run locally
```bash
npm install
npx expo prebuild
npx expo run:android
# or, on macOS:
npx expo run:ios
```

For cloud builds, configure EAS Build after installing the EAS CLI and signing in.

## Before public release
Test on real iPhone and Android devices, review permission prompts, add a privacy policy and support contact, and complete Apple App Store / Google Play review requirements. Never present a room as "clear" merely because no device was found.