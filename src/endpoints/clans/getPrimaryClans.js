const response = xml([
    { _attr: { "xmlns:xsd": "http://www.w3.org/2001/XMLSchema", "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance", xmlns: "ClanMembershipResponse", ms: "10" }},
    { Status: 1 },
    { Members: [
        { _attr: { Count: "3", MaxCount: "3" }},
        { Membership: [
            { _attr: { Id: "245325077", IsPrimary: "true", JoinedTimePosix: "1679776838" }},
            { Clan: [
                { _attr: {
                    Id: "68330145", Name: "LSO", Tag: "LSO", Motto: "LSO", IsSystemClan: "1",
                    IsOpenClan: "0", CreatedTimePosix: "1679776207", MemberCount: "",
                    Colors: "Black", IsVerifiedClan: "1"
                  }}
              ]},
            { Rank: [
                { _attr: { Id: "115134229", Name: "Leader", RankOrder: "0", SystemFlags: "9223372036854775807" }}
              ]}
          ]}
      ]}
]);


async function getPrimaryClansHandler(req, res){
    
}