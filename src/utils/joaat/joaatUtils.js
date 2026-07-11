export function multiStringJoaat(...args) {
    let hash = 0;
    for (const arg of args) {
        const k = arg.toLowerCase();
        for (let i = 0; i < k.length; i++) {
            hash += k.charCodeAt(i);
            hash += hash << 10;
            hash ^= hash >>> 6;
        }
    }
    hash += hash << 3;
    hash ^= hash >>> 11;
    hash += hash << 15;
    return hash >>> 0;
}