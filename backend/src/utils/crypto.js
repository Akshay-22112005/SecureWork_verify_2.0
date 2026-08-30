const crypto = require('crypto');

/**
 * Deterministic JSON Canonicalization (RFC 8785 subset)
 * Ensures reproducible SHA-256 hashes across platforms.
 */
function canonicalizeJson(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalizeJson).join(',')}]`;
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map(key => `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`);
  return `{${pairs.join(',')}}`;
}

/**
 * Compute SHA-256 hash of string, buffer, or object
 * @param {string | Buffer | object} data
 * @returns {string} Hex-encoded SHA-256 hash
 */
function sha256(data) {
  const hash = crypto.createHash('sha256');
  if (typeof data === 'object' && !Buffer.isBuffer(data)) {
    hash.update(canonicalizeJson(data), 'utf8');
  } else {
    hash.update(data);
  }
  return hash.digest('hex');
}

/**
 * Compute SHA-256 hash of a readable stream (e.g. file upload or storage stream)
 * @param {import('stream').Readable} readableStream
 * @returns {Promise<string>} Hex-encoded SHA-256 hash
 */
function sha256Stream(readableStream) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    readableStream.on('data', chunk => hash.update(chunk));
    readableStream.on('end', () => resolve(hash.digest('hex')));
    readableStream.on('error', err => reject(err));
  });
}

/**
 * Timing-safe buffer comparison to prevent timing attacks
 */
function timingSafeCompare(a, b) {
  try {
    const bufA = Buffer.isBuffer(a) ? a : Buffer.from(a, 'hex');
    const bufB = Buffer.isBuffer(b) ? b : Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Generate an Ed25519 asymmetric cryptographic keypair.
 * Uses Node.js built-in crypto.
 * @returns {{ publicKeyPem: string, privateKeyPem: string }}
 */
function generateEd25519KeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return {
    publicKeyPem: publicKey,
    privateKeyPem: privateKey
  };
}

/**
 * Sign data using an Ed25519 private key.
 * @param {string | Buffer | object} data - Payload to sign
 * @param {string} privateKeyPem - Private key in PKCS#8 PEM format
 * @param {'hex' | 'base64'} [encoding='hex'] - Output signature encoding
 * @returns {string} Digital signature
 */
function signEd25519(data, privateKeyPem, encoding = 'hex') {
  let dataBuffer;
  if (Buffer.isBuffer(data)) {
    dataBuffer = data;
  } else if (typeof data === 'object') {
    dataBuffer = Buffer.from(canonicalizeJson(data), 'utf8');
  } else {
    dataBuffer = Buffer.from(String(data), 'utf8');
  }

  const privateKey = crypto.createPrivateKey(privateKeyPem);
  // In Node.js Ed25519 signing, pass null as the algorithm parameter
  const signature = crypto.sign(null, dataBuffer, privateKey);
  return signature.toString(encoding);
}

/**
 * Verify an Ed25519 digital signature against data and public key.
 * @param {string | Buffer | object} data - Signed payload
 * @param {string} signature - Digital signature (hex or base64)
 * @param {string} publicKeyPem - Public key in SPKI PEM format
 * @param {'hex' | 'base64'} [encoding='hex'] - Signature encoding
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifyEd25519(data, signature, publicKeyPem, encoding = 'hex') {
  try {
    let dataBuffer;
    if (Buffer.isBuffer(data)) {
      dataBuffer = data;
    } else if (typeof data === 'object') {
      dataBuffer = Buffer.from(canonicalizeJson(data), 'utf8');
    } else {
      dataBuffer = Buffer.from(String(data), 'utf8');
    }

    const signatureBuffer = Buffer.from(signature, encoding);
    const publicKey = crypto.createPublicKey(publicKeyPem);
    // In Node.js Ed25519 verification, pass null as the algorithm parameter
    return crypto.verify(null, dataBuffer, publicKey, signatureBuffer);
  } catch {
    return false;
  }
}

module.exports = {
  canonicalizeJson,
  sha256,
  sha256Stream,
  timingSafeCompare,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519
};
