import xml from "xml";
import fs from 'fs-extra'
import { getExpectedProfileStatType, StatsIdsParser, StatsParser, StatsWriter } from "../../utils/profileStats/profileStatsUtil.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma, s3Client } from "../../main.js";

function createReadStatsByGamer2(gamers) {
    const gamerHandlesXML = gamers.map((gamer) => ({
        r: [
            { _attr: { gh: gamer.gamerHandle } },
            gamer.stats,
        ]
    }));

    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'ReadStatsResponse',
                    },
                },
                { Status: 1},
                { Results: [{ _attr: { count: gamers.length.toString() } }, ...gamerHandlesXML] },
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

export async function readStatsByGamer2Handler(req,res){
    try {
        console.log(req.body)
    let rawHandles;
    const platform = req.headers['Platform'];

    
        console.log(req.body.gamerHandles)
    if(platform === "XBOX360"){
      rawHandles = `${req.body.gamerHandles}`.split(',');
    } else if(platform === "PS4" || platform === "PS5") {
    if (typeof req.body.gamerHandles === "string") {
        rawHandles = req.body.gamerHandles.split(',').map(h => h.trim()).filter(Boolean);
    } else if (Array.isArray(req.body.gamerHandles)) {
        rawHandles = req.body.gamerHandles;
    } else {
        rawHandles = [];
    }
    }

    const statIdsParser = new StatsIdsParser(req.body.statIds);
    const wantedStatsIds = statIdsParser.readStatsIds();

    // Pre-fetch all stat lookups in a single query for better performance
    const statLookupMap = new Map();
    const statLookups = await prisma.statLookup.findMany({
        where: {
            Hash: {
                in: wantedStatsIds.map(id => id.toString())
            }
        }
    });
    
    for (const lookup of statLookups) {
        statLookupMap.set(lookup.Hash, lookup);
    }

    let gamersResults = []

    for(let gamerHandle of rawHandles){
        let username;
        if(platform === "XBOX360"){
            username = parseInt(gamerHandle.replace('XBL ', ''), 16).toString()
        } else if(platform === "PS4" || platform === "PS5"){
            username = gamerHandle.replace('NP 2 ', '').replace('NP -1 ', '');
        }

        let user;

        if(platform === "XBOX360"){
            user = await prisma.user.findFirst({
                where: {
                    XUID: `${username}`
                }
            })
            console.log(user)
        } else if(platform === "PS4" || platform === "PS5"){
            user = await prisma.user.findFirst({
                where: {
                    blueSphereAccountId: username
                }
            })
        }

        if (!user) {
            continue;
        }
        
        const statsS3Key = generateStatsS3Key(platform, user.RockstarId);
        
        let StatsData = "";
        try {
            // Get stats from S3
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
            StatsData = Buffer.concat(chunks).toString('utf8');
        } catch (error) {
            // File doesn't exist or other error
            console.log('No stats found or error reading stats:', error.message);
            continue;
        }
        
        if (!StatsData) {
            continue;
        }
        
        const statsParser = new StatsParser(StatsData);
        let existingStats = {}

        existingStats = statsParser.readStatsAsHashMap();
        let statResults = []

        for(const statId of wantedStatsIds){
            if(existingStats[statId]){
                statResults.push({statId: statId, value: existingStats[statId].value, type: existingStats[statId].type})
            } else {
                // Use pre-fetched stat lookup from cache instead of individual query
                const missingStat = statLookupMap.get(statId.toString());
                if (missingStat) {
                    statResults.push({statId: statId, value: 0, type: getExpectedProfileStatType(missingStat.Type)})
                } else {
                    // Fallback if stat not found in lookup
                    statResults.push({statId: statId, value: 0, type: 'INT32'})
                }
            }
        }

        console.log(statResults.length);

        const statsWriter = new StatsWriter()
        const finalStatsBase64 = statsWriter.writeStatsOnlyValues(statResults);
        if(finalStatsBase64 === "") continue;
        if(platform === "XBOX360"){
          gamersResults.push({
              gamerHandle: `${gamerHandle}`,
              stats: finalStatsBase64,
          })
        } else if (platform === "PS4" || platform === "PS5"){
          gamersResults.push({
            gamerHandle: `NP 2 ${username}`,
            stats: finalStatsBase64,
          })
        }
    }
    console.log(createReadStatsByGamer2(gamersResults))
    res.send(createReadStatsByGamer2(gamersResults));
        
}   catch (error) {
        console.log(error)
}
}
