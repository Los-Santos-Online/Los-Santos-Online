import xml from 'xml';

function createGetTelemetryClientConfigXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        IsTelemetryEnabled: 'true',
                        Path: 'telemetryConfig/gta5_ps4_prod_config.json',
                        xmlns: 'TelemetryClientConfigResponse',
                    },
                },
                { Status: '1' },
                { RawConfig: null },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getTelemetryClientConfigXMLHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(createGetTelemetryClientConfigXML());
};
