var DEFAULT_STREAM_URL = "https://w-live-edge2.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8";

document.addEventListener("DOMContentLoaded", function () {
  var player = document.getElementById("live-player");
  var status = document.getElementById("status");
  var goLiveBtn = document.getElementById("go-live-btn");

  // --- UI idle / button fade logic ---
  var idleTimer = null;
  var UI_IDLE_MS = 4000;

  function showUI() {
    if (goLiveBtn) { goLiveBtn.classList.remove("hidden"); }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (goLiveBtn) { goLiveBtn.classList.add("hidden"); }
    }, UI_IDLE_MS);
  }

  // Trigger on any user interaction.
  document.addEventListener("mousemove", showUI);
  document.addEventListener("keydown", showUI);
  document.addEventListener("click", showUI);

  // Snap to live edge immediately when button is pressed.
  if (goLiveBtn) {
    goLiveBtn.addEventListener("click", function () {
      snapToLiveEdge();
    });
  }

  // Hide immediately on load — show on first input.
  if (goLiveBtn) { goLiveBtn.classList.add("hidden"); }

  function setStatus(message) {
    if (status) {
      status.textContent = message;
    }
  }

  function play() {
    // play() may not return a Promise on webOS 3.5 — guard accordingly.
    try {
      var p = player.play();
      if (p && typeof p.then === "function") {
        p.catch(function () {
          player.muted = true;
          player.play();
        });
      }
    } catch (e) {
      console.error("play() failed", e);
    }
  }

  // How many seconds behind the live edge is tolerated before we snap back.
  var LIVE_EDGE_TOLERANCE = 30;
  var syncInterval = null;
  var canPlayHandler = null;
  var errorHandler = null;

  function snapToLiveEdge() {
    try {
      var seekable = player.seekable;
      if (!seekable || seekable.length === 0) { return; }
      var liveEdge = seekable.end(seekable.length - 1);
      player.currentTime = liveEdge - 1;
      console.log("Manual snap to live edge");
    } catch (e) {
      console.warn("snapToLiveEdge failed", e);
    }
  }

  function stopLiveEdgeSync() {
    if (syncInterval !== null) {
      clearInterval(syncInterval);
      syncInterval = null;
    }
  }

  function startLiveEdgeSync() {
    stopLiveEdgeSync();
    syncInterval = setInterval(function () {
      if (!player || player.paused || player.ended) {
        return;
      }
      try {
        var seekable = player.seekable;
        if (!seekable || seekable.length === 0) { return; }
        var liveEdge = seekable.end(seekable.length - 1);
        var drift = liveEdge - player.currentTime;
        if (drift > LIVE_EDGE_TOLERANCE) {
          console.log("Live edge drift " + drift.toFixed(1) + "s — snapping to live edge");
          player.currentTime = liveEdge - 1;
        }
      } catch (e) {
        // seekable may throw on some webOS versions — ignore silently.
      }
    }, 5000);
  }

  function startStream(streamUrl) {
    if (!player) {
      setStatus("Player not found");
      return;
    }

    stopLiveEdgeSync();
    if (canPlayHandler) {
      player.removeEventListener("canplay", canPlayHandler);
      canPlayHandler = null;
    }
    if (errorHandler) {
      player.removeEventListener("error", errorHandler);
      errorHandler = null;
    }
    setStatus("Connecting...");

    // webOS 3.5: native media pipeline handles HLS at OS level.
    // Assign src directly — do NOT rely on canPlayType().
    player.src = streamUrl;
    player.load();

    canPlayHandler = function onCanPlay() {
      player.removeEventListener("canplay", onCanPlay);
      canPlayHandler = null;
      setStatus("Live");
      play();
      startLiveEdgeSync();
    };
    player.addEventListener("canplay", canPlayHandler);

    errorHandler = function onError() {
      player.removeEventListener("error", onError);
      errorHandler = null;
      stopLiveEdgeSync();
      var code = player.error ? player.error.code : "unknown";
      console.error("Video error code", code);
      setStatus("Stream error (" + code + ")");
    };
    player.addEventListener("error", errorHandler);
  }

  // Start stream immediately.
  startStream(DEFAULT_STREAM_URL);

  // Load config in background via XHR (webOS 3.5 has no fetch API).
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "./shared/app-config.json", true);
  xhr.onreadystatechange = function () {
    if (xhr.readyState !== 4) { return; }
    if (xhr.status === 200) {
      try {
        var config = JSON.parse(xhr.responseText);
        if (config && config.streamUrl && config.streamUrl !== DEFAULT_STREAM_URL) {
          startStream(config.streamUrl);
        }
        console.log("KvfLive webOS config loaded", config);
      } catch (e) {
        console.warn("Config parse failed", e);
      }
    } else {
      console.warn("Config load failed, status", xhr.status);
    }
  };
  xhr.send();
});
