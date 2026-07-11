import express from 'express';
import xml from 'xml';
import { generateRelayServer, PUBLIC_KEY } from '../../utils/relaySignature.js';
const router = express.Router();

/**
 * Endpoint: http://prod.ros.rockstargames.com/gta5/11/gameservices/GeoLocation.asmx/GetRelayServers
 * <?xml version="1.0" encoding="utf-8"?>
 * <Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ms="15.6263" xmlns="RegionBucketLookUpResponse">
 *     <Status>1</Status>
 *     <LocInfo RegionCode="3" Longitude="0.0" Latitude="0.0" CountryCode="US" />
 *     <RelaysList Count="1" IsSecure="false">
 *         <Server Host="185.56.65.153:61456" IsXblSg="false" />
 *     </RelaysList>
 * </Response>
 **/

function generateRelayServerXML(address, port) {
    const xmlObject = {
        Response: [
            {
                _attr: {
                    'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                    'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                    ms: '0.0',
                    xmlns: 'RegionBucketLookUpResponse',
                },
            },
            { Status: '1' },
            { LocInfo: { _attr: { RegionCode: '3', Longitude: '0.0', Latitude: '0.0', CountryCode: 'US' } } },
            {
                RelaysList: [
                    { _attr: { Count: '1', IsSecure: 'false' } },
                    { Server: { _attr: { Host: `${address}:${port}`} } },
                ],
            },
        ],
    };

    return xml(xmlObject, { declaration: true });
}

export const getRelayServersHandler = (req, res) => {
    res.set('Content-Type', 'application/xml');

    const relayAddress = process.env.RELAY_PUBLIC_ADDRESS;
    const relayPort = process.env.RELAY_PUBLIC_PORT;

    if (!relayAddress || !relayPort) {
        throw new Error('RELAY_PUBLIC_ADDRESS and RELAY_PUBLIC_PORT must be configured');
    }

    // Generate signed relay server
    const relay = generateRelayServer(relayAddress, relayPort);
    console.log('Generated relay server:', relay);

    console.log(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="RegionBucketLookUpResponse">
  <Status>1</Status>
  <LocInfo RegionCode="5" Longitude="144.3436" Latitude="-38.1801" CountryCode="AU" />
  <RelaysList Count="1" IsSecure="false" PublicKey="${PUBLIC_KEY}">
    <Server Host="${relay.host}" IsXblSg="false" Sig="${relay.signature}" />
  </RelaysList>
</Response>`);

    // Build XML response with signature
    res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="RegionBucketLookUpResponse">
  <Status>1</Status>
  <LocInfo RegionCode="5" Longitude="144.3436" Latitude="-38.1801" CountryCode="AU" />
  <RelaysList Count="1" IsSecure="false" PublicKey="${PUBLIC_KEY}">
    <Server Host="${relay.host}" IsXblSg="false" Sig="${relay.signature}" />
  </RelaysList>
</Response>`);
//         res.send(`<?xml version="1.0" encoding="utf-8"?>
// <Response xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns="RegionBucketLookUpResponse">
//   <Status>1</Status>
//   <LocInfo RegionCode="5" Longitude="144.3436" Latitude="-38.1801" CountryCode="AU" />
//   <RelaysList Count="1" IsSecure="false" PublicKey="MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEdNw3atDa5oyyaMXkISR02dfrcGZayc2llU15LpH7cXO5/TX11Pq1/o2Ti/wor4hvaY3Bglsin0pw2yj27hwXOQ==">
//     <Server Host="192.81.241.225:61456" IsXblSg="false" Sig="bRZJr3uf3mM38jlxZst0Q4cTAqW0JKwHSf7Uu5N2cYwN5j5FKwLmi4q2DB6XLxXC1N6FMSgLHwyHCjZfTwYP6Q==" />
//   </RelaysList>
// </Response>`);
};

