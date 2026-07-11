import { prisma } from "../../main.js";
import xml from "xml";

function publishResponse(ugcData) {
    const publishedTimestamp = Math.floor(new Date(ugcData.publishedDate).getTime() / 1000);

    const resultFields = [
        { ci: ugcData.contentId },
        { rci: ugcData.rootContentId },
        { n: ugcData.name },
        { pd: publishedTimestamp }
    ];

    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'PublishResponse',
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

export async function publishContentHandler(req, res) {
    try {
        console.log('Publish request:', req.body);

        const { contentId } = req.body;

        // Look up user by SessionTicket
        const user = await prisma.user.findUnique({
            where: { SessionTicket: req.headers['ros-sessionticket'] }
        });

        if (!user) {
            console.log('Invalid session ticket - user not found');
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        // Find the content to publish
        const contentToPublish = await prisma.uGC.findUnique({
            where: { contentId: contentId }
        });

        if (!contentToPublish) {
            console.log(`Content not found: ${contentId}`);
            res.status(404).json({ message: "Content not found" });
            return;
        }

        // Verify ownership
        if (contentToPublish.userId !== user.id && contentToPublish.rockstarId !== user.RockstarId) {
            console.log('User does not own this content');
            res.status(403).json({ message: "Forbidden - you don't own this content" });
            return;
        }

        // Unpublish any other entries with the same rootContentId
        await prisma.uGC.updateMany({
            where: {
                rootContentId: contentToPublish.rootContentId,
                NOT: {
                    contentId: contentId
                }
            },
            data: {
                isPublished: false
            }
        });

        // Publish this content
        const publishedEntry = await prisma.uGC.update({
            where: { contentId: contentId },
            data: {
                isPublished: true,
                publishedDate: new Date().toISOString()
            }
        });

        console.log(`Published content: ${contentId}, unpublished others with rootContentId: ${contentToPublish.rootContentId}`);

        // Send success response
        const responseXml = publishResponse(publishedEntry);
        res.set('Content-Type', 'text/xml');
        res.send(responseXml);

    } catch (error) {
        console.error('Error during publish:', error);
        res.status(500).json({ message: "Internal server error" });
    }
}
