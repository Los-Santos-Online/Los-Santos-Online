import { prisma } from '../../main.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export function generateRandomShit(length) {
    const buffer = crypto.randomBytes(length);
    const ticket = buffer.toString('base64');
    return ticket;
}

export function generateRandomNumber(length) {
    const min = BigInt('1' + '0'.repeat(length - 1)); // Minimum number with 'length' digits
    const max = BigInt('9'.repeat(length)); // Maximum number with 'length' digits

    // Generate random BigInt within the range [min, max]
    const range = max - min;
    const rand = BigInt(Math.floor(Math.random() * Number(range))) + min;

    return rand;
}

export async function createAccountHandler(req, res) {
    try {
        const { email, password, nickname, avatarUrl } = req.body;
        const passwordHash = bcrypt.hashSync(password, 10);

        await prisma.user.create({
            data: {
                Nickname: nickname,
                AvatarUrl: avatarUrl,
                CountryCode: 'US',
                Email: email,
                Password: passwordHash,
                LanguageCode: 'en',
                SessionId: `${generateRandomNumber(19)}`,
                SessionKey: generateRandomShit(18),
                SessionTicket: generateRandomShit(60),
                Ticket: generateRandomShit(128),
                SCAuthToken: generateRandomShit(85),
                Age: 25,
            },
        });
        res.send(200);
    } catch (e) {
        //console.log(e);
    }
}
