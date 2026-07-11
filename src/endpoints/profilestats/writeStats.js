import xml from 'xml';
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import fs from 'fs/promises';
import path from 'path';

import { ReadByTypeStatsParser, StatsParser, StatsWriter, decompressStats } from '../../utils/profileStats/profileStatsUtil.js';
import { prisma, sendLogMessage, s3Client } from '../../main.js';
import { PackedStatsParser } from '../../utils/profileStats/profileStatsUtil.js';
import { rawDataExtractor } from '../../utils/rc4Encryption/middleware.js';

function createWriteStatsResponseXML(numWritten, secsUntilNextWrite, maxSubmissionBinarySize) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'WriteStatsResponse',
                    },
                },
                { Status: '1' },
                { NumWritten: numWritten.toString() },
                { SecsUntilNextWrite: secsUntilNextWrite.toString() },
                { MaxSubmissionBinarySize: maxSubmissionBinarySize.toString() },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
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


export const writeStatsHandler = async (req, res) => {
    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                SessionTicket: req.headers['ros-sessionticket'],
            },
        });

        const platform = req.headers['Platform'];
        
        const rawData = req.headers['original-data'];
        const extractedData = rawDataExtractor(rawData).data;

        //await sendLogMessage(`Updating stats for user: ${user.name}`)

        // Decompress incoming stats
        const DecompressedStats = decompressStats(extractedData);
        
        // Generate S3 key for stats file
        const statsS3Key = generateStatsS3Key(platform, user.RockstarId);

        // Parse incoming stats
        const packedStatsParser = new PackedStatsParser(DecompressedStats);
        const incomingStats = packedStatsParser.readStats();

        // Read and parse existing stats if they exist
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
            console.log('No existing stats found or error reading stats:', error.message);
        }

        // Merge incoming stats with existing stats
        for (const stat of incomingStats) {
            existingStats[stat.statId] = stat;
        }

        // Write merged stats to S3
        const statsWrite = new StatsWriter();
        const convertedStats = Object.values(existingStats);
        const finalStatsBase64 = statsWrite.writeStats(convertedStats);
        
        // Upload to S3
        const putCommand = new PutObjectCommand({
            Bucket: process.env.S3_BUCKET_NAME,
            Key: statsS3Key,
            Body: finalStatsBase64,
            ContentType: "text/plain"
        });

        await s3Client.send(putCommand);

        // Send response
        res.set('Content-Type', 'text/xml');
        res.send(createWriteStatsResponseXML(incomingStats.length, 90, 8192));
    } catch (e) {
        console.error('Error in writeStatsHandler:', e);
        res.status(500).send('Internal Server Error');
    }
};
