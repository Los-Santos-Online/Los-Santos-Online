import { GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma, sendUGCMessage, ugcClient, generateError } from "../../main.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function getMissionFileHandler(req, res) {
    const missionHash = req.params.missionHash;
    const filename = req.params.filename;

    const extension = path.extname(filename).toLowerCase();
    const isImageRequest = extension === '.jpg' || extension === '.jpeg' || extension === '.png';
    const fileIdMatch = filename.match(/^(\d+)_/);
    const resolvedFileId = fileIdMatch ? Number.parseInt(fileIdMatch[1], 10) : (isImageRequest ? 1 : 0);
    const fixedFileName = `${missionHash}_${String(resolvedFileId).padStart(2, '0')}.ugc`;
    const fallbackImageFileName = isImageRequest
        ? `${missionHash}_${String(resolvedFileId === 2 ? 1 : 2).padStart(2, '0')}.ugc`
        : null;

    try {
        // Authenticate user
        const user = await prisma.user.findFirst({
            where: {
                SessionTicket: req.headers["ros-sessionticket"],
            },
        });

        if (!user) {
            res.setHeader("Content-Type", "text/xml");
            return res.status(401).send(generateError(0, "Unauthorized", "Invalid session"));
        }

        console.log(`Fetching UGC file: ${fixedFileName} for user: ${user.name || user.RockstarId}`);

        // Try to get the file from S3 UGC bucket
        let response;
        let isDefaultImage = false;

        try {
            const getObjectParams = {
                Bucket: process.env.S3_UGC_BUCKET_NAME,
                Key: fixedFileName
            };

            const command = new GetObjectCommand(getObjectParams);
            response = await ugcClient.send(command);

        } catch (s3Error) {
            if (isImageRequest && fallbackImageFileName) {
                try {
                    console.log(`Primary image key missing, trying alternate key: ${fallbackImageFileName}`);
                    const fallbackImageCommand = new GetObjectCommand({
                        Bucket: process.env.S3_UGC_BUCKET_NAME,
                        Key: fallbackImageFileName
                    });
                    response = await ugcClient.send(fallbackImageCommand);
                } catch (alternateErr) {
                    console.log(`Alternate image key missing: ${fallbackImageFileName}`);
                }
            }

            // If not found and it's an image, try to fetch the default image
            if (isImageRequest && !response) {
                try {
                    console.log(`Mission image not found, trying default image`);
                    const defaultImageCommand = new GetObjectCommand({
                        Bucket: process.env.S3_UGC_BUCKET_NAME,
                        Key: "_ClYvtLwf06ccYKyMxTQCQ_01.ugc"
                    });
                    response = await ugcClient.send(defaultImageCommand);
                    isDefaultImage = true;
                } catch (defaultS3Err) {
                    console.error("Default image not found in S3:", defaultS3Err);
                    response = null;
                }
            }

            // If still no response, handle as not found
            if (!response) {
                await sendUGCMessage(`UGC not found in S3: ${missionHash}_${filename} (tried ${fixedFileName})`);
                console.error("S3 UGC fetch error:", s3Error.Code || s3Error.message);

                if (isImageRequest) {
                    // Try to serve a local default image if available
                    try {
                        const defaultImagePath = path.join(__dirname, "..", "..", "static", "ugc", "_ClYvtLwf06ccYKyMxTQCQ_01.ugc");
                        if (fs.existsSync(defaultImagePath)) {
                            const fileData = fs.readFileSync(defaultImagePath);
                            res.setHeader("Content-Type", "image/jpeg");
                            res.setHeader("Cache-Control", "public, max-age=3600");
                            return res.send(fileData);
                        }
                    } catch (localErr) {
                        console.error("Local default image error:", localErr);
                    }

                    res.setHeader("Content-Type", "text/xml");
                    return res.status(404).send(generateError(0, "DoesNotExist", "Image not found"));
                } else {
                    res.setHeader("Content-Type", "text/xml");
                    return res.status(404).send(generateError(0, "DoesNotExist", "Content not found"));
                }
            }
        }

        // Successfully got the file from S3
        if (isImageRequest) {
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=3600");
        } else {
            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Cache-Control", "private, max-age=0");
        }

        // Convert stream to buffer and send
        const chunks = [];
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);

        if (!isDefaultImage) {
            console.log(`Successfully served UGC file: ${fixedFileName} (${data.length} bytes)`);
        } else {
            console.log(`Served default image for missing: ${fixedFileName}`);
        }

        res.send(data);

    } catch (err) {
        console.error("UGC endpoint error:", err);
        res.setHeader("Content-Type", "text/xml");
        res.status(500).send(generateError(0, "InternalError", "Server error occurred"));
    }
}
