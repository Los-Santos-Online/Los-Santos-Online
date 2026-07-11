import crypto from 'crypto';
import CryptoJS from 'crypto-js';
import fs from 'fs';
import { RC4Jorby } from './rc4.js';

// Convert PLATFORM_KEY to an object mapping
const PLATFORM_KEYS = {
    XBOX360: 'C/FFY6D50f1j+m267/o9iVRYYRbp+m1HquNEOF5FzXQpZ+3XrPq24fre+6XLlF1vH8PUoCElN7KsMdOc7N8hvDg=',
    PS3: 'C4AaRpadRR2hApFvyl6fJDHShJIa/K76qSPt+2wTcox6C4Yn2X82ubbT79Rg/Ci2bTedR/1PzOaYMWM0TLT82m0=',
    PS4: 'C6i91R73oCD3qt1kUh0UIkDTu3Su5Qa7/r74q5ohUj1UxX/yQz7qB8a4y2TXfCMxqJo31tOPuZJMwG3jupDl7rs=',
    PCROS: 'C4pWJwWIKGUxcHd69eGl2AOwH2zrmzZAoQeHfQFcMelybd32QFw9s10px6k0o75XZeB5YsI9Q9TdeuRgdbvKsxc=',
    XBOXONE: 'CzNMuF1g9qTpMaAkczKPCFNicASIHUuvUw8932yltFRG3jfTB/t5OKaI3rDiuwVH35yMDfUmykmxxzEzXIDg44g=',
    PS5: 'C/Fy+j2heWO5DN+RPsxtLu48wf+B+vgtLGNpHY57leZG28I5Ier9QhjfrgYNk56Pv7y1mm7ungBC++aE0Du8JRM=',
};

export class RC4Decryptor {
    constructor(encryptedData, sessionKey = null, platform = 'PCROS') {
        this.encryptedData = encryptedData;
        this.blockSize = 1024;
        this.platformKey = Buffer.from(PLATFORM_KEYS[platform] || PLATFORM_KEYS.PC, 'base64');
        //Grab the slices of keys from the current platform key
        this.rc4key = this.platformKey.slice(1, 33);
        this.xorkey = this.platformKey.slice(33, 49);
        this.hashkey = this.platformKey.slice(49);
        //Then decrypt the keys so they are ready to be used later
        const decryptedXorKey = rc4(this.rc4key, this.xorkey);
        const decrypted_hashkey = rc4(this.rc4key, this.hashkey);
        this.xorkey = decryptedXorKey;
        this.hashkey = decrypted_hashkey;
        //If we have a session key prepare it
        if (sessionKey) {
            this.sessionKey = Buffer.from(sessionKey, 'base64');
        } else {
            this.sessionKey = Buffer.alloc(0);
        }
        //Read the plaintext data
        this.key = encryptedData.slice(0, 16);

        for (let i = 0; i < this.key.length; i++) {
            this.key[i] ^= this.xorkey[i];
        }

        //If we have the session key, xor the plain text key back to normal
        if (sessionKey) {
            for (let i = 0; i < this.key.length; i++) {
                this.key[i] ^= this.sessionKey[i];
            }
        }
    }

    decrypt() {
        let encryptedData = this.encryptedData.subarray(16, this.encryptedData.length - 20);
        const RC4 = new RC4Jorby(this.key);
        let decryptedData = RC4.decrypt(encryptedData);
        return decryptedData;
    }
}

function rc4(key, data) {
    let s = [],
        j = 0,
        x,
        res = Buffer.alloc(data.length);
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % key.length]) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
    }
    let i = 0;
    j = 0;
    for (let y = 0; y < data.length; y++) {
        i = (i + 1) % 256;
        j = (j + s[i]) % 256;
        x = s[i];
        s[i] = s[j];
        s[j] = x;
        res[y] = data[y] ^ s[(s[i] + s[j]) % 256];
    }
    return res;
}

export class RC4Encryptor {
    constructor(sessionKey = null, platform = 'PC') {
        this.platformKey = Buffer.from(PLATFORM_KEYS[platform] || PLATFORM_KEYS.PC, 'base64');
        this.rc4key = this.platformKey.slice(1, 33); //Also known as master key
        this.xorkey = this.platformKey.slice(33, 49); //Also known as key or http key
        this.hashkey = this.platformKey.slice(49); //Also known as salt
        let hasSecurity = false;

        if (sessionKey) {
            this.sessionKey = Buffer.from(sessionKey, 'base64');
        } else {
            //Make it but dont use it
            this.sessionKey = Buffer.alloc(0);
        }

        //Decrypt these so we can use them. These are decoded from platform key, as it encrypts them on the server/client side
        const decryptedXorKey = rc4(this.rc4key, this.xorkey);
        const decrypted_hashkey = rc4(this.rc4key, this.hashkey);
        this.xorkey = decryptedXorKey;
        this.hashkey = decrypted_hashkey;

        this.originalKey = Buffer.alloc(16); //Known as random key
        this.encryptedKey = Buffer.alloc(16); //Known as the key
        //We start by filling the data in the buffer with entropy
        for (let i = 0; i < this.originalKey.length; i++) {
            this.originalKey[i] = i + 1;
            this.encryptedKey[i] = i + 1;
        }

        //Get the encryption key for the RC4 Decryption
        for (let i = 0; i < this.encryptedKey.length; i++) {
            this.encryptedKey[i] ^= this.xorkey[i];
        }

        if (sessionKey) {
            for (let i = 0; i < this.encryptedKey.length; i++) {
                this.encryptedKey[i] ^= this.sessionKey[i];
            }
        }
    }

    encrypt(rawData) {
        //Maybe use a TextEncoder and see what happens?
        const rawDataBuffer = Buffer.from(rawData, 'utf-8');
        let fullBuffer = Buffer.alloc(0);
        fullBuffer = Buffer.concat([fullBuffer, this.encryptedKey]);

        const RC4 = new RC4Jorby(this.originalKey);
        const blockSize = 1024;
        //Then we need to add our block size
        let blockBuffer = Buffer.alloc(4); // Allocate 4 bytes (32 bits)
        blockBuffer.writeInt32BE(blockSize, 0); // Write integer in big-endian format
        const encryptedBlockBuffer = RC4.encrypt(blockBuffer);
        fullBuffer = Buffer.concat([fullBuffer, encryptedBlockBuffer]);
        //console.log('Buffer Size: ' + fullBuffer.length);
        //console.log(fullBuffer.slice(0, 20).toString('hex'));
        //This concludes our preamble
        //After we create our preamble we will encrypt our main data
        for (let i = 0; i < rawDataBuffer.length; i += blockSize) {
            let block;

            if (rawDataBuffer.length < blockSize) {
                block = rawDataBuffer.slice(i);
            } else {
                block = rawDataBuffer.slice(i, i + blockSize);
            }

            const encryptedBlock = RC4.encrypt(block);

            const hashed = crypto.createHash('sha1');
            hashed.update(encryptedBlock);
            hashed.update(this.hashkey);
            let tempBuffer = Buffer.alloc(0);
            // Append the sha1 hash to the encrypted data
            const sha1Hash = hashed.digest();
            tempBuffer = Buffer.concat([encryptedBlock, sha1Hash]);
            fullBuffer = Buffer.concat([fullBuffer, tempBuffer]);
        }
        return fullBuffer;
    }
}
