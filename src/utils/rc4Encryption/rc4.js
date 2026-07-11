export class RC4Jorby {
    constructor(key) {
        this.m_State = Array.from({ length: 256 }, (_, i) => i);
        this.m_X = 0;
        this.m_y = 0;

        let j = 0,
            x;
        for (let i = 0; i < 256; i++) {
            j = (j + this.m_State[i] + key[i % key.length]) % 256;
            x = this.m_State[i];
            this.m_State[i] = this.m_State[j];
            this.m_State[j] = x;
        }
    }

    encrypt(data) {
        let output = Buffer.alloc(data.length);
        for (let y = 0; y < data.length; y++) {
            this.m_X = (this.m_X + 1) % 256;
            this.m_y = (this.m_y + this.m_State[this.m_X]) % 256;
            let x = this.m_State[this.m_X];
            this.m_State[this.m_X] = this.m_State[this.m_y];
            this.m_State[this.m_y] = x;
            output[y] = data[y] ^ this.m_State[(this.m_State[this.m_X] + this.m_State[this.m_y]) % 256];
        }
        return output;
    }

    decrypt(data) {
        // Decryption is symmetric, use the same function
        return this.encrypt(data);
    }
}
