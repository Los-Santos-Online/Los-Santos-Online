//Imports
import "dotenv/config";
import "./config/environment.js";
import express from "express";
import http from "http";
import https from "https";
import path from "path";
import xml from "xml";
import logger from "morgan";
import fs from "fs-extra";
import { PrismaClient } from "@prisma/client";
import { dirname } from "dirname-filename-esm";
import JSON5 from "json5";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const __dirname = dirname(import.meta);
import {
  encryptDecryptMiddleware,
} from "./utils/rc4Encryption/middleware.js";
import { getPlayerAchievementsHandler } from "./endpoints/achievements/getPlayerAchievements.js";
import { createTicketNP2AuthTokenHandler } from "./endpoints/auth/PS3/createTicketNp2.js";
import { getLegalTerritoryRestrictionsHandler } from "./endpoints/cashTransactions/getLegalTerritoryRestrictions.js";
import { getPackValueUSDEHandler } from "./endpoints/cashTransactions/getPackValueUSDE.js";
import { clanInvitesHandler } from "./endpoints/clans/getInvites.js";
import { getRelayServersHandler } from "./endpoints/geoLocation/getRelayServers.js";
import { getUnreadMessagesHandler } from "./endpoints/inbox/getUnreadMessages.js";
import { getAcceptedVersionHandler } from "./endpoints/legalpolicies/getAcceptedVersion.js";
import { getLicensePlateHandler } from "./endpoints/licenseplates/getLicensePlates.js";
import { getPresenceServersHandler } from "./endpoints/presence/getPresenceServers.js";
import { multiPostMessageHandler } from "./endpoints/presence/multiPostMessage.js";
import { getMessagesHandler } from "./endpoints/presence/getMessages.js";
import { queryPresenceHandler } from "./endpoints/presence/query.js";
import { setAttributesHandler } from "./endpoints/presence/setAttributes.js";
import { replaceAttributesHandler } from "./endpoints/presence/replaceAttributes.js";
import { readStatsByGroupHandler } from "./endpoints/profilestats/readStatsByGroup.js";
import { writeStatsHandler } from "./endpoints/profilestats/writeStats.js";
import { GetPasswordRequirementsHandler } from "./endpoints/socialClub/getPasswordRequirements.js";
import { FuckingHellRockstarHandler } from "./endpoints/socialClub/checkText.js";
import { getTelemetryClientConfigXMLHandler } from "./endpoints/telemetry/getTelemetryClientConfig.js";
import { createTicketXBLAuthTokenHandler } from "./endpoints/auth/XBL/CreateTicketXBL.js";
import { readStatsByGamer2Handler } from "./endpoints/profilestats/readStatsByGamer2.js";
import { createContentHandler } from "./endpoints/ugc/createContent.js";
import { getTunablesHandler } from "./endpoints/tunables/tunables.js";
import { createTicketNP4AuthTokenHandler, createTicketNP5AuthTokenHandler } from "./endpoints/auth/PS4/createTicketNp4.js";
import { getSinglePlayerSaveStateHandler } from "./endpoints/saveMigration/getSinglePlayerSaveState.js";
import { resetStatsHandler } from "./endpoints/profilestats/resetStats.js";
import { PresenceAttributesClient } from "./utils/presence/presenceUtils.js";
import axios from "axios";
import { createTicketSC3Handler } from "./endpoints/auth/PC/createTicketSC3.js";
import { createSCAuthTokenHandler } from "./endpoints/auth/PC/createSCAuthToken.js";
import { publishContentHandler } from "./endpoints/ugc/publish.js";
import { updateContent } from "./endpoints/ugc/updateContent.js";
import { setDeletedHandler } from "./endpoints/ugc/setDeleted.js";
import { getMissionFileHandler } from "./endpoints/ugc/getMissionFile.js";
import { uploadPhotoToCdnHandler } from "./endpoints/ugc/photoUpload.js";
import { submitCompressedHandler } from "./endpoints/telemetry/submitCompressed.js";
import { impersonateCreateTicketXbl } from "./endpoints/auth/XBL/ImpersonateCreateTicketXbl.js";
import { getSaveFile, saveSaveFile } from "./endpoints/saves/savefiles.js";
import { updateTicketSC3Handler } from "./endpoints/auth/PC/updateTicketSC3.js";
import { saveMigrationStatusHandler } from "./endpoints/saveMigration/saveMigrationStatus.js";
import { createP2PCertificateCyprusHandler, createP2PCertificateHandler } from "./endpoints/p2pCertificates/createP2PCertificate.js";
import { verifyPS4Login } from "./endpoints/auth/PS4/verifyPS4Login.js";
import { queryContentHandler } from "./endpoints/ugc/QueryContent.js";
import { getFriendsListHandler } from "./endpoints/PSN/friendslist.js";
import { matchmakingService } from './services/matchmakingService.js';
import { advertiseHandler } from "./endpoints/matchmaking/advertise.js";
import { updateHandler } from "./endpoints/matchmaking/update.js";
import { findHandler } from "./endpoints/matchmaking/find.js";
import { unadvertiseAllHandler } from "./endpoints/matchmaking/unadvertiseAll.js";
import { getNewsItemsHandler, getNewsStoryHandler } from "./endpoints/news/getNewsItems.js";
import { getNewsImageHandler } from "./endpoints/news/getNewsImage.js";
import { unadvertiseHandler } from "./endpoints/matchmaking/unadvertise.js";
import { isLicensePlateValidHandler } from "./endpoints/licenseplates/isLicensePlateValid.js";
import { GetSourceAccountsMPHandler } from "./endpoints/saveMigration/getSourceAccountsMP.js";
import { getMineHandler } from "./endpoints/clans/getMine.js";
import { getDescHandler } from "./endpoints/clans/getDesc.js";
import { leaderboardReadByCrewsHandler } from "./endpoints/clans/leaderboardReadByCrews.js";
import { getCrewEmblemHandler } from "./endpoints/clans/getCrewEmblem.js";
import { setPrimaryClanHandler } from "./endpoints/clans/setPrimaryClan.js";
import { createTicketNP3AuthTokenHandler } from "./endpoints/auth/PS4/createTicketNp3.js";

export const prisma = new PrismaClient();

export const sessionList = [];


// Add these near other global constants
export const ACTIVE_PLAYERS = {
  PS4: new Map(),
  XBOX360: new Map()
}; // Stores player activity timestamps by platform


// Channel-based Discord notifications are intentionally disabled. Keep these
// no-op exports so endpoint modules do not need notification-specific branching.
export const sendLogMessage = async () => {};
export const sendFailedLoginMessage = async () => {};
export const sendUGCMessage = async () => {};
export const sendUGCPhotoMessage = async () => {};
export const sendPlayerReportMessage = async () => {};

export function generateError(status, errorCode, errorMessage) {
  const responseObject = {
    Response: [{ Status: status.toString() }, { Error: [{ _attr: { Code: errorCode } }, errorMessage] }],
  };

  const xmlString = xml(responseObject, { declaration: true, indent: "  " });
  return xmlString;
}
//App Init
const app = express();
app.set("port", process.env.ENDPOINT_PORT || 80); // Keep existing HTTP port or default to 80
app.disable('etag');
app.set('trust proxy', true);
const ignoredRequestLogPaths = new Set([
  "/gta5/11/gameservices/Presence.asmx/GetMessages",
]);

app.use((req, res, next) => {
  res.removeHeader('Last-Modified');
  res.set('Cache-Control', 'public, max-age=0, immutable');
  if (req.secure) {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));
app.use(
  logger("combined", {
    skip: (req) => {
      const requestPath = (req.originalUrl || req.url || req.path || "").split("?")[0];
      return ignoredRequestLogPaths.has(requestPath);
    },
  }),
);
// Add memory monitoring middleware to track all requests
export const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true, // Required for MinIO, Wasabi, and other S3-compatible services
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY
  }
});

export const ugcClient = new S3Client({
  region: 'auto',
  endpoint: process.env.S3_UGC_ENDPOINT,
  forcePathStyle: true, // Required for MinIO, Wasabi, and other S3-compatible services
  credentials: {
    accessKeyId: process.env.S3_UGC_ACCESS_KEY,
    secretAccessKey: process.env.S3_UGC_SECRET_KEY
  }
});

app.post("/gta5/11/gameservices/Complaint.asmx/WriteComplaint", encryptDecryptMiddleware, async (req, res) => {
  res.send(
  `<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ms="200">
      <Status>1</Status>
  </Response>
  `);
})

//Save Save Files
app.post("/cloud/11/cloudservices/members/xbl/:xuid/GTA5/saves/mpstats", encryptDecryptMiddleware, saveSaveFile);
app.post("/cloud/11/cloudservices/members/sc/:scId/GTA5/saves/mpstats", encryptDecryptMiddleware, saveSaveFile);
app.post("/cloud/11/cloudservices/members/np/:scId/GTA5/saves/mpstats", encryptDecryptMiddleware, saveSaveFile);

//Get Save Files
app.get("/cloud/11/cloudservices/members/sc/:scId/GTA5/saves/mpstats/:saveFileName", encryptDecryptMiddleware, getSaveFile);
app.get("/cloud/11/cloudservices/members/np/:scId/GTA5/saves/mpstats/:saveFileName", encryptDecryptMiddleware, getSaveFile);
app.get("/cloud/11/cloudservices/members/xbl/:xuid/GTA5/saves/mpstats/:saveFileName", encryptDecryptMiddleware, getSaveFile);

app.post("/gta5/11/gameservices/auth.asmx/CreateP2PCertificateCyprus", express.json(), createP2PCertificateCyprusHandler);
app.post("/gta5/11/gameservices/auth.asmx/CreateP2PCertificate", encryptDecryptMiddleware, createP2PCertificateHandler);

//GET UGC
app.get("/cloud/11/cloudservices/ugc/gta5mission/:missionHash/:filename", encryptDecryptMiddleware, getMissionFileHandler);
app.get("/cloud/11/cloudservices/ugc/gta5photo/:missionHash/:filename", encryptDecryptMiddleware, getMissionFileHandler);
app.post(
  "/cloud/11/cloudservices/ugc/gta5photo/upload/:contentId/:fileName",
  express.raw({ type: () => true, limit: "25mb" }),
  uploadPhotoToCdnHandler
);
app.post(
  "/ugc/gta5photo/:contentId/:fileName",
  express.raw({ type: () => true, limit: "25mb" }),
  uploadPhotoToCdnHandler
);

//SAVE PROFILE IMAGE
app.post("/cloud/11/cloudservices/members/np/:scId/share/gta5/mpchars", encryptDecryptMiddleware, async (req, res) => {
  try {
    const file = req.body?.[0];
    const filename = file?.headers?.["content-disposition"]?.filename;
    if (!filename || !file?.body) {
      throw new Error("Profile image upload did not contain a file");
    }

    const s3Key = `ps4/saveFiles/${req.params.scId}/${filename}`;
    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: s3Key,
      Body: file.body,
      ContentType: file.headers["content-type"] || "application/octet-stream",
    }));

    res.status(200).send('<?xml version="1.0" encoding="utf-8"?> <Response ms="0"> <Status>1<Status> </Response>');
  } catch (error) {
    console.error("Failed to upload PS4 profile image to object storage:", error);
    res.status(500).send('<?xml version="1.0" encoding="utf-8"?> <Response ms="0"> <Status>0<Status> </Response>');
  }
});

const SingleplayerSaveMigrationRouter = express.Router();
SingleplayerSaveMigrationRouter.post('/GetUploadedSingleplayerSaveMetadata', encryptDecryptMiddleware, getSinglePlayerSaveStateHandler);

//PS4 News
app.get("/cloud/11/cloudservices/titles/gta5/ps4/news/news.json", encryptDecryptMiddleware, getNewsItemsHandler);
app.get('/cloud/11/cloudservices/global/sc/news/:storyKey/:langFile', encryptDecryptMiddleware, getNewsStoryHandler);
app.get('/cloud/11/cloudservices/global/news/image/:newsId/:imageName', encryptDecryptMiddleware, getNewsImageHandler);
app.get('/cloud/11/cloudservices/crews/sc/:clanId/publish/emblem/emblem_:size.dds', encryptDecryptMiddleware, getCrewEmblemHandler);
//PS4 Tunables
app.get('/cloud/11/cloudservices/titles/gta5/ps4/0x1a098062.json', encryptDecryptMiddleware, (req, res) => {
  try {
    const filePath = path.join(__dirname, "static", "tunables02192026.bin");
    res.type("application/octet-stream").send(fs.readFileSync(filePath));
  } catch (error) {
    console.error("Error reading PS4 tunables file:", error);
    res.status(500).json({ error: "Failed to load tunables" });
  }
});

// app.get('/titles/gta5/ps2/0x1a098062.json', encryptDecryptMiddleware, (req, res) => {
//   res.setHeader('Content-Type', 'application/json'); // Set the appropriate content type for DDS
//   const file = fs.readFileSync('./src/static/0x1a098062PS4.json');
//   res.send(file);
// });

//PC Tunables
app.get('/cloud/11/cloudservices/titles/gta5/pcros/0x1a098062.json', (req, res) => {
  res.redirect('http://prod.cloud.rockstargames.com/titles/gta5/pcros/0x1a098062.json');
});

app.get('/titles/gta5/ps2/0x1a098062.json', encryptDecryptMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const file = fs.readFileSync('./src/static/0x1a098062PS4.json');
  res.send(file);
});

//Xbox One Tunables
app.get('/cloud/11/cloudservices/titles/gta5/xboxone/0x1a098062.json', (req, res) => {
  res.redirect(`http://${process.env.ROS_HOST}/titles/gta5/ps2/0x1a098062.json`);
});

app.get('/titles/gta5/ps2/0x1a098062.json', encryptDecryptMiddleware, (req, res) => {
  res.setHeader('Content-Type', 'application/json'); // Set the appropriate content type for DDS
  const file = fs.readFileSync('./src/static/0x1a098062PS4.json');
  res.send(file);
});

// Xbox One BG Scripts
app.get('/cloud/11/cloudservices/titles/gta5/ps4/bgscripts/bg_902_0.rpf', (req, res) => {
  res.redirect('http://prod.cloud.rockstargames.com/cloud/11/cloudservices/titles/gta5/xboxone/bgscripts/bg_ng_2843_0.rpf');
});

// Xbox One Extra Content Manifest
app.get("/cloud/11/cloudservices/titles/gta5/xboxone/extraContent/ExtraContentManifest.xml", (req, res) => {
  res.redirect("http://prod.cloud.rockstargames.com/titles/gta5/xboxone/extraContent/ExtraContentManifest.xml");
});

// Xbox One CHECK.JSON
app.get("/cloud/11/cloudservices/titles/gta5/xboxone/check.json", (req, res) => {
  res.redirect("http://prod.cloud.rockstargames.com/titles/gta5/xboxone/check.json");
});

// PS4 BG Scripts
app.get('/cloud/11/cloudservices/titles/gta5/ps4/bgscripts/bg_902_0.rpf', (req, res) => {
  res.redirect('http://prod.cloud.rockstargames.com/cloud/11/cloudservices/titles/gta5/ps4/bgscripts/bg_ng_2843_0.rpf');
});

// PS4 Extra Content Manifest
app.get("/cloud/11/cloudservices/titles/gta5/ps4/extraContent/ExtraContentManifest.xml", (req, res) => {
  res.redirect("http://prod.cloud.rockstargames.com/titles/gta5/ps4/extraContent/ExtraContentManifest.xml");
});

// PS4 CHECK.JSON
app.get("/cloud/11/cloudservices/titles/gta5/ps4/check.json", (req, res) => {
  res.redirect("http://prod.cloud.rockstargames.com/titles/gta5/ps4/check.json");
});

//Xbox 360 News
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/news/news.json", encryptDecryptMiddleware, (req, res, next) => {
  const fileName = "./src/static/news.json";
  const file = fs.readFileSync(fileName);
  res.setHeader("Content-Type", "application/json");
  res.send(file);
});

//Xbox 360 Tunables
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/0x1a098062.json", encryptDecryptMiddleware, (req,res) => {
    res.redirect('http://tunables.gtao.us/titles/gta5/ps3/0x1a098062.json');
});

app.get("/titles/gta5/ps3/0x1a098062.json", getTunablesHandler);

//Xbox 360 BG Scripts
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/bgscripts/bg_900_0.rpf", (req, res) => {
    res.redirect('http://tunables.gtao.us/titles/gta5/xbox360/bgscripts/bg_900_0.rpf');
});


app.post('/gta5/11/gameservices/SaveMigration.asmx/GetSourceAccountsMP', encryptDecryptMiddleware, GetSourceAccountsMPHandler);

//PS5
app.get('/cloud/11/cloudservices/titles/gta5/ps5/bgscripts/bg_ng_171_8.rpf', (req, res) => {
  try {
      res.setHeader('Content-Type', 'application/json');
      const filePath = path.join(__dirname, "static", "ps5", "bg_ng_344_15.rpf");
      const file = fs.readFileSync(filePath);
      res.send(file);
  } catch (error) {
      console.error('Error reading tunables file:', error);
      res.status(500).json({ error: 'Failed to load Bgscripts' });
  }
});

app.get('/cloud/11/cloudservices/titles/gta5/ps5/0x1a098062.json', encryptDecryptMiddleware, (req, res) => {
  const filePath = path.join(__dirname, "static", "ps5", "tunables-ps5-reencrypted.bin")
  try {
    const data = fs.readFileSync(filePath);
    res.send(data);
  } catch (err) {
    res.status(404).send('File not found');
  }
});

app.get("/cloud/11/cloudservices/titles/gta5/ps5/legal/version/version_num.xml", async (req, res) => {
  const filePath = path.join(__dirname, "static", "ps4", "version_num.xml")
  try {
    const data = fs.readFileSync(filePath);
    res.send(data);
  } catch (err) {
    res.status(404).send('File not found');
  }
});
app.post('/gta5/11/gameservices/entitlements.asmx/GetSubscriptionDataPSN', encryptDecryptMiddleware, (req, res) => {
    console.log(req.body);
    res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="QueryContent">
  <Status>1</Status>
  <Subscription>
    <Active>true</Active>
    <SubStartTime>2024-11-12T11:52:07-06:00</SubStartTime>
    <SubEndTime>2027-11-12T11:52:07-06:00</SubEndTime>
</Response>`)
});
app.get("/titles/gta5/xbox360/bgscripts/bg_900_0.rpf", (req, res) => {
    const filePath = path.join(__dirname, "static", "rockstar", "bg_900_0.rpf");
    try {
        const data = fs.readFileSync(filePath);
        res.send(data);
    } catch (err) {
        res.status(404).send('File not found');
    }
});

//Xbox 360 Extra Content Manifest
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/extraContent/ExtraContentManifest.xml", (req, res) => {
    res.redirect('http://tunables.gtao.us/titles/gta5/xbox360/extraContent/ExtraContentManifest.xml');
});

app.get("/titles/gta5/xbox360/extraContent/ExtraContentManifest.xml", (req, res) => {
    const filePath = path.join(__dirname, "static", "rockstar", "ExtraContentManifest.xml");
    try {
        const data = fs.readFileSync(filePath);
        res.send(data);
    } catch (err) {
        res.status(404).send('File not found');
    }
});
function createAgeAssuranceXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'PlayerStatus'
                    },
                },
                { Status: '1' },
                { AgeAssuranceStatus: 'NotRequired' }
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

app.post('/gta5/11/gameservices/AgeAssurance.asmx/PlayerStatus', encryptDecryptMiddleware, (req, res) => {
    console.log('Age Assurance Request:', req.body);
    const xmlResponse = createAgeAssuranceXML();
    res.setHeader("Content-Type", "application/xml");
    res.send(xmlResponse);
});

//Xbox 360 CHECK.JSON
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/check.json", (req, res) => {
    res.redirect('http://tunables.gtao.us/titles/gta5/xbox360/check.json');
});

app.get("/titles/gta5/xbox360/check.json", (req, res) => {
    const filePath = path.join(__dirname, "static", "rockstar", "check.json");
    try {
        const data = fs.readFileSync(filePath);
        res.send(data);
    } catch (err) {
        res.status(404).send('File not found');
    }
});

//Xbox 360 Commerce Data
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/store/en/commerceData.xml",  async (req, res) => {
    res.redirect('http://tunables.gtao.us/titles/gta5/xbox360/store/en/commerceData.xml');
});


// app.get("/cloud/11/cloudservices/titles/gta5/ps4/store/SCEA/en/commerceData.xml", getCommerceData);
// app.get("/titles/gta5/ps4/store/SCEA/en/commerceData.xml", getCommerceData);
app.get("/titles/gta5/ps4/store/SCEA/en/commerceData.xml", async (req, res) => {
  const filePath = path.join(__dirname, "static", "ps4", "commerceData.xml")
  try {
      const data = fs.readFileSync(filePath);
      res.send(data);
  } catch (err) {
      res.status(404).send('File not found');
  }
});
// app.get("/cloud/11/cloudservices/titles/gta5/ps4/store/commerceData.xml", getCommerceData);

app.get("/cloud/11/cloudservices/titles/gta5/ps4/store/SCEA/en/commerceData.xml", (req, res) => {
  res.redirect("http://ros.lossantosonline.com/titles/gta5/ps4/store/SCEA/en/commerceData.xml");
});

app.get("/cloud/11/cloudservices/titles/gta5/ps4/store/commerceData.xml", (req, res) => {
  res.redirect("http://ros.lossantosonline.com/titles/gta5/ps4/store/SCEA/en/commerceData.xml");
});

app.get("/titles/gta5/xbox360/store/en/commerceData.xml", (req, res) => {
    const filePath = path.join(__dirname, "static", "rockstar", "commerceData.xml")
    try {
        const data = fs.readFileSync(filePath);
        res.send(data);
    } catch (err) {
        res.status(404).send('File not found');
    }
});


//Xbox 360 Commerce Data Images
app.get("/cloud/11/cloudservices/titles/gta5/xbox360/store/images/editions/:imageName", (req, res, next) => {
  const imageName = req.params.imageName;
  sendLogMessage(`https://prod.cloud.rockstargames.com/titles/gta5/xbox360/store/images/editions/${imageName}`);
  res.redirect(`https://prod.cloud.rockstargames.com/titles/gta5/xbox360/store/images/editions/${imageName}`);
});

//PS4 Commerce Data Images
app.get("/cloud/11/cloudservices/titles/gta5/ps4/store/images/editions/:imageName", encryptDecryptMiddleware, async (req, res) => {
  const imageName = req.params.imageName;
  res.redirect(`https://prod.cloud.rockstargames.com/titles/gta5/ps4/store/images/editions/${imageName}`);
});

//PS4 Legal Version
app.get("/cloud/11/cloudservices/titles/gta5/ps4/legal/version/version_num.xml", async (req, res) => {
  const filePath = path.join(__dirname, "static", "ps4", "version_num.xml")
  try {
    const data = fs.readFileSync(filePath);
    res.send(data);
  } catch (err) {
    res.status(404).send('File not found');
  }
});

app.get("/cloud/11/cloudservices/members/sc/1/GTA5/dog/appnpps4.json", async (req, res) => {
  res.send(JSON.stringify({
    "version": 1,
    "ownerID": "Jorby",
    "blockName": {
      "nestedBlockName": {
        "key": "value"
      },
      "simpleKey": "simpleValue"
    }
  }));
});

app.get("/cloud/11/cloudservices/members/sc/1/GTA5/car/appnpps4.json", async (req, res) => {
  res.send(JSON.stringify({
    "version": 1,
    "ownerID": "Jorby",
    "blockName": {
      "companion_waypoints": {
        "active_route": "value",
        "last_position": "coordinates"
      },
      "dog_status": {
        "happiness": "value",
        "training_level": "value"
      }
    }
  }));
});

//Achievements Router
const AchievementsRouter = express.Router();

AchievementsRouter.post('/Synchronize', encryptDecryptMiddleware, (req, res) => {
  res.send('<?xml version="1.0" encoding="utf-8"?> <Response ms="0"> <Status>1<Status> </Response>');
});

AchievementsRouter.post("/GetPlayerAchievements", encryptDecryptMiddleware, getPlayerAchievementsHandler);

//Auth Router
const AuthRouter = express.Router();
//Create Ticket PS4
AuthRouter.post("/CreateTicketNp3", encryptDecryptMiddleware, createTicketNP3AuthTokenHandler);
AuthRouter.post("/CreateTicketNp4", encryptDecryptMiddleware, createTicketNP4AuthTokenHandler);
AuthRouter.post("/CreateTicketNp5", encryptDecryptMiddleware, createTicketNP5AuthTokenHandler);
//PS4 Launch Verification
app.post("/loginPS4", express.urlencoded({ extended: true }), verifyPS4Login);
//Create Ticket Xbox 360
AuthRouter.post("/CreateTicketXbl2", encryptDecryptMiddleware, createTicketXBLAuthTokenHandler);
//Impersonate Create Ticket Xbox One
AuthRouter.post("/ImpersonateCreateTicketXbl",encryptDecryptMiddleware, impersonateCreateTicketXbl);
//Create Ticket PC
AuthRouter.post("/CreateTicketSc3", encryptDecryptMiddleware, createTicketSC3Handler);
//Update Ticket PC
AuthRouter.post("/UpdateTicketSc3", express.urlencoded({ extended: true }), updateTicketSC3Handler);


//Social Club Router
const SocialClubRouter = express.Router();

//Other Social Club items of the day
SocialClubRouter.post("/GetPasswordRequirements", encryptDecryptMiddleware, GetPasswordRequirementsHandler);

SocialClubRouter.post("/CheckText", encryptDecryptMiddleware, FuckingHellRockstarHandler);
//Create SC Auth Token 
SocialClubRouter.post("/CreateScAuthToken", encryptDecryptMiddleware, createSCAuthTokenHandler);

//Cash Transactions Router
const CashTranscationsRouter = express.Router();

CashTranscationsRouter.post("/GetPackValueUSDE", encryptDecryptMiddleware, getPackValueUSDEHandler);

CashTranscationsRouter.post("/GetLegalTerritoryRestrictions", encryptDecryptMiddleware, getLegalTerritoryRestrictionsHandler);

//Clans Router
const ClansRouter = express.Router();
ClansRouter.post("/GetInvites", encryptDecryptMiddleware, clanInvitesHandler);
ClansRouter.post("/SetPrimaryClan", encryptDecryptMiddleware, setPrimaryClanHandler);
ClansRouter.post("/GetPrimaryClans", encryptDecryptMiddleware, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: {
      Ticket: req.body.ticket
    }
  });

  if (!user) {
    return res.status(404).send("User not found");
  }

  const response = `<?xml version="1.0" encoding="utf-8"?>
    <Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="ClanMembershipResponse" ms="10">
      <Status>1</Status>
      <Members Count="3" MaxCount="3">
        <Membership Id="245325077" IsPrimary="true" JoinedTimePosix="1679776838">
          <Clan Id="68330145" Name="${user.ClanTag}" Tag="${user.ClanTag}" Motto="${user.ClanTag}" IsSystemClan="0" IsOpenClan="0" CreatedTimePosix="1679776207" MemberCount="7" Colors="Black" IsVerifiedClan="0"/>
          <Rank Id="115134229" Name="Leader" RankOrder="0" SystemFlags="9223372036854775807"/>
        </Membership>
      </Members>
    </Response>`;

  res.send(response);
});

ClansRouter.post("/GetMetadataForClan", encryptDecryptMiddleware, async (req, res) => {
  const user = await prisma.user.findFirst({
    where: {
      Ticket: req.body.ticket
    }
  });

  if (!user) {
    return res.status(404).send("User not found");
  }

  res.send('<?xml version="1.0" encoding="utf-8"?><Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ms="15" xmlns="ClanMetadataEnumResponse"><Status>1</Status><MetadataEnums Count="0" MaxCount="0" /></Response>');
});

ClansRouter.post("/GetMine", encryptDecryptMiddleware, getMineHandler);
ClansRouter.post("/GetDesc", encryptDecryptMiddleware, getDescHandler);
app.post('/gta5/11/gameservices/Leaderboards.asmx/ReadByCrews', encryptDecryptMiddleware, leaderboardReadByCrewsHandler);
//Friends Router
export const FriendsRouter = express.Router();
FriendsRouter.post("/GetFriends", (req, res) => {});

//Geolocation Router
const GeoLocationRouter = express.Router();
GeoLocationRouter.post("/GetRelayServers", encryptDecryptMiddleware, getRelayServersHandler);
GeoLocationRouter.post("/GetLocationInfoFromIP", encryptDecryptMiddleware, getRelayServersHandler);

//Inbox Router
const InboxRouter = express.Router();

InboxRouter.post("/GetUnreadMessages", encryptDecryptMiddleware, getUnreadMessagesHandler);

InboxRouter.post("/PostMessageToRecipients", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
});

//Legal Policies Router
const LegalPoliciesRouter = express.Router();

LegalPoliciesRouter.post("/GetAcceptedVersion", encryptDecryptMiddleware, getAcceptedVersionHandler);

//Legal Policies Router
const LicensePlatesRouter = express.Router();
LicensePlatesRouter.post("/Get", encryptDecryptMiddleware, getLicensePlateHandler);
LicensePlatesRouter.post("/IsValid", encryptDecryptMiddleware, isLicensePlateValidHandler);

//Presence Router
const PresenceRouter = express.Router();
PresenceRouter.post("/GetPresenceServers", encryptDecryptMiddleware, getPresenceServersHandler);

PresenceRouter.post("/Publish", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

PresenceRouter.post("/MultiPostMessage", express.urlencoded({ extended: false }), multiPostMessageHandler);

PresenceRouter.post("/PostMessageToRecipients", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

export async function getAttributesHandler(req, res) {
  try {
    const platform = req.headers['Platform'];
    const callingUser = await prisma.user.findFirst({
      where: {
        Ticket: req.body.ticket
      }
    })


    if (!callingUser) {
      console.log("User not found");
      res.status(404);
      return;
    }

    // Parse the gamer handle format "NP -1 409" or "SC 191" to get RockstarId
    console.log(req.body)
    const gamerHandleParts = req.body.gamerHandle.split(' ');
    let rockstarId;

    if (gamerHandleParts[0] === 'NP' && gamerHandleParts.length === 3) {
      rockstarId = parseInt(gamerHandleParts[2], 10);
    } else if (gamerHandleParts[0] === 'SC' && gamerHandleParts.length === 2) {
      rockstarId = parseInt(gamerHandleParts[1], 10);
    } else {
      res.status(400).send(generateError("Invalid gamer handle format"));
      return;
    }
    
    // Look up user by RockstarId
    let user;
    if(platform === 'PS4' || platform === 'PS5'){
        user = await prisma.user.findFirstOrThrow({
          where: {
            blueSphereAccountId: `${rockstarId}`
          }
        });
    } else {
      user = await prisma.user.findFirstOrThrow({
        where: {
          RockstarId: rockstarId
        }
      });
    }


    if (!user) {
      res.status(404)
      return;
    }

    // Create presence attributes client
    const presenceClient = new PresenceAttributesClient(user.PresenceAttributes);
    
    // Look up requested attributes
    const requestedNames = req.body.namesCsv.split(',');
    const count = requestedNames.length;
    
    // Build name-value pairs
    const values = requestedNames.map(name => {
      const value = presenceClient.getAttribute(name) || '';
      return `${name},${value}`;
    }).join(',');

    // Generate XML response
    const response = {
      Response: [
        {
          _attr: {
            "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            xmlns: "GetAttributes"
          }
        },
        { Status: "1" },
        { Count: count.toString() },
        { NameValueCsv: values }
      ]
    };

    res.type('application/xml');
    console.log(xml(response, { declaration: true }))
    res.send(xml(response, { declaration: true }));

  } catch (error) {
    console.error("Error in getAttributes:", error);
    res.status(500);
  }
}


PresenceRouter.post("/GetAttributes", encryptDecryptMiddleware, getAttributesHandler);

PresenceRouter.post("/GetAttributesForGamers", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

PresenceRouter.post("/Subscribe", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

PresenceRouter.post("/Unsubscribe", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});


PresenceRouter.post("/GetMessages", encryptDecryptMiddleware, getMessagesHandler);

PresenceRouter.post("/Query", encryptDecryptMiddleware, queryPresenceHandler);
PresenceRouter.post("/QueryWithMaxRecordLength", encryptDecryptMiddleware, queryPresenceHandler);

PresenceRouter.post("/SignOut", encryptDecryptMiddleware, (req, res) => {
  console.log(req.body);
  res.sendStatus(200);
});

//Set Attributes Replaces an Attribute if it already exists
PresenceRouter.post("/SetAttributes", encryptDecryptMiddleware, setAttributesHandler);

//Replace Attributes replaces all attributes for a gamer
PresenceRouter.post("/ReplaceAttributes", encryptDecryptMiddleware, replaceAttributesHandler);
const ProfileStatsRouter = express.Router();

ProfileStatsRouter.post("/ReadStatsByGamer2", encryptDecryptMiddleware, readStatsByGamer2Handler);
//Profile Stats Router
ProfileStatsRouter.post("/ReadStatsByGroups", encryptDecryptMiddleware, readStatsByGroupHandler);
ProfileStatsRouter.post("/WriteStats", encryptDecryptMiddleware, writeStatsHandler);
ProfileStatsRouter.post("/ResetStats", encryptDecryptMiddleware, resetStatsHandler);
//Save Migration Router
const SaveMigrationRouter = express.Router();
SaveMigrationRouter.post('/GetSaveMigrationStatus', encryptDecryptMiddleware, saveMigrationStatusHandler);

//Admin Router
const TelemetryRouter = express.Router();
//Telemetry hahahhahah fuck you rockstar
TelemetryRouter.post("/GetTelemetryClientConfig", encryptDecryptMiddleware, getTelemetryClientConfigXMLHandler);

function createReplaceAttributes() {
  const xmlStructure = [
    {
      Response: [
        {
          _attr: {
            "xmlns:xsd": "http://www.w3.org/2001/XMLSchema",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            xmlns: "http://services.ros.rockstargames.com/",
          },
        },
        { Status: "1" },
      ],
    },
  ];

  return xml(xmlStructure, { declaration: true });
}

TelemetryRouter.post("/SubmitCompressed", encryptDecryptMiddleware, submitCompressedHandler);

export const UGCRouter = express.Router();
UGCRouter.post("/CheckText", encryptDecryptMiddleware, FuckingHellRockstarHandler);
UGCRouter.post("/CreateContent", encryptDecryptMiddleware, createContentHandler);
UGCRouter.post("/UpdateContent", encryptDecryptMiddleware, updateContent);
UGCRouter.post("/Publish", encryptDecryptMiddleware, publishContentHandler);
UGCRouter.post("/SetDeleted", encryptDecryptMiddleware, setDeletedHandler);
UGCRouter.post("/QueryContent", encryptDecryptMiddleware, queryContentHandler);


const MatchmakingRouter = express.Router();
MatchmakingRouter.post('/Advertise', encryptDecryptMiddleware, advertiseHandler);
MatchmakingRouter.post('/Unadvertise', encryptDecryptMiddleware, unadvertiseHandler);
MatchmakingRouter.post('/Update', encryptDecryptMiddleware, updateHandler);
MatchmakingRouter.post('/Find', encryptDecryptMiddleware, findHandler);
MatchmakingRouter.post(
    '/UnadvertiseAll',
    encryptDecryptMiddleware,
    unadvertiseAllHandler
);

//MatchmakingRouter.post('/Unadvertise', encryptDecryptMiddleware, createUnadvertiseXMLHandler);

app.use('/gta5/11/gameservices/matchmaking.asmx', MatchmakingRouter);
app.use("/gta5/11/gameservices/achievements.asmx", AchievementsRouter);
app.use("/gta5/11/gameservices/auth.asmx", AuthRouter);
app.use("/gta5/11/gameservices/CashTransactions.asmx", CashTranscationsRouter);
app.use("/gta5/11/gameservices/Clans.asmx", ClansRouter);
app.use("/gta5/11/gameservices/GeoLocation.asmx", GeoLocationRouter);
app.use("/gta5/11/gameservices/Inbox.asmx", InboxRouter);
app.use("/gta5/11/gameservices/legalpolicies.asmx", LegalPoliciesRouter);
app.use("/gta5/11/gameservices/licenseplates.asmx", LicensePlatesRouter);
app.use("/gta5/11/gameservices/Presence.asmx", PresenceRouter);
app.use("/gta5/11/gameservices/ProfileStats.asmx", ProfileStatsRouter);
app.use('/gta5/11/gameservices/SaveMigration.asmx', SaveMigrationRouter);
app.use("/gta5/11/gameservices/socialclub.asmx", SocialClubRouter);
app.use("/gta5/11/gameservices/telemetry.asmx", TelemetryRouter);
app.use("/gta5/11/gameservices/ugc.asmx", UGCRouter);
app.use('/gta5/11/gameservices/SaveMigrationSingleplayer.asmx', SingleplayerSaveMigrationRouter);

const httpServer = http.createServer(app);
let matchmakingStarted = false;

function startMatchmakingOnce() {
  if (!matchmakingStarted) {
    matchmakingStarted = true;
    matchmakingService.start();
  }
}

httpServer.on("listening", () => {
  const address = httpServer.address();
  const bind = typeof address === "string" ? `pipe ${address}` : `port ${address.port}`;
  console.log(`HTTP endpoint server listening on ${bind}`);
  startMatchmakingOnce();
});

httpServer.listen(Number(process.env.ENDPOINT_PORT || 80));

const tlsEnabled = process.env.TLS_ENABLED === "true";
let httpsServer = null;

if (tlsEnabled) {
  const tlsKeyPath = process.env.TLS_KEY_PATH || "/run/secrets/tls_key";
  const tlsCertPath = process.env.TLS_CERT_PATH || "/run/secrets/tls_cert";
  const tlsCaPath = process.env.TLS_CA_PATH;

  const readTlsFile = (label, filePath) => {
    try {
      return fs.readFileSync(filePath);
    } catch (error) {
      throw new Error(`TLS is enabled but the ${label} file could not be read at ${filePath}: ${error.message}`);
    }
  };

  const tlsOptions = {
    key: readTlsFile("private key", tlsKeyPath),
    cert: readTlsFile("certificate", tlsCertPath),
    minVersion: process.env.TLS_MIN_VERSION || "TLSv1.2",
  };

  if (tlsCaPath) {
    tlsOptions.ca = readTlsFile("CA chain", tlsCaPath);
  }

  httpsServer = https.createServer(tlsOptions, app);
  httpsServer.on("listening", () => {
    const address = httpsServer.address();
    const bind = typeof address === "string" ? `pipe ${address}` : `port ${address.port}`;
    console.log(`HTTPS endpoint server listening on ${bind}`);
    startMatchmakingOnce();
  });
  httpsServer.listen(Number(process.env.HTTPS_ENDPOINT_PORT || 443));
}


// server.listen(process.env.ENDPOINT_PORT); // REMOVED - Replaced by httpServer.listen()

export default app; // Keep exporting app if needed elsewhere, though servers are now started here
