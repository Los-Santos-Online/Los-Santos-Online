import xml from 'xml';
import { prisma } from '../../../main.js';
function createTicketSCAuthToken2XML(ScAuthToken) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        ScAuthToken: ScAuthToken,
                        xmlns: 'CreateScAuthToken2',
                    },
                },
                { Status: [{ _attr: { xmlns: 'CreateScAuthTokenResponse' } }, '1'] },
                { Result: [`${ScAuthToken}`] },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const createSCAuthTokenHandler = async (req, res) => {
    console.log('CREATING AUTH TOKEN');

    res.set('Content-Type', 'text/xml');

    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                SessionTicket: req.headers['ros-SessionTicket'],
            },
        });
        res.send(createTicketSCAuthToken2XML(user.SCAuthToken));
    } catch (e) {
        console.log(e);
    }
};
