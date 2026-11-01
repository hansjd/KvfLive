import SwiftUI
import AVKit
import Combine

@main
struct KvfLiveAppleTVApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}

struct ContentView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var player: AVPlayer?
    @State private var statusText: String = "Starting stream..."
    @State private var showGoLiveButton: Bool = false
    @State private var lastInteractionAt: Date = Date()
    @State private var lastLiveSyncAt: Date = .distantPast
    @State private var isVisible = false
    @State private var resumePlayback = true
    @State private var isSuspended = false
    @State private var playbackFailed = false

    private let defaultStreamUrl = "https://w-live-edge2.kringvarp.fo/kvf/_definst_/smil:kvf.smil/playlist.m3u8"
    private let liveEdgeToleranceSec: Double = 30
    private let uiIdleSec: Double = 4
    private let syncIntervalSec: Double = 5

    // Drives both idle fade and live-edge periodic checks.
    private let ticker = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            Group {
                if let activePlayer = player {
                    VideoPlayer(player: activePlayer)
                        .ignoresSafeArea()
                } else {
                    Color.black
                        .ignoresSafeArea()
                }
            }

            VStack(alignment: .leading) {
                Text(statusText)
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color.black.opacity(0.55))
                    .clipShape(RoundedRectangle(cornerRadius: 8))
                Spacer()
            }
            .padding(16)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)

            Button(action: {
                snapToLiveEdge()
                markInteraction()
            }) {
                Text("GO LIVE")
                    .font(.title3.bold())
                    .padding(.horizontal, 28)
                    .padding(.vertical, 12)
                    .background(Color.red.opacity(0.85))
                    .foregroundColor(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
            .opacity(showGoLiveButton ? 1 : 0)
            .disabled(!showGoLiveButton)
            .animation(.easeOut(duration: 0.6), value: showGoLiveButton)
            .padding(.trailing, 32)
            .padding(.bottom, 36)
        }
        .focusSection()
        .onMoveCommand { _ in
            markInteraction()
        }
        .onPlayPauseCommand {
            if let activePlayer = player {
                if activePlayer.timeControlStatus == .paused {
                    activePlayer.play()
                } else {
                    activePlayer.pause()
                }
            }
            markInteraction()
        }
        .onAppear {
            isVisible = true
            if player == nil {
                startStream()
            } else {
                resumePlaybackIfNeeded()
            }
        }
        .onChange(of: scenePhase) { phase in
            if phase == .active {
                if isVisible {
                    resumePlaybackIfNeeded()
                }
            } else if phase == .background {
                suspendPlayback()
            }
        }
        .onReceive(ticker) { _ in
            guard isVisible && scenePhase == .active else { return }
            updatePlaybackStatus()
            updateIdleVisibility()
            maybeAutoSnapToLiveEdge()
        }
        .onReceive(NotificationCenter.default.publisher(for: .AVPlayerItemFailedToPlayToEndTime)) { notification in
            guard let item = notification.object as? AVPlayerItem,
                  item === player?.currentItem else { return }
            playbackFailed = true
            statusText = "Stream error"
            print("Stream playback failed: \(String(describing: notification.userInfo))")
        }
        .onDisappear {
            isVisible = false
            suspendPlayback()
        }
    }

    private func startStream() {
        let streamUrl = loadStreamUrlFromSharedConfig()
        let avPlayer = AVPlayer(url: streamUrl)
        player = avPlayer
        statusText = "Connecting..."

        avPlayer.play()
        markInteraction()
    }

    private func suspendPlayback() {
        guard !isSuspended else { return }
        resumePlayback = PlaybackSupport.shouldResumePlayback(
            isPaused: player.map { $0.timeControlStatus == .paused }
        )
        isSuspended = true
        player?.pause()
    }

    private func resumePlaybackIfNeeded() {
        guard isSuspended else { return }
        isSuspended = false
        if resumePlayback {
            player?.play()
        }
    }

    private func updatePlaybackStatus() {
        guard let avPlayer = player, let item = avPlayer.currentItem else { return }
        let itemFailed = item.status == .failed
        if itemFailed && statusText != "Stream error" {
            print("Stream playback failed: \(String(describing: item.error))")
        }
        let playbackState: PlaybackState
        switch avPlayer.timeControlStatus {
        case .playing:
            playbackState = .playing
        case .waitingToPlayAtSpecifiedRate:
            playbackState = .waiting
        case .paused:
            playbackState = .paused
        @unknown default:
            playbackState = .unknown
        }
        statusText = PlaybackSupport.statusText(
            itemFailed: itemFailed,
            playbackFailed: playbackFailed,
            playbackState: playbackState
        )
    }

    private func markInteraction() {
        lastInteractionAt = Date()
        showGoLiveButton = true
    }

    private func updateIdleVisibility() {
        let idleFor = Date().timeIntervalSince(lastInteractionAt)
        showGoLiveButton = PlaybackSupport.shouldShowGoLiveButton(
            idleFor: idleFor,
            idleThreshold: uiIdleSec
        )
    }

    private func maybeAutoSnapToLiveEdge() {
        guard let avPlayer = player else { return }
        guard avPlayer.timeControlStatus == .playing else { return }

        let now = Date()
        guard now.timeIntervalSince(lastLiveSyncAt) >= syncIntervalSec else { return }
        lastLiveSyncAt = now

        guard let seekableRange = avPlayer.currentItem?.seekableTimeRanges.last?.timeRangeValue else { return }
        let start = CMTimeGetSeconds(seekableRange.start)
        let duration = CMTimeGetSeconds(seekableRange.duration)
        let current = CMTimeGetSeconds(avPlayer.currentTime())
        guard let target = PlaybackSupport.automaticLiveEdgeTarget(
            start: start,
            duration: duration,
            current: current,
            tolerance: liveEdgeToleranceSec
        ) else { return }

        avPlayer.seek(to: CMTime(seconds: target, preferredTimescale: 600))
    }

    private func snapToLiveEdge() {
        guard let avPlayer = player else { return }
        guard let seekableRange = avPlayer.currentItem?.seekableTimeRanges.last?.timeRangeValue else { return }

        guard let target = PlaybackSupport.liveEdgeTarget(
            start: CMTimeGetSeconds(seekableRange.start),
            duration: CMTimeGetSeconds(seekableRange.duration)
        ) else { return }

        avPlayer.seek(to: CMTime(seconds: target, preferredTimescale: 600))
        avPlayer.play()
    }

    private func loadStreamUrlFromSharedConfig() -> URL {
        var configData: Data?
        if let configUrl = Bundle.main.url(
            forResource: "app-config",
            withExtension: "json",
            subdirectory: "shared"
        ) {
            do {
                configData = try Data(contentsOf: configUrl)
            } catch {
                print("Failed to read shared app config: \(error)")
            }
        }

        do {
            return try PlaybackSupport.streamURL(from: configData, defaultURL: URL(string: defaultStreamUrl)!)
        } catch {
            print("Failed to parse shared app config: \(error)")
            return URL(string: defaultStreamUrl)!
        }
    }
}
