import xml from 'xml';
function createGetPasswordRequirementsXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'GetPasswordRequirements',
                    },
                },
                { Status: '1' },
                {
                    Result: [{ ValidSymbols: '_*;.-!$^' }, { MinLength: '8' }, { MaxLength: '30' }],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const GetPasswordRequirementsHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(createGetPasswordRequirementsXML());
};
