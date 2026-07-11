import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Cleans up expired game sessions
 * Should be called periodically to maintain database hygiene
 */
export async function cleanupExpiredSessions() {
    try {
        const now = new Date();
        const threeHoursAgo = new Date(now.getTime() - (3 * 60 * 60 * 1000)); // 3 hours in milliseconds

        // Delete sessions that have been inactive for 3+ hours
        const deleteResult = await prisma.gameSession.deleteMany({
            where: {
                updatedAt: {
                    lt: threeHoursAgo
                }
            }
        });

        console.log(`Deleted ${deleteResult.count} sessions inactive for 3+ hours`);
        return deleteResult.count;
    } catch (error) {
        console.error('Error cleaning up expired sessions:', error);
        throw error;
    }
}

/**
 * Gets session statistics for monitoring
 */
export async function getSessionStats() {
    try {
        const now = new Date();
        
        const stats = await prisma.gameSession.groupBy({
            by: ['active'],
            _count: {
                _all: true
            },
            where: {
                expiresAt: {
                    gt: now
                }
            }
        });

        const activeCount = stats.find(s => s.active)?._count._all || 0;
        const totalCount = stats.reduce((sum, s) => sum + s._count._all, 0);

        return {
            activeSessions: activeCount,
            totalValidSessions: totalCount,
            timestamp: now
        };
    } catch (error) {
        console.error('Error getting session stats:', error);
        throw error;
    }
}

/**
 * Updates session availability (when players join/leave)
 * @param {string} matchId - The match ID to update
 * @param {number} newAvailableSlots - New number of available slots
 */
export async function updateSessionAvailability(matchId, newAvailableSlots) {
    try {
        const session = await prisma.gameSession.update({
            where: {
                matchId: matchId,
                active: true
            },
            data: {
                availableSlots: newAvailableSlots,
                updatedAt: new Date()
            }
        });

        console.log(`Updated session ${matchId} availability to ${newAvailableSlots} slots`);
        return session;
    } catch (error) {
        console.error('Error updating session availability:', error);
        throw error;
    }
}

/**
 * Updates a complete session by matchId and owner
 * @param {string} matchId - The match ID to update
 * @param {string} ownerTicket - The owner's ticket for verification
 * @param {Object} updateData - Data to update
 */
export async function updateSessionByMatchId(matchId, ownerTicket, updateData) {
    try {
        const session = await prisma.gameSession.update({
            where: {
                matchId: matchId,
                owner: ownerTicket,
                active: true
            },
            data: {
                ...updateData,
                updatedAt: new Date()
            }
        });

        console.log(`Updated session ${matchId} for owner ${ownerTicket}`);
        return session;
    } catch (error) {
        console.error('Error updating session:', error);
        throw error;
    }
}

/**
 * Gets active sessions for a specific user
 * @param {string} ticket - User ticket
 */
export async function getUserSessions(ticket) {
    try {
        const now = new Date();
        
        const sessions = await prisma.gameSession.findMany({
            where: {
                owner: ticket,
                active: true,
                expiresAt: {
                    gt: now
                }
            },
            orderBy: {
                updatedAt: 'desc'
            }
        });

        return sessions;
    } catch (error) {
        console.error('Error getting user sessions:', error);
        throw error;
    }
}
