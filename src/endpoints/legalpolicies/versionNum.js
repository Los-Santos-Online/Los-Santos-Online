import xml from 'xml';

function VersionNum(version, policyTag) {
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
                { Version: '13' },
                { PolicyTag: policyTag },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const versionNumHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    //console.log(VersionNum(13, 'tos'));
    res.send(VersionNum());
};
