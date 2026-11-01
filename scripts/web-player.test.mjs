import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultStreamUrl =
  "https://w-live-edge2.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8";
const configuredStreamUrl = "https://example.com/configured.m3u8";

class FakeElement {
  constructor() {
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: (value) => this.classes.add(value),
      remove: (value) => this.classes.delete(value)
    };
    this.playCalls = 0;
    this.loadCalls = 0;
    this.paused = false;
    this.ended = false;
    this.currentTime = 0;
    this.seekable = { length: 1, end: () => 100 };
    this.playResult = undefined;
  }

  addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) ?? new Set();
    callbacks.add(callback);
    this.listeners.set(name, callbacks);
  }

  removeEventListener(name, callback) {
    this.listeners.get(name)?.delete(callback);
  }

  dispatch(name) {
    for (const callback of [...(this.listeners.get(name) ?? [])]) {
      callback();
    }
  }

  listenerCount(name) {
    return this.listeners.get(name)?.size ?? 0;
  }

  load() {
    this.loadCalls += 1;
  }

  play() {
    this.playCalls += 1;
    return this.playResults?.shift() ?? this.playResult;
  }
}

async function createPlayerHarness(platform) {
  const scriptPath = platform === "webos" ? "webos/main.js" : "tizen/js/main.js";
  const source = await readFile(path.join(root, scriptPath), "utf8");
  const player = new FakeElement();
  const status = { textContent: "Starting stream..." };
  const button = new FakeElement();
  const documentListeners = new Map();
  const timeouts = new Map();
  const intervals = new Map();
  const logs = [];
  let nextTimerId = 0;

  const document = {
    getElementById(id) {
      return {
        "live-player": player,
        status,
        "go-live-btn": button
      }[id] ?? null;
    },
    addEventListener(name, callback) {
      documentListeners.set(name, callback);
    }
  };
  const xhr = {
    readyState: 0,
    status: 0,
    responseText: "",
    open(method, url, async) {
      this.request = { method, url, async };
    },
    send() {
      this.sent = true;
    }
  };
  const context = {
    document,
    window: {},
    XMLHttpRequest: function () { return xhr; },
    setTimeout(callback, delay) {
      const id = ++nextTimerId;
      timeouts.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) {
      timeouts.delete(id);
    },
    setInterval(callback, delay) {
      const id = ++nextTimerId;
      intervals.set(id, { callback, delay });
      return id;
    },
    clearInterval(id) {
      intervals.delete(id);
    },
    console: {
      log: (...args) => logs.push(["log", ...args]),
      warn: (...args) => logs.push(["warn", ...args]),
      error: (...args) => logs.push(["error", ...args])
    }
  };

  vm.runInNewContext(source, context, { filename: scriptPath });
  if (platform === "webos") {
    documentListeners.get("DOMContentLoaded")();
  } else {
    context.window.onload();
  }

  return {
    player,
    status,
    button,
    xhr,
    timeouts,
    intervals,
    logs,
    documentListeners,
    fireConfig({ status = 200, responseText = "{}" } = {}) {
      xhr.readyState = 4;
      xhr.status = status;
      xhr.responseText = responseText;
      xhr.onreadystatechange();
    }
  };
}

for (const platform of ["webos", "tizen"]) {
  test(`${platform} starts the default stream and handles canplay`, async () => {
    const app = await createPlayerHarness(platform);

    assert.equal(app.player.src, defaultStreamUrl);
    assert.equal(app.player.loadCalls, 1);
    assert.equal(app.status.textContent, "Connecting...");
    assert.equal(app.xhr.request.url, "./shared/app-config.json");
    assert.equal(app.xhr.sent, true);
    assert.equal(app.button.classes.has("hidden"), true);

    app.player.dispatch("canplay");

    assert.equal(app.status.textContent, "Live");
    assert.equal(app.player.playCalls, 1);
    assert.equal(app.player.listenerCount("canplay"), 0);
    assert.equal(app.intervals.size, 1);
    assert.equal([...app.intervals.values()][0].delay, 5000);
  });

  test(`${platform} uses a configured stream and ignores unchanged configuration`, async () => {
    const app = await createPlayerHarness(platform);

    app.fireConfig({ responseText: JSON.stringify({ streamUrl: configuredStreamUrl }) });
    assert.equal(app.player.src, configuredStreamUrl);
    assert.equal(app.player.loadCalls, 2);
    assert.equal(app.status.textContent, "Connecting...");

    app.fireConfig({ responseText: JSON.stringify({ streamUrl: defaultStreamUrl }) });
    assert.equal(app.player.loadCalls, 2);

    app.player.dispatch("canplay");
    assert.equal(app.status.textContent, "Live");
    assert.equal(app.player.playCalls, 1);
  });

  test(`${platform} retains the default stream for bad config responses`, async () => {
    const app = await createPlayerHarness(platform);

    app.fireConfig({ status: 404, responseText: "{}" });
    assert.equal(app.player.loadCalls, 1);
    assert.equal(app.player.src, defaultStreamUrl);

    app.fireConfig({ responseText: "{" });
    assert.equal(app.player.loadCalls, 1);
    assert.equal(app.player.src, defaultStreamUrl);
  });

  test(`${platform} reports media errors and removes the error listener`, async () => {
    const app = await createPlayerHarness(platform);
    app.player.dispatch("canplay");
    app.player.error = { code: 3 };
    app.player.dispatch("error");

    assert.equal(app.status.textContent, "Stream error (3)");
    assert.equal(app.player.listenerCount("error"), 0);
    assert.equal(app.intervals.size, 0);
  });

  test(`${platform} retries muted when autoplay is rejected`, async () => {
    const app = await createPlayerHarness(platform);
    app.player.playResults = [Promise.reject(new Error("autoplay blocked")), undefined];

    app.player.dispatch("canplay");
    await Promise.resolve();

    assert.equal(app.player.muted, true);
    assert.equal(app.player.playCalls, 2);
  });

  test(`${platform} manual Go Live seeks one second before the seekable edge`, async () => {
    const app = await createPlayerHarness(platform);
    app.button.listeners.get("click").values().next().value();

    assert.equal(app.player.currentTime, 99);
  });

  test(`${platform} tolerates unavailable seekable ranges`, async () => {
    const app = await createPlayerHarness(platform);
    app.player.seekable = { length: 0, end: () => 100 };
    app.button.listeners.get("click").values().next().value();
    app.player.dispatch("canplay");
    [...app.intervals.values()][0].callback();

    assert.equal(app.player.currentTime, 0);
    assert.equal(app.status.textContent, "Live");
  });

  test(`${platform} automatic live-edge sync only corrects active playback beyond tolerance`, async () => {
    const app = await createPlayerHarness(platform);
    app.player.dispatch("canplay");
    const sync = [...app.intervals.values()][0];

    app.player.currentTime = 60;
    app.player.paused = true;
    sync.callback();
    assert.equal(app.player.currentTime, 60);

    app.player.paused = false;
    app.player.currentTime = 70;
    sync.callback();
    assert.equal(app.player.currentTime, 70);

    app.player.currentTime = 69;
    sync.callback();
    assert.equal(app.player.currentTime, 99);

    app.player.ended = true;
    app.player.currentTime = 60;
    sync.callback();
    assert.equal(app.player.currentTime, 60);
  });

  test(`${platform} interaction reveals the Go Live button and resets its idle timer`, async () => {
    const app = await createPlayerHarness(platform);
    const onKeyDown = app.documentListeners.get("keydown");

    onKeyDown();
    assert.equal(app.button.classes.has("hidden"), false);
    assert.equal(app.timeouts.size, 1);
    assert.equal([...app.timeouts.values()][0].delay, 4000);

    onKeyDown();
    assert.equal(app.timeouts.size, 1);
    [...app.timeouts.values()][0].callback();
    assert.equal(app.button.classes.has("hidden"), true);
  });
}
