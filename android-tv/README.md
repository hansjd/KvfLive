# Android TV

Native Android TV app built with Kotlin, AndroidX, and Media3/ExoPlayer.

## Requirements

- JDK 17
- Android SDK Platform 34 and Build Tools 34.0.0
- Android Studio (optional) or the included Gradle wrapper
- An Android TV device/emulator for installation and playback checks

## Build

From the repository root:

```sh
npm run android:tv:build
```

Or, from this folder, run `gradlew.bat :app:assembleDebug` on Windows or
`./gradlew :app:assembleDebug` on macOS/Linux.

## Install and launch

Connect an Android TV device/emulator with ADB, then run:

```sh
npm run android:tv:run
```

For network-connected devices, set `ANDROID_TV_HOST` to the device address
(for example, `192.168.1.20:5555`) before running the command. The helper also
supports separate `connect`, `install`, and `launch` commands; run
`node scripts/android-tv.mjs` from the repository root to see usage.

## Tests

Run the JVM unit tests from the repository root:

```sh
cd android-tv
./gradlew :app:testDebugUnitTest
```

On Windows, use `gradlew.bat` instead of `./gradlew`. The VS Code task
**Android TV: Unit Tests** runs the same test suite. CI builds the debug APK
and runs these tests. The APK is available as the
`kvflive-android-tv-debug` artifact on the GitHub Actions workflow run.

## Shared stream configuration

The app reads `streamUrl` from
`app/src/main/assets/shared/app-config.json`. Edit the source configuration at
[`packages/shared/app-config.json`](../packages/shared/app-config.json), then
run `npm run sync:shared` from the repository root to update this platform copy.
