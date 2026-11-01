# Apple TV (tvOS)

This folder uses XcodeGen for reproducible project generation.

The app's unit tests cover stream configuration, playback status, idle visibility, and live-edge seek policy. A macOS CI job builds and runs this suite on the tvOS simulator; playback and remote interaction still need device/simulator checks.

## Generate project (macOS)

1. Install Xcode and command line tools.
2. Install XcodeGen.
3. Run `xcodegen generate` in this folder.
4. Open generated `.xcodeproj` and run on tvOS simulator/device.

Run the unit-test suite on macOS with:

```sh
xcodebuild -project KvfLiveAppleTV.xcodeproj -scheme KvfLiveAppleTV \
  -destination 'platform=tvOS Simulator,name=Apple TV 4K (3rd generation)' \
  CODE_SIGNING_ALLOWED=NO test
```

The app icon and top-shelf artwork match the blue K and red live dot used by Android TV/webOS.

## Playback checks

On the tvOS simulator or an Apple TV, verify:

- The live stream plays with video and sound.
- Remote navigation reveals **GO LIVE**, and the hidden button is not focusable.
- Play/pause works, and **GO LIVE** resumes playback at the live edge.
- Returning to the app resumes playback unless it was manually paused.
- Stream failures show **Stream error** instead of **Live**.
