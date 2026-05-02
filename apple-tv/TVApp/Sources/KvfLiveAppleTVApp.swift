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
    @State private var player: AVPlayer?
    @State private var statusText: String = "Starting stream..."
    @State private var showGoLiveButton: Bool = false
    @State private var lastInteractionAt: Date = Date()

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
            .animation(.easeOut(duration: 0.6), value: showGoLiveButton)
            .padding(.trailing, 32)
            .padding(.bottom, 36)
        }
        .focusable()
        .onMoveCommand { _ in
            markInteraction()
        }
        .onPlayPauseCommand {
            markInteraction()
        }
        .onTapGesture {
            markInteraction()
        }
        .onAppear {
            if player == nil {
                startStream()
            }
        }
        .onReceive(ticker) { _ in
            updateIdleVisibility()
            maybeAutoSnapToLiveEdge()
        }
        .onDisappear {
            player?.pause()
        }
    }

    private func startStream() {
        let streamUrl = loadStreamUrlFromSharedConfig()
        let avPlayer = AVPlayer(url: streamUrl)
        player = avPlayer
        statusText = "Connecting..."

        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemNewAccessLogEntry,
            object: avPlayer.currentItem,
            queue: .main
        ) { _ in
            statusText = "Live"
        }

        NotificationCenter.default.addObserver(
            forName: .AVPlayerItemFailedToPlayToEndTime,
            object: avPlayer.currentItem,
            queue: .main
        ) { _ in
            statusText = "Stream error"
        }

        avPlayer.play()
        markInteraction()
    }

    private func markInteraction() {
        lastInteractionAt = Date()
        showGoLiveButton = true
    }

    private func updateIdleVisibility() {
        let idleFor = Date().timeIntervalSince(lastInteractionAt)
        if idleFor > uiIdleSec {
            showGoLiveButton = false
        }
    }

    private func maybeAutoSnapToLiveEdge() {
        guard let avPlayer = player else { return }
        guard avPlayer.timeControlStatus == .playing else { return }

        let nowSec = Date().timeIntervalSinceReferenceDate
        let bucket = Int(nowSec / syncIntervalSec)
        let shouldCheckThisSecond = abs(nowSec - (Double(bucket) * syncIntervalSec)) < 1.0
        if !shouldCheckThisSecond {
            return
        }

        guard let seekableRange = avPlayer.currentItem?.seekableTimeRanges.last?.timeRangeValue else { return }
        let liveEdge = CMTimeGetSeconds(seekableRange.start) + CMTimeGetSeconds(seekableRange.duration)
        let current = CMTimeGetSeconds(avPlayer.currentTime())
        let drift = liveEdge - current
        if drift > liveEdgeToleranceSec {
            let target = max(0, liveEdge - 1)
            avPlayer.seek(to: CMTime(seconds: target, preferredTimescale: 600))
        }
    }

    private func snapToLiveEdge() {
        guard let avPlayer = player else { return }
        guard let seekableRange = avPlayer.currentItem?.seekableTimeRanges.last?.timeRangeValue else { return }

        let liveEdge = CMTimeGetSeconds(seekableRange.start) + CMTimeGetSeconds(seekableRange.duration)
        let target = max(0, liveEdge - 1)
        avPlayer.seek(to: CMTime(seconds: target, preferredTimescale: 600))
    }

    private func loadStreamUrlFromSharedConfig() -> URL {
        if let configUrl = Bundle.main.url(
            forResource: "app-config",
            withExtension: "json",
            subdirectory: "shared"
        ) {
            do {
                let data = try Data(contentsOf: configUrl)
                if let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                   let streamUrl = root["streamUrl"] as? String,
                   let url = URL(string: streamUrl) {
                    return url
                }
            } catch {
                print("Failed to parse shared app config: \(error)")
            }
        }

        return URL(string: defaultStreamUrl)!
    }
}
