import { s3Client } from '../../main.js';
import { GetObjectCommand } from '@aws-sdk/client-s3';

/**
 * Handler for getting news images from S3
 * URL format: /cloud/11/cloudservices/global/news/image/{newsId}
 * S3 key format: /news/{newsId}/image
 * S3 bucket: losssantosonline-news
 */
export async function getNewsImageHandler(req, res) {
  try {
    const { newsId, imageName } = req.params;

    if (!newsId || !imageName) {
      return res.status(400).send('Missing news ID or image name');
    }

    // Construct S3 key
    const s3Key = `news/${newsId}/${imageName}`;

    // Fetch from S3
    const getCommand = new GetObjectCommand({
      Bucket: 'losssantosonline-news',
      Key: s3Key
    });

    const s3Response = await s3Client.send(getCommand);

    // Set appropriate content type (default to image/jpeg if not specified)
    const contentType = s3Response.ContentType || 'image/jpeg';
    res.setHeader('Content-Type', contentType);

    // Set content length if available
    if (s3Response.ContentLength) {
      res.setHeader('Content-Length', s3Response.ContentLength);
    }

    // Read the image data as a buffer
    const imageBuffer = await s3Response.Body.transformToByteArray();
    res.send(Buffer.from(imageBuffer));

  } catch (error) {
    console.error('Error fetching news image:', error);

    // If it's a NoSuchKey error, return 404
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      return res.status(404).send('Image not found');
    }

    res.status(500).send('Internal server error');
  }
}
