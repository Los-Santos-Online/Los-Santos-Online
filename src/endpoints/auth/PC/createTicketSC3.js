import xml from 'xml';
import bcrypt from 'bcrypt';
import { prisma, sendLogMessage } from '../../../main.js';
import { generateRandomNumber, generateRandomShit } from '../../../utils/account/createAccount.js';


function createTicketResponse(data) {
    return xml(
        {
            Response: [
                { Status: data.status },
                { Ticket: data.ticket },
                { PosixTime: data.posixTime },
                { SecsUntilExpiration: data.secsUntilExpiration },
                { PlayerAccountId: data.playerAccountId },
                { PublicIp: data.publicIp },
                { SessionId: data.sessionId },
                { SessionKey: data.sessionKey },
                { SessionTicket: data.sessionTicket },
                { CloudKey: data.cloudKey },
                { MFAEnabled: data.mfaEnabled },
                { DisabledSecurityFlags: 255 },
                {
                    Services: [
                        { _attr: { Count: data.services.length } },
                        ...data.services.map((service) => ({
                            S: { _attr: { ep: service.ep, h: service.h } },
                        })),
                    ],
                },
                {
                    RockstarAccount: [
                        { RockstarId: data.rockstarAccount.rockstarId },
                        { Age: 25 },
                        { AvatarUrl: "https://prod-avatars.akamaized.net/stock-avatars/n/default.png" },
                        { CountryCode: "US" },
                        { Email: data.rockstarAccount.email },
                        { LanguageCode: "en" },
                        { Nickname: data.rockstarAccount.nickname },
                    ],
                },
                { Privileges: data.privileges.join(',') },
            ],
            _attr: {
                ['xmlns:xsd']: 'http://www.w3.org/2001/XMLSchema',
                ['xmlns:xsi']: 'http://www.w3.org/2001/XMLSchema-instance',
                xmlns: 'CreateTicketResponse',
            },
        },
        { declaration: true }
    );
}

export const createTicketSC3Handler = async (req, res) => {
    console.log(req.body)
    try {
        // Validate that both email and password are provided
        if (!req.body.email || !req.body.password) {
            console.log("Missing email or password");
            return res.status(400).send('Bad Request');
        }

        let user = await prisma.user.findFirstOrThrow({
            where: {
                PCEmail: req.body.email,
            }
        });

        // Validate password
        if (!user.PCPassword || !(await bcrypt.compare(req.body.password, user.PCPassword))) {
            console.log("Invalid password");
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM PC (Invalid Password) from ${req.body.email} !!`);
            return res.status(404).send('Not Found');
        }

        if (user) {
            
            // Check if user is banned
            if (user.banned) {
                console.log("User is banned")
                return res.status(404).send('Not Found');
            }

            await sendLogMessage(`Log in request from: ${user.name} PC Name: ${user.name}`)

        } else {
            console.log("User does not exist")
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM PC from ${req.body.email} !!`)
            // If user doesn't exist, return 404
            return res.status(404).send('Not Found');
        }

        if (user) {
            const host = req.get('host').replace('auth-', '');
            const services = [
                { ep: '*/Accounts.svc/*', h: host },
                { ep: '*/Feed.asmx/*', h: host },
                { ep: '*/Telemetry.asmx/SubmitCompressed', h: host },
                { ep: '*/Telemetry.asmx/SubmitRealTime', h: host },
                { ep: '*/ProfileStats.asmx/*', h: host },
                { ep: '*/matchmaking.asmx/*', h: host },
                { ep: '*/ugc.asmx/*', h: host },
                { ep: '*/Presence.asmx/*', h: host },
                { ep: '*/Inbox.asmx/*', h: host },
                { ep: '*/Clans.asmx/*', h: host },
                { ep: '*/cloudservices/members/*/GTA5/saves/mpstats*', h: host },
            ];

            const ticket = createTicketResponse({
                status: 1,
                ticket: user.Ticket,
                posixTime: Math.floor(+new Date() / 1000),
                secsUntilExpiration: 86399,
                playerAccountId: user.RockstarId,
                publicIp: req.ip.split(':').pop(),
                sessionId: user.SessionId,
                sessionKey: user.SessionKey,
                sessionTicket: user.SessionTicket,
                cloudKey: '8G8S9JuEPa3kp74FNQWxnJ5BXJXZN1NFCiaRRNWaARU=',
                mfaEnabled: false,
                services: services,
                rockstarAccount: {
                    rockstarId: user.RockstarId,
                    age: user.Age,
                    avatarUrl: user.AvatarUrl,
                    countryCode: 'US',
                    email: user.PCEmail,
                    languageCode: "en",
                    nickname: user.PCNickname || `User${user.RockstarId}`,
                },
                privileges: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 27],
            })
            console.log(ticket)
            res.send(
                ticket
            );
        }
    } catch (e) {
        console.log(e);
        return res.status(404).send('Not Found');
    }
};
