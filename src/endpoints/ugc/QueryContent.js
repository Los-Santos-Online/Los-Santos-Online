import JSON5 from "json5";
import { prisma, sendUGCMessage } from '../../main.js';
import fs from 'fs-extra'

function normalizeContentType(contentType) {
  if (!contentType) return contentType;
  const normalized = String(contentType).toLowerCase();
  if (normalized === 'photo' || normalized === 'gta5photo') return 'gta5photo';
  if (normalized === 'mission' || normalized === 'gta5mission') return 'gta5mission';
  return contentType;
}

function quoteKeysAndNormalizeValues(jsonString) {
  let normalizedString = jsonString.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3');
  normalizedString = normalizedString.replace(/:\s*'([^']*)'/g, ': "$1"');
  return normalizedString;
}

function escapeXmlAttribute(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildContentXMLItem(item) {
  let xml = `
    <r c="${item.contentId}">`;

  const fieldMapping = {
    category: 'ca',
    fileVersion0: 'f0',
    fileVersion1: 'f1',
    fileVersion2: 'f2',
    name: 'n',
    rootContentId: 'rci',
    username: 'un',
    rockstarId: 'r',
    accountId: 'a',
    userId: 'u',
    language: 'l',
    createdDate: 'cd',
    publishedDate: 'pd',
    updatedDate: 'ud',
    version: 'v'
  };

  const attributes = [];

  for (const [field, attr] of Object.entries(fieldMapping)) {
    if (item[field] !== null && item[field] !== undefined) {
      if ((field === 'fileVersion0' || field === 'fileVersion1' || field === 'fileVersion2') && item[field] === -1) {
        continue;
      }
      const value = (field === 'name' || field === 'username') ? escapeXmlAttribute(item[field]) : item[field];
      attributes.push(`${attr}="${value}"`);
    }
  }

  if (item.isVerified) {
    attributes.push('vci="true"');
  }

  xml += `
      <m${attributes.length > 0 ? ' ' + attributes.join(' ') : ''}>`;

  if (item.data) {
    xml += `
        <da><![CDATA[${item.data}]]></da>`;
  }
  if (item.description) {
    xml += `
        <de><![CDATA[${item.description}]]></de>`;
  }

  xml += `
      </m>`;
  xml += `
    </r>`;

  return xml;
}

function buildXMLResponse(ugcItems, totalCount = null) {
  if (!ugcItems || ugcItems.length === 0) {
    return `<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="QueryContent">
  <Status>1</Status>
  <Result Count="0" Total="0" Hash="0" />
</Response>`;
  }

  const total = totalCount !== null ? totalCount : ugcItems.length;

  let xmlContent = `<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="QueryContent">
  <Status>1</Status>
  <Result Count="${ugcItems.length}" Total="${total}" Hash="0">`;

  for (const item of ugcItems) {
    xmlContent += buildContentXMLItem(item);
  }

  xmlContent += `
  </Result>
</Response>`;

  return xmlContent;
}

async function getContentByContentId(contentIds, platform, queryName) {
    try {
        const isLegacyPlatform = platform === "PS3" || platform === "XBOX360";

        const whereClause = {
            OR: [
                { contentId: { in: contentIds } },
                { rootContentId: { in: contentIds } }
            ]
        };

        // Legacy platforms only see legacy content; NG platforms see all
        if (isLegacyPlatform) {
            whereClause.isLegacy = true;
        }

        const ugcData = await prisma.uGC.findMany({
            where: whereClause
        });

        console.log(`GetContentByContentId (${isLegacyPlatform ? 'Legacy' : 'NG'}) for IDs [${contentIds.join(', ')}]: found ${ugcData.length} items`);

        // Track missing content IDs
        const foundContentIds = new Set([
            ...ugcData.map(content => content.contentId),
            ...ugcData.map(content => content.rootContentId)
        ]);
        const missingIds = contentIds.filter(id => !foundContentIds.has(id));

        if (missingIds.length > 0) {
            const platformType = isLegacyPlatform ? "Legacy" : "NG";
            await sendUGCMessage(`${queryName} (${platformType}) - Missing content IDs: ${missingIds.join(', ')}`);
        }

        return buildXMLResponse(ugcData);

    } catch (error) {
        console.error('Error fetching content by ID:', error);
        return buildXMLResponse([]);
    }
}

async function getContentByCategory(category, platform) {
    try {
        const isLegacyPlatform = platform === "PS3" || platform === "XBOX360";

        const whereClause = {
            category: category
        };

        if (isLegacyPlatform) {
            whereClause.isLegacy = true;
        }

        const ugcData = await prisma.uGC.findMany({
            where: whereClause
        });

        return buildXMLResponse(ugcData);
    } catch (error) {
        console.error('Error fetching content by category:', error);
        return buildXMLResponse([]);
    }
}

async function getMyContent(sessionTicket, platform, contentType, queryParams, offset, count) {
    try {
        const user = await prisma.user.findUnique({
            where: { SessionTicket: sessionTicket }
        });

        if (!user) {
            console.log('Invalid session ticket - user not found');
            return { error: true, status: 401, message: "Unauthorized" };
        }

        console.log(queryParams)

        const isLegacyPlatform = platform === "PS3" || platform === "XBOX360";

        const whereClause = {
            AND: [
                { rockstarId: user.RockstarId }
            ]
        };

        const normalizedContentType = normalizeContentType(contentType);
        if (normalizedContentType) {
            whereClause.AND.push({ category: normalizedContentType });
        }

        if (isLegacyPlatform) {
            whereClause.AND.push({ isLegacy: true });
        }

        // Add published filter if specified
        if (queryParams.published !== undefined) {
            const isPublishedFilter = queryParams.published === true || queryParams.published === "true";

            if (isPublishedFilter) {
                whereClause.AND.push({ isPublished: true });
            } else {
                whereClause.AND.push({
                    OR: [
                        { isPublished: false },
                        { isPublished: null }
                    ]
                });
            }
        }

        const myContent = await prisma.uGC.findMany({
            where: whereClause,
            skip: offset,
            take: count,
            orderBy: {
                updatedDate: 'desc'
            }
        });

        const totalCount = await prisma.uGC.count({
            where: whereClause
        });

        console.log(`GetMyContent for user ${user.RockstarId} (${isLegacyPlatform ? 'Legacy' : 'NG'}): found ${myContent.length} items (total=${totalCount})`);

        return buildXMLResponse(myContent, totalCount);

    } catch (error) {
        console.error('Error fetching user content:', error);
        return buildXMLResponse([]);
    }
}

async function getMyBookmarkedContent(sessionTicket, platform, contentType, offset, count) {
    try {
        const user = await prisma.user.findUnique({
            where: { SessionTicket: sessionTicket }
        });

        if (!user) {
            return { error: true, status: 401, message: "Unauthorized" };
        }

        const missionWhere = {};
        const normalizedContentType = normalizeContentType(contentType);
        if (normalizedContentType) {
            missionWhere.category = normalizedContentType;
        }

        if (platform === "PS3" || platform === "XBOX360") {
            missionWhere.isLegacy = true;
        }

        const where = {
            userId: user.id,
            mission: missionWhere
        };
        const [bookmarks, totalCount] = await prisma.$transaction([
            prisma.uGCMissionBookmark.findMany({
                where,
                include: { mission: true },
                skip: offset,
                take: count,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.uGCMissionBookmark.count({ where })
        ]);

        return buildXMLResponse(bookmarks.map(({ mission }) => mission), totalCount);
    } catch (error) {
        console.error('Error fetching bookmarked content:', error);
        return buildXMLResponse([]);
    }
}

export async function queryContentHandler(req, res) {
    try {
        console.log(req.body);
        const platform = req.get('Platform');

        let queryParams;

        if (req.body.queryParams !== '') {
            queryParams = JSON5.parse(quoteKeysAndNormalizeValues(req.body.queryParams));
        } else {
            queryParams = {};
        }

        // Unified handler for all platforms
        switch (req.body.queryName) {
            case "GetMyContent":
                const offset = parseInt(req.body.offset) || 0;
                const count = parseInt(req.body.count) || 31;

                const myContentResult = await getMyContent(
                    req.headers['ros-sessionticket'],
                    platform,
                    req.body.contentType,
                    queryParams,
                    offset,
                    count
                );

                if (myContentResult.error) {
                    res.status(myContentResult.status).json({ message: myContentResult.message });
                    return;
                }

                res.send(myContentResult);
                break;

            case "GetMyBookmarkedContent": {
                const offset = parseInt(req.body.offset) || 0;
                const count = parseInt(req.body.count) || 31;
                const bookmarkedContentResult = await getMyBookmarkedContent(
                    req.headers['ros-sessionticket'],
                    platform,
                    req.body.contentType,
                    offset,
                    count
                );

                if (bookmarkedContentResult.error) {
                    res.status(bookmarkedContentResult.status).json({ message: bookmarkedContentResult.message });
                    return;
                }

                res.send(bookmarkedContentResult);
                break;
            }

            case "GetLatestVersionByContentId":
            case "GetContentByContentId":
                const contentIds = queryParams.contentids;
                if (contentIds.includes('QS6WYcjJFk2YxqYDMN8mjQ')) {
                    const heists1XML = fs.readFileSync('./src/static/Heists1.xml', 'utf8');
                    res.send(heists1XML);
                    return;
                } else if (contentIds.includes('hK5OgJk1BkinXGGXghhTMg')) {
                    const heists2XML = fs.readFileSync('./src/static/Heists2.xml', 'utf8');
                    res.send(heists2XML);
                    return;
                }
                const contentResults = await getContentByContentId(contentIds, platform, req.body.queryName);
                res.send(contentResults);
                break;

            case "GetContentByCategory":
                const category = queryParams.category;
                const categoryResults = await getContentByCategory(category, platform);
                res.send(categoryResults);
                break;

            default:
                console.error(`Unknown queryName: ${req.body.queryName}`);
                res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="QueryContent">
  <Status>0</Status>
  <Result Count="0" Total="0" Hash="0" />
</Response>`);
        }
    } catch (error) {
        console.error('Error querying content:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
