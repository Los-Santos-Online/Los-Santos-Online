import crypto from 'crypto';
import fs from 'fs'; // Use all of fs for consistency
import path from 'path';
import { tmpdir } from 'os';
import { prisma } from '../../main.js';
import { execFileSync } from 'child_process';

// Cache for CA data
let cachedCAData = null;

function loadCAData() {
  if (cachedCAData) {
    return cachedCAData;
  }
  try {
    const caCertPath = path.join(process.cwd(), 'certs', 'p2p', 'ca-cert.pem');
    const caKeyPath = path.join(process.cwd(), 'certs', 'p2p', 'ca-key.pem');
    const caCertPem = fs.readFileSync(caCertPath, 'utf8');
    cachedCAData = {
      certificatePem: caCertPem,
      keyPath: caKeyPath,
      certPath: caCertPath
    };
    console.log('CA certificate loaded successfully');
    return cachedCAData;
  } catch (error) {
    console.error('Error loading CA data:', error);
    throw new Error('Failed to load CA certificate and key');
  }
}

/**
 * Converts a base64-encoded uncompressed EC public key to PEM format
 */
function convertPubKeyToPEM(base64Key) {
  const keyBytes = Buffer.from(base64Key, 'base64');

  const pubKeyASN1 = Buffer.concat([
    Buffer.from('3059' + // SEQUENCE
      '3013' + // SEQUENCE (AlgorithmIdentifier)
      '0607' + '2a8648ce3d0201' + // id-ecPublicKey
      '0608' + '2a8648ce3d030107', // prime256v1
      'hex'),
    Buffer.from('0342', 'hex'), // BIT STRING
    Buffer.from([0x00]), // 0 unused bits
    keyBytes
  ]);

  const base64 = pubKeyASN1.toString('base64').match(/.{1,64}/g).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${base64}\n-----END PUBLIC KEY-----`;
}

/**
 * Generates a certificate using OpenSSL
 */
function issueCertificate(pubKeyPem, commonName, SN, serialHex, caCertPath, caKeyPath) {
  const tmp = fs.mkdtempSync(path.join(tmpdir(), 'cert-'));
  try {
    const pubKeyPath = path.join(tmp, 'pub.pem');
    const dummyKeyPath = path.join(tmp, 'dummy.key');
    const csrPath = path.join(tmp, 'req.csr');
    const confPath = path.join(tmp, 'openssl.cnf');
    const certPath = path.join(tmp, 'cert.pem');

    // Write the public key
    fs.writeFileSync(pubKeyPath, pubKeyPem);
    const opensslVersion = execFileSync('openssl', ['version']).toString().trim();
    console.log('OpenSSL version:', opensslVersion);
    // Generate a dummy private key just for CSR generation
    execFileSync('openssl', ['ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', dummyKeyPath]);

    const safeSerialName = String(SN).replace(/[\r\n/]/g, '_');
    const safeCommonName = String(commonName).replace(/[\r\n/]/g, '_');

    // OpenSSL config for distinguished name
    fs.writeFileSync(confPath, `
  [req]
  distinguished_name=req_distinguished_name
  prompt=no

  [req_distinguished_name]
  SN=${safeSerialName}
  CN=prod.gta5.ps4.NP 2 ${safeCommonName}
  `.trim());

    // Generate dummy CSR using dummy key
    execFileSync('openssl', [
      'req', '-new', '-key', dummyKeyPath, '-out', csrPath, '-config', confPath,
      '-subj', `/SN=${safeSerialName}/CN=prod.gta5.ps4.NP 2 ${safeCommonName}`, '-nodes'
    ]);

    // Sign the CSR using the provided public key with -force_pubkey
    execFileSync('openssl', [
      'x509', '-req', '-in', csrPath, '-force_pubkey', pubKeyPath,
      '-CA', caCertPath, '-CAkey', caKeyPath, '-out', certPath,
      '-days', '1', '-sha256', '-set_serial', `0x${serialHex}`
    ]);

    return fs.readFileSync(certPath, 'utf8');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * HTTP handler for /createP2PCertificate
 */
export async function createP2PCertificateHandler(req, res) {
  try {
    console.log('P2P Certificate Request:', req.body);
    const { ticket, pubKey, sig } = req.body;

    const user = await prisma.user.findUnique({
      where: { Ticket: ticket }
    });

    if (!user) {
      res.statusCode = 400;
      return res.end('User not found');
    }
    if (!pubKey || !sig) {
      res.statusCode = 400;
      return res.end('Missing pubKey, sig, or username');
    }

    const pubKeyPem = convertPubKeyToPEM(pubKey);

    const serial = crypto.randomBytes(16).toString('hex');
    const caData = loadCAData();

    let accountId;
    let onlineId;
    if (user.blueSphereAccountId && user.blueSphereOnlineId) {
      accountId = user.blueSphereAccountId;
      onlineId = user.blueSphereOnlineId;
    } else {
      accountId = user.RockstarId;
      onlineId = user.PS4Username;
    }

    const clientCertPem = issueCertificate(pubKeyPem, accountId, onlineId, serial, caData.certPath, caData.keyPath);

        const xml = `<?xml version="1.0" encoding="utf-8"?>
    <Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ms="5">
      <Status>1</Status>
      <CertChain>${clientCertPem.trim()}\n${caData.certificatePem.trim()}</CertChain>
      <SecsUntilExpiration>86400</SecsUntilExpiration>
    </Response>`;


    console.log(xml);
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);

  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}

export async function createP2PCertificateCyprusHandler(req, res) {
  try {
    console.log('P2P Certificate Request:', req.body);

    const { rockstarId, username, pubKey, sig } = req.body;

    if (!rockstarId) {
      res.statusCode = 400;
      return res.end('User not found');
    }


    if (!pubKey || !sig) {
      res.statusCode = 400;
      return res.end('Missing pubKey, sig, or username');
    }

    const pubKeyPem = convertPubKeyToPEM(pubKey);

    const serial = crypto.randomBytes(16).toString('hex');
    const caData = loadCAData();
    const clientCertPem = issueCertificate(pubKeyPem, rockstarId, username, serial, caData.certPath, caData.keyPath);

        const xml = `<?xml version="1.0" encoding="utf-8"?>
    <Response xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ms="5">
      <Status>1</Status>
      <CertChain>${clientCertPem.trim()}\n${caData.certificatePem.trim()}</CertChain>
      <SecsUntilExpiration>86400</SecsUntilExpiration>
    </Response>`;


    console.log(xml);
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);

  } catch (err) {
    console.error(err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
}

