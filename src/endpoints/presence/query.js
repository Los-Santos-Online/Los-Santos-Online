import xml from 'xml';
import { prisma, sendLogMessage, ACTIVE_PLAYERS } from '../../main.js';
import { PresenceAttributesClient, PresenceParamNameValueCSVClient } from '../../utils/presence/presenceUtils.js';

function createQueryPresence(gamers) {
    const gamerHandlesXML = gamers.map((gamer) => ({
        r: [
            { _attr: { gh: gamer.gamerHandle } },
            gamer.gsinfo
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
                { Results: [{ _attr: { Count: gamers.length.toString() } }, ...gamerHandlesXML] },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const queryPresenceHandler = async (req, res) => {
    try {
        const { ticket } = req.body;
        const user = await prisma.user.findUnique({
            where: { Ticket: ticket }
        });

        console.log(req.body)
        switch (req.body.queryName) {
            case "NetAddrByPeerAddr":
                console.log(req.body);
                break;
            case "SessionByGamerHandle":
                await getSessionByQueryHandle(req, res, user)
                break;
            case "CrewmateSessions":
                const platform = req.headers['Platform'];
                const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

                // All active sessions are public, so only platform and recency matter.
                const activePlayers = await prisma.activePlayer.findMany({
                    where: {
                        platform: platform,
                        lastSeen: { gte: fiveMinutesAgo }
                    },
                    include: {
                        user: true
                    }
                });

                // Create map to track unique session infos
                const uniqueSessions = new Map();

                for (const activePlayer of activePlayers) {
                    const user = activePlayer.user;
                    if (user) {
                        const attributesClient = new PresenceAttributesClient(user.PresenceAttributes);
                        const sessionAttribute = attributesClient.getAttribute('gsinfo');
                        
                        if (sessionAttribute) {
                            const gamerHandle = platform === 'PS4' ? 
                                `NP 2 "${user.PS4Username}"` : 
                                `XBL ${BigInt(user.XUID).toString(16).toUpperCase()}"`;

                            // Use session info as key to deduplicate
                            if (!uniqueSessions.has(sessionAttribute)) {
                                uniqueSessions.set(sessionAttribute, {
                                    gamerHandle: `${gamerHandle}"`,
                                    gsinfo: `{\"gsinfo\":\"${sessionAttribute}\"}`
                                });
                            }
                        }
                    }
                }

                // Convert to array and shuffle
                let finalGamers = Array.from(uniqueSessions.values());
                for (let i = finalGamers.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [finalGamers[i], finalGamers[j]] = [finalGamers[j], finalGamers[i]];
                }

                // Take up to 10 sessions, or all sessions if less than 10
                finalGamers = finalGamers.slice(0, Math.min(finalGamers.length, 10));

                res.set('Content-Type', 'text/xml');
                console.log(createQueryPresence(finalGamers))
                res.send(createQueryPresence(finalGamers));
                break;
            default:
                await sendLogMessage(`Unknown Presence Query: ${req.body.queryName}`)
                break;
        }

    } catch (error) {
        await sendLogMessage('ERROR IN QUERY PRESENCE ATTRIBUTES')
        console.log(error);
    }
};


async function getSessionByQueryHandle(req, res, requestingUser){
    try {
        const platform = req.headers['Platform'];
        if(platform === "XBOX360"){
            const finalGamers = [];

            const paramNameValueClient = new PresenceParamNameValueCSVClient();
            const requestedValues = paramNameValueClient.parse(`${req.body.paramNameValueCsv}`);
            console.log(requestedValues)
            const name = requestedValues.find((value) => value.name === '@ghandle').value;
            const filteredName = name.replace('XBL ', '').replace('"', "").replace('"', "")
            console.log(filteredName)
            const XUID = parseInt(filteredName, 16)
            const user = await prisma.user.findFirst({
                where: {
                    XUID: `${XUID}`,
                },
            });

            const presenceAttributes = user.PresenceAttributes;
            const attributesClient = new PresenceAttributesClient(presenceAttributes);
            const sessionAttribute = attributesClient.getAttribute('gsinfo');

            finalGamers.push({
                gamerHandle: `XBL ${filteredName}"`,
                gsinfo: `{"_id":"XBL ${filteredName}","gsinfo":"${sessionAttribute}"}`
            });
            console.log(createQueryPresence(finalGamers))
            res.set('Content-Type', 'text/xml');
            res.send(createQueryPresence(finalGamers));
        }            
        else if(platform === "PS4" || platform === "PCROS"){                
            const finalGamers = [];

            const paramNameValueClient = new PresenceParamNameValueCSVClient();
            const requestedValues = paramNameValueClient.parse(`${req.body.paramNameValueCsv}`);

            const name = requestedValues.find((value) => value.name === '@ghandle').value;
            const filteredName = name.split(' ').pop().replace(/"/g, '');

            const user = await prisma.user.findUnique({
                where: {
                    blueSphereAccountId: filteredName,
                },
            });

            if (!user) {
                const emptyXmlResponse = `
            <?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="PresenceQueryResponse">
  <Status>1</Status>
  <Results Count="0">
  </Results>
</Response>`;
                res.set('Content-Type', 'text/xml');
                res.send(emptyXmlResponse);
                return;
            }

            const presenceAttributes = user.PresenceAttributes;
            const attributesClient = new PresenceAttributesClient(presenceAttributes);
            const sessionAttribute = attributesClient.getAttribute('gsinfo');
            const gsType = attributesClient.getAttribute('gsType') || '5';
            finalGamers.push({
                gamerHandle: `NP 2 ${filteredName}`,
                gsinfo: `{"_id":"NP 2 ${filteredName}","gsinfo":"${sessionAttribute}","gsType":1}`,
            });

            const xmlResponse = `
            <?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="PresenceQueryResponse">
  <Status>1</Status>
  <Results Count="1">
    <R>{"_id":"NP 2 ${filteredName}","gsinfo":"${sessionAttribute}","gstype":5}</R>
  </Results>
</Response>`

            res.set('Content-Type', 'text/xml');
            res.send(xmlResponse);
        }

    } catch (error) {
        console.log(error)
    }
}
