import xml from 'xml';
import { prisma, sendLogMessage } from '../../../main.js';
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
                        { Age: 25 },
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


function readNameFromBase64(base64Ticket) {
    const buffer = Buffer.from(base64Ticket, 'base64');
    const prefix = Buffer.from([0x00, 0x04, 0x00, 0x20]);
    const prefixIndex = buffer.indexOf(prefix);
    
    if (prefixIndex === -1) {
        throw new Error('Prefix not found in the buffer');
    }

    const startIndex = prefixIndex + prefix.length;
    const endIndex = startIndex + 20;
    const usernameBuffer = buffer.slice(startIndex, endIndex);

    // Find the null termination
    const nullIndex = usernameBuffer.indexOf(0x00);
    const usernameEndIndex = nullIndex !== -1 ? nullIndex : 20;

    return usernameBuffer.slice(0, usernameEndIndex).toString('utf8');
}


export const createTicketNP2AuthTokenHandler = async (req, res) => {
    try {
        const npTicket = req.body.npTicket;
        if (!npTicket) {
            return res.status(400).send('NP Ticket is required');
        }

        const ticketName = readNameFromBase64(npTicket);
        
        let user = await prisma.user.findFirst({
            where: {
                NPUsername: ticketName,
            },
        });

        if (user) {
            await sendLogMessage(`Log in request from: ${user.name} PS3 User: ${ticketName}`)

            if (user.banned) {
                return res.status(404).send('Not Found');
            }

        } else {
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM PSN: ${ticketName} !!`)
            
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
                nickname: user.NPUsername,
            },
            privileges: [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 21, 22],
        });

        res.send(ticket);
    } catch (e) {
        console.error(e);
        res.status(500).send('Internal Server Error');
    }
};