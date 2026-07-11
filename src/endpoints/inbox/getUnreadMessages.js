import xml from 'xml';

function createGetUnreadMessagesXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'InboxGetMessagesResponse',
                    },
                },
                { Status: '1' },
                {
                    Messages: [{ _attr: { Count: '0', Total: '0' } }],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getUnreadMessagesHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    //console.log(createGetUnreadMessagesXML());
    res.send(createGetUnreadMessagesXML());
};
