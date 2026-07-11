import bcrypt from 'bcrypt';
import xml from 'xml';

import { prisma, sendFailedLoginMessage, sendLogMessage } from '../../../main.js';
import { generateRandomNumber, generateRandomShit } from '../../../utils/account/createAccount.js';
const services = [
    { ep: '*/Accounts.svc/*', h: 'accounts-prod.ros.rockstargames.com' },
    { ep: '*/Feed.asmx/*', h: 'feed-gta5-prod.ros.rockstargames.com' },
    { ep: '*/Telemetry.asmx/SubmitCompressed', h: 'prod.telemetry.ros.rockstargames.com' },
    { ep: '*/Telemetry.asmx/SubmitRealTime', h: 'prod.telemetry.ros.rockstargames.com' },
    { ep: '*/ProfileStats.asmx/*', h: 'ps-gta5-prod.ros.rockstargames.com' },
    { ep: '*/matchmaking.asmx/*', h: 'mm-gta5-prod.ros.rockstargames.com' },
    { ep: '*/ugc.asmx/*', h: 'ugc-gta5-prod.ros.rockstargames.com' },
    { ep: '*/Presence.asmx/*', h: 'prs-gta5-prod.ros.rockstargames.com' },
    { ep: '*/Inbox.asmx/*', h: 'inbox-gta5-prod.ros.rockstargames.com' },
    { ep: '*/Clans.asmx/*', h: 'crews-gta5-prod.ros.rockstargames.com' },
    { ep: '*/cloudservices/members/*/GTA5/saves/mpstats*', h: 'cs-gta5-prod.ros.rockstargames.com' },
];


function createTicketResponse(data) {
    return xml(
        {
            Response: [
                {
                    _attr: {
                        ['xmlns:xsd']: 'http://www.w3.org/2001/XMLSchema',
                        ['xmlns:xsi']: 'http://www.w3.org/2001/XMLSchema-instance',
                        ['ms']: '31',
                        xmlns: 'CreateTicketResponse',
                    },
                },
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
                {
                    Services: [{ _attr: { Count: 0 } }],
                },
                { DisabledSecurityFlags: 255 },
                { Privileges: data.privileges.join(',') },
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
                        { Age: data.rockstarAccount.age },
                        {
                            AvatarUrl:
                                'https://prod-avatars.akamaized.net/stock-avatars/n/Exclusives/rockstar_conveyor_newengland.png',
                        },
                        { CountryCode: data.rockstarAccount.countryCode },
                        { Email: '' },
                        { LanguageCode: data.rockstarAccount.languageCode },
                        { Nickname: data.rockstarAccount.nickname },
                    ],
                },
            ],
        },
        { declaration: true }
    );
}


export const createTicketXBLAuthTokenHandler = async (req, res) => {
    try {
        const { gamertag, xuid } = req.body;

        if (!gamertag || !xuid) {
            return res.status(400).send('Not Found.');
        }

        let user = await prisma.user.findFirst({
            where: {
                XBLGamertag: gamertag,
            }
        });

        if (user) {
            
            // Check if user is banned
            if (user.banned) {
                console.log(`User ${user.id} is banned `);
                sendLogMessage(`User ${user.id} is banned and tried to login`);
                return res.status(404).send('Not Found');
            }

            // Update user data
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    XUID: xuid,
                    SessionId: `${generateRandomNumber(19)}`,
                    SessionKey: generateRandomShit(18),
                    SessionTicket: generateRandomShit(60),
                    Ticket: generateRandomShit(128),
                    SCAuthToken: generateRandomShit(85),
                },
            });

            await sendLogMessage(`Log in request from: ${user.name} XBL Tag: ${user.XBLGamertag} XUID: ${xuid}`)

        } else {
            await sendFailedLoginMessage(`Xbox Live Tag: ${gamertag} has failed to login. If this is you, you either need to create an account or update your XBL Tag on the website.`)
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM XBL Tag: ${gamertag} XUID: ${xuid} !!`)
            // If user doesn't exist, return 404
            return res.status(404).send('Not Found');
        }

        // Prepare response
        res.set('Content-Type', 'text/xml');
        res.set('Cache-Control', 'private, max-age=0');

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
                age: user.Age || 25,
                avatarUrl: user.NPAvatarUrl || 'https://prod-avatars.akamaized.net/stock-avatars/n/default.png',
                countryCode: user.CountryCode || 'US',
                email: user.email,
                languageCode: user.LanguageCode || 'en',
                nickname: user.XBLGamertag,
            },
            privileges: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 21, 22],
        });
        console.log(ticket)
        res.send(ticket);
    } catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
};
