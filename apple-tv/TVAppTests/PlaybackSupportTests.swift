import Foundation
import XCTest
@testable import KvfLiveAppleTV

final class PlaybackSupportTests: XCTestCase {
    private let defaultURL = URL(string: "https://example.com/default.m3u8")!

    func testStreamURLUsesConfiguredHTTPURL() throws {
        let url = try PlaybackSupport.streamURL(
            from: Data(#"{"streamUrl":"https://cdn.example.com/live.m3u8"}"#.utf8),
            defaultURL: defaultURL
        )

        XCTAssertEqual(url.absoluteString, "https://cdn.example.com/live.m3u8")
    }

    func testStreamURLUsesDefaultWhenConfigIsMissing() throws {
        XCTAssertEqual(
            try PlaybackSupport.streamURL(from: nil, defaultURL: defaultURL),
            defaultURL
        )
    }

    func testStreamURLUsesDefaultWhenStreamURLIsMissingOrNotAString() throws {
        let missing = Data(#"{"appName":"KvfLive"}"#.utf8)
        let wrongType = Data(#"{"streamUrl":42}"#.utf8)

        XCTAssertEqual(try PlaybackSupport.streamURL(from: missing, defaultURL: defaultURL), defaultURL)
        XCTAssertEqual(try PlaybackSupport.streamURL(from: wrongType, defaultURL: defaultURL), defaultURL)
    }

    func testStreamURLRejectsNonHTTPURLSchemes() throws {
        let data = Data(#"{"streamUrl":"file:///tmp/stream.m3u8"}"#.utf8)

        XCTAssertEqual(try PlaybackSupport.streamURL(from: data, defaultURL: defaultURL), defaultURL)
    }

    func testStreamURLThrowsForMalformedJSON() {
        XCTAssertThrowsError(
            try PlaybackSupport.streamURL(from: Data("{".utf8), defaultURL: defaultURL)
        )
    }

    func testStatusTextCoversPlaybackStates() {
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: false, playbackState: .playing),
            "Live"
        )
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: false, playbackState: .waiting),
            "Buffering..."
        )
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: false, playbackState: .paused),
            "Paused"
        )
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: false, playbackState: .unknown),
            "Connecting..."
        )
    }

    func testStatusTextKeepsPlaybackFailuresVisible() {
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: true, playbackFailed: false, playbackState: .playing),
            "Stream error"
        )
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: true, playbackState: .playing),
            "Stream error"
        )
        XCTAssertEqual(
            PlaybackSupport.statusText(itemFailed: false, playbackFailed: false, playbackState: .failed),
            "Stream error"
        )
    }

    func testGoLiveButtonRemainsVisibleThroughIdleThreshold() {
        XCTAssertTrue(PlaybackSupport.shouldShowGoLiveButton(idleFor: 0, idleThreshold: 4))
        XCTAssertTrue(PlaybackSupport.shouldShowGoLiveButton(idleFor: 4, idleThreshold: 4))
    }

    func testGoLiveButtonHidesAfterIdleThreshold() {
        XCTAssertFalse(PlaybackSupport.shouldShowGoLiveButton(idleFor: 4.01, idleThreshold: 4))
    }

    func testLiveEdgeTargetSeeksOneSecondBeforeLiveEdge() {
        XCTAssertEqual(PlaybackSupport.liveEdgeTarget(start: 100, duration: 50), 149)
    }

    func testLiveEdgeTargetDoesNotReturnNegativeTime() {
        XCTAssertEqual(PlaybackSupport.liveEdgeTarget(start: 0, duration: 0.5), 0)
    }

    func testLiveEdgeTargetRejectsNonFiniteRange() {
        XCTAssertNil(PlaybackSupport.liveEdgeTarget(start: .infinity, duration: 10))
        XCTAssertNil(PlaybackSupport.liveEdgeTarget(start: 10, duration: .nan))
    }

    func testAutomaticLiveEdgeTargetRequiresDriftBeyondTolerance() {
        XCTAssertNil(
            PlaybackSupport.automaticLiveEdgeTarget(
                start: 100,
                duration: 50,
                current: 120,
                tolerance: 30
            )
        )
        XCTAssertEqual(
            PlaybackSupport.automaticLiveEdgeTarget(
                start: 100,
                duration: 50,
                current: 119,
                tolerance: 30
            ),
            149
        )
    }

    func testAutomaticLiveEdgeTargetRejectsInvalidCurrentTime() {
        XCTAssertNil(
            PlaybackSupport.automaticLiveEdgeTarget(
                start: 100,
                duration: 50,
                current: .nan,
                tolerance: 30
            )
        )
    }
}
