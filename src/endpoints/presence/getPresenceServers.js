import xml from 'xml';

function createPresenceServersXML() {
    const relayAddress = process.env.RELAY_PUBLIC_ADDRESS;
    const relayPort = process.env.RELAY_PUBLIC_PORT;

    if (!relayAddress || !relayPort) {
        throw new Error('RELAY_PUBLIC_ADDRESS and RELAY_PUBLIC_PORT must be configured');
    }

    const servers = [
        { host: `${relayAddress}:${relayPort}` },
    ];

    // Create server entries for XML structure
    const serverEntries = servers.map(server => ({
        Server: [{ _attr: { Host: server.host, isSecure: 'false', IsXblSg: 'false' } }]
    }));

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
                    Result: [
                        { _attr: { Count: servers.length.toString(), IsSecure: 'false', IsXblSg: 'false' } },
                        ...serverEntries
                    ],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getPresenceServersHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    console.log(createPresenceServersXML());
    res.send(createPresenceServersXML());
};
