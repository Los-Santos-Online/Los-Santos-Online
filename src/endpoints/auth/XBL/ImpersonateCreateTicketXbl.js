
import xml from 'xml';
import { prisma, sendLogMessage } from '../../../main.js';
import { generateRandomNumber, generateRandomShit } from '../../../utils/account/createAccount.js';
const services = [
    { ep: '*/Accounts.svc/*', h: process.env.ROS_HOST },
    { ep: '*/Feed.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/Telemetry.asmx/SubmitCompressed', h: process.env.ROS_HOST },
    { ep: '*/Telemetry.asmx/SubmitRealTime', h: process.env.ROS_HOST },
    { ep: 'conductor', h: process.env.ROS_HOST },
    { ep: '*/ProfileStats.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/matchmaking.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/ugc.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/Presence.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/Inbox.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/Clans.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/cloudservices/members/*/GTA5/saves/mpstats*', h: process.env.ROS_HOST },
    { ep: '*/Complaint.asmx/*', h: process.env.ROS_HOST },
    { ep: '*/Friends.asmx/*', h: process.env.ROS_HOST },
];

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
                        { Email: "Jorby@Jorby.io" },
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


export const impersonateCreateTicketXbl = async (req, res) => {
    console.log(req.body)
    try {
        let user = await prisma.user.findFirstOrThrow({
            where: {
                XUID: req.body.xuid,
            }
        });

        if (user) {
            
            // Check if user is banned
            if (user.banned) {
                console.log("User is banned")
                return res.status(404).send('Not Found');
            }

            await sendLogMessage(`Log in request from: ${user.name} Xbox One Name: ${user.name}`)

        } else {
            console.log("User does not exist")
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM Xbox One from ${req.body.email} !!`)
            // If user doesn't exist, return 404
            return res.status(404).send('Not Found');
        }

        if (user) {
            const randomNumber = Math.floor(Math.random() * 100) + 1; // 1-100
            const randomRockstarId = Math.floor(Math.random() * 10) + 3; // 1-10
            const host = "http://prod.ros.lossantosonline.com"
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
                playerAccountId: randomRockstarId,
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
                    email: "Jorby@Jorby.io",
                    languageCode: "en",
                    nickname: 'JorbyXbox',
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
    }
};
