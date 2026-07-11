import { prisma } from '../../main.js';
import { UGCBinaryDecoder } from '../../utils/ugc/ugc.js';
import crypto from 'crypto';
import fsExtra from 'fs-extra';
import {
    createMissionContent,
    createMissionContentResponse
} from './missionContentHandlers.js';
import {
    buildPhotoCreateResponseDataJson,
    createPhotoContent,
    createPhotoContentResponse
} from './photoContentHandlers.js';

function generateContentId() {
    return crypto
        .randomBytes(16)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function resolveContentType(rawType) {
    const normalized = String(rawType || 'gta5mission').trim().toLowerCase();

    switch (normalized) {
        case 'gta5mission':
        case '1':
            return 'gta5mission';
        case 'gta5photo':
        case 'photo':
        case '4':
            return 'gta5photo';
        default:
            return null;
    }
}

function getUsername(user) {
    return user.name || user.blueSphereOnlineId || user.PCNickname || 'Unknown';
}

export async function createContentHandler(req, res) {
    try {
        const createContentBuffer = req.headers['original-data'];
        const platform = req.headers['Platform'];
        // fsExtra.writeFileSync(`debug/ugc_create_${Date.now()}.bin`, createContentBuffer);
        // console.log('Original data as hex:', Buffer.from(createContentBuffer, 'binary').toString('hex'));
        // Use the decoder to parse the content
        const decoder = new UGCBinaryDecoder(createContentBuffer);
        let decoded;

        try {
            decoded = decoder.decode();
        } catch (error) {
            console.error('Failed to decode UGCBinary data:', error);
            res.status(400).send('Invalid request format');
            return;
        }

        const { formData, files } = decoded;
        const decodedParamsJson = formData.paramsJson;
        console.log('Decoded form data:', {paramsJson: decodedParamsJson });
        console.log(`Decoded ${files.length} file(s) from request.`);
        const resolvedContentType = resolveContentType(formData.contentType);

        console.log(`Total files extracted: ${files.length}`);
        console.log(`Resolved content type: ${resolvedContentType || 'unsupported'}`);

        if (!resolvedContentType) {
            res.status(400).send('Unsupported content type');
            return;
        }

        // Look up user by SessionTicket
        const user = await prisma.user.findUnique({
            where: { SessionTicket: req.headers['ros-sessionticket'] }
        });

        if (!user) {
            console.log('Invalid session ticket - user not found');
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        // Get username based on platform
        const username = getUsername(user);

        // Determine if this is a legacy platform
        const isLegacyPlatform = platform === 'PS3' || platform === 'XBOX360';

        // Generate base content ID
        const contentId = generateContentId();
        const rootContentId = contentId;
        let ugcEntry;
        let responseDataJson = null;
        let responseXml;

        switch (resolvedContentType) {
            case 'gta5photo':
                ugcEntry = await createPhotoContent({
                    contentId,
                    rootContentId,
                    params: decodedParamsJson,
                    files,
                    user,
                    username,
                    isLegacy: isLegacyPlatform
                });
                responseDataJson = buildPhotoCreateResponseDataJson({
                    req,
                    user,
                    contentId,
                    baseDataJson: decodedParamsJson?.DataJson || null
                });
                responseXml = createPhotoContentResponse(ugcEntry, responseDataJson);
                break;
            case 'gta5mission':
            default:
                ugcEntry = await createMissionContent({
                    contentId,
                    rootContentId,
                    params: decodedParamsJson,
                    files,
                    user,
                    username,
                    isLegacy: isLegacyPlatform
                });
                responseXml = createMissionContentResponse(ugcEntry);
                break;
        }

        console.log(`Created UGC entry for ${resolvedContentType}: ${contentId}`);

        console.log('[UGC CreateContent] Response metadata:', JSON.stringify({
            contentType: resolvedContentType,
            contentId,
            rootContentId,
            responseDataJson
        }));
        console.log('[UGC CreateContent] Response XML:', responseXml);
        res.set('Content-Type', 'text/xml');
        res.send(responseXml);

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "An error occurred." });
    }
}
