# Apple TV (tvOS)

This folder uses XcodeGen for reproducible project generation.

Status: **Not yet tested**. A macOS CI job builds the tvOS simulator target; successful compilation does not verify playback or remote interaction.

## Generate project (macOS)

1. Install Xcode and command line tools.
2. Install XcodeGen.
3. Run `xcodegen generate` in this folder.
4. Open generated `.xcodeproj` and run on tvOS simulator/device.

The app icon and top-shelf artwork match the blue K and red live dot used by Android TV/webOS.

## Playback checks

On the tvOS simulator or an Apple TV, verify:

- The live stream plays with video and sound.
- Remote navigation reveals **GO LIVE**, and the hidden button is not focusable.
- Play/pause works, and **GO LIVE** resumes playback at the live edge.
- Returning to the app resumes playback unless it was manually paused.
- Stream failures show **Stream error** instead of **Live**.
