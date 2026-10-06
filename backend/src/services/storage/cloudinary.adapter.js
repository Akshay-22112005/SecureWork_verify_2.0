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
    const ext = path.extname(originalFilename).toLowerCase() || '.bin';
    const publicId = `${this.folder}/${sha256Hash.slice(0, 16)}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: 'auto',
          type: 'authenticated', // Authenticated private delivery
          format: ext.replace(/^\./, '') || undefined,
          tags: ['securework_verify', 'document']
        },
        (error, result) => {
          if (error) {
            logger.error('Cloudinary upload error, falling back to local storage', { error: error.message });
            return this.fallbackAdapter.uploadFile(fileBuffer, originalFilename, mimeType)
              .then(resolve)
              .catch(reject);
          }

          resolve({
            storagePath: `cloudinary:${result.public_id}`,
            fileSize: result.bytes || fileSize,
            sha256Hash
          });
        }
      );

      uploadStream.end(fileBuffer);
    });
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

    const publicId = storagePath.replace(/^cloudinary:/, '');
    const signedUrl = this.getSignedUrl(publicId);

    const buffer = await this._downloadBuffer(signedUrl);
    return buffer;
  }

  /**
   * Generate an authenticated/signed private download URL.
   * @param {string} publicId
   * @param {number} [expiresInSeconds=3600]
   * @returns {string} Signed download URL
   */
  getSignedUrl(publicId, expiresInSeconds = 3600) {
    const cleanPublicId = publicId.replace(/^cloudinary:/, '');
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary.utils.private_download_url(cleanPublicId, '', {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt
    }) || cloudinary.url(cleanPublicId, {
      sign_url: true,
      type: 'authenticated',
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

    const publicId = storagePath.replace(/^cloudinary:/, '');
    try {
      const res = await cloudinary.uploader.destroy(publicId, {
        type: 'authenticated',
        resource_type: 'raw'
      });
      return res.result === 'ok';
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
    const tempFilePath = path.join(this.tempDir, `stream_${Date.now()}_${path.basename(storagePath)}`);
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
