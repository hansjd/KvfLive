# KvfLive TV Apps Monorepo

Starter project scaffold for:

- ✅ Android TV (native Kotlin) — **Working**
- ❓ Apple TV / tvOS (native SwiftUI via XcodeGen) — **Not yet tested**
- ✅ LG webOS (web app package) — **Working**
- ❌ Samsung Tizen (web app package) — **Wot yet working**

## Structure

- [Android TV guide](android-tv/README.md)
- [Apple TV guide](apple-tv/README.md)
- [LG webOS guide](webos/README.md)
- [Samsung Tizen guide](tizen/README.md)
- [packages/shared](packages/shared)

## 1) Android TV

Prerequisites: JDK 17 and Android SDK Platform 34 / Build Tools 34.0.0.

Build the debug APK from the repository root:

- `npm run android:tv:build`

With `adb` on `PATH` and an Android TV device or emulator connected, install and launch it:

- `npm run android:tv:run`

Find **KvfLive TV** in the TV's Apps list after installation. Its launcher banner uses the project's existing KvfLive icon.

Video fills the available screen without outer padding and preserves the stream's aspect ratio.

You can also open [android-tv](android-tv) in Android Studio and run the `app` target.

Run the Android TV JVM unit tests from [android-tv](android-tv) with:

- `gradle :app:testDebugUnitTest`

## 2) Apple TV (tvOS)

This repo includes an XcodeGen spec to generate the Xcode project and its unit-test target.

On macOS:

1. Install Xcode and Xcode command line tools.
2. Install XcodeGen.
3. From [apple-tv](apple-tv), run:
   - `xcodegen generate`
4. Open the generated project in Xcode and run the **KvfLiveAppleTV** scheme's tests or run on an Apple TV simulator/device.

The test suite can also be run from macOS in [apple-tv](apple-tv) with:

- `xcodebuild -project KvfLiveAppleTV.xcodeproj -scheme KvfLiveAppleTV -destination 'platform=tvOS Simulator,name=Apple TV 4K (3rd generation)' CODE_SIGNING_ALLOWED=NO test`

## 3) LG webOS

Prerequisites:

- Node.js
- webOS CLI (`ares-*`)

Typical flow from [webos](webos):

- `ares-package .`
- `ares-install --device <deviceName> <package.ipk>`
- `ares-launch --device <deviceName> com.kvflive.webos`

Quick npm scripts (from repo root):

- Set device once in terminal:
   - PowerShell: `$env:WEBOS_DEVICE="kvf-tv"`
- Or pass device inline per command:
   - `npm run webos:run -- --device kvf-tv`
- Package app: `npm run webos:package`
- Install latest package: `npm run webos:install`
- Launch app: `npm run webos:launch`
- Package + install + launch: `npm run webos:run`
- Stream app logs: `npm run webos:logs`

## 4) Samsung Tizen

Prerequisites:

- Tizen Studio (TV Extension)

Import [tizen](tizen) as a Web application project, build a `.wgt`, install, and run on emulator/device.

## Shared app config layer

A shared config file is stored at [packages/shared/app-config.json](packages/shared/app-config.json).

The `streamUrl` in this file is used as startup playback URL across all platform apps.

Sync it into each platform target:

- `npm run sync:shared`

This copies the file to:

- [webos/shared/app-config.json](webos/shared/app-config.json)
- [tizen/shared/app-config.json](tizen/shared/app-config.json)
- [android-tv/app/src/main/assets/shared/app-config.json](android-tv/app/src/main/assets/shared/app-config.json)
- [apple-tv/TVApp/Resources/shared/app-config.json](apple-tv/TVApp/Resources/shared/app-config.json)

Run tests for shared-config syncing and validation with `npm test` or the VS Code task **Shared Code: Tests**.

## CI

GitHub Actions workflow added at [/.github/workflows/ci.yml](.github/workflows/ci.yml) with jobs for:

- Shared-code tests and shared/web validation
- Android TV build and unit tests
- Apple TV build

---

This scaffold is now ready for iterative feature development.
