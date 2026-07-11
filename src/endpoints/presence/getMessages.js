import xml from 'xml';
import { prisma, sendLogMessage } from '../../main.js';

function createMessagesXML(messages) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'GetPresenceServersResponse',
                    },
                },
                { Status: '1' },
                {
                    Messages: [
                        { _attr: { Count: messages.length.toString(), Total: 1, svc: true, } },
                        ...messages.map((message) => ({
                            message: [
                                {
                                    _attr: {
                                        t: message.timestamp,
                                        svc: true,
                                    },
                                },
                                `${message.message}`
                            ],
                        })),                    
                    ],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}





export async function getMessagesHandler(req, res){
    try {
    const user = await prisma.user.findFirst({
        where: {
            Ticket: req.body.ticket,
        },
    });

    const messages = await prisma.messages.findMany({
        where: {
            recipent: user.blueSphereOnlineId,
            hasBeenSentToRecipent: false
        }
    })

    const formattedMessages = messages.map((message) => {
        return {
            message: message.message,
            timestamp: Date.now()
        }
    })

    if (!user) {
        return res.status(401);
    }

    res.send(createMessagesXML(formattedMessages));

    await prisma.messages.updateMany({
        where: {
            recipent: user.blueSphereOnlineId,
            hasBeenSentToRecipent: false
        },
        data: {
            hasBeenSentToRecipent: true
        }
    })

    } catch (error) {
            await sendLogMessage('ERROR IN GET MESSAGES PRESENCE')
            console.log(error)
    }
}