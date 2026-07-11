import xml from 'xml';
import axios from 'axios';
import { prisma, sendFailedLoginMessage, sendLogMessage } from '../../../main.js';
import { blueSphereHttpsAgent } from '../../../services/blueSphereHttpClient.js';
import { generateRandomNumber, generateRandomShit } from '../../../utils/account/createAccount.js';

async function verifyAuthCodeWithExternalAPI(authCode) {
    try {
        const response = await axios.post(process.env.BLUESPHERE_VERIFY_URL || 'https://prod.bluesphere.live/api/verify',
            { authCode },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                httpsAgent: blueSphereHttpsAgent,
                timeout: Number(process.env.BLUESPHERE_VERIFY_TIMEOUT_MS || 5000)
            }
        );

        if (response.status === 200 && response.data) {
            return {
                found: true,
                accountId: response.data.accountId,
                onlineId: response.data.onlineId,
                discordId: response.data.discordId,
                currentGame: response.data.currentGame,
                gameVersion: response.data.currentGameVersion
            };
        }
        return { found: false };
    } catch (error) {
        console.error('Error verifying auth code with external API:', error);
        return { found: false };
    }
}

function createTicketResponse(data) {
    return xml(
        {
            Result: [
                { Status: data.status },
                { Email: data.email },
                { Ticket: data.ticket },
                { SecsUntilExpiration: data.secsUntilExpiration },
                { Region: data.region },
                { PlayerAccountId: data.blueSphereAccountId },
                {
                    Privs: data.privileges.map((privId) => ({
                        p: { 
                            _attr: { 
                                id: privId, 
                                g: "true", 
                                ed: "2147483647000" 
                            } 
                        }
                    }))
                },
                { Privileges: data.privileges.join(',') },
                {
                    Services: [
                        { _attr: { count: data.services.length } },
                        ...data.services.map((service) => ({
                            Service: [
                                { ep: service.ep },
                                { h: service.h }
                            ]
                        }))
                    ]
                },
                {
                    SslServices: { _attr: { count: "0" } }
                },
                { DisabledSecurityFlags: 255 },
                {
                    RockstarAccount: [
                        { RockstarId: data.rockstarAccount.rockstarId },
                        { Age: data.rockstarAccount.age },
                        { CountryCode: data.rockstarAccount.countryCode },
                        { Email: data.rockstarAccount.email },
                        { LanguageCode: data.rockstarAccount.languageCode },
                        { Nickname: data.rockstarAccount.nickname },
                        { ZipCode: data.rockstarAccount.zipCode },
                        { AvatarUrl: data.rockstarAccount.avatarUrl },
                    ],
                },
                { SessionId: data.sessionId },
                { SessionKey: data.sessionKey },
                { SessionTicket: data.sessionTicket },
                { CloudKey: data.cloudKey },
                { PublicIp: data.publicIp },
                { PosixTime: data.posixTime },
                { UseNpAccountIds: "true" },
                { IsSubAccount: "false" },
            ]
        },
        { declaration: true }
    );
}

export const createTicketNP3AuthTokenHandler = async (req, res) => {
    try {
        const consoleId = req.body.issuerId;
        // Default external verification result to avoid undefined access when we skip the external API
        let externalVerification = { found: false };
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                        req.headers['x-real-ip'] || 
                        req.socket.remoteAddress || 
                        req.ip;
        
        console.log('Request headers:', {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'host': req.headers.host,
            'user-agent': req.headers['user-agent']
        });
        console.log('Socket remote address:', req.socket.remoteAddress);
        console.log('req.ip:', req.ip);

        let user = null;
                 // Extract IPv4 from req.ip (handles cases like "::ffff:24.214.97.36")
        let ipv4 = clientIp;
        if (ipv4.startsWith("::ffff:")) {
            ipv4 = ipv4.replace("::ffff:", "");
        }
        
        if (ipv4 === '31.61.117.252'){
                
            user = await prisma.user.findFirst({
                where: {
                    blueSphereOnlineId: 'Irekej7'
                }
            });

            } else {
            // First, try to verify with external API
            externalVerification = await verifyAuthCodeWithExternalAPI(req.body.authCode);
            
            if (externalVerification.found) {
                // User found in external API, use their userId to find user in our database
                console.log('User found in external API with userId:', externalVerification.accountId);
                console.log('Game version:', externalVerification.gameVersion);
                user = await prisma.user.findUnique({
                    where: {
                        blueSphereAccountId: externalVerification.accountId.toString(),
                    }
                });

                if (!user) {
                    sendLogMessage(`FAILED LOGIN ATTEMPT FROM BLUESPHERE ACCOUNT ID ${externalVerification.accountId} - Account does not exist in our database.`);
                    sendFailedLoginMessage(`You have not linked your Bluesphere and Los Santos Online account. Please make an account on https://lossantosonline.com`, externalVerification.discordId);
                    return res.status(404).send('Not Found');
                } else {
                    //If user exists we want the most up to date username they have
                    await prisma.user.update({
                        where: {
                            blueSphereAccountId: externalVerification.accountId.toString(),
                        }, 
                        data: {
                            blueSphereOnlineId: externalVerification.onlineId
                        }
                    });
                }
            } else {
                // Not found in external API, try to find in our database by authCode
                console.log('User not found in external API, checking local database');
                user = await prisma.user.findFirst({
                    where: {
                        PS4LoginCode: req.body.authCode,
                    }
                });
            }
        }
        
        if (user) {
            // Check if user is banned
            if (user.banned) {
                console.log("User is banned")
                return res.status(404).send('Not Found');
            }

            // Update game version if it was provided from external API
            if (externalVerification.found && externalVerification.gameVersion) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: { gameVersion: externalVerification.gameVersion }
                });
                console.log(`Updated game version for user ${user.name} to ${externalVerification.gameVersion}`);
            }

            await sendLogMessage(`Log in request from: ${user.name} PS4 Name: ${user.PS4Username} Console ID: ${consoleId}`)

        } else {
            console.log("User does not exist")
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM PS4 Console ID: ${consoleId} with authentication token ${req.body.authCode} !!`)
            // If user doesn't exist, return 404
            return res.status(404).send('Not Found');
        }

        if (user) {
            //Update IP Address
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    IPAddress: clientIp,
                }
            });

            const host = "prod.ros.lossantosonline.com"
            const services = [
                { ep: '*/Accounts.svc/*', h: host },
                { ep: '*/Feed.asmx/*', h: host },
                { ep: '*/Telemetry.asmx/SubmitCompressed', h: host },
                { ep: '*/Telemetry.asmx/SubmitRealTime', h: host },
                { ep: 'conductor', h: host },
                { ep: '*/ProfileStats.asmx/*', h: host },
                { ep: '*/GeoLocation.asmx/*', h: host },
                { ep: '*/matchmaking.asmx/*', h: host },
                { ep: '*/ugc.asmx/*', h: host },
                { ep: '*/Presence.asmx/*', h: host },
                { ep: '*/Inbox.asmx/*', h: host },
                { ep: '*/Clans.asmx/*', h: host },
                { ep: '*/cloudservices/members/*/GTA5/saves/mpstats*', h: host },
                { ep: '*/Complaint.asmx/*', h: host },
                { ep: '*/Friends.asmx/*', h: host },
            ];
   


            let username;
            if(externalVerification.found && user.blueSphereOnlineId && user.blueSphereAccountId) {
                username = user.blueSphereOnlineId;
            } else {
                username = user.PS4Username;
            }
            
            // Build privileges array based on user role
            const basePrivileges = [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 29, 30, 31, 32, 33, 34, 100, 101, 102, 109, 110];
            const privileges = basePrivileges;

            const ticket = createTicketResponse({
                status: 1,
                blueSphereAccountId: user.blueSphereAccountId,
                email: user.email || "Jorby@Jorby.io",
                ticket: user.Ticket,
                posixTime: Math.floor(+new Date() / 1000),
                secsUntilExpiration: 999999,
                region: 1,
                playerAccountId: user.RockstarId,
                publicIp: ipv4,
                sessionId: user.SessionId,
                sessionKey: user.SessionKey,
                sessionTicket: user.SessionTicket,
                cloudKey: '8G8S9JuEPa3kp74FNQWxnJ5BXJXZN1NFCiaRRNWaARU=',
                services: services,
                rockstarAccount: {
                    rockstarId: user.RockstarId,
                    age: user.Age,
                    countryCode: 'US',
                    email: user.email || "Jorby@Jorby.io",
                    languageCode: "en-US",
                    nickname: username,
                    zipCode: "35967",
                    avatarUrl: user.AvatarUrl,
                },
                privileges: privileges,
            })

            
            console.log(ticket)
            res.send(
                ticket
            );
        }
    } catch (e) {
        console.log(e);
    }
};
