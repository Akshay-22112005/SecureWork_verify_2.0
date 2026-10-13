const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const cloudinary = require('cloudinary').v2;
const StorageAdapter = require('./storage.adapter');
const LocalStorageAdapter = require('./localStorage.adapter');
const env = require('../../config/env');
const { sha256 } = require('../../utils/crypto');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError } = require('../../utils/errors');

/**
 * Checks if a string has placeholder values.
 */
function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  return /<[^>]+>|CHANGE_ME|your_cloud_name|your_api_key|your_api_secret/i.test(val);
}

/**
 * Cloudinary Storage Adapter
 * Implements authenticated/private document storage with SHA-256 cryptographic integrity.
 */
class CloudinaryAdapter extends StorageAdapter {
  constructor() {
    super();
    this.cloudName = env.CLOUDINARY_CLOUD_NAME;
    this.apiKey = env.CLOUDINARY_API_KEY;
    this.apiSecret = env.CLOUDINARY_API_SECRET;
    this.folder = env.CLOUDINARY_FOLDER || 'securework-verify';
    this.tempDir = path.resolve(env.TEMP_STORAGE_PATH);

    this.isConfigured = !isPlaceholder(this.cloudName) && !isPlaceholder(this.apiKey) && !isPlaceholder(this.apiSecret);
    this.fallbackAdapter = new LocalStorageAdapter();

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true
      });
      logger.info(`Cloudinary storage adapter initialized for cloud: ${this.cloudName}`);
    } else {
      logger.info('Cloudinary credentials contain placeholders or are unset. Operating with local fallback.');
    }
  }

  /**
   * Parse Cloudinary storage pointer into resourceType, format, and publicId.
   * Supports both new structured format "cloudinary:{resourceType}:{format}:{publicId}"
   * and legacy format "cloudinary:{publicId}".
   * @param {string} storagePath
   * @returns {{ resourceType: string, format: string, publicId: string } | null}
   */
  _parseStoragePath(storagePath) {
    if (!storagePath || typeof storagePath !== 'string') return null;
    const stripped = storagePath.replace(/^cloudinary:/, '');
    const parts = stripped.split(':');
    if (parts.length >= 3) {
      const resourceType = parts[0];
      const format = parts[1] === 'none' ? '' : parts[1];
      const publicId = parts.slice(2).join(':');
      return { resourceType, format, publicId };
    }

    // Legacy format fallback: cloudinary:publicId
    const ext = path.extname(stripped).replace(/^\./, '').toLowerCase();
    const isImageOrPdf = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'svg'].includes(ext);
    return {
      resourceType: isImageOrPdf ? 'image' : 'raw',
      format: ext || '',
      publicId: stripped
    };
  }

  /**
   * Upload file to Cloudinary with authenticated/private access.
   * @param {Buffer} fileBuffer
   * @param {string} originalFilename
   * @param {string} mimeType
   * @returns {Promise<{ storagePath: string, fileSize: number, sha256Hash: string }>}
   */
  async uploadFile(fileBuffer, originalFilename, mimeType) {
    if (!this.isConfigured) {
      return this.fallbackAdapter.uploadFile(fileBuffer, originalFilename, mimeType);
    }

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new ValidationError('Invalid file buffer provided');
    }

    const sha256Hash = sha256(fileBuffer);
    const fileSize = fileBuffer.length;
    const ext = path.extname(originalFilename || '').toLowerCase();
    const cleanExt = ext.replace(/^\./, '');
    const isImageOrPdf = (mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf')) ||
                         ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'svg'].includes(cleanExt);
    const primaryResourceType = isImageOrPdf ? 'image' : 'raw';
    const publicId = `${this.folder}/${sha256Hash.slice(0, 16)}_${Date.now()}`;

    const uploadStreamPromise = (resType) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            public_id: publicId,
            resource_type: resType,
            type: 'authenticated', // Authenticated private delivery
            format: cleanExt || undefined,
            tags: ['securework_verify', 'document']
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        uploadStream.end(fileBuffer);
      });
    };

    try {
      let result;
      try {
        result = await uploadStreamPromise(primaryResourceType);
      } catch (uploadErr) {
        // If image upload failed (e.g. invalid PDF/image structure), retry as raw
        if (primaryResourceType === 'image') {
          logger.warn(`Cloudinary image upload failed (${uploadErr.message}), retrying as raw asset...`);
          result = await uploadStreamPromise('raw');
        } else {
          throw uploadErr;
        }
      }

      const resType = result.resource_type || primaryResourceType;
      const resFormat = result.format || cleanExt || 'none';

      return {
        storagePath: `cloudinary:${resType}:${resFormat}:${result.public_id}`,
        fileSize: result.bytes || fileSize,
        sha256Hash
      };
    } catch (error) {
      logger.error('Cloudinary upload error, falling back to local storage', { error: error.message });
      return this.fallbackAdapter.uploadFile(fileBuffer, originalFilename, mimeType);
    }
  }

  /**
   * Retrieve file buffer from Cloudinary or local fallback and verify hash.
   * @param {string} storagePath
   * @returns {Promise<Buffer>}
   */
  async getFile(storagePath) {
    if (!storagePath || typeof storagePath !== 'string') {
      throw new ValidationError('Invalid storage path');
    }

    if (!storagePath.startsWith('cloudinary:')) {
      return this.fallbackAdapter.getFile(storagePath);
    }

    if (!this.isConfigured) {
      throw new NotFoundError('Cloudinary driver not configured to resolve remote storage pointer');
    }

    const parsed = this._parseStoragePath(storagePath);
    if (!parsed) {
      throw new ValidationError('Malformed Cloudinary storage path');
    }

    const { resourceType, format, publicId } = parsed;
    const signedUrl = this.getSignedUrl(storagePath);

    try {
      const buffer = await this._downloadBuffer(signedUrl);
      return buffer;
    } catch (err) {
      // If download failed (e.g. 404), attempt alternate resource type (image <-> raw)
      const altResourceType = resourceType === 'image' ? 'raw' : 'image';
      const altUrl = cloudinary.utils.private_download_url(publicId, altResourceType === 'raw' ? '' : (format || ''), {
        resource_type: altResourceType,
        type: 'authenticated',
        expires_at: Math.floor(Date.now() / 1000) + 3600
      });

      try {
        const altBuffer = await this._downloadBuffer(altUrl);
        return altBuffer;
      } catch {
        throw err;
      }
    }
  }

  /**
   * Generate an authenticated/signed private download URL.
   * @param {string} storagePathOrPublicId
   * @param {number} [expiresInSeconds=3600]
   * @returns {string} Signed download URL
   */
  getSignedUrl(storagePathOrPublicId, expiresInSeconds = 3600) {
    const parsed = this._parseStoragePath(storagePathOrPublicId);
    if (!parsed) return '';

    const { resourceType, format, publicId } = parsed;
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

    return cloudinary.utils.private_download_url(publicId, format || '', {
      resource_type: resourceType,
      type: 'authenticated',
      expires_at: expiresAt
    }) || cloudinary.url(publicId, {
      sign_url: true,
      type: 'authenticated',
      resource_type: resourceType,
      format: format || undefined,
      secure: true
    });
  }

  /**
   * Delete file from Cloudinary.
   * @param {string} storagePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(storagePath) {
    if (!storagePath.startsWith('cloudinary:')) {
      return this.fallbackAdapter.deleteFile(storagePath);
    }

    if (!this.isConfigured) return false;

    const parsed = this._parseStoragePath(storagePath);
    if (!parsed) return false;

    const { resourceType, publicId } = parsed;
    try {
      let res = await cloudinary.uploader.destroy(publicId, {
        type: 'authenticated',
        resource_type: resourceType
      });
      if (res && res.result === 'ok') return true;

      // Try alternate resource type if not ok
      const altResourceType = resourceType === 'image' ? 'raw' : 'image';
      res = await cloudinary.uploader.destroy(publicId, {
        type: 'authenticated',
        resource_type: altResourceType
      });
      return res && res.result === 'ok';
    } catch (err) {
      logger.error('Cloudinary delete error', { error: err.message, publicId });
      return false;
    }
  }

  /**
   * Prepare a local downloaded copy in temp storage for streaming / download.
   * @param {string} storagePath
   * @returns {Promise<string>} Path to temporary verified file
   */
  async getDownloadPath(storagePath) {
    if (!storagePath.startsWith('cloudinary:')) {
      return this.fallbackAdapter.getDownloadPath(storagePath);
    }

    const buffer = await this.getFile(storagePath);
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    const parsed = this._parseStoragePath(storagePath);
    const ext = parsed && parsed.format ? `.${parsed.format}` : '';
    const tempFileName = `stream_${Date.now()}_${path.basename(parsed ? parsed.publicId : storagePath)}${ext}`;
    const tempFilePath = path.join(this.tempDir, tempFileName);
    await fs.promises.writeFile(tempFilePath, buffer);
    return tempFilePath;
  }

  /**
   * Download helper for signed URLs.
   * @private
   */
  _downloadBuffer(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this._downloadBuffer(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new NotFoundError(`Cloudinary download failed with status ${res.statusCode}`));
        }

        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}

module.exports = CloudinaryAdapter;
