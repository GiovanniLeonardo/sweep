# Sweep

Sweep is a cross-platform room-inspection companion for iOS and Android.

## Current MVP
- Camera preview and flashlight control for manual visual inspection
- Bluetooth Low Energy advertisement scan (15 seconds)
- Device list with signal strength, service UUIDs and local review markers
- Eight-step physical inspection checklist with persistent progress
- Room naming, local inspection history, export/share and clear-history controls
- Detection guide and permission/privacy settings

## Honest capability boundaries
This app is an inspection assistant, not a certified hidden-camera or bug detector.
- It does not automatically analyze camera frames, identify lens glints, or detect IR emitters.
- BLE scan results are unclassified radio advertisements. They do not identify AirTags or prove surveillance.
- Use built-in iOS/Android unknown-tracker alerts for tracker safety. Sweep cannot invoke Apple's private Find My detection system.
- iOS third-party apps cannot enumerate every device on a local Wi-Fi network. Android LAN discovery is not implemented.
- It cannot guarantee detection of hardwired, powered-off, passive, shielded, or out-of-range devices.

## Requirements
- Node.js LTS
- Xcode on macOS for iOS builds
- Android Studio for Android builds
- EAS CLI for cloud builds (optional)
- A development build; Expo Go is not sufficient for the native BLE dependency

## Run
    npm install
    npx expo prebuild
    npx expo run:android
    # On macOS:
    npx expo run:ios

## EAS
    npm install -g eas-cli
    eas login
    eas build:configure
    eas build --profile preview --platform all

## Before store release
1. Test camera permission, torch, BLE permissions and scan lifecycle on real devices.
2. Confirm privacy disclosures and publish a privacy policy.
3. Add store artwork, screenshots, support contact and app review notes.
4. Validate builds with EAS and test installation on both platforms.
5. Do not present an empty scan as proof that a room is safe.