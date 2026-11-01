package com.kvflive.tv

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaybackPolicyTest {
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
}
