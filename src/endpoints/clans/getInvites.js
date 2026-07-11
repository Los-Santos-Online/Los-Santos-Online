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

function getDisplayName(user) {
  return (
    user?.blueSphereOnlineId
  );
}

function buildPlayerAttributes(user) {
  const rockstarId = user?.RockstarId ? user.RockstarId.toString() : '';
  return {
    Id: rockstarId,
    RockstarId: rockstarId,
    AccountId: rockstarId,
    Name: getDisplayName(user),
    CrewTag: user?.ClanTag ?? '',
    AvatarUrl: user?.NPAvatarUrl ?? '',
  };
}

function buildClanAttributes(clan, memberCount) {
  return {
    Id: clan.id.toString(),
    Name: clan.name ?? '',
    Tag: clan.tag ?? '',
    Motto: clan.motto ?? '',
    IsSystemClan: clan.isSystemClan ? '1' : '0',
    IsOpenClan: clan.isOpenClan ? '1' : '0',
    CreatedTimePosix: toUnixSeconds(clan.createdAt),
    MemberCount: (memberCount ?? 0).toString(),
    Colors: clan.colors ?? '',
    IsVerifiedClan: clan.isVerifiedClan ? '1' : '0',
  };
}

function buildClanInviteResponse({ status = 1, invites = [] }) {
  return xml(
    [
      {
        Response: [
          {
            _attr: {
              'xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
              'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
              xmlns: 'ClanInviteResponse',
              ms: '10',
            },
          },
          { Status: status.toString() },
          {
            Invites: [
              { _attr: { Count: invites.length.toString(), MaxCount: invites.length.toString() } },
              ...invites.map((invite) => ({
                Invite: [
                  {
                    _attr: {
                      Id: invite.id.toString(),
                      Message: invite.message ?? '',
                    },
                  },
                  { Inviter: [{ _attr: buildPlayerAttributes(invite.inviter) }] },
                  { Invitee: [{ _attr: buildPlayerAttributes(invite.invitee) }] },
                  { Clan: [{ _attr: buildClanAttributes(invite.clan, invite.memberCount) }] },
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

export const clanInvitesHandler = async (req, res) => {
  try {
    const { ticket } = req.body || {};
    const user = await prisma.user.findFirst({ where: { Ticket: ticket } });

    if (!user) {
      res.status(404).send('User not found');
      return;
    }

    const invites = await prisma.clanInvite.findMany({
      where: { inviteeId: user.id },
      include: {
        inviter: true,
        invitee: true,
        clan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!invites.length) {
      res.set('Content-Type', 'text/xml');
      res.send(buildClanInviteResponse({ status: 1, invites: [] }));
      return;
    }

    const uniqueClanIds = [...new Set(invites.map((invite) => invite.clanId))];
    const counts = await Promise.all(
      uniqueClanIds.map((clanId) =>
        prisma.clanMembership.count({ where: { clanId } }).then((count) => ({ clanId, count }))
      )
    );
    const countMap = new Map(counts.map((entry) => [entry.clanId, entry.count]));

    const payloadInvites = invites.map((invite) => ({
      ...invite,
      memberCount: countMap.get(invite.clanId) ?? 0,
    }));

    res.set('Content-Type', 'text/xml');
    res.send(buildClanInviteResponse({ status: 1, invites: payloadInvites }));
  } catch (error) {
    console.error('GetInvites error:', error);
    res.status(500).send('Internal Server Error');
  }
};
