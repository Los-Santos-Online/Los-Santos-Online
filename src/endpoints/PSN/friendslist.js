
// GET /api/v1/users/:userId/friendList
export function getFriendsListHandler(req, res) {
    const { userId } = req.params;
    const { friendStatus, presenceType, presenceDetail, limit, sort } = req.query;

    console.log(`Fetching friends list for userId: ${userId}, friendStatus: ${friendStatus}, presenceType: ${presenceType}, presenceDetail: ${presenceDetail}, limit: ${limit}, sort: ${sort}`);



    const friendsListResponse = {
        friendList: [
            {
                user: {
                    onlineId: "TMPonPS4",
                    accountId: "4"
                },
                region: "us",
                npId: "TMPonPS4",
                presence: {
                    onlineStatus: "online",
                    platformInfoList: [
                        {
                            onlineStatus: "online",
                            platform: "PS4",
                            gameTitleInfo: {
                                npTitleId: "CUSA00419",
                                titleName: "Grand Theft Auto V"
                            },
                            gameStatus: "Playing Grand Theft Auto Online",
                            gameData: "",
                        }
                    ]
                }
            }
        ],
        start: 0,
        size: 1,
        totalResults: 1, // Total number of friends
    };
    
    res.json(friendsListResponse);
}