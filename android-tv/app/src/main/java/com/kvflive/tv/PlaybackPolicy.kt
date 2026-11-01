package com.kvflive.tv

internal const val LIVE_EDGE_TOLERANCE_MS = 30_000L

internal fun shouldSeekToLiveEdge(liveOffsetMs: Long): Boolean =
    liveOffsetMs > LIVE_EDGE_TOLERANCE_MS

internal fun configuredStreamUrl(configuredUrl: String?, defaultUrl: String): String =
    configuredUrl?.takeIf { it.isNotBlank() } ?: defaultUrl
