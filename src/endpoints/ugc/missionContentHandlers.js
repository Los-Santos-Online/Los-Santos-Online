import { prisma, ugcClient } from '../../main.js';
import xml from 'xml';
import { PutObjectCommand } from '@aws-sdk/client-s3';

async function uploadToS3(key, data, contentType = 'application/octet-stream') {
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

async function uploadMissionFiles(contentId, files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isMissionData = i === 0;
        const primarySuffix = String(i).padStart(2, '0');
        const primaryKey = `${contentId}_${primarySuffix}.ugc`;
        const contentType = isMissionData ? 'application/octet-stream' : 'image/jpeg';
        const uploaded = await uploadToS3(primaryKey, file.data, contentType);

        if (!uploaded) {
            console.error(`Failed to upload mission file ${i}`);
            continue;
        }

        // Compatibility path: if only one preview image is present, mirror it to _02
        // so clients requesting high-def preview do not miss.
        if (i === 1 && files.length === 2) {
            const highDefKey = `${contentId}_02.ugc`;
            const mirrored = await uploadToS3(highDefKey, file.data, 'image/jpeg');
            if (!mirrored) {
                console.error(`Failed to mirror mission preview image to high-def key for ${contentId}`);
            }
        }
    }
}

function buildMissionCreateData({ contentId, rootContentId, params, user, username, isLegacy, files }) {
    const now = new Date().toISOString();
    const shouldPublish = params?.Publish === true;

    return {
        contentId,
        rootContentId,
        description: params?.Description || null,
        data: params?.DataJson || null,
        category: 'gta5mission',
        fileVersion0: files.length > 0 ? files[0].id : 1,
        fileVersion1: files.length > 1 ? files[1].id : 0,
        fileVersion2: files.length > 2 ? files[2].id : 0,
        language: params?.Language || 'en',
        username,
        name: params?.ContentName || 'Untitled Mission',
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

function buildMissionUpdateData(existingUGC, updateJson, files) {
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

export async function createMissionContent({ contentId, rootContentId, params, files, user, username, isLegacy }) {
    const createData = buildMissionCreateData({
        contentId,
        rootContentId,
        params,
        files,
        user,
        username,
        isLegacy
    });

    const ugcEntry = await prisma.uGC.create({ data: createData });
    await uploadMissionFiles(contentId, files);
    return ugcEntry;
}

export function createMissionContentResponse(ugcData) {
    const createdTimestamp = Math.floor(new Date(ugcData.createdDate).getTime() / 1000);
    const updatedTimestamp = Math.floor(new Date(ugcData.updatedDate).getTime() / 1000);

    const resultAttrs = {
        ci: ugcData.contentId,
        cd: createdTimestamp.toString(),
        ud: updatedTimestamp.toString(),
        u: (ugcData.rockstarId || 0).toString(),
        v: (ugcData.version || 1).toString(),
        n: ugcData.name,
        rci: ugcData.rootContentId,
        f0: (ugcData.fileVersion0 !== null && ugcData.fileVersion0 !== undefined) ? ugcData.fileVersion0.toString() : '-1',
        f1: (ugcData.fileVersion1 !== null && ugcData.fileVersion1 !== undefined) ? ugcData.fileVersion1.toString() : '-1',
        f2: (ugcData.fileVersion2 !== null && ugcData.fileVersion2 !== undefined) ? ugcData.fileVersion2.toString() : '0'
    };

    const resultContent = [{ _attr: resultAttrs }];
    if (ugcData.data) {
        resultContent.push({ da: { _cdata: ugcData.data } });
    }

    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'CreateContentResponse',
                    },
                },
                { Status: '1' },
                {
                    Result: resultContent
                }
            ],
        },
    ];

    return xml(xmlStructure, { declaration: { encoding: 'utf-8' } });
}

export async function updateMissionContent({ contentId, existingUGC, updateJson, files }) {
    const updateData = buildMissionUpdateData(existingUGC, updateJson, files);
    const updatedUGC = await prisma.uGC.update({
        where: { contentId },
        data: updateData
    });

    if (files.length > 0) {
        const baseContentId = contentId.replace(/_\d{2}$/, '');
        await uploadMissionFiles(baseContentId, files);
    }

    return updatedUGC;
}

export function updateMissionContentResponse(ugcData) {
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
