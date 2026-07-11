import { PrismaClient } from '@prisma/client';
import { getMatchmakingPlatform, getPlatformCandidates } from './platformUtils.js';

const prisma = new PrismaClient();

/**
 * Handles the UnadvertiseAll matchmaking request
 * Removes all active game session advertisements for the user
 */
export async function unadvertiseAllHandler(req, res) {
    try {
        const platform = getMatchmakingPlatform(req);
        const { ticket } = req.body;

        console.log('UnadvertiseAll request:', { ticket, platform });

        // Validate required fields
        if (!ticket) {
            return res.status(400).send('Missing required field: ticket');
        }

        // Find the user by ticket
        const user = await prisma.user.findUnique({
            where: { Ticket: ticket }
        });

        if (!user) {
            console.log('User not found for ticket:', ticket);
            return res.status(404).send('User not found');
        }

        // Deactivate all sessions for this user
        const updateResult = await prisma.gameSession.updateMany({
            where: {
                owner: `${user.RockstarId}`,
                platform: {
                    in: getPlatformCandidates(platform)
                },
                active: true
            },
            data: {
                active: false,
                updatedAt: new Date()
            }
        });

        console.log(`Unadvertised ${updateResult.count} sessions for user ${user.RockstarId}`);

        // Return success response
        res.setHeader('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="DynamicResponse">
    <Status>1</Status>
    <RemovedSessions>${updateResult.count}</RemovedSessions>
</Response>`);

    } catch (error) {
        console.error('Error in UnadvertiseAll:', error);
        res.status(500).send('Internal Server Error');
    }
}
