import { cleanupExpiredSessions, getSessionStats } from "../endpoints/matchmaking/sessionUtils.js";

/**
 * Background service for managing matchmaking sessions
 */
class MatchmakingService {
    constructor() {
        this.cleanupInterval = null;
        this.statsInterval = null;
        this.isRunning = false;
    }

    /**
     * Start the background service
     * @param {number} cleanupIntervalMs - Cleanup interval in milliseconds (default: 5 minutes)
     * @param {number} statsIntervalMs - Stats logging interval in milliseconds (default: 30 minutes)
     */
    start(cleanupIntervalMs = 5 * 60 * 1000, statsIntervalMs = 30 * 60 * 1000) {
        if (this.isRunning) {
            console.log('Matchmaking service is already running');
            return;
        }

        console.log('Starting matchmaking background service...');
        this.isRunning = true;

        // Initial cleanup
        this.performCleanup();

        // Set up periodic cleanup
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, cleanupIntervalMs);

        // Set up periodic stats logging
        this.statsInterval = setInterval(() => {
            this.logStats();
        }, statsIntervalMs);

        console.log(`Matchmaking service started with cleanup interval: ${cleanupIntervalMs}ms, stats interval: ${statsIntervalMs}ms`);
    }

    /**
     * Stop the background service
     */
    stop() {
        if (!this.isRunning) {
            console.log('Matchmaking service is not running');
            return;
        }

        console.log('Stopping matchmaking background service...');
        
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.statsInterval) {
            clearInterval(this.statsInterval);
            this.statsInterval = null;
        }

        this.isRunning = false;
        console.log('Matchmaking service stopped');
    }

    /**
     * Perform cleanup of expired sessions
     */
    async performCleanup() {
        try {
            const cleanedCount = await cleanupExpiredSessions();
            if (cleanedCount > 0) {
                console.log(`Matchmaking cleanup: removed ${cleanedCount} expired sessions`);
            }
        } catch (error) {
            console.error('Error during matchmaking cleanup:', error);
        }
    }

    /**
     * Log session statistics
     */
    async logStats() {
        try {
            const stats = await getSessionStats();
            console.log('Matchmaking stats:', stats);
        } catch (error) {
            console.error('Error getting matchmaking stats:', error);
        }
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            hasCleanupInterval: this.cleanupInterval !== null,
            hasStatsInterval: this.statsInterval !== null
        };
    }
}

// Export singleton instance
export const matchmakingService = new MatchmakingService();
