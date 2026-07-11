import xml from "xml";
import axios from "axios";
import { prisma, sendLogMessage } from "../../../main.js";
import { blueSphereHttpsAgent } from "../../../services/blueSphereHttpClient.js";
import { findOrProvisionBlueSphereUser } from "../../../services/blueSphereUserService.js";

async function verifyAuthCodeWithExternalAPI(authCode) {
  try {
    const response = await axios.post(
      process.env.BLUESPHERE_VERIFY_URL || "https://prod.bluesphere.live/api/verify",
      { authCode },
      {
        headers: {
          "Content-Type": "application/json",
        },
        httpsAgent: blueSphereHttpsAgent,
        timeout: Number(process.env.BLUESPHERE_VERIFY_TIMEOUT_MS || 5000),
      },
    );

    if (response.status === 200 && response.data?.accountId && response.data?.onlineId) {
      return {
        found: true,
        accountId: String(response.data.accountId),
        onlineId: String(response.data.onlineId),
        discordId: response.data.discordId ? String(response.data.discordId) : null,
        gameVersion: response.data.currentGameVersion ? String(response.data.currentGameVersion) : "",
        countryCode: response.data.countryCode ? String(response.data.countryCode) : "",
        languageCode: response.data.languageCode ? String(response.data.languageCode) : "",
        avatarUrl: response.data.avatarUrl ? String(response.data.avatarUrl) : "",
      };
    }
    return { found: false };
  } catch (error) {
    console.error("BlueSphere auth validation failed:", error.response?.status || error.message);
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
                ed: "2147483647000",
              },
            },
          })),
        },
        { Privileges: data.privileges.join(",") },
        {
          Services: [
            { _attr: { count: data.services.length } },
            ...data.services.map((service) => ({
              Service: [{ ep: service.ep }, { h: service.h }],
            })),
          ],
        },
        {
          SslServices: { _attr: { count: "0" } },
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
      ],
    },
    { declaration: true },
  );
}

export const createTicketNP4AuthTokenHandler = async (req, res) => {
  try {
    const consoleId = req.body.issuerId;
    const externalVerification = await verifyAuthCodeWithExternalAPI(req.body.authCode);
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.headers["x-real-ip"] || req.socket.remoteAddress || req.ip;

    // Extract IPv4 from req.ip (handles cases like "::ffff:24.214.97.36")
    let ipv4 = clientIp;
    if (ipv4.startsWith("::ffff:")) {
      ipv4 = ipv4.replace("::ffff:", "");
    }

    if (!externalVerification.found) {
      return res.status(401).send("Invalid or expired BlueSphere authorization");
    }

    const provisioned = await findOrProvisionBlueSphereUser(prisma, externalVerification, {
      consoleId,
      clientIp,
    });
    const user = provisioned.user;

    if (provisioned.created) {
      await sendLogMessage(
        `Created Los Santos Online account for BlueSphere user ${externalVerification.onlineId} (${externalVerification.accountId}).`,
      );
    }

    if (user.banned) {
      console.log("User is banned");
      return res.status(404).send("Not Found");
    }

    await sendLogMessage(`Log in request from: ${user.name} PS4 Name: ${user.PS4Username} Console ID: ${consoleId}`);

    //Update IP Address
    await prisma.user.update({
      where: { id: user.id },
      data: {
        IPAddress: clientIp,
      },
    });

    const host = process.env.ROS_HOST || "prod.ros.lossantosonline.com";
    const services = [
      { ep: "*/Accounts.svc/*", h: host },
      { ep: "*/Feed.asmx/*", h: host },
      { ep: "*/Telemetry.asmx/SubmitCompressed", h: host },
      { ep: "*/Telemetry.asmx/SubmitRealTime", h: host },
      { ep: "conductor", h: host },
      { ep: "*/ProfileStats.asmx/*", h: host },
      { ep: "*/GeoLocation.asmx/*", h: host },
      { ep: "*/matchmaking.asmx/*", h: host },
      { ep: "*/ugc.asmx/*", h: host },
      { ep: "*/Presence.asmx/*", h: host },
      { ep: "*/Inbox.asmx/*", h: host },
      { ep: "*/Clans.asmx/*", h: host },
      { ep: "*/cloudservices/members/*/GTA5/saves/mpstats*", h: host },
      { ep: "*/Complaint.asmx/*", h: host },
      { ep: "*/Friends.asmx/*", h: host },
    ];

    const username = user.blueSphereOnlineId;

    // Build privileges array based on user role
    const basePrivileges = [
      1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21, 22, 29, 30, 31, 32, 33, 34, 100, 101, 102, 109, 110,
    ];
    const privileges = basePrivileges;

    const ticket = createTicketResponse({
      status: 1,
      blueSphereAccountId: user.blueSphereAccountId,
      email: user.email,
      ticket: user.Ticket,
      posixTime: Math.floor(+new Date() / 1000),
      secsUntilExpiration: 999999,
      region: 1,
      playerAccountId: user.RockstarId,
      publicIp: ipv4,
      sessionId: user.SessionId,
      sessionKey: user.SessionKey,
      sessionTicket: user.SessionTicket,
      cloudKey: "8G8S9JuEPa3kp74FNQWxnJ5BXJXZN1NFCiaRRNWaARU=",
      services: services,
      rockstarAccount: {
        rockstarId: user.RockstarId,
        age: 25,
        countryCode: user.CountryCode || "US",
        email: user.email,
        languageCode: user.LanguageCode || "en-US",
        nickname: username,
        zipCode: "",
        avatarUrl: user.NPAvatarUrl,
      },
      privileges: privileges,
    });

    res.send(ticket);
  } catch (e) {
    console.error("CreateTicketNp4/CreateTicketNp5 failed:", e);
    if (!res.headersSent) {
      res.status(500).send("Internal Server Error");
    }
  }
};

export const createTicketNP5AuthTokenHandler = createTicketNP4AuthTokenHandler;
