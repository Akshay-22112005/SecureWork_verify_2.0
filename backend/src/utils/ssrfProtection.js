const dns = require('dns').promises;
const { URL } = require('url');
const { sha256 } = require('./crypto');
const { isExecutable } = require('./fileValidator');
const logger = require('./logger');
const { ValidationError } = require('./errors');

const MAX_RESPONSE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_TIMEOUT_MS = 5000; // 5 seconds
const MAX_REDIRECTS = 2;

/**
 * Determine if an IP address is private, loopback, link-local, or cloud metadata.
 * @param {string} ip - IPv4 or IPv6 address string
 * @returns {boolean} True if blocked
 */
function isPrivateOrBlockedIp(ip) {
  if (!ip || typeof ip !== 'string') return true;

  const cleanIp = ip.trim().toLowerCase();

  // 1. IPv6 Loopback and Link-local
  if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '::') return true;
  if (cleanIp.startsWith('fe80:') || cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd')) return true;

  // Handle IPv4-mapped IPv6 (::ffff:127.0.0.1)
  let ipv4 = cleanIp;
  if (cleanIp.startsWith('::ffff:')) {
    ipv4 = cleanIp.substring(7);
  }

  // IPv4 checks
  const parts = ipv4.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 127.0.0.0/8 (Loopback / Localhost)
    if (b0 === 127) return true;

    // 10.0.0.0/8 (Private RFC 1918)
    if (b0 === 10) return true;

    // 172.16.0.0/12 (Private RFC 1918: 172.16 - 172.31)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16 (Private RFC 1918)
    if (b0 === 192 && b1 === 168) return true;

    // 169.254.0.0/16 (Link-local & Cloud Metadata: 169.254.169.254)
    if (b0 === 169 && b1 === 254) return true;

    // 224.0.0.0/4 (Multicast) & 255.255.255.255 (Broadcast)
    if (b0 >= 224) return true;
  }

  return false;
}

/**
 * Validate a target URL for SSRF vulnerabilities:
 * 1. Enforces HTTPS only.
 * 2. Matches domain against trusted allowlist.
 * 3. Resolves DNS and blocks private/loopback/cloud metadata IP addresses.
 * @param {string} urlString
 * @param {string} allowedDomain
 * @returns {Promise<{ url: URL, resolvedIps: string[] }>}
 */
async function validateUrlForSsrf(urlString, allowedDomain) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new ValidationError('Invalid target URL provided for official source query', 'SSRF_INVALID_URL');
  }

  // 1. Enforce HTTPS only (Reject http, file, gopher, ftp)
  if (parsedUrl.protocol !== 'https:') {
    throw new ValidationError(
      `Insecure protocol "${parsedUrl.protocol}" rejected. Official source queries strictly enforce HTTPS-only.`,
      'SSRF_HTTPS_REQUIRED'
    );
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // 2. Reject raw IP hostnames or common metadata aliases
  if (hostname === 'localhost' || hostname === 'metadata.google.internal') {
    throw new ValidationError('Access to localhost or cloud metadata is strictly prohibited', 'SSRF_BLOCKED_HOST');
  }

  // 3. Domain Allowlist Check
  if (allowedDomain) {
    const cleanAllowed = allowedDomain.toLowerCase().trim();
    const isAllowed = hostname === cleanAllowed || hostname.endsWith(`.${cleanAllowed}`);
    if (!isAllowed) {
      throw new ValidationError(
        `Host "${hostname}" does not match trusted source domain "${allowedDomain}"`,
        'SSRF_DOMAIN_UNTRUSTED'
      );
    }
  }

  // 4. Safe DNS Resolution & IP Range Blocking
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch (err) {
    throw new ValidationError(`DNS resolution failed for host "${hostname}": ${err.message}`, 'SSRF_DNS_FAILED');
  }

  if (!records || records.length === 0) {
    throw new ValidationError(`No DNS records found for host "${hostname}"`, 'SSRF_DNS_FAILED');
  }

  const resolvedIps = records.map(r => r.address);

  // Check every resolved address against private/loopback/metadata rules
  for (const addr of resolvedIps) {
    if (isPrivateOrBlockedIp(addr)) {
      throw new ValidationError(
        `DNS resolution resolved to private/loopback/metadata IP address "${addr}". Query blocked for security.`,
        'SSRF_BLOCKED_IP'
      );
    }
  }

  return {
    url: parsedUrl,
    resolvedIps
  };
}

/**
 * Perform an SSRF-safe HTTPS retrieval with destination revalidation,
 * response size limits, executable blocking, and SHA-256 calculation.
 * @param {string} targetUrl
 * @param {object} options
 * @param {string} allowedDomain
 * @param {number} [redirectDepth=0]
 * @returns {Promise<{ status: number, body: Buffer, responseHash: string, contentType: string, url: string }>}
 */
async function safeFetch(targetUrl, options = {}, allowedDomain, redirectDepth = 0) {
  if (redirectDepth > MAX_REDIRECTS) {
    throw new ValidationError('Maximum redirect depth exceeded', 'SSRF_MAX_REDIRECTS');
  }

  const startTime = Date.now();

  // Step 1: Pre-flight SSRF Validation
  const { url: validatedUrl, resolvedIps } = await validateUrlForSsrf(targetUrl, allowedDomain);

  // Step 2: Timeout Configuration
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Step 3: Fetch with manual redirect handling
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'SecureWork-Verify-SourceVerifier/1.0',
        Accept: 'application/json, text/html, application/pdf',
        ...(options.headers || {})
      },
      signal: controller.signal,
      redirect: 'manual' // Prevent uninspected redirects
    };

    if (options.body) {
      fetchOptions.body = options.body;
    }

    const res = await fetch(validatedUrl.toString(), fetchOptions);

    // Step 4: Handle Redirects with Full Destination Revalidation
    if (res.status >= 300 && res.status < 400) {
      const redirectLocation = res.headers.get('location');
      if (!redirectLocation) {
        throw new ValidationError('Redirect response missing Location header', 'SSRF_REDIRECT_ERROR');
      }

      const nextUrl = new URL(redirectLocation, validatedUrl).toString();

      logger.info('Following verified source redirect', {
        from: targetUrl,
        to: nextUrl,
        depth: redirectDepth + 1
      });

      return safeFetch(nextUrl, options, allowedDomain, redirectDepth + 1);
    }

    // Step 5: Read Response with Maximum Size Limit Enforcement
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_RESPONSE_SIZE_BYTES) {
      throw new ValidationError(
        `Source response exceeds maximum permitted size of 5 MB (${buffer.length} bytes)`,
        'SSRF_RESPONSE_TOO_LARGE'
      );
    }

    // Step 6: Executable Blocking
    if (isExecutable(buffer)) {
      throw new ValidationError(
        'Source response contained prohibited executable binaries or scripts',
        'EXECUTABLE_PROHIBITED'
      );
    }

    // Step 7: Authoritative SHA-256 Calculation
    const responseHash = sha256(buffer);
    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const durationMs = Date.now() - startTime;

    // Step 8: Retrieval Audit Logging
    logger.info('Official source query completed successfully', {
      url: validatedUrl.toString(),
      domain: validatedUrl.hostname,
      resolvedIps,
      statusCode: res.status,
      sizeBytes: buffer.length,
      responseHash,
      durationMs
    });

    return {
      status: res.status,
      body: buffer,
      responseHash,
      contentType,
      url: validatedUrl.toString(),
      durationMs
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ValidationError(`Official source request timed out after ${timeoutMs}ms`, 'SOURCE_TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

module.exports = {
  isPrivateOrBlockedIp,
  validateUrlForSsrf,
  safeFetch,
  MAX_RESPONSE_SIZE_BYTES,
  DEFAULT_TIMEOUT_MS
};
