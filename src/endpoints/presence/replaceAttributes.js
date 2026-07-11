import xml from 'xml';
import { prisma, sendLogMessage } from '../../main.js';

function createReplaceAttributes() {
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

export const replaceAttributesHandler = async (req, res) => {
    try { 
        const updatedRecord = await prisma.user.update({
            where: {
                SessionTicket: req.headers['ros-sessionticket'],
            },
            data: {
                PresenceAttributes: req.body.typeNameValueCsv
            }
        })
    
        res.set('Content-Type', 'text/xml');
        res.send(createReplaceAttributes());
    } catch (error) {
        await sendLogMessage('ERROR IN REPLACE PRESENCE ATTRIBUTES')
        console.log(error)
    }
};
