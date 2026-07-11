import { PrismaClient } from '@prisma/client';
import { getMatchmakingPlatform, getPlatformCandidates } from './platformUtils.js';

const prisma = new PrismaClient();

/**
 * Handles the Unadvertise matchmaking request
 * Removes a specific game session advertisement for the user
 */
export async function unadvertiseHandler(req, res) {
    try {
        const platform = getMatchmakingPlatform(req);
        console.log('Unadvertise request body:', req.body);
        const { ticket, matchId } = req.body;

        console.log('Unadvertise request:', { ticket, platform, matchId });

        // Validate required fields
        if (!ticket) {
            return res.status(400).send('Missing required field: ticket');
        }

        if (!matchId) {
            return res.status(400).send('Missing required field: matchId');
        }

        // Find the user by ticket
        const user = await prisma.user.findUnique({
            where: { Ticket: ticket }
        });

        if (!user) {
            console.log('User not found for ticket:', ticket);
            return res.status(404).send('User not found');
        }

        // Find the specific session owned by this user
        const session = await prisma.gameSession.findFirst({
            where: {
                matchId: matchId,
                owner: `${user.RockstarId}`,
                platform: {
                    in: getPlatformCandidates(platform)
                }
            }
        });

        if (!session) {
            console.log(`Session ${matchId} not found or not owned by user ${user.RockstarId}`);
            // Return success even if not found for idempotency
            res.setHeader('Content-Type', 'text/xml');
            return res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="DynamicResponse">
    <Status>1</Status>
    <MatchId>${matchId}</MatchId>
</Response>`);
        }

        // Deactivate the session
        await prisma.gameSession.update({
            where: {
                id: session.id
            },
            data: {
                active: false,
                updatedAt: new Date()
            }
        });

        console.log(`Unadvertised session ${matchId} for user ${user.RockstarId}`);

        // Return success response
        res.setHeader('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="DynamicResponse">
    <Status>1</Status>
    <MatchId>${matchId}</MatchId>
</Response>`);

    } catch (error) {
        console.error('Error in Unadvertise:', error);
        res.status(500).send('Internal Server Error');
    }
}
