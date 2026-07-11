
import queryString from 'node:querystring';

export class UGCBinaryDecoder {
    constructor(buffer) {
        this.buffer = buffer;
    }

    decode() {
        // Find where the binary data starts (after &data=)
        const dataMarker = Buffer.from('&data=');
        const dataIndex = this.buffer.indexOf(dataMarker);

        if (dataIndex === -1) {
            throw new Error('No &data= marker found in buffer');
        }

        // Extract URL-encoded form data
        const paramBuffer = this.buffer.slice(0, dataIndex);
        const paramString = paramBuffer.toString('utf-8');
        const formData = queryString.parse(paramString);

        // Decode paramsJson if it exists
        if (formData.paramsJson) {
            try {
                formData.paramsJson = JSON.parse(decodeURIComponent(formData.paramsJson));
            } catch (error) {
                console.error('Failed to parse paramsJson:', error);
            }
        }

        // Extract files
        const files = [];
        let offset = dataIndex + dataMarker.length;

        while (offset < this.buffer.length - 8) {
            // Read fileSize (4 bytes, big-endian)
            const fileSize = this.buffer.readInt32BE(offset);
            offset += 4;

            // Read fileId (4 bytes, big-endian)
            const fileId = this.buffer.readInt32BE(offset);
            offset += 4;

            // Check if we have enough bytes for the file content
            if (offset + fileSize > this.buffer.length) {
                console.warn(`Not enough bytes for file. Expected ${fileSize}, available ${this.buffer.length - offset}`);
                break;
            }

            // Read file content
            const content = this.buffer.slice(offset, offset + fileSize);
            offset += fileSize;

            // Add file with metadata
            files.push({
                id: fileId,
                size: fileSize,
                data: content
            });
        }

        return {
            formData,
            files
        };
    }
}
