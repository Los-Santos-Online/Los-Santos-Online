import { PrismaClient } from '@prisma/client';
import xml from 'xml';
import { getMatchmakingPlatform } from './platformUtils.js';

const prisma = new PrismaClient();

const PS5_ATTRIBUTE_ORDER = [
    'GAME_MODE',
    'MMATTR_AIM_TYPE',
    'MMATTR_DISCRIMINATOR',
    'MMATTR_MM_GROUP_1',
    'MMATTR_MM_GROUP_2',
    'MMATTR_REGION',
    'MMATTR_ACTIVITY_TYPE',
    'MMATTR_ACTIVITY_ID',
    'MMATTR_ACTIVITY_PLAYERS',
    'MMATTP_2'
];

function parseSessionAttributes(session) {
    if (!session.attrsJson) {
        return {};
    }

    try {
        const attrs = typeof session.attrsJson === 'string'
            ? JSON.parse(session.attrsJson)
            : session.attrsJson;

        return attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};
    } catch (error) {
        console.error(`Error parsing attributes for session ${session.matchId}:`, error);
        return {};
    }
}

function formatAttributeValue(value) {
    if (value === undefined || value === null || value === '') {
        return '0';
    }

    if (typeof value === 'boolean') {
        return value ? '1' : '0';
    }

    return String(value);
}

function buildPS5Attributes(session) {
    const attrs = parseSessionAttributes(session);
    return PS5_ATTRIBUTE_ORDER.map((key) => formatAttributeValue(attrs[key])).join(',');
}

/**
 * Generates XML response from game sessions
 * @param {Array} sessions - Array of game sessions
 * @returns {string} XML string
 */
function generateXMLFromSessions(sessions, platform = '') {
    const includeAttributes = platform === 'PS5';

    // Map each session to an XML structure
    const sessionsXML = sessions.map((session) => {
        const sessionXML = [
            {
                _attr: {
                    MatchId: session.matchId,
                    Owner: session.owner
                }
            },
            { Data: session.data }
        ];

        if (includeAttributes) {
            sessionXML.push({ Attributes: buildPS5Attributes(session) });
        }

        return { R: sessionXML };
    });

    // Define the root XML structure, incorporating the dynamic sessions
    const xmlObject = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'DynamicResponse',
                    },
                },
                { Status: 1 },
                { Results: [
                    { _attr: { Count: sessions.length.toString() } },
                    ...sessionsXML
                ]},
            ],
        },
    ];

    // Convert the JavaScript object to an XML string with declaration and indentation
    const xmlString = xml(xmlObject, { declaration: true, indent: '\t' });
    return xmlString;
}

/**
 * Filters sessions based on the requester's game version.
 * @param {Array} sessions - Array of all active sessions
 * @param {string} requesterGameVersion - Requesting player's current game version
 * @returns {Array} Filtered sessions
 */
function filterSessions(sessions, requesterGameVersion) {
    if (!requesterGameVersion) {
        console.log('Requesting user has no game version recorded, skipping game version filter');
        return sessions;
    }

    return sessions.filter(session => {
        const matches = session.gameVersion === requesterGameVersion;
        console.log(`Filtering session ${session.matchId} by game version: expected ${requesterGameVersion}, got ${session.gameVersion}, match=${matches}`);
        return matches;
    });
}

/**
 * Handles the Find matchmaking request
 * Finds available game sessions based on filter criteria
 */
export async function findHandler(req, res) {
    try {
        const platform = getMatchmakingPlatform(req);
        const {
            ticket,
            availableSlots = '1',
            filterName,
            filterParamsJson,
            maxResults = '15'
        } = req.body;

        console.log('Find request:', { ticket, platform, availableSlots, filterName, filterParamsJson, maxResults });

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
            const xmlResponse = generateXMLFromSessions([], platform);
            res.setHeader('Content-Type', 'text/xml');
            return res.send(xmlResponse);
        }

        // Clean up expired sessions first
        const now = new Date();
        await prisma.gameSession.updateMany({
            where: {
                expiresAt: {
                    lt: now
                },
                active: true,
            },
            data: {
                active: false
            }
        });

        // Get all active sessions with available slots
        const minAvailableSlots = parseInt(availableSlots) || 1;
        const limit = parseInt(maxResults) || 15;
        const requesterGameVersion = user.gameVersion?.trim() || '';

        let sessions = await prisma.gameSession.findMany({
            where: {
                active: true,
                availableSlots: {
                    gte: minAvailableSlots
                },
                platform: platform,
                expiresAt: {
                    gt: now
                },
                ...(requesterGameVersion ? { gameVersion: requesterGameVersion } : {})
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: limit * 5 // Get more than needed in case filtering removes some
        });

        // Match against the tracked game version instead of MMATTR_DISCRIMINATOR.
        sessions = filterSessions(sessions, requesterGameVersion);

        // Limit results
        sessions = sessions.slice(0, limit);

        console.log(`Found ${sessions.length} matching ${platform || 'UNKNOWN'} sessions for user ${user.RockstarId}`);

        // Generate and send XML response
        res.setHeader('Content-Type', 'text/xml');
        const xmlResponse = generateXMLFromSessions(sessions, platform);
        console.log('XML Response:', xmlResponse);
        res.send(xmlResponse);

    } catch (error) {
        console.error('Error in Find:', error);
        res.status(500).send('Internal Server Error');
    }
}
