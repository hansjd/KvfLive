package com.kvflive.tv

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackPolicyTest {
    private val defaultStreamUrl = "https://example.com/default.m3u8"

    @Test
    fun doesNotSeekWhenLiveOffsetIsBelowTolerance() {
        assertFalse(shouldSeekToLiveEdge(LIVE_EDGE_TOLERANCE_MS - 1))
    }

    @Test
    fun doesNotSeekWhenLiveOffsetIsExactlyAtTolerance() {
        assertFalse(shouldSeekToLiveEdge(LIVE_EDGE_TOLERANCE_MS))
    }

    @Test
    fun seeksWhenLiveOffsetExceedsTolerance() {
        assertTrue(shouldSeekToLiveEdge(LIVE_EDGE_TOLERANCE_MS + 1))
    }

    @Test
    fun doesNotSeekForZeroOrNegativeLiveOffset() {
        assertFalse(shouldSeekToLiveEdge(0L))
        assertFalse(shouldSeekToLiveEdge(-1L))
    }

    @Test
    fun usesConfiguredStreamUrlWhenPresent() {
        assertEquals(
            "https://example.com/live.m3u8",
            configuredStreamUrl("https://example.com/live.m3u8", defaultStreamUrl)
        )
    }

    @Test
    fun usesDefaultStreamUrlWhenConfigurationIsMissingOrBlank() {
        assertEquals(defaultStreamUrl, configuredStreamUrl(null, defaultStreamUrl))
        assertEquals(defaultStreamUrl, configuredStreamUrl("", defaultStreamUrl))
        assertEquals(defaultStreamUrl, configuredStreamUrl("  ", defaultStreamUrl))
    }
}
