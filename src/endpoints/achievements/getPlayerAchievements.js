import xml from 'xml';

const achievements = [
    { Id: 1, DateAchieved: '2021-07-23T22:24:38.05', AchievedOffline: false },
    { Id: 2, DateAchieved: '2023-11-13T01:18:15.37', AchievedOffline: false },
    { Id: 6, DateAchieved: '2023-11-12T17:14:38.07', AchievedOffline: false },
    { Id: 14, DateAchieved: '2024-01-16T05:24:05.21', AchievedOffline: false },
    { Id: 17, DateAchieved: '2024-01-28T01:15:30.53', AchievedOffline: false },
    { Id: 22, DateAchieved: '2024-01-28T01:15:05.18', AchievedOffline: false },
    { Id: 27, DateAchieved: '2024-01-28T01:15:39.47', AchievedOffline: false },
    { Id: 33, DateAchieved: '2021-07-11T04:53:32.69', AchievedOffline: false },
    { Id: 34, DateAchieved: '2021-07-18T20:03:31.49', AchievedOffline: false },
    { Id: 35, DateAchieved: '2024-01-28T23:43:40.26', AchievedOffline: false },
    { Id: 41, DateAchieved: '2021-07-16T03:51:20.86', AchievedOffline: false },
    { Id: 46, DateAchieved: '2021-07-13T00:36:48.11', AchievedOffline: false },
    { Id: 48, DateAchieved: '2021-07-14T04:43:53.85', AchievedOffline: false },
    { Id: 50, DateAchieved: '2024-01-27T21:40:12.46', AchievedOffline: false },
    { Id: 51, DateAchieved: '2021-07-11T20:05:45.4', AchievedOffline: false },
    { Id: 54, DateAchieved: '2021-07-14T03:11:32.03', AchievedOffline: false },
];

function createAchievementsXML(achievements) {
    const xmlStructure = [
        {
            Response: [
                {
                    _attr: {
                        'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                        xmlns: 'PlayerAchievementsResponse',
                    },
                },
                { Status: '1' },
                {
                    AchievementList: [
                        { _attr: { Count: achievements.length.toString() } },
                        ...achievements.map((achievement) => ({
                            Achievement: [
                                {
                                    _attr: {
                                        Id: achievement.Id.toString(),
                                        DateAchieved: achievement.DateAchieved,
                                        AchievedOffline: achievement.AchievedOffline.toString(),
                                    },
                                },
                            ],
                        })),
                    ],
                },
            ],
        },
    ];

    return xml(xmlStructure, { declaration: true });
}

export const getPlayerAchievementsHandler = (req, res) => {
    res.set('Content-Type', 'text/xml');
    //console.log(createAchievementsXML(achievements));
    res.send(createAchievementsXML(achievements));
};
