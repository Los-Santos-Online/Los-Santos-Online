import xml from 'xml';
import { prisma, sendLogMessage } from '../../main.js';
import { PresenceAttributesClient } from '../../utils/presence/presenceUtils.js';

function createSetAttributes() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'http://services.ros.rockstargames.com/',
                    },
                },
                { Status: '1' },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const setAttributesHandler = async (req, res) => {
    try {
        res.set('Content-Type', 'text/xml');
        const user = await prisma.user.findFirstOrThrow({
            where: {
                SessionTicket: req.headers['ros-sessionticket'],
            },
        });

        const currentPresenceAttributes = user.PresenceAttributes;

        const presenceClient = new PresenceAttributesClient(currentPresenceAttributes);

        presenceClient.setAttributes(req.body.typeNameValueCsv);

        const newPresenceAttributes = presenceClient.serialize();

        const newUser = await prisma.user.update({
            where: {
                Ticket: req.body.ticket,
            },
            data: {
                PresenceAttributes: newPresenceAttributes,
            },
        });

        res.send(createSetAttributes());
    } catch (error) {
        await sendLogMessage('ERROR IN SET PRESENCE ATTRIBUTES')
        res.sendStatus(500);
    }
};
