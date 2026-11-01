# LG webOS

KvfLive runs on webOS as a web application packaged for LG TVs.

## Requirements

- Node.js and npm
- webOS TV SDK/CLI (`ares-*`)
- An LG webOS TV or emulator configured as a CLI device for installation and
  playback checks

Install repository dependencies from the root with `npm ci`. The package script
uses the local `hls.js` dependency and syncs the shared configuration.

## Package

From the repository root:

```sh
npm run webos:package
```

This creates an `.ipk` package in this folder.

## Install and launch

Configure a device using either the `WEBOS_DEVICE` environment variable or an
inline option:

```sh
npm run webos:run -- --device <deviceName>
```

Alternatively, set `WEBOS_DEVICE` and run `npm run webos:run`. The script also
provides `webos:install`, `webos:launch`, and `webos:logs` commands. The webOS
CLI must already know the selected device.

## Shared stream configuration

The app loads `shared/app-config.json` at startup. Edit the source configuration
at [`packages/shared/app-config.json`](../packages/shared/app-config.json), then
run `npm run sync:shared` from the repository root. Packaging also runs this
sync automatically.
