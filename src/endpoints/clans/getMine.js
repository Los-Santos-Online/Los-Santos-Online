import xml from 'xml';
import { prisma } from '../../main.js';

function toUnixSeconds(date) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return Math.floor(d.getTime() / 1000).toString();
  } catch {
    return '0';
  }
}

function buildClanMembershipResponse({ status = 1, memberships = [] }) {
  return xml(
    [
      {
        Response: [
          {
            _attr: {
              'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
              'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
              xmlns: 'ClanMembershipResponse',
              ms: '10',
            },
          },
          { Status: status.toString() },
          {
            Memberships: [
              { _attr: { Count: memberships.length.toString(), MaxCount: memberships.length.toString() } },
              ...memberships.map((m) => ({
                Membership: [
                  {
                    _attr: {
                      Id: m.id.toString(),
                      IsPrimary: m.isPrimary ? 'true' : 'false',
                      JoinedTimePosix: m.joinedTimePosix,
                    },
                  },
                  {
                    Clan: [
                      {
                        _attr: {
                          Id: m.clan.id.toString(),
                          Name: m.clan.name ?? '',
                          Tag: m.clan.tag ?? '',
                          Motto: m.clan.motto ?? '',
                          IsSystemClan: m.clan.isSystemClan ? '1' : '0',
                          IsOpenClan: m.clan.isOpenClan ? '1' : '0',
                          CreatedTimePosix: toUnixSeconds(m.clan.createdAt),
                          MemberCount: (m.memberCount ?? 0).toString(),
                          Colors: m.clan.colors ?? '',
                          IsVerifiedClan: m.clan.isVerifiedClan ? '1' : '0',
                        },
                      },
                    ],
                  },
                  {
                    Rank: [
                      {
                        _attr: {
                          Id: m.rank.id.toString(),
                          Name: m.rank.name ?? '',
                          RankOrder: m.rank.rankOrder.toString(),
                          SystemFlags: (typeof m.rank.systemFlags === 'bigint'
                            ? m.rank.systemFlags.toString()
                            : (m.rank.systemFlags ?? '').toString()),
                        },
                      },
                    ],
                  },
                ],
              })),
            ],
          },
        ],
      },
    ],
    { declaration: true }
  );
}

export const getMineHandler = async (req, res) => {
  try {
    // Acquire user by ticket (consistent with other Clan routes)
    const user = await prisma.user.findFirst({
      where: { Ticket: req.body.ticket },
      select: {
        id: true,
        ClanTag: true,
        primaryClanId: true,
      },
    });

    if (!user) {
      res.status(404).send('User not found');
      return;
    }

    // Fetch memberships with related clan and rank
    const memberships = await prisma.clanMembership.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        clanId: true,
        joinedAt: true,
        clan: true,
        rank: true,
      },
    });

    // If none, return empty response
    if (!memberships || memberships.length === 0) {
      res.set('Content-Type', 'text/xml');
      res.send(buildClanMembershipResponse({ status: 1, memberships: [] }));
      return;
    }

    // Compute member counts per clan
    const uniqueClanIds = [...new Set(memberships.map((m) => m.clanId))];
    const counts = await Promise.all(
      uniqueClanIds.map((clanId) =>
        prisma.clanMembership.count({ where: { clanId } }).then((c) => ({ clanId, count: c }))
      )
    );
    const countMap = new Map(counts.map((c) => [c.clanId, c.count]));

    // Build payloads
    const payloadMemberships = memberships.map((m) => ({
      id: m.id,
      isPrimary: user.primaryClanId ? m.clanId === user.primaryClanId : false,
      joinedTimePosix: toUnixSeconds(m.joinedAt),
      clan: m.clan,
      memberCount: countMap.get(m.clanId) ?? 0,
      rank: m.rank,
    }));

    const xmlString = buildClanMembershipResponse({ status: 1, memberships: payloadMemberships });
    res.set('Content-Type', 'text/xml');
    console.log(xmlString)
    res.send(xmlString);
  } catch (err) {
    console.error('GetMine error:', err);
    res.status(500).send('Internal Server Error');
  }
};
