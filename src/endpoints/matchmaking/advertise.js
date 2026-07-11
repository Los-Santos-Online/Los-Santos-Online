import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { getMatchmakingPlatform, getPlatformCandidates } from './platformUtils.js';
const prisma = new PrismaClient();

/**
 * Generates a unique match ID
 * @returns {string} Unique match ID
 */
function parseAdvertiseAttributes(attrsJson) {
    const parsedAttrs = typeof attrsJson === 'string' ? JSON.parse(attrsJson) : attrsJson;

    if (!parsedAttrs || typeof parsedAttrs !== 'object' || Array.isArray(parsedAttrs)) {
        throw new Error('attrsJson must be a JSON object');
    }

    const { Data, ...attrsWithoutData } = parsedAttrs;
    return {
        sessionData: Data || '',
        attrs: attrsWithoutData
    };
}

/**
 * Handles the Advertise matchmaking request
 * Creates or updates a game session advertisement
 */
export async function advertiseHandler(req, res) {
    try {
        const platform = getMatchmakingPlatform(req);
        const {
            ticket,
            numSlots,
            availableSlots,
            attrsJson
        } = req.body;
        console.log(req.body);
        console.log('Advertise request:', { ticket, platform, numSlots, availableSlots, attrsJson });

        // Validate required fields
        if (!ticket || !numSlots || !availableSlots || !attrsJson) {
            return res.status(400).send('Missing required fields');
        }

        // Find the user by ticket
        const user = await prisma.user.findUnique({
            where: { Ticket: ticket }
        });

        if (!user) {
            console.log('User not found for ticket:', ticket);
            return res.status(404).send('User not found');
        }

        // Parse attributes to extract session data
        let sessionData = '';
        let parsedAttrs = {};

        try {
            const parsed = parseAdvertiseAttributes(attrsJson);
            sessionData = parsed.sessionData;
            parsedAttrs = parsed.attrs;
        } catch (error) {
            console.error('Error parsing attributes JSON:', error);
            return res.status(400).send('Invalid attributes JSON');
        }

        // Set expiration time (8 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);
        const gameVersion = user.gameVersion?.trim() || '';

        // Check if user already has an active session
        const existingSession = await prisma.gameSession.findFirst({
            where: {
                owner: `${user.RockstarId}`,
                platform: {
                    in: getPlatformCandidates(platform)
                },
                active: true,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        let session;

        if (existingSession) {
            // Deactivate existing session and set expiry to 10 minutes for migration
            console.log(`Deactivating existing session ${existingSession.matchId} for user ${user.RockstarId} for migration`);

            const migrationExpiry = new Date();
            migrationExpiry.setMinutes(migrationExpiry.getMinutes() + 10);

            await prisma.gameSession.update({
                where: {
                    id: existingSession.id
                },
                data: {
                    active: false,
                    expiresAt: migrationExpiry,
                    updatedAt: new Date()
                }
            });

            // Create a new session instead of updating
            const matchId = randomUUID();
            console.log(`Creating new session ${matchId} for user ${user.RockstarId} after deactivating old one`);
            session = await prisma.gameSession.create({
                data: {
                    matchId: matchId,
                    owner: `${user.RockstarId}`,
                    userId: user.id,
                    platform: platform,
                    gameVersion: gameVersion,
                    numSlots: parseInt(numSlots),
                    availableSlots: parseInt(availableSlots),
                    attrsJson: JSON.stringify(parsedAttrs),
                    data: sessionData,
                    expiresAt: expiresAt,
                    active: true
                }
            });
        } else {
            // Create new session
            const matchId = randomUUID();
            console.log(`Creating new session ${matchId} for user ${user.RockstarId}`);
            session = await prisma.gameSession.create({
                data: {
                    matchId: matchId,
                    owner: `${user.RockstarId}`,
                    platform: platform,
                    gameVersion: gameVersion,
                    userId: user.id,
                    numSlots: parseInt(numSlots),
                    availableSlots: parseInt(availableSlots),
                    attrsJson: JSON.stringify(parsedAttrs),
                    data: sessionData,
                    expiresAt: expiresAt,
                    active: true
                }
            });
        }

        console.log(`Session ${session.matchId} advertised successfully`);

        // Return success response (GTA expects a simple OK response for advertise)
        res.setHeader('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="DynamicResponse">
    <Status>1</Status>
    <MatchId>${session.matchId}</MatchId>
</Response>`);

    } catch (error) {
        console.error('Error in Advertise:', error);
        res.status(500).send('Internal Server Error');
    }
}
