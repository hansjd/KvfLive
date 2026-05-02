# KvfLive TV Apps Monorepo

Starter project scaffold for:

- Android TV (native Kotlin)
- Apple TV / tvOS (native SwiftUI via XcodeGen)
- LG webOS (web app package)
- Samsung Tizen (web app package)

## Structure

- [android-tv](android-tv)
- [apple-tv](apple-tv)
- [webos](webos)
- [tizen](tizen)
- [packages/shared](packages/shared)

## 1) Android TV

Open [android-tv](android-tv) in Android Studio and run the `app` target on an Android TV emulator/device.

## 2) Apple TV (tvOS)

This repo includes an XcodeGen spec to generate the Xcode project.

On macOS:

1. Install Xcode and Xcode command line tools.
2. Install XcodeGen.
3. From [apple-tv](apple-tv), run:
   - `xcodegen generate`
4. Open the generated project in Xcode and run on an Apple TV simulator/device.

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

## CI

GitHub Actions workflow added at [/.github/workflows/ci.yml](.github/workflows/ci.yml) with jobs for:

- Shared/web validation
- Android TV build
- Apple TV build

---

This scaffold is now ready for iterative feature development.

