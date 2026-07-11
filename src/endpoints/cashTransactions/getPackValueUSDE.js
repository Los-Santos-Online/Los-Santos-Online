import xml from 'xml';

function createCashValueUSDResponseXML() {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'CashValueUSDEResponse',
                    },
                },
                { Status: '1' },
                {
                    ItemList: [
                        { _attr: { Count: '29' } },
                        {
                            Pack: {
                                _attr: {
                                    id: '12EAA58C2A89418F3C29B4E4BD7A47E6',
                                    vcValue: '100000',
                                    usde: '3',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '20DE1E16E12DC7C67424E7DA0AE2C0EE',
                                    vcValue: '250000',
                                    usde: '5',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'F006EE8B8984283F1AD5BF04E1A0FBF0',
                                    vcValue: '600000',
                                    usde: '10',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'A8AA817BAD5FE768166AFF3FCC937F26',
                                    vcValue: '1500000',
                                    usde: '20',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '2D2BBF0C70EF90A5136963FABBC329F0',
                                    vcValue: '4250000',
                                    usde: '50',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '395975920B28DF2D47C1E35F042699AD',
                                    vcValue: '10000000',
                                    usde: '100',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '1EE7703C0DEB4E86ECB4432519A0DDC0',
                                    vcValue: '500000',
                                    usde: '0.002',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '5173BC5B225331E7A38FA61A482A0BC0',
                                    vcValue: '300000',
                                    usde: '0.0003',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '46188D8AA9B1DB0B1779A72A5FE914CC',
                                    vcValue: '150000',
                                    usde: '0.005',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '71ADDA37AB62B96A3AD716A4A3E41E89',
                                    vcValue: '200000',
                                    usde: '0.0007',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'ED16274E758A69E44AAA8F3FF19215B6',
                                    vcValue: '100000',
                                    usde: '0.0011',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '760A57586B03B0C08B98D2CDEC56AF02',
                                    vcValue: '250000',
                                    usde: '0.0012',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '21073CF679BB5B98F54505B27E37552A',
                                    vcValue: '600000',
                                    usde: '0.0013',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '60DDE8D58617A798032E8185F5299DF2',
                                    vcValue: '1500000',
                                    usde: '0.0014',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '52DBC424960C8A695A859749ACFEAC8C',
                                    vcValue: '4250000',
                                    usde: '0.0015',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '68F428DF0203FAD88102D596086AF1FC',
                                    vcValue: '10000000',
                                    usde: '0.0016',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '6C1CE4F51330B24DC214B467A085804D',
                                    vcValue: '100000',
                                    usde: '2.99',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'E5263B2EF28605AEFB20B7FAEB48FD53',
                                    vcValue: '250000',
                                    usde: '4.99',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '91A48A3A7CD02B0675C7F0096B046040',
                                    vcValue: '100000',
                                    usde: '3',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '9F98000CCEA2B42961FE59E65C533564',
                                    vcValue: '250000',
                                    usde: '5',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '7F0715CCA63304B3467B50FD9C3863DA',
                                    vcValue: '600000',
                                    usde: '10',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'BAB1092BAB181C2D72AC8EA1C61447C1',
                                    vcValue: '1500000',
                                    usde: '20',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'D1A17327C6DF061366A51A2C356C8B75',
                                    vcValue: '4250000',
                                    usde: '50',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '2CE80BF08D93580C06383437155F66CD',
                                    vcValue: '10000000',
                                    usde: '100',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '3B3AE867FE5E4670398E88598674581C',
                                    vcValue: '1000000',
                                    usde: '0.008',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '2D92DD82C60598470C6170F9A18292DF',
                                    vcValue: '600000',
                                    usde: '9.99',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '3E10721F5E3A18B4DEA2AC20083DE1D8',
                                    vcValue: '1500000',
                                    usde: '17.995',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: '8DD18F886605A15CBD8CCD74A93B252C',
                                    vcValue: '4250000',
                                    usde: '44.495',
                                    cashTypeId: '0',
                                },
                            },
                        },
                        {
                            Pack: {
                                _attr: {
                                    id: 'DD65DCBD3294E7F31A6390799DDEF6F3',
                                    vcValue: '10000000',
                                    usde: '87.995',
                                    cashTypeId: '0',
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
export const getPackValueUSDEHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    res.send(createCashValueUSDResponseXML());
};
