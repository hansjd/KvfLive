# Samsung Tizen

KvfLive is a web app targeting Samsung TV's Tizen platform.

## Requirements

- Tizen Studio with the TV Extension
- A Samsung TV/emulator configured in Tizen Studio for installation and
  playback checks

## Import and build

1. Install Tizen Studio and its TV Extension.
2. In Tizen Studio, import this folder as a Web Application project.
3. Build the project and create a signed `.wgt` package using your Tizen
   certificate profile.
4. Connect a TV or start an emulator, then install and launch the package from
   Tizen Studio.

Package signing requires a certificate profile configured in Tizen Studio.

## Shared stream configuration

The app loads `shared/app-config.json` at startup. Edit the source configuration
at [`packages/shared/app-config.json`](../packages/shared/app-config.json), then
run `npm run sync:shared` from the repository root to update this platform copy.

## Validation

The repository CI checks that the Tizen project configuration contains the TV
profile and expected entry point, and that the shared config copy is valid and
in sync. It does not currently build or install a Tizen package.
