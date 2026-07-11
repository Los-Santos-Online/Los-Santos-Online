import xml from 'xml';
import { prisma } from '../../main.js';

function buildSetPrimaryClanResponse(status = 1) {
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
        ],
      },
    ],
    { declaration: true }
  );
}

export const setPrimaryClanHandler = async (req, res) => {
  try {
    const { ticket, clanId } = req.body || {};

    const user = await prisma.user.findFirst({
      where: { Ticket: ticket },
      select: { id: true },
    });

    if (!user) {
      res.status(404).send('User not found');
      return;
    }

    const id = Number.parseInt(clanId, 10);
    if (!Number.isFinite(id)) {
      res.status(400).send('Invalid clanId');
      return;
    }

    const membership = await prisma.clanMembership.findUnique({
      where: {
        userId_clanId: {
          userId: user.id,
          clanId: id,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      res.status(404).send('Membership not found');
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { primaryClanId: id },
    });

    res.set('Content-Type', 'text/xml');
    res.send(buildSetPrimaryClanResponse(1));
  } catch (error) {
    console.error('SetPrimaryClan error:', error);
    res.status(500).send('Internal Server Error');
  }
};
