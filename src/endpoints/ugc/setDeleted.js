import { prisma } from '../../main.js';

function SetDeletedResponse() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Status>1</Status>
</Response>`;
}

export async function setDeletedHandler(req, res) {
    console.log('SetDeleted request:', req.body);

    try {
        const { contentType, contentId } = req.body;

        // Verify user authentication via SessionTicket
        const user = await prisma.user.findUnique({
            where: { SessionTicket: req.headers['ros-sessionticket'] }
        });

        if (!user) {
            console.log('Invalid session ticket - user not found');
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        // Unpublish the mission by setting isPublished to false (soft delete)
        await prisma.uGC.update({
            where: { contentId: contentId },
            data: {
                isPublished: false,
                publishedDate: null,
                updatedDate: new Date().toISOString()
            }
        });

        console.log(`Mission ${contentId} unpublished successfully`);

        // Send success response
        const responseXml = SetDeletedResponse();
        res.set('Content-Type', 'text/xml');
        res.send(responseXml);

    } catch (error) {
        console.error('Error in setDeleted handler:', error);
        const responseXml = SetDeletedResponse();
        res.set('Content-Type', 'text/xml');
        res.send(responseXml);
    }
}
