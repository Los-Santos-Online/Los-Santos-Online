import express from 'express';
import xml from 'xml';
const router = express.Router();

/**
 * Endpoint: http://prod.ros.rockstargames.com/gta5/11/gameservices/licenseplates.asmx/Get
 *	<Plates>
 *		<PlateText>
 *		69420
 *		</PlateText>
 *		<PlateData>
 *		Optional Field
 *		</PlateData>
 *	</Plates>
 **/

function generateLicensePlatesXML(rockstarId, plateText, plateIndex, plateData) {
    // Start with the core structure of the XML
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'AddLicensePlateResponse',
                    },
                },
                { Status: '1' },
                {
                    Plates: [
                        {
                            LicensePlateInfo: [
                                { PlateText: plateText },
                                { PlateIndex: plateIndex },
                            ],
                        },
                    ],
                },
            ],
        },
    ];

    // Conditionally add PlateData if it's provided
    if (plateData) {
        xmlStructure[0].Response[2].Plates[0].LicensePlateInfo.push({ PlateData: plateData });
    }

    // Generate the XML string
    const xmlString = xml(xmlStructure, { declaration: true, indent: '\t' });

    return xmlString;
}

export const getLicensePlateHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(`<?xml version="1.0" encoding="utf-8"?>
<Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="Response">
  <Status>1</Status>
  <Plates>
    <Plate>
      <PlateText>JORBY</PlateText>
    </Plate>
  </Plates>
</Response>
`);
};

