import xml from 'xml';

function createGetSourceAccountsMP() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        xmlns: 'GetSourceAccountsMP'
                    },
                },
                {
                    Result: [
                        {
                            Accounts: [
                                // {
                                //     Account: {
                                //         _attr: {
                                //             accountId: 996352064,
                                //             platform: 'ps4',
                                //             gamertag: 'Jorby',
                                //             gamerhandle: 'NP 2 Jorby',
                                //             ugcPublishCount: 0,
                                //             errorCode: 'ERROR_NOT_AVAILABLE'
                                //         },
                                //         Stats: []
                                //     }
                                // }
                            ]
                        }
                    ]
                },
                { Status: '1' }
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const GetSourceAccountsMPHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    console.log(createGetSourceAccountsMP())
    res.send(createGetSourceAccountsMP());
};
