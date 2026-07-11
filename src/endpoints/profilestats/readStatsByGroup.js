import { PrismaClient } from '@prisma/client';
import ByteBuffer from 'bytebuffer';
import xml from 'xml';
import { getExpectedProfileStatType, StatsParser, StatsWriter } from '../../utils/profileStats/profileStatsUtil.js';
import { s3Client } from '../../main.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';


const prisma = new PrismaClient();

function decodeGroupIdsFromBase64(base64String) {
    // Decode the Base64 string to a ByteBuffer
    let bb = ByteBuffer.fromBase64(base64String);

    // Prepare to read from the buffer
    bb.order(ByteBuffer.BIG_ENDIAN); // Ensure big endian byte order
    let ids = [];

    while (bb.remaining() >= 4) {
        let id = bb.readInt32();
        ids.push(id);
    }

    return ids;
}


function generateStatsS3Key(platform, rockstarId) {
    if (platform === 'PS3') {
        return `ps3/statsStorage/${rockstarId}/profileStats.txt`;
    } else if (platform === 'PS4') {
        return `ps4/statsStorage/${rockstarId}/profileStats.txt`;
    } else if (platform === 'PS5') {
        return `ps5/statsStorage/${rockstarId}/profileStats.txt`;
    } else if (platform === 'XBOX360') {
        return `xbox360/statsStorage/${rockstarId}/profileStats.txt`;
    } else if (platform === 'XBOXONE') {
        return `xboxone/statsStorage/${rockstarId}/profileStats.txt`;
    } else if (platform === 'PCROS') {
        return `pc/statsStorage/${rockstarId}/profileStats.txt`;
    } else {
        throw new Error("Invalid platform");
    }
}

export async function readStatsByGroupHandler(req, res) {
    try {
        const platform = req.headers['Platform'];
        const groupIds = req.body.groupIds;
        let user;
        
        try {
            user = await prisma.user.findFirstOrThrow({
                where: {
                    SessionTicket: req.headers['ros-sessionticket'],
                },
            });
        } catch (error) {
            return res.status(401).json({ error: 'Invalid session ticket' });
        }

        // Decode the groupIds from Base64
        let decodedGroupIds;
        try {
            decodedGroupIds = decodeGroupIdsFromBase64(groupIds);
        } catch (error) {
            console.log('failed to decode group IDs');
            return res.status(400).json({ error: 'Failed to decode groupIds' });
        }

        let allStatsRequested;
        // Get all requested stats from the database
        if(platform !== "PS5"){
        allStatsRequested = await prisma.statLookup.findMany({
            where: {
                Group: {
                    in: decodedGroupIds,
                },
            },
            select: {
                Hash: true,
                Type: true,
            },
        });
        } else {
            allStatsRequested = await prisma.gen9StatLookup.findMany({
                where: {
                    Group: {
                        in: decodedGroupIds,
                    },
                },
                select: {
                    Hash: true,
                    Type: true,
                },
            });
        }

        // Generate S3 key for stats file using the helper function
        const statsS3Key = generateStatsS3Key(platform, user.RockstarId);

        // Read existing stats from S3 if available
        let existingStats = {};
        try {
            // Get existing stats from S3
            const { Body } = await s3Client.send(
                new GetObjectCommand({
                    Bucket: process.env.S3_BUCKET_NAME,
                    Key: statsS3Key,
                })
            );

            // Read the entire stream into a string
            const chunks = [];
            for await (const chunk of Body) {
                chunks.push(chunk);
            }
            const StatsData = Buffer.concat(chunks).toString('utf8');
            
            const statsParser = new StatsParser(StatsData);
            existingStats = statsParser.readStatsAsHashMap();
        } catch (error) {
            // File doesn't exist or other error - start with empty stats
            console.log(`No existing stats found for user ${user.RockstarId} or error reading stats:`, error.message);
        }

        // Create stats array using existing values or 0 as default
        const requestedStats = allStatsRequested.map(dbStat => {
            const statId = parseInt(dbStat.Hash, 10);
            const existingStat = existingStats[statId];
            
            // Check if this is the _SaveMpTimestamp_0 stat (hash 1314069208)
            if (statId === 1314069208) {
                // Set to current POSIX time
                const currentPosixTime = Math.floor(Date.now() / 1000);
                return {
                    statId,
                    type: existingStat ? existingStat.type : getExpectedProfileStatType(dbStat.Type),
                    value: BigInt(currentPosixTime)
                };
            }

            if(platform === "PS5"){

                if (statId === 1553020756) {
                    // Set to current POSIX time
                    const currentPosixTime = Math.floor(Date.now() / 1000);
                    return {
                        statId,
                        type: existingStat ? existingStat.type : getExpectedProfileStatType(dbStat.Type),
                        value: BigInt(currentPosixTime)
                    };
                }

                //226991546
                if (statId === 226991546) {
                    // Set to current POSIX time
                    const currentPosixTime = Math.floor(Date.now() / 1000);
                    return {
                        statId,
                        type: 0,
                        value: BigInt(currentPosixTime)
                    };
                }
            }
            
            return {
                statId,
                type: existingStat ? existingStat.type : getExpectedProfileStatType(dbStat.Type),
                value: existingStat ? existingStat.value : 0
            };
        });

        const requestedStatsBase64 = new StatsWriter().writeStats(requestedStats);
    
        res.set('Content-Type', 'text/xml');
        res.send(createReadStatsByGroupsXML(requestedStatsBase64));
    } catch (e) {
        console.log(e);
        res.status(500).send('Internal Server Error');
    }
}


function createReadStatsByGroupsXML(values) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'ReadStatsByGroupsResponse',
                    },
                },
                { Status: '1' },
                { Values: values },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}
