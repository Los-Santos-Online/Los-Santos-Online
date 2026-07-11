import { prisma } from "../../main.js";
import { UGCBinaryDecoder } from "../../utils/ugc/ugc.js";
import {
    updateMissionContent,
    updateMissionContentResponse
} from "./missionContentHandlers.js";
import {
    updatePhotoContent,
    updatePhotoContentResponse
} from "./photoContentHandlers.js";

function resolveStoredContentType(existingUGC) {
    const normalized = String(existingUGC?.category || 'gta5mission').trim().toLowerCase();
    if (normalized === 'gta5photo' || normalized === 'photo') {
        return 'gta5photo';
    }

    return 'gta5mission';
}

export async function updateContent(req, res) {
    try {
        const updateContentBuffer = req.headers['original-data'];

        // Use the decoder to parse the content
        const decoder = new UGCBinaryDecoder(updateContentBuffer);
        let decoded;

        try {
            decoded = decoder.decode();
        } catch (error) {
            res.status(400).send('Invalid request format');
            return;
        }

        const { formData, files } = decoded;
        const decodedUpdateJson = formData.updateJson;

        console.log('Content ID to update:', formData.contentId);
        console.log(`Total files extracted: ${files.length}`);

        // Look up user by SessionTicket
        const user = await prisma.user.findUnique({
            where: { SessionTicket: req.headers['ros-sessionticket'] }
        });

        if (!user) {
            console.log('Invalid session ticket - user not found');
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        // Find existing UGC entry
        let existingUGC = await prisma.uGC.findUnique({
            where: { contentId: formData.contentId }
        });

        if (!existingUGC) {
            console.log(`UGC not found with contentId: ${formData.contentId}`);
            res.status(404).json({ message: "Content not found" });
            return;
        }

        // Verify ownership
        if (existingUGC.userId !== user.id && existingUGC.rockstarId !== user.RockstarId) {
            console.log('User does not own this content');
            res.status(403).json({ message: "Forbidden - you don't own this content" });
            return;
        }

        const resolvedContentType = resolveStoredContentType(existingUGC);
        let updatedUGC;
        let responseXml;

        switch (resolvedContentType) {
            case 'gta5photo':
                updatedUGC = await updatePhotoContent({
                    contentId: formData.contentId,
                    existingUGC,
                    updateJson: decodedUpdateJson,
                    files
                });
                responseXml = updatePhotoContentResponse(updatedUGC);
                break;
            case 'gta5mission':
            default:
                updatedUGC = await updateMissionContent({
                    contentId: formData.contentId,
                    existingUGC,
                    updateJson: decodedUpdateJson,
                    files
                });
                responseXml = updateMissionContentResponse(updatedUGC);
                break;
        }

        console.log(`Updated UGC entry: ${formData.contentId}, version: ${updatedUGC.version}, type: ${resolvedContentType}`);

        // Send success response
        res.set('Content-Type', 'text/xml');
        res.send(responseXml);

    } catch (error) {
        console.log('Error during update processing:', error);
        res.status(500).send('Internal server error');
    }
}
