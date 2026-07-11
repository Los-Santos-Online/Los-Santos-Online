import crypto from 'crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma, ugcClient } from '../../main.js';

const PHOTO_UPLOAD_FILE_NAME = '0_0.jpg';

function getTokenTtlSeconds() {
    return 900;
}

function getUploadTokenSecret() {
    if (!process.env.SERVER_SECRET) {
        throw new Error('SERVER_SECRET is required for UGC photo upload tokens');
    }
    return process.env.SERVER_SECRET;
}

function getPublicCdnBaseUrl(req) {
    const toHttpBaseUrl = (input) => {
        const cleaned = String(input || '').replace(/\/$/, '');
        if (/^https?:\/\//i.test(cleaned)) {
            return cleaned.replace(/^https:/i, 'http:');
        }
        return `http://${cleaned}`;
    };

    if (process.env.ROS_HOST) {
        return toHttpBaseUrl(process.env.ROS_HOST);
    }

    const host = req.get('host');
    return toHttpBaseUrl(host);
}

function signTokenPayload(payload) {
    return crypto.createHmac('sha256', getUploadTokenSecret()).update(payload).digest('hex');
}

function createPhotoUploadToken({ contentId, fileName }) {
    const now = Math.floor(Date.now() / 1000);
    const start = Math.max(0, now - 5);
    const expires = now + getTokenTtlSeconds();
    const aclPath = `/ugc/gta5photo/${contentId}/${fileName}*`;
    const aclEncoded = encodeURIComponent(aclPath).replace(/\*/g, '%2a');
    const signaturePayload = `${start}:${expires}:${aclPath}`;
    const hmac = signTokenPayload(signaturePayload);
    return `__token__=st=${start}~exp=${expires}~acl=${aclEncoded}~hmac=${hmac}`;
}

function verifyPhotoUploadToken(token, contentId, fileName) {
    if (!token || typeof token !== 'string') {
        return null;
    }

    const normalizedToken = token.startsWith('__token__=') ? token.slice('__token__='.length) : token;
    const parts = normalizedToken.split('~');
    const tokenFields = {};

    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key && value !== undefined) {
            tokenFields[key] = value;
        }
    }

    const start = Number.parseInt(tokenFields.st || '', 10);
    const expires = Number.parseInt(tokenFields.exp || '', 10);
    const aclRaw = tokenFields.acl ? decodeURIComponent(tokenFields.acl) : null;
    const hmac = tokenFields.hmac;

    if (!Number.isFinite(start) || !Number.isFinite(expires) || !aclRaw || !hmac) {
        return null;
    }

    const expectedAcl = `/ugc/gta5photo/${contentId}/${fileName}*`;
    if (aclRaw !== expectedAcl) {
        return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (start > now + 10 || expires < now) {
        return null;
    }

    const expectedHmac = signTokenPayload(`${start}:${expires}:${expectedAcl}`);
    if (hmac.length !== expectedHmac.length || hmac.length === 0) {
        return null;
    }

    const signatureBuffer = Buffer.from(hmac);
    const expectedBuffer = Buffer.from(expectedHmac);
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return null;
    }

    return { start, expires };
}

function getUploadTokenFromRequest(req) {
    if (typeof req.query?.token === 'string' && req.query.token.length > 0) {
        return req.query.token;
    }

    if (typeof req.query?.__token__ === 'string' && req.query.__token__.length > 0) {
        return `__token__=${req.query.__token__}`;
    }

    const rawQuery = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
    if (!rawQuery) {
        return null;
    }

    if (rawQuery.startsWith('__token__=')) {
        return decodeURIComponent(rawQuery);
    }

    if (!rawQuery.includes('=')) {
        return decodeURIComponent(rawQuery);
    }

    return null;
}

function extractUploadBuffer(input) {
    if (!input) {
        return null;
    }

    if (Buffer.isBuffer(input)) {
        return input;
    }

    if (ArrayBuffer.isView(input)) {
        return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    }

    if (input instanceof ArrayBuffer) {
        return Buffer.from(input);
    }

    if (typeof input === 'string') {
        // GTA upload body should be raw JPEG bytes; binary preserves byte values.
        return Buffer.from(input, 'binary');
    }

    if (Array.isArray(input)) {
        if (input.length === 0) {
            return null;
        }

        if (input.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
            return Buffer.from(input);
        }

        // Multipart-like payloads can arrive as [{ headers, body }]
        for (const item of input) {
            const nested = extractUploadBuffer(item);
            if (nested && nested.length > 0) {
                return nested;
            }
        }
        return null;
    }

    if (typeof input === 'object') {
        // Node Buffer JSON shape: { type: "Buffer", data: [...] }
        if (input.type === 'Buffer' && Array.isArray(input.data)) {
            return Buffer.from(input.data);
        }

        if (Object.prototype.hasOwnProperty.call(input, 'body')) {
            return extractUploadBuffer(input.body);
        }

        if (Object.prototype.hasOwnProperty.call(input, 'data')) {
            return extractUploadBuffer(input.data);
        }

        // Some request wrappers use { file: <binary> }
        if (Object.prototype.hasOwnProperty.call(input, 'file')) {
            return extractUploadBuffer(input.file);
        }
    }

    return null;
}

function getPhotoDumpDir() {
    if (process.env.UGC_PHOTO_DEBUG_DUMP_DIR) {
        return process.env.UGC_PHOTO_DEBUG_DUMP_DIR;
    }

    return path.join(process.cwd(), 'debug', 'ugc-photo-raw');
}

async function dumpOriginalDataToDisk(contentId, fileName, payload) {
    if (!payload || payload.length === 0) {
        return null;
    }

    const dumpDir = getPhotoDumpDir();
    await fs.mkdir(dumpDir, { recursive: true });

    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const safeFileName = String(fileName || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
    const outputPath = path.join(
        dumpDir,
        `${timestamp}_${contentId}_${safeFileName}_${randomSuffix}.bin`
    );

    await fs.writeFile(outputPath, payload);
    return outputPath;
}

async function uploadPhotoToS3(contentId, data, contentType) {
    const fileKeys = [`${contentId}_00.ugc`, `${contentId}_01.ugc`];

    for (const key of fileKeys) {
        const command = new PutObjectCommand({
            Bucket: process.env.S3_UGC_BUCKET_NAME,
            Key: key,
            Body: data,
            ContentType: contentType || 'image/jpeg'
        });

        await ugcClient.send(command);
    }
}

function parsePhotoMetadata(baseDataJson) {
    if (!baseDataJson || typeof baseDataJson !== 'string') {
        return {};
    }

    try {
        const parsed = JSON.parse(baseDataJson);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
        return {};
    }
}

export function buildPhotoCdnMetadata({ req, user, contentId, baseDataJson = null }) {
    const cdnDirectory = `/ugc/gta5photo/${contentId}/`;
    const token = createPhotoUploadToken({
        contentId,
        fileName: PHOTO_UPLOAD_FILE_NAME
    });

    const existingMetadata = parsePhotoMetadata(baseDataJson);
    const metadataJson = JSON.stringify({
        ...existingMetadata,
        cdndir: cdnDirectory,
        cdnfn: PHOTO_UPLOAD_FILE_NAME,
        cdnurl: getPublicCdnBaseUrl(req),
        cdnat: token
    });
    return metadataJson;
}

export async function uploadPhotoToCdnHandler(req, res) {
    try {
        
        const contentId = req.params.contentId;
        const fileName = req.params.fileName;
        console.log('[UGC PhotoUpload] Incoming upload:', { contentId, fileName, originalUrl: req.originalUrl });

        const token = getUploadTokenFromRequest(req);
        const tokenPayload = verifyPhotoUploadToken(token, contentId, fileName);

        if (!tokenPayload) {
            console.warn('[UGC PhotoUpload] Invalid token', { contentId, fileName, tokenPreview: token?.slice(0, 20) || null });
            res.status(401).send('Invalid upload token');
            return;
        }

        const content = await prisma.uGC.findUnique({
            where: { contentId }
        });

        if (!content) {
            console.warn('[UGC PhotoUpload] Content not found', { contentId });
            res.status(404).send('Content not found');
            return;
        }

        if (content.category !== 'gta5photo') {
            console.warn('[UGC PhotoUpload] Invalid content type', { contentId, category: content.category });
            res.status(400).send('Invalid content type');
            return;
        }

        const rawPayload = extractUploadBuffer(req.body);
        const rawDumpPath = await dumpOriginalDataToDisk(contentId, fileName, rawPayload);
        if (rawDumpPath && rawPayload) {
            console.log('[UGC PhotoUpload] Dumped raw body', { contentId, path: rawDumpPath, bytes: rawPayload.length });
        }

        const body = rawPayload;
        if (!body || body.length === 0) {
            console.warn('[UGC PhotoUpload] Empty/invalid body', {
                contentId,
                bodyType: typeof req.body,
                isArray: Array.isArray(req.body),
                keys: req.body && typeof req.body === 'object' ? Object.keys(req.body).slice(0, 8) : []
            });
            res.status(400).send('Empty upload body');
            return;
        }

        const contentType = req.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
        await uploadPhotoToS3(contentId, body, contentType);
        console.log('[UGC PhotoUpload] Uploaded to storage', {
            contentId,
            bytes: body.length,
            contentType,
            source: 'req.body'
        });

        await prisma.uGC.update({
            where: { contentId },
            data: {
                fileVersion0: 0,
                fileVersion1: 0,
                updatedDate: new Date().toISOString()
            }
        });

        res.set('X-Akamai-RSGShardPath', `/ugc/gta5photo/${contentId}/0_0.jpg`);
        res.set('Cache-Control', 'no-store');
        res.status(200).send('');
    } catch (error) {
        console.error('Photo CDN upload failed:', error);
        res.status(500).send('Upload failed');
    }
}
