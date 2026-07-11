import { RC4Decryptor, RC4Encryptor } from './GTAEncryption.js';
import queryString from 'node:querystring';
import { prisma } from '../../main.js';

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const rawIp = forwardedValue?.split(',')[0]?.trim() || req.ip || req.connection?.remoteAddress || '';
    if (!rawIp) {
        return '';
    }
    return rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
}

export function decodeUserAgent(str) {
    try {
        const PREFIX_STR = "ros ";
        
        // Verify prefix
        if (!str.toLowerCase().startsWith(PREFIX_STR)) {
            throw new Error(`Does not start with '${PREFIX_STR}': ${str}`);
        }

        // Get payload after prefix and trim whitespace
        let payload = str.substring(PREFIX_STR.length).trim();

        // Decode base64
        const decodedData = Buffer.from(payload, 'base64');
        const RANDOM_PREFIX_LEN = 4;

        // Deobfuscate the payload by XORing with the random prefix bytes
        for (let i = RANDOM_PREFIX_LEN; i < decodedData.length; i++) {
            decodedData[i] ^= decodedData[i % RANDOM_PREFIX_LEN];
        }

        // Get the KVP string after the random prefix
        const kvpStr = decodedData.slice(RANDOM_PREFIX_LEN).toString('utf-8');

        // Parse key-value pairs
        const result = {
            encryption: 0,
            titleName: "",
            platformName: "",
            version: 0,
            sessionId: 0,
            accountId: 0
        };
        // Split by comma and process each pair
        const pairs = kvpStr.split(',');
        for (const pair of pairs) {
            const [key, value] = pair.split('=').map(s => s.trim());
            
            switch (key.toLowerCase()) {
                case 'e':
                    result.encryption = parseInt(value);
                    break;
                case 't':
                    result.titleName = value;
                    break;
                case 'p':
                    result.platformName = value;
                    break;
                case 'v':
                    result.version = parseInt(value);
                    break;
                case 's':
                    result.sessionId = BigInt(value);
                    break;
                case 'a':
                    result.accountId = parseInt(value);
                    break;
                default:
                    console.warn(`Unhandled key in ROS user agent: '${key}'`);
            }
        }

        return result;
    } catch (error) {
        console.error('Failed to decode user agent:', error);
        return null;
    }
}

export function decryptEndpointMiddleware(req, res, next) {
    let dataChunks = [];
    req.on('data', (chunk) => {
        dataChunks.push(chunk);
    });
    
    req.on('end', async () => {
        try {
            if (req.method === 'POST') {
                const userAgentInfo = decodeUserAgent(req.headers['user-agent'] || '');
                const platform = userAgentInfo?.platformName?.toUpperCase();
                
                let sessionKey = null;
                if (req.headers['ros-sessionticket']) {
                    const user = await prisma.user.findUnique({
                        where: { SessionTicket: req.headers['ros-sessionticket'] },
                    });
                    if (user) sessionKey = user.SessionKey;
                }
                
                req.headers['SessionKey'] = sessionKey;
                req.headers['Platform'] = platform;
                req.headers['UserAgentInfo'] = userAgentInfo;
                
                const encryptedData = Buffer.concat(dataChunks);
                const decryptor = new RC4Decryptor(encryptedData, sessionKey, platform);
                const decryptedData = decryptor.decrypt();
                const newData = parseFormData(req.headers['content-type'], decryptedData);
                req.body = newData;
            }
            next();
        } catch (e) {
            next();
        }
    });
}

function parseWriteStatsFormData(rawBuffer) {
    const utf8String = rawBuffer.toString('utf-8');
    const pairs = utf8String.split('&');
    const data = {};

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const [key, value] = pair.split('=');
        if (key === 'data') {
            // Find the starting byte position of the value in the original buffer
            const dataIndex = utf8String.indexOf('data=');
            const dataValueIndex = utf8String.indexOf(pair) + key.length + 1;
            const startByte = Buffer.byteLength(utf8String.slice(0, dataValueIndex));
            // Extract the value as a buffer
            const binaryValue = rawBuffer.slice(startByte);
            // Convert the binary value to a hex string
            const hexString = binaryValue;
            data[key] = hexString;
            break; // Stop processing after 'data' key
        } else {
            data[key] = decodeURIComponent(value);
        }
    }
    return data;
}




export async function encryptDecryptMiddleware(req, res, next) {
    // Setup response encryption wrapper
    const oldSend = res.send;
    res.send = function (data) {
        const sessionKey = req.headers['SessionKey'];
        const platform = req.headers['Platform'];
        const encryptor = new RC4Encryptor(sessionKey, platform);
        const encryptedData = encryptor.encrypt(data);
        oldSend.call(this, encryptedData);
    };

    // Helper function to process user session and set headers
    async function processUserSession() {
        const userAgentInfo = decodeUserAgent(req.headers['user-agent'] || '');
        const platform = userAgentInfo?.platformName?.toUpperCase();

        let sessionKey = null;
        let user = null;

        if (req.headers['ros-sessionticket']) {
            user = await prisma.user.findUnique({
                where: {
                    SessionTicket: req.headers['ros-sessionticket'],
                },
            });

            // Check if user is banned
            if (user?.banned) {
                console.log(`${user.name} is banned and tried to connect`);
                res.status(404).end();
                return false; // Signal that request should stop
            }

            // Block specific IP prefixes without external channel notifications.
            const clientIp = getClientIp(req);
            const isBlockedPrefix = clientIp.startsWith('51.211') || clientIp.startsWith('169.148');
            if (isBlockedPrefix) {
                console.warn(`Blocked connection from IP ${clientIp}. User: ${user?.blueSphereOnlineId ?? 'unknown'}.`);
                res.status(404).end();
                return false;
            }

            // Update player activity for supported platforms
            if (user && (platform === 'PS4' || platform === 'PS5' || platform === 'XBOX360' || platform === 'PCROS' || platform === 'XBOXONE')) {
                await prisma.activePlayer.upsert({
                    where: {
                        RockstarId_platform: {
                            RockstarId: user.RockstarId,
                            platform: platform
                        }
                    },
                    update: {
                        lastSeen: new Date()
                    },
                    create: {
                        RockstarId: user.RockstarId,
                        platform: platform,
                        lastSeen: new Date()
                    }
                });
            }

            if (user) {
                const clientIp = getClientIp(req);
                if (clientIp) {
                    const now = new Date();
                    await prisma.userIPAddress.upsert({
                        where: {
                            userId_ipAddress: {
                                userId: user.id,
                                ipAddress: clientIp
                            }
                        },
                        update: {
                            blueSphereOnlineId: user.blueSphereOnlineId,
                            ipAddress: clientIp,
                            lastSeenAt: now
                        },
                        create: {
                            userId: user.id,
                            blueSphereOnlineId: user.blueSphereOnlineId,
                            ipAddress: clientIp,
                            lastSeenAt: now
                        }
                    });
                }
            }

            sessionKey = user?.SessionKey;
            req.headers['Ticket'] = user?.Ticket;
        }

        // Set headers for encryption and downstream handlers
        req.headers['SessionKey'] = sessionKey;
        req.headers['Platform'] = platform;
        req.headers['UserAgentInfo'] = userAgentInfo;

        return true; // Signal success
    }

    // Handle GET requests (no body to process)
    if (req.method === 'GET') {
        try {
            const success = await processUserSession();
            if (success) {
                next();
            }
        } catch (e) {
            console.log('Error in GET middleware:', e);
            next();
        }
        return;
    }

    // Handle POST requests (need to decrypt body)
    const dataChunks = [];
    req.on('data', (chunk) => {
        dataChunks.push(chunk);
    });

    req.on('end', async () => {
        try {
            const success = await processUserSession();
            if (!success) return; // User was banned or error occurred

            // Decrypt and parse body data
            const encryptedData = Buffer.concat(dataChunks);
            const decryptor = new RC4Decryptor(encryptedData, req.headers['SessionKey'], req.headers['Platform']);
            const decryptedData = decryptor.decrypt();
            req.headers['original-data'] = Buffer.from(decryptedData);
            const newData = parseFormData(req.headers['content-type'], decryptedData);

            req.body = newData;
            next();
        } catch (e) {
            console.log('Error in POST middleware:', e);
            next();
        }
    });
}

export function rawDataExtractor(rawBuffer) {
    const utf8String = rawBuffer.toString('utf-8');
    const pairs = utf8String.split('&');
    const data = {};

    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        const [key, value] = pair.split('=');
        if (key === 'data') {
            // Find the starting byte position of the value in the original buffer
            const dataIndex = utf8String.indexOf('data=');
            const dataValueIndex = utf8String.indexOf(pair) + key.length + 1;
            const startByte = Buffer.byteLength(utf8String.slice(0, dataValueIndex));
            // Extract the value as a buffer
            const binaryValue = rawBuffer.slice(startByte);
            // Convert the binary value to a hex string
            const hexString = binaryValue;
            data[key] = hexString;
            break; // Stop processing after 'data' key
        } else {
            data[key] = decodeURIComponent(value);
        }
    }
    return data;
}

/**
 * @function parseFormData - Parse the body of the request
 * @param contentType
 * @param buffer
 * @returns {ParsedUrlQuery|{filename: *, data: *, type: *}[]|any}
 */
function parseFormData(contentType, buffer) {
    switch (true) {
        case /application\/json/.test(contentType):
            return parseJsonFormData(buffer.toString('utf-8'));

        case /application\/x-www-form-urlencoded/.test(contentType):
            return parseUrlEncodedFormData(buffer.toString('utf-8'));

        case /multipart\/form-data/.test(contentType):
            // For multipart, we need to extract the boundary and pass the buffer
            const boundary = contentType.split('boundary=')[1];
            if (!boundary) {
                throw new Error('Boundary not found for multipart form data');
            }
            return parseMultipartFormData(buffer, boundary);

        default:
            throw new Error('Unsupported content type');
    }
}

// Function to find the index of a buffer within another buffer
function indexOf(buffer, search, start = 0) {
    for (let i = start; i <= buffer.length - search.length; i++) {
        let match = true;
        for (let j = 0; j < search.length; j++) {
            if (buffer[i + j] !== search[j]) {
                match = false;
                break;
            }
        }
        if (match) return i;
    }
    return -1;
}

// Parse headers into key-value pairs
function parseHeaders(headersBuffer) {
    const headers = {};
    const headerLines = headersBuffer.toString('utf8').split('\r\n');

    headerLines.forEach((line) => {
        const [name, value] = line.split(': ');
        if (name && value) {
            headers[name.toLowerCase()] = value;
        }
    });

    return headers;
}

// Parse multipart form data
function parseMultipartFormData(data, boundary) {
    const boundaryBuffer = Buffer.from(boundary);
    const boundaryLength = boundaryBuffer.length;
    const crlf = Buffer.from('\r\n');
    const crlfLength = crlf.length;

    // Parse headers into key-value pairs
    function parseHeaders(headersBuffer) {
        const headers = {};
        const headerLines = headersBuffer.toString('utf8').split('\r\n');

        headerLines.forEach((line) => {
            const [name, value] = line.split(': ');
            if (name && value) {
                headers[name.toLowerCase()] = value;
            }
        });

        return headers;
    }

    // Extract fields from Content-Disposition header
    function parseContentDisposition(contentDisposition) {
        const fields = {};
        const parts = contentDisposition.split(';');

        parts.forEach((part) => {
            const [key, value] = part.trim().split('=');
            if (key && value) {
                fields[key.toLowerCase()] = value.replace(/(^"|"$)/g, ''); // Remove surrounding quotes if present
            }
        });

        return fields;
    }

    let parts = [];
    let position = 0;

    while (position < data.length) {
        let boundaryIndex = indexOf(data, boundaryBuffer, position);
        if (boundaryIndex === -1) break;
        let nextBoundaryIndex = indexOf(data, boundaryBuffer, boundaryIndex + boundaryLength);

        if (nextBoundaryIndex === -1) nextBoundaryIndex = data.length;

        let partData = data.slice(boundaryIndex + boundaryLength + crlfLength, nextBoundaryIndex - crlfLength);

        let headersEndIndex = indexOf(partData, Buffer.from('\r\n\r\n'), 0);
        let headersBuffer = partData.slice(0, headersEndIndex);
        let headers = parseHeaders(headersBuffer);

        let body = partData.slice(headersEndIndex + 4, partData.length - 2);

        // Extract fields from Content-Disposition header if present
        if (headers['content-disposition']) {
            headers['content-disposition'] = parseContentDisposition(headers['content-disposition']);
        }
        parts.push({ headers, body });

        position = nextBoundaryIndex + boundaryLength + crlfLength;
    }
    return parts;
}

/**
 * @function parseUrlEncodedFormData - Parse URL Encoded Strings into JSON variables
 * @param inputString
 * @returns {ParsedUrlQuery}
 */
function parseUrlEncodedFormData(inputString) {
    if (!inputString) {
        throw new Error('Input string is required');
    }

    // Parse the URL-encoded string
    const parsedData = queryString.parse(inputString);
    return parsedData;
}

/**
 * @function parseUrlEncodedFormData - Parse JSON Forms
 * @param inputString
 * @returns {ParsedUrlQuery}
 */
function parseJsonFormData(inputString) {
    if (!inputString) {
        throw new Error('Input string is required');
    }
    try {
        const parsedData = JSON.parse(inputString);
        return parsedData;
    } catch (error) {
        throw new Error('Invalid JSON data: ' + error.message);
    }
}
