import { prisma, ugcClient } from '../../main.js';
import xml from 'xml';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { buildPhotoCdnMetadata } from './photoUpload.js';

async function uploadToS3(key, data, contentType = 'image/jpeg') {
    try {
        const command = new PutObjectCommand({
            Bucket: process.env.S3_UGC_BUCKET_NAME,
            Key: key,
            Body: data,
            ContentType: contentType
        });

        await ugcClient.send(command);
        console.log(`Successfully uploaded to S3: ${key} (${data.length} bytes)`);
        return true;
    } catch (error) {
        console.error(`Failed to upload to S3: ${key}`, error);
        return false;
    }
}

async function uploadPhotoFiles(contentId, files) {
    const maxPhotoFiles = 2;

    for (let i = 0; i < Math.min(files.length, maxPhotoFiles); i++) {
        const file = files[i];
        const suffix = i === 0 ? '00' : '01';
        const s3Key = `${contentId}_${suffix}.ugc`;
        const uploaded = await uploadToS3(s3Key, file.data, 'image/jpeg');

        if (!uploaded) {
            console.error(`Failed to upload photo file ${i}`);
        }
    }
}

function escapeXmlAttr(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function buildPhotoCreateData({ contentId, rootContentId, params, user, username, isLegacy, files }) {
    const now = new Date().toISOString();
    const shouldPublish = params?.Publish === true;
    const hasInlinePhotoBytes = files.length > 0;

    return {
        contentId,
        rootContentId,
        description: params?.Description || null,
        data: params?.DataJson || null,
        category: 'gta5photo',
        fileVersion0: hasInlinePhotoBytes ? files[0].id : -1,
        fileVersion1: hasInlinePhotoBytes && files.length > 1 ? files[1].id : -1,
        fileVersion2: -1,
        language: params?.Language || 'en',
        username,
        name: params?.ContentName || 'Untitled Photo',
        accountId: user.RockstarId,
        createdDate: now,
        publishedDate: shouldPublish ? now : null,
        rockstarId: user.RockstarId,
        userId: user.id,
        updatedDate: now,
        version: 1,
        isVerified: false,
        isLegacy,
        isPublished: shouldPublish
    };
}

function buildPhotoUpdateData(existingUGC, updateJson, files) {
    const now = new Date().toISOString();
    const updateData = {
        updatedDate: now,
        version: (existingUGC.version || 1) + 1
    };

    if (updateJson) {
        if (updateJson.ContentName) {
            updateData.name = updateJson.ContentName;
        }
        if (updateJson.DataJson) {
            updateData.data = updateJson.DataJson;
        }
        if (updateJson.Description) {
            updateData.description = updateJson.Description;
        }
        if (updateJson.Language) {
            updateData.language = updateJson.Language;
        }
        if (updateJson.Publish === true && !existingUGC.publishedDate) {
            updateData.publishedDate = now;
            updateData.isPublished = true;
        }
    }

    if (files.length > 0) {
        updateData.fileVersion0 = files[0]?.id || existingUGC.fileVersion0;
        updateData.fileVersion1 = files[1]?.id || existingUGC.fileVersion1;
        updateData.fileVersion2 = files[2]?.id || existingUGC.fileVersion2;
    }

    return updateData;
}

export async function createPhotoContent({ contentId, rootContentId, params, files, user, username, isLegacy }) {
    const createData = buildPhotoCreateData({
        contentId,
        rootContentId,
        params,
        files,
        user,
        username,
        isLegacy
    });

    const ugcEntry = await prisma.uGC.create({ data: createData });
    if (files.length > 0) {
        await uploadPhotoFiles(contentId, files);
    }
    return ugcEntry;
}

export function buildPhotoCreateResponseDataJson({ req, user, contentId, baseDataJson = null }) {
    return buildPhotoCdnMetadata({
        req,
        user,
        contentId,
        baseDataJson
    });
}

export function createPhotoContentResponse(ugcData, responseDataJson = null) {
    const createdTimestamp = Math.floor(new Date(ugcData.createdDate).getTime() / 1000);
    const updatedTimestamp = Math.floor(new Date(ugcData.updatedDate).getTime() / 1000);

    const ci = escapeXmlAttr(ugcData.contentId || '');
    const rci = escapeXmlAttr(ugcData.rootContentId || ugcData.contentId || '');
    const cd = escapeXmlAttr(createdTimestamp);
    const ud = escapeXmlAttr(updatedTimestamp);
    const u = escapeXmlAttr(ugcData.rockstarId || 0);
    const v = escapeXmlAttr(ugcData.version || 1);
    const n = escapeXmlAttr(ugcData.name || 'Untitled Photo');
    const daCdata = String(responseDataJson || '{}').replace(/]]>/g, ']]]]><![CDATA[>');

    return `<?xml version="1.0" encoding="utf-8"?><Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="CreateContent"><Status>1</Status><Result ci="${ci}" cd="${cd}" f1="-1" f2="-1" n="${n}" rci="${rci}" ud="${ud}" u="${u}" v="${v}"><da><![CDATA[${daCdata}]]></da></Result></Response>`;
}

export async function updatePhotoContent({ contentId, existingUGC, updateJson, files }) {
    const updateData = buildPhotoUpdateData(existingUGC, updateJson, files);
    const updatedUGC = await prisma.uGC.update({
        where: { contentId },
        data: updateData
    });

    if (files.length > 0) {
        const baseContentId = contentId.replace(/_\d{2}$/, '');
        await uploadPhotoFiles(baseContentId, files);
    }

    return updatedUGC;
}

export function updatePhotoContentResponse(ugcData) {
    const updatedTimestamp = Math.floor(new Date(ugcData.updatedDate).getTime() / 1000);
    const publishedTimestamp = ugcData.publishedDate ? Math.floor(new Date(ugcData.publishedDate).getTime() / 1000) : null;

    const resultFields = [
        { ci: ugcData.contentId },
        { n: ugcData.name },
        { ud: updatedTimestamp }
    ];

    if (publishedTimestamp) {
        resultFields.push({ pd: publishedTimestamp });
    }

    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'UpdateContentResponse',
                    },
                },
                { Status: '1' },
                {
                    Result: resultFields
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}
