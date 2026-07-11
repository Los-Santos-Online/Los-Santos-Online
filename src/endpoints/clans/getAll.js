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

function buildClansResponse({ status = 1, clans = [] }) {
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
            Clans: [
              { _attr: { Count: clans.length.toString(), MaxCount: clans.length.toString() } },
              ...clans.map((c) => ({
                Clan: [
                  {
                    _attr: {
                      Id: c.id.toString(),
                      Name: c.name ?? '',
                      Tag: c.tag ?? '',
                      Motto: c.motto ?? '',
                      IsSystemClan: c.isSystemClan ? '0' : '0',
                      IsOpenClan: c.isOpenClan ? '1' : '0',
                      CreatedTimePosix: toUnixSeconds(c.createdAt),
                      MemberCount: (c.memberCount ?? 0).toString(),
                      Colors: c.colors ?? '',
                      IsVerifiedClan: c.isVerifiedClan ? '1' : '0',
                    },
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

export const getAllHandler = async (req, res) => {
  try {
    // Expecting: { ticket, clanId }
    const { ticket, clanId } = req.body || {};
    console.log(req.body);

    const user = await prisma.user.findFirst({ where: { Ticket: ticket } });
    if (!user) {
      res.status(404).send('User not found');
      return;
    }

    const id = parseInt(clanId, 10);
    if (!Number.isFinite(id)) {
      res.status(400).send('Invalid clanId');
      return;
    }

    const clan = await prisma.clan.findMany({})
    if (!clan) {
      res.set('Content-Type', 'text/xml');
      res.send(buildClansResponse({ status: 1, clans: [] }));
      return;
    }

    const memberCount = await prisma.clanMembership.count({ where: { clanId: id } });
    const xmlString = buildClansResponse({ status: 1, clans: [{ ...clan, memberCount }] });
    res.set('Content-Type', 'text/xml');
    res.send(xmlString);
  } catch (err) {
    console.error('GetDesc error:', err);
    res.status(500).send('Internal Server Error');
  }
};
