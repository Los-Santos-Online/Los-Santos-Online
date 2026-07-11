function normalizePlatformValue(value) {
    if (Array.isArray(value)) {
        return normalizePlatformValue(value[0]);
    }

    if (typeof value !== 'string') {
        return '';
    }

    return value.trim().toUpperCase();
}

export function getMatchmakingPlatform(req) {
    return normalizePlatformValue(
        req.headers?.platform ??
        req.headers?.Platform ??
        req.get?.('Platform') ??
        req.body?.platform
    );
}

export function getPlatformCandidates(platform) {
    const normalizedPlatform = normalizePlatformValue(platform);
    return normalizedPlatform ? [normalizedPlatform, ''] : [''];
}
