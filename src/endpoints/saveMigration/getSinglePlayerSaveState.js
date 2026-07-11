import xml from 'xml';
import { prisma } from '../../main.js';

function createGetSinglePlayerSaveStateXML(user) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        xmlns: 'GetUploadedSingleplayerSaveMetadata'
                    }
                },
                {
                    SaveMigrationRecordMetadata: [
                        { SaveMigrationRecordToken: user.SessionKey }, // Using SessionKey as save token
                        { SourceRockstarId: user.RockstarId },
                        { SourcePlayerAccountId: 42069 }, // Using RockstarId as PlayerAccountId
                        { SourcePlatformId: 3 }, // Hardcoded as appears platform-specific
                        { UploadPosixTime: Math.floor(Date.now() / 1000) },
                        { CompletionPercentage: 0 }, // Keeping default as not in schema
                        { LastCompletedMissionId: 0 }, // Keeping default as not in schema
                        { SavePosixTime: Math.floor(Date.now() / 1000) }
                    ]
                },
                { Status: '1' }
            ]
        }
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getSinglePlayerSaveStateHandler = async (req, res) => {
    res.set('Content-Type', 'text/xml');

    try {
        const user = await prisma.user.findFirstOrThrow({
            where: {
                SessionTicket: req.headers['ros-SessionTicket'],
            }
        });
        res.send(createGetSinglePlayerSaveStateXML(user));
    } catch (e) {
        console.log(e);
        res.status(500).send('Error retrieving save data');
    }
};
