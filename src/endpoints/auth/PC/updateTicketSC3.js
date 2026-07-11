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

export const updateTicketSC3Handler = async (req, res) => {
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
        } else {
            console.log("Password is valid")
        }

        if (user) {
            console.log("User exists")
            // Check if user is banned
            if (user.banned) {
                console.log("User is banned")
                return res.status(404).send('Not Found');
            }

            await sendLogMessage(`Log in request from: ${user.name} PC Name: ${user.name}`)

            // Update user tickets after successful validation
            user = await prisma.user.update({
                where: { id: user.id },
                data: {
                    Ticket: req.body.ticket,
                    SessionTicket: req.body.sessionTicket,
                    SessionKey: req.body.sessionKey,
                }
            });

            console.log("User tickets updated")
            // Send a 200 OK response instead of the detailed ticket
            return res.send(`<?xml version="1.0" encoding="utf-8"?>
    <Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="ClanMembershipResponse" ms="10">
      <Status>1</Status>
      <Members Count="3" MaxCount="3">
        <Membership Id="245325077" IsPrimary="true" JoinedTimePosix="1679776838">
          <Clan Id="68330145" Name="${user.ClanTag}" Tag="${user.ClanTag}" Motto="${user.ClanTag}" IsSystemClan="0" IsOpenClan="0" CreatedTimePosix="1679776207" MemberCount="7" Colors="Black" IsVerifiedClan="0"/>
          <Rank Id="115134229" Name="Leader" RankOrder="0" SystemFlags="9223372036854775807"/>
        </Membership>
      </Members>
    </Response>`);

        } else {
            console.log("User does not exist")
            await sendLogMessage(`!! FAILED LOGIN REQUEST FROM PC from ${req.body.email} !!`)
            // If user doesn't exist, return 404
            return res.status(404).send('Not Found');
        }
    } catch (e) {
        console.log(e);
        return res.status(404).send('Not Found');
    }
};
