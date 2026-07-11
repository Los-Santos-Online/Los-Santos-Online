import crypto from "node:crypto";

function randomBase64(bytes) {
  return crypto.randomBytes(bytes).toString("base64");
}

function randomNumericString(length) {
  let value = String(crypto.randomInt(1, 10));
  while (value.length < length) {
    value += String(crypto.randomInt(0, 10));
  }
  return value;
}

function optionalString(value) {
  return value === undefined || value === null || value === "" ? null : String(value);
}

function buildSyncData(verification) {
  return {
    blueSphereOnlineId: verification.onlineId,
    name: verification.onlineId,
    ...(verification.discordId ? { discordId: verification.discordId } : {}),
    ...(verification.gameVersion ? { gameVersion: verification.gameVersion } : {}),
    ...(verification.avatarUrl ? { NPAvatarUrl: verification.avatarUrl } : {}),
  };
}

function buildNewUserData(verification, context) {
  const accountIdForEmail = verification.accountId.replace(/[^a-zA-Z0-9._-]/g, "-");

  return {
    ...buildSyncData(verification),
    email: `bluesphere-${accountIdForEmail}@users.lossantosonline.invalid`,
    CountryCode: verification.countryCode || "US",
    LanguageCode: verification.languageCode || "en-US",
    PS4Username: verification.onlineId,
    PS4ConsoleId: optionalString(context.consoleId),
    IPAddress: optionalString(context.clientIp) || "",
    SessionId: randomNumericString(19),
    SessionKey: randomBase64(18),
    SessionTicket: randomBase64(60),
    Ticket: randomBase64(128),
    SCAuthToken: randomBase64(85),
  };
}

async function findLegacyCandidate(db, verification) {
  const identityMatches = [
    { blueSphereOnlineId: verification.onlineId },
    { PS4Username: verification.onlineId },
  ];
  if (verification.discordId) {
    identityMatches.push({ discordId: verification.discordId });
  }

  return db.user.findFirst({
    where: {
      blueSphereAccountId: null,
      OR: identityMatches,
    },
  });
}

export async function findOrProvisionBlueSphereUser(db, verification, context = {}) {
  const existing = await db.user.findUnique({
    where: { blueSphereAccountId: verification.accountId },
  });

  if (existing) {
    return {
      created: false,
      user: await db.user.update({
        where: { id: existing.id },
        data: buildSyncData(verification),
      }),
    };
  }

  const legacyCandidate = await findLegacyCandidate(db, verification);
  if (legacyCandidate) {
    return {
      created: false,
      user: await db.user.update({
        where: { id: legacyCandidate.id },
        data: {
          ...buildSyncData(verification),
          blueSphereAccountId: verification.accountId,
        },
      }),
    };
  }

  try {
    return {
      created: true,
      user: await db.user.create({
        data: {
          ...buildNewUserData(verification, context),
          blueSphereAccountId: verification.accountId,
        },
      }),
    };
  } catch (error) {
    // Concurrent first logins can race on the unique BlueSphere account ID.
    if (error?.code === "P2002") {
      const racedUser = await db.user.findUnique({
        where: { blueSphereAccountId: verification.accountId },
      });
      if (racedUser) {
        return {
          created: false,
          user: await db.user.update({
            where: { id: racedUser.id },
            data: buildSyncData(verification),
          }),
        };
      }
    }
    throw error;
  }
}
