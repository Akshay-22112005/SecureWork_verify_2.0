const zlib = require('zlib');
const logger = require('../../utils/logger');

/**
 * Offline, zero-dependency PDF text and embedded image extractor.
 * Handles:
 * - Uncompressed and FlateDecode compressed stream parsing
 * - Tj and TJ text operator decoding
 * - Hexadecimal string decoding (<48656c6c6f>)
 * - PDF escape sequences (\(, \), \\, \r, \n, \t, octal escapes)
 * - Extraction of embedded JPEG images (/DCTDecode) for OCR fallback on scanned PDFs
 * - PDF structure & metadata extraction (CreationDate, ModDate, Producer, Creator, trailer count)
 */

function decodePdfEscapes(str) {
  if (!str) return '';
  return str
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\r/g, '\r')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\([0-7]{1,3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function decodeHexString(hex) {
  const cleanHex = hex.replace(/\s+/g, '');
  const buf = Buffer.from(cleanHex.length % 2 !== 0 ? cleanHex + '0' : cleanHex, 'hex');
  return buf.toString('latin1');
}

/**
 * Extract direct text from PDF buffer.
 * @param {Buffer} buffer
 * @returns {{ text: string, embeddedImages: Buffer[], metadata: object }}
 */
function extractFromPdf(buffer) {
  if (!buffer || buffer.length < 5) {
    return { text: '', embeddedImages: [], metadata: {} };
  }

  const binary = buffer.toString('latin1');
  const extractedLines = [];
  const embeddedImages = [];
  const metadata = {};

  // 1. Extract metadata tags
  const titleMatch = binary.match(/\/Title\s*\(([^)]+)\)/i);
  if (titleMatch) metadata.title = decodePdfEscapes(titleMatch[1]);

  const authorMatch = binary.match(/\/Author\s*\(([^)]+)\)/i);
  if (authorMatch) metadata.author = decodePdfEscapes(authorMatch[1]);

  const creatorMatch = binary.match(/\/Creator\s*\(([^)]+)\)/i);
  if (creatorMatch) metadata.creator = decodePdfEscapes(creatorMatch[1]);

  const producerMatch = binary.match(/\/Producer\s*\(([^)]+)\)/i);
  if (producerMatch) metadata.producer = decodePdfEscapes(producerMatch[1]);

  const creationDateMatch = binary.match(/\/CreationDate\s*\(([^)]+)\)/i);
  if (creationDateMatch) metadata.creationDate = decodePdfEscapes(creationDateMatch[1]);

  const modDateMatch = binary.match(/\/ModDate\s*\(([^)]+)\)/i);
  if (modDateMatch) metadata.modDate = decodePdfEscapes(modDateMatch[1]);

  // Count trailer / xref instances (detect incremental updates)
  const trailerMatches = binary.match(/trailer\b/g);
  metadata.trailerCount = trailerMatches ? trailerMatches.length : 1;

  // 2. Parse Streams
  // Stream regex matching object header before stream
  const objStreamRegex = /<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = objStreamRegex.exec(binary)) !== null) {
    const dict = match[1];
    const streamRaw = match[2];
    let streamBytes = Buffer.from(streamRaw, 'latin1');

    // Check if stream is an embedded DCT (JPEG) image
    if (dict.includes('/DCTDecode') || (dict.includes('/Subtype') && dict.includes('/Image'))) {
      if (streamBytes.length > 500) {
        embeddedImages.push(streamBytes);
      }
    }

    // Try FlateDecode inflate
    if (dict.includes('/FlateDecode') || dict.includes('/Fl')) {
      try {
        streamBytes = zlib.inflateSync(streamBytes);
      } catch (err) {
        // Continue if inflate fails
      }
    }

    const streamStr = streamBytes.toString('latin1');

    // Extract text commands in BT ... ET blocks or standalone operators
    // Tj: (text) Tj
    const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(streamStr)) !== null) {
      const decoded = decodePdfEscapes(tjMatch[1]).trim();
      if (decoded) extractedLines.push(decoded);
    }

    // Hex strings: <48656c6c6f> Tj
    const hexTjRegex = /<([0-9a-fA-F\s]+)>\s*Tj/g;
    let hexMatch;
    while ((hexMatch = hexTjRegex.exec(streamStr)) !== null) {
      const decoded = decodeHexString(hexMatch[1]).trim();
      if (decoded) extractedLines.push(decoded);
    }

    // TJ: [(text) -10 (more)] TJ
    const tjArrayRegex = /\[([\s\S]*?)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayRegex.exec(streamStr)) !== null) {
      const innerContent = arrMatch[1];
      let lineParts = [];

      // match both (string) and <hex> elements
      const elementRegex = /\(((?:[^()\\]|\\.)*)\)|<([0-9a-fA-F\s]+)>/g;
      let elMatch;
      while ((elMatch = elementRegex.exec(innerContent)) !== null) {
        if (elMatch[1] !== undefined) {
          lineParts.push(decodePdfEscapes(elMatch[1]));
        } else if (elMatch[2] !== undefined) {
          lineParts.push(decodeHexString(elMatch[2]));
        }
      }

      const joined = lineParts.join('').trim();
      if (joined) extractedLines.push(joined);
    }
  }

  // Fallback: If objStreamRegex missed loose streams
  if (extractedLines.length === 0) {
    const looseStreamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let looseMatch;
    while ((looseMatch = looseStreamRegex.exec(binary)) !== null) {
      let streamBytes = Buffer.from(looseMatch[1], 'latin1');
      try {
        streamBytes = zlib.inflateSync(streamBytes);
      } catch {}
      const streamStr = streamBytes.toString('latin1');
      const tjRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
      let tjMatch;
      while ((tjMatch = tjRegex.exec(streamStr)) !== null) {
        const decoded = decodePdfEscapes(tjMatch[1]).trim();
        if (decoded) extractedLines.push(decoded);
      }
    }
  }

  const fullText = extractedLines.join('\n').trim();

  return {
    text: fullText,
    embeddedImages,
    metadata
  };
}

module.exports = {
  extractFromPdf
};
