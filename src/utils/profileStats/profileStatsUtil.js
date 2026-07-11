import { inflateRawSync } from 'node:zlib';
import ByteBuffer from 'bytebuffer';
const RL_PROFILESTATS_TYPE_FLOAT = 3;
const RL_PROFILESTATS_TYPE_INT32 = 4;
const RL_PROFILESTATS_TYPE_INT64 = 0;
const RL_PROFILESTATS_TYPE_INVALID = null;

const StatTypes = {
    STAT_TYPE_NONE: 0,
    STAT_TYPE_INT: 1,
    STAT_TYPE_FLOAT: 2,
    STAT_TYPE_STRING: 3,
    STAT_TYPE_BOOLEAN: 4,
    STAT_TYPE_UINT8: 5,
    STAT_TYPE_UINT16: 6,
    STAT_TYPE_UINT32: 7,
    STAT_TYPE_UINT64: 8,
    STAT_TYPE_TIME: 9,
    STAT_TYPE_CASH: 10,
    STAT_TYPE_PERCENT: 11,
    STAT_TYPE_DEGREES: 12,
    STAT_TYPE_WEIGHT: 13,
    STAT_TYPE_MILES: 14,
    STAT_TYPE_METERS: 15,
    STAT_TYPE_FEET: 16,
    STAT_TYPE_SECONDS: 17,
    STAT_TYPE_CHART: 18,
    STAT_TYPE_VELOCITY: 19,
    STAT_TYPE_DATE: 20,
    STAT_TYPE_POS: 21,
    STAT_TYPE_TEXTLABEL: 22,
    STAT_TYPE_PACKED: 23,
    STAT_TYPE_USERID: 24,
    STAT_TYPE_PROFILE_SETTING: 25,
    STAT_TYPE_INT64: 26,
    MAX_STAT_TYPE: 27,
};

export function getExpectedProfileStatType(type) {
    const RL_PROFILESTATS_TYPE_FLOAT = 3;
    const RL_PROFILESTATS_TYPE_INT32 = 4;
    const RL_PROFILESTATS_TYPE_INT64 = 0;
    const RL_PROFILESTATS_TYPE_INVALID = null;

    switch (type) {
        case StatTypes.STAT_TYPE_INT:
        case StatTypes.STAT_TYPE_TIME:
        case StatTypes.STAT_TYPE_CASH:
        case StatTypes.STAT_TYPE_PERCENT:
        case StatTypes.STAT_TYPE_DEGREES:
        case StatTypes.STAT_TYPE_WEIGHT:
        case StatTypes.STAT_TYPE_MILES:
        case StatTypes.STAT_TYPE_METERS:
        case StatTypes.STAT_TYPE_FEET:
        case StatTypes.STAT_TYPE_SECONDS:
        case StatTypes.STAT_TYPE_CHART:
        case StatTypes.STAT_TYPE_VELOCITY:
        case StatTypes.STAT_TYPE_TEXTLABEL:
        case StatTypes.STAT_TYPE_BOOLEAN:
        case StatTypes.STAT_TYPE_UINT8:
        case StatTypes.STAT_TYPE_UINT16:
        case StatTypes.STAT_TYPE_PROFILE_SETTING:
            return RL_PROFILESTATS_TYPE_INT32;

        case StatTypes.STAT_TYPE_UINT32:
        case StatTypes.STAT_TYPE_UINT64:
        case StatTypes.STAT_TYPE_DATE:
        case StatTypes.STAT_TYPE_POS:
        case StatTypes.STAT_TYPE_PACKED:
        case StatTypes.STAT_TYPE_USERID:
        case StatTypes.STAT_TYPE_INT64:
            return RL_PROFILESTATS_TYPE_INT64;

        case StatTypes.STAT_TYPE_FLOAT:
            return RL_PROFILESTATS_TYPE_FLOAT;

        case StatTypes.STAT_TYPE_STRING:
        default:
            //console.log(`Unknown stat type: ${type}`)
            //console.error('Strings are not supported by profile stats.');
            return RL_PROFILESTATS_TYPE_INVALID;
    }
}


function convertArrayToHashmap(array) {
    const hashmap = {};
    for (const item of array) {
        const key = item.statId;
        hashmap[key] = item;
    }
    return hashmap;
}

export function decompressStats(inputBuffer) {
    const buffer = Buffer.from(inputBuffer, 'hex');
    const decompressedBuffer = inflateRawSync(inputBuffer.slice(1));
    return decompressedBuffer;
}

export function decompressStats2(inputBuffer) {
    return Buffer.from(inputBuffer, 'hex');
}

export class ReadByTypeStatsParser {
    constructor(base64String) {
        this.byteBuffer = ByteBuffer.wrap(base64String, 'base64');
    }

    readBigInt(count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const statId = this.byteBuffer.readUint32();
            const value = this.byteBuffer.readInt64();
            results.push({ statId, type: RL_PROFILESTATS_TYPE_INT64,  value });
        }
        return results;
    }

    readInt(count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const statId = this.byteBuffer.readUint32();
            const value = this.byteBuffer.readInt32();
            results.push({ statId, type: RL_PROFILESTATS_TYPE_INT32, value });
        }
        return results;
    }

    readFloats(count) {
        const results = [];
        for (let i = 0; i < count; i++) {
            const statId = this.byteBuffer.readUint32();
            const value = this.byteBuffer.readFloat();
            results.push({ statId, type: RL_PROFILESTATS_TYPE_FLOAT, value });
        }
        //console.log("Remaining Bytes: " + this.byteBuffer.remaining())
        return results;
    }
}


export class StatsIdsParser {
    constructor(base64String) {
        this.byteBuffer = ByteBuffer.wrap(base64String, 'base64');
    }

    readStatsIds() {
        const stats = [];
        while (this.byteBuffer.remaining() >= 4) {
            // Minimum bytes to read: 4 for ID + 1 for type
            const statId = this.byteBuffer.readUInt32();
            stats.push(statId);
        }
        return stats;
    }

}

export class StatsParser {
    constructor(base64String) {
        // Convert base64 to buffer and create DataView
        const buffer = Buffer.from(base64String, 'base64');
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        this.offset = 0;
    }

    readStat() {
        // Ensure we have enough bytes to read the header (4 bytes for ID + 1 for type)
        if (this.offset + 5 > this.view.byteLength) {
            return null;
        }

        // Read statId and type in big-endian format
        const statId = this.view.getUint32(this.offset, false);
        this.offset += 4;
        const type = this.view.getInt8(this.offset);
        this.offset += 1;

        let value;
        try {
            switch (type) {
                case RL_PROFILESTATS_TYPE_FLOAT:
                    if (this.offset + 4 > this.view.byteLength) throw new Error('Not enough bytes for float');
                    value = this.view.getFloat32(this.offset, false);
                    this.offset += 4;
                    break;
                case RL_PROFILESTATS_TYPE_INT32:
                    if (this.offset + 4 > this.view.byteLength) throw new Error('Not enough bytes for int32');
                    value = this.view.getInt32(this.offset, false);
                    this.offset += 4;
                    break;
                case RL_PROFILESTATS_TYPE_INT64:
                    if (this.offset + 8 > this.view.byteLength) throw new Error('Not enough bytes for int64');
                    value = this.view.getBigInt64(this.offset, false);
                    this.offset += 8;
                    break;
                default:
                    throw new Error(`Unknown data type: ${type} at offset: ${this.offset}`);
            }
        } catch (error) {
            throw new Error(`Failed to read value: ${error.message}`);
        }

        return { statId, type, value };
    }

    readStats() {
        const stats = [];
        try {
            while (this.offset < this.view.byteLength) {
                const stat = this.readStat();
                if (!stat) break;
                stats.push(stat);
            }
            return stats;
        } catch (error) {
            console.error('Error parsing stats:', error);
            throw error;
        }
    }

    readStatsAsHashMap() {
        try {
            const stats = this.readStats();
            return convertArrayToHashmap(stats);
        } catch (error) {
            console.error('Error creating stats hashmap:', error);
            throw error;
        }
    }
}

export class PackedStatsParser {
    constructor(buffer) {
        if (buffer instanceof Buffer) {
            this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else if (buffer instanceof ArrayBuffer) {
            this.view = new DataView(buffer);
        } else if (buffer instanceof Uint8Array) {
            this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        } else {
            throw new Error('Invalid buffer type. Expected Buffer, ArrayBuffer, or Uint8Array');
        }
        this.offset = 0;
    }

    readTypeHeader() {
        // Read the three 16-bit count values in big-endian order (NtoB in C++)
        const int64Count = this.view.getInt16(this.offset, false);  // false = big endian
        this.offset += 2;
        const int32Count = this.view.getInt16(this.offset, false);
        this.offset += 2;
        const floatCount = this.view.getInt16(this.offset, false);
        this.offset += 2;

        return { int64Count, int32Count, floatCount };
    }

    readStat(type) {
        // Read statId in big-endian format (NtoB in C++)
        const statId = this.view.getUint32(this.offset, false);  // false = big endian
        this.offset += 4;

        let value;
        switch (type) {
            case RL_PROFILESTATS_TYPE_INT64:
                value = this.view.getBigInt64(this.offset, false);
                this.offset += 8;
                break;
            case RL_PROFILESTATS_TYPE_INT32:
                value = this.view.getInt32(this.offset, false);
                this.offset += 4;
                break;
            case RL_PROFILESTATS_TYPE_FLOAT:
                value = this.view.getFloat32(this.offset, false);
                this.offset += 4;
                break;
            default:
                throw new Error(`Unknown data type: ${type}`);
        }

        return { statId, type, value };
    }

    readStats() {
        const stats = [];
        try {
            const { int64Count, int32Count, floatCount } = this.readTypeHeader();

            // Read INT64 values
            for (let i = 0; i < int64Count; i++) {
                stats.push(this.readStat(RL_PROFILESTATS_TYPE_INT64));
            }

            // Read INT32 values
            for (let i = 0; i < int32Count; i++) {
                stats.push(this.readStat(RL_PROFILESTATS_TYPE_INT32));
            }

            // Read FLOAT values
            for (let i = 0; i < floatCount; i++) {
                stats.push(this.readStat(RL_PROFILESTATS_TYPE_FLOAT));
            }

            return stats;
        } catch (error) {
            console.error('Error parsing stats:', error);
            throw error;
        }
    }
}


export class StatsWriter {
    constructor() {
        this.buffer = Buffer.alloc(0);
    }

    writeStats(statsJSON) {
        let tempBuffer = Buffer.alloc(0);
        for (const stat of statsJSON) {
            let idBuffer = Buffer.alloc(4);
            idBuffer.writeUInt32BE(stat.statId >>> 0, 0);

            let typeBuffer = Buffer.alloc(1);
            typeBuffer.writeUInt8(stat.type, 0);

            let valueBuffer;
            switch (stat.type) {
                case RL_PROFILESTATS_TYPE_FLOAT:
                    valueBuffer = Buffer.alloc(4);
                    valueBuffer.writeFloatBE(stat.value, 0);
                    break;
                case RL_PROFILESTATS_TYPE_INT32:
                    valueBuffer = Buffer.alloc(4);
                    valueBuffer.writeInt32BE(stat.value, 0);
                    break;
                case RL_PROFILESTATS_TYPE_INT64:
                    valueBuffer = Buffer.alloc(8);
                    // Convert any INT64 value format to BigInt
                    const bigIntValue = this.toBigInt(stat.value);
                    valueBuffer.writeBigInt64BE(bigIntValue, 0);
                    break;
                case RL_PROFILESTATS_TYPE_INVALID:
                    continue;
                default:
                    throw new Error(`Unknown data type: ${stat.type}`);
            }

            tempBuffer = Buffer.concat([tempBuffer, idBuffer, typeBuffer, valueBuffer]);
        }

        this.buffer = tempBuffer;
        return this.buffer.toString('base64');
    }

    writeStatsOnlyValues(statsJSON) {
        let tempBuffer = Buffer.alloc(0);
        for (const stat of statsJSON) {
            let valueBuffer;
            let typeBuffer = Buffer.alloc(1);
            typeBuffer.writeUInt8(stat.type, 0);

            switch (stat.type) {
                case RL_PROFILESTATS_TYPE_FLOAT:
                    valueBuffer = Buffer.alloc(4);
                    valueBuffer.writeFloatBE(stat.value, 0);
                    break;
                case RL_PROFILESTATS_TYPE_INT32:
                    valueBuffer = Buffer.alloc(4);
                    valueBuffer.writeInt32BE(stat.value, 0);
                    break;
                case RL_PROFILESTATS_TYPE_INT64:
                    valueBuffer = Buffer.alloc(8);
                    const bigIntValue = this.toBigInt(stat.value);
                    valueBuffer.writeBigInt64BE(bigIntValue, 0);
                    break;
                default:
                    throw new Error(`Unknown data type: ${stat.type}`);
            }
            tempBuffer = Buffer.concat([tempBuffer, typeBuffer, valueBuffer]);
        }

        this.buffer = tempBuffer;
        return this.buffer.toString('base64');
    }

    toBigInt(value) {
        if (typeof value === 'bigint') {
            return value;
        }
        if (typeof value === 'number') {
            return BigInt(value);
        }
        if (typeof value === 'string') {
            return BigInt(value);
        }
        if (typeof value === 'object' && value !== null) {
            if ('low' in value && 'high' in value) {
                // Handle {low, high} format
                return (BigInt(value.high) << 32n) | (BigInt(value.low) & 0xFFFFFFFFn);
            }
            if ('toString' in value) {
                // Handle BigInt-like objects
                return BigInt(value.toString());
            }
        }
        throw new Error(`Cannot convert value to BigInt: ${value}`);
    }
}