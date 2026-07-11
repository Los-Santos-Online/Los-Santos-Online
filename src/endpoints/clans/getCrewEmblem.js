import { GetObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { prisma, s3Client } from '../../main.js';

const EMBLEM_BUCKET = 'losssantosonline-news';
const MAX_EMBLEM_SIZE = 1024;

function normalizeKey(key) {
  if (!key) return '';
  return key.replace(/^\/+/, '');
}

function parseEmblemSize(rawSize) {
  const size = Number.parseInt(rawSize, 10);
  if (!Number.isFinite(size) || size <= 0 || size > MAX_EMBLEM_SIZE) {
    return null;
  }
  return size;
}

export async function getCrewEmblemHandler(req, res) {
  try {
    const { clanId, size } = req.params;
    const id = Number.parseInt(clanId, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).send('Invalid clan id');
    }

    const emblemSize = parseEmblemSize(size);
    if (!emblemSize) {
      return res.status(400).send('Invalid emblem size');
    }

    const clan = await prisma.clan.findUnique({
      where: { id },
      select: { clanEmblem: true },
    });

    const emblemKey = normalizeKey(clan?.clanEmblem || '');
    if (!emblemKey) {
      return res.status(404).send('Emblem not found');
    }

    const getCommand = new GetObjectCommand({
      Bucket: EMBLEM_BUCKET,
      Key: emblemKey,
    });

    const s3Response = await s3Client.send(getCommand);
    const imageBuffer = Buffer.from(await s3Response.Body.transformToByteArray());

    const resizedBuffer = await sharp(imageBuffer)
      .rotate()
      .resize(emblemSize, emblemSize, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .withMetadata({ density: 72 })
      .toBuffer();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Length', resizedBuffer.length);
    return res.send(resizedBuffer);
  } catch (error) {
    console.error('Error fetching crew emblem:', error);

    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') {
      return res.status(404).send('Emblem not found');
    }

    return res.status(500).send('Internal server error');
  }
}
