import xml from "xml";
import fs from 'fs-extra'
import { prisma } from "../../main.js";
import { StatsIdsParser, StatsParser, StatsWriter } from "../../utils/profileStats/profileStatsUtil.js";

function createResetStatsResponseXML() {

    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'ResetStatsResponse',
                    },
                },
                { Status: 1},
                {Count: 10},
                { Results: [{ _attr: { count: 10 } }] },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}
export async function resetStatsHandler(req,res){
    try {
        console.log(req.body);
    res.send(createResetStatsResponseXML());
        
}   catch (error) {
        console.log(error)
}
}