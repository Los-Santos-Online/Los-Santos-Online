import xml from 'xml';

function createCheckTextResponseXML(count) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'CheckText',
                    },
                },
                { Status: '1' },
                {
                    Result: [{ Count: count.toString() }],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const FuckingHellRockstarHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(createCheckTextResponseXML(0));
};
