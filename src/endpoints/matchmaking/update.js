import { PrismaClient } from '@prisma/client';
import { getMatchmakingPlatform, getPlatformCandidates } from './platformUtils.js';

const prisma = new PrismaClient();

/**
 * Handles the Update matchmaking request
 * Updates an existing game session's details
 */
export async function updateHandler(req, res) {
    try {
        const platform = getMatchmakingPlatform(req);
        const {
            ticket,
            matchId,
            numSlots,
            availableSlots,
            attrsJson
        } = req.body;

        console.log('Update request:', { ticket, platform, matchId, numSlots, availableSlots, attrsJson });

        // Validate required fields
        if (!ticket || !matchId || !numSlots || !availableSlots || !attrsJson) {
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

        const gameVersion = user.gameVersion?.trim() || '';

        // Parse attributes to extract session data
        let sessionData = '';
        let parsedAttrs = {};

        try {
            parsedAttrs = JSON.parse(attrsJson);
            sessionData = parsedAttrs.Data || '';

            // Remove Data from attrs since we store it separately
            const { Data, ...attrsWithoutData } = parsedAttrs;
            parsedAttrs = attrsWithoutData;
        } catch (error) {
            console.error('Error parsing attributes JSON:', error);
            return res.status(400).send('Invalid attributes JSON');
        }

        // Find the existing session by matchId (no ownership check - anyone can update)
        let existingSession = await prisma.gameSession.findFirst({
            where: {
                matchId: matchId,
                platform: platform,
                active: true,
                expiresAt: {
                    gt: new Date()
                }
            }
        });

        if (!existingSession) {
            existingSession = await prisma.gameSession.findFirst({
                where: {
                    matchId: matchId,
                    platform: {
                        in: getPlatformCandidates(platform)
                    },
                    active: true,
                    expiresAt: {
                        gt: new Date()
                    }
                }
            });
        }

        // Extend expiration time (8 hours from now)
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 8);

        let session;

        if (!existingSession) {
            // Session doesn't exist, create a new one for the user
            console.log(`Session ${matchId} not found, creating new session for user ${user.RockstarId}`);

            // session = await prisma.gameSession.create({
            //     data: {
            //         matchId: matchId,
            //         owner: `${user.RockstarId}`,
            //         gameVersion: gameVersion,
            //         userId: user.id,
            //         numSlots: parseInt(numSlots),
            //         availableSlots: parseInt(availableSlots),
            //         attrsJson: JSON.stringify(parsedAttrs),
            //         data: sessionData,
            //         expiresAt: expiresAt,
            //         active: true
            //     }
            // });
        } else {
            // Update the existing session
            console.log(`Updating session ${matchId} for user ${user.RockstarId}`);

            session = await prisma.gameSession.update({
                where: {
                    id: existingSession.id
                },
                data: {
                    owner: `${user.RockstarId}`,  // Whoever updates becomes the new owner
                    platform: platform,
                    gameVersion: gameVersion,
                    numSlots: parseInt(numSlots),
                    availableSlots: parseInt(availableSlots),
                    attrsJson: JSON.stringify(parsedAttrs),
                    data: sessionData,
                    expiresAt: expiresAt,
                    updatedAt: new Date(),
                    active: true,
                }
            });
        }

        console.log(`Session ${matchId} updated successfully`);

        // Return success response
        res.setHeader('Content-Type', 'text/xml');
        res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="DynamicResponse">
    <Status>1</Status>
</Response>`);

    } catch (error) {
        console.error('Error in Update:', error);

        // Handle specific Prisma errors
        if (error.code === 'P2025') {
            return res.status(404).send('Session not found');
        }

        res.status(500).send('Internal Server Error');
    }
}
