import xml from 'xml';

function createLegalTerritoryRestrictionsXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'LegalTerritoryRestrictionsResponse',
                    },
                },
                { Status: '1' },
                {
                    restrictions: [
                        { _attr: { territoryCode: 'US' } },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_HOUSE',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_3CARDPOKER',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_INSIDETRACK',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_LUCKYWHEEL',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_BLACKJACK',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_ROULETTE',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                        {
                            restriction: {
                                _attr: {
                                    resId: 'GAMBLING_RESTRICTED_GEOGRAPHIC',
                                    gameType: 'GTAO_CASINO_SLOTS',
                                    pvcAllowed: 'true',
                                    evcAllowed: 'true',
                                },
                            },
                        },
                    ],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getLegalTerritoryRestrictionsHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(createLegalTerritoryRestrictionsXML());
};
