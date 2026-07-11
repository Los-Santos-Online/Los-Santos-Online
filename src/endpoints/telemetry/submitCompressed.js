import { inflateRawSync } from 'node:zlib';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { rawDataExtractor } from '../../utils/rc4Encryption/middleware.js';

export const submitCompressedHandler = async (req, res) => {
    try {
        // Decompress the zlib data
        const rawDataExtracted = rawDataExtractor(req.headers['original-data']);
        const decompressedBuffer = inflateRawSync(rawDataExtracted.data);
        const decompressedData = decompressedBuffer.toString();

        console.log(decompressedData);

        res.status(200).send('OK');
    } catch (e) {
        console.error('Error in submitCompressedHandler:', e);
        res.status(500).send('Internal Server Error');
    }
};
