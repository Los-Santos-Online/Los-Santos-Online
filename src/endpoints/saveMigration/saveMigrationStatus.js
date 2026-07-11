import xml from 'xml';

function createGetSaveMigrationStatusXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        xmlns: 'GetSaveMigrationStatus'
                    },
                },
                {
                    Result: [
                        { TransactionId: 69420 },
                        { InProgress: false },
                        { State: 'Finished' }
                    ],
                },
                { Status: '1' }
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const saveMigrationStatusHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    console.log(createGetSaveMigrationStatusXML())
    res.send(createGetSaveMigrationStatusXML());
};
