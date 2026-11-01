import Foundation

enum PlaybackState {
    case failed
    case playing
    case waiting
    case paused
    case unknown
}

enum PlaybackSupport {
    static func streamURL(from data: Data?, defaultURL: URL) throws -> URL {
        guard let data else { return defaultURL }

        let root = try JSONSerialization.jsonObject(with: data) as? [String: Any]
        guard let streamURLString = root?["streamUrl"] as? String,
              let url = URL(string: streamURLString),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let scheme = components.scheme?.lowercased(),
              ["http", "https"].contains(scheme),
              components.host != nil else {
            return defaultURL
        }

        return url
    }

    static func statusText(
        itemFailed: Bool,
        playbackFailed: Bool,
        playbackState: PlaybackState
    ) -> String {
        guard !itemFailed, !playbackFailed else { return "Stream error" }

        switch playbackState {
        case .failed:
            return "Stream error"
        case .playing:
            return "Live"
        case .waiting:
            return "Buffering..."
        case .paused:
            return "Paused"
        case .unknown:
            return "Connecting..."
        }
    }

    static func shouldShowGoLiveButton(idleFor: TimeInterval, idleThreshold: TimeInterval) -> Bool {
        idleFor <= idleThreshold
    }

    static func liveEdgeTarget(start: Double, duration: Double) -> Double? {
        let liveEdge = start + duration
        guard start.isFinite, duration.isFinite, liveEdge.isFinite else { return nil }
        return max(0, liveEdge - 1)
    }

    static func automaticLiveEdgeTarget(
        start: Double,
        duration: Double,
        current: Double,
        tolerance: Double
    ) -> Double? {
        guard current.isFinite,
              tolerance.isFinite,
              let target = liveEdgeTarget(start: start, duration: duration) else {
            return nil
        }

        let drift = start + duration - current
        guard drift.isFinite, drift > tolerance else { return nil }
        return target
    }
}
