// src/utils/s3Upload.js
// AWS S3 Upload Utility

const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

// Configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const storageProvider = (process.env.STORAGE_PROVIDER || 'local').toLowerCase();

const hasS3Config = () =>
  Boolean(
    process.env.AWS_ACCESS_KEY_ID &&
      process.env.AWS_SECRET_ACCESS_KEY &&
      process.env.AWS_S3_BUCKET
  );

const isLocalStorage = () => storageProvider === 'local' || !hasS3Config();

const getBaseUrl = () => {
  if (process.env.PUBLIC_FILE_BASE_URL) {
    return process.env.PUBLIC_FILE_BASE_URL;
  }

  if (process.env.API_URL) {
    return process.env.API_URL;
  }

  const host = process.env.HOST || 'localhost';
  const port = process.env.PORT || '5000';
  return `http://${host}:${port}`;
};

const uploadToLocal = async (fileBuffer, fileName, folder) => {
  const timestamp = Date.now();
  const ext = path.extname(fileName) || '.jpg';
  const uniqueFileName = `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
  const relativeKey = `${folder}/${uniqueFileName}`;
  const uploadRoot = path.resolve(__dirname, '../../uploads');
  const targetPath = path.join(uploadRoot, relativeKey);

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.promises.writeFile(targetPath, fileBuffer);

  return {
    url: `${getBaseUrl()}/uploads/${relativeKey}`,
    key: relativeKey,
    bucket: 'local',
    eTag: null,
    provider: 'local',
  };
};

/**
 * Upload image to S3 bucket
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {string} folder - Folder path in S3 (e.g., 'complaints', 'profiles')
 * @returns {Promise} - S3 file URL
 */
const uploadToS3 = async (fileBuffer, fileName, folder = 'complaints') => {
  if (isLocalStorage()) {
    return uploadToLocal(fileBuffer, fileName, folder);
  }

  try {
    // Generate unique file name
    const timestamp = Date.now();
    const ext = path.extname(fileName);
    const uniqueFileName = `${timestamp}-${Math.random().toString(36).substring(7)}${ext}`;
    const s3Key = `${folder}/${uniqueFileName}`;

    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'smart-garbage-images',
      Key: s3Key,
      Body: fileBuffer,
      ContentType: getContentType(fileName),
      ACL: 'public-read', // Make file publicly readable
      Metadata: {
        uploadedAt: new Date().toISOString(),
      },
    };

    const data = await s3.upload(params).promise();

    return {
      url: data.Location,
      key: s3Key,
      bucket: data.Bucket,
      eTag: data.ETag,
    };
  } catch (error) {
    throw new Error(`S3 upload failed: ${error.message}`);
  }
};

/**
 * Delete image from S3
 * @param {string} s3Key - S3 object key
 * @returns {Promise}
 */
const deleteFromS3 = async (s3Key) => {
  if (isLocalStorage()) {
    try {
      const uploadRoot = path.resolve(__dirname, '../../uploads');
      const targetPath = path.join(uploadRoot, s3Key);
      await fs.promises.unlink(targetPath);
      return { success: true };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { success: true };
      }
      throw new Error(`Local file deletion failed: ${error.message}`);
    }
  }

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'smart-garbage-images',
      Key: s3Key,
    };

    await s3.deleteObject(params).promise();
    return { success: true };
  } catch (error) {
    throw new Error(`S3 deletion failed: ${error.message}`);
  }
};

/**
 * Get MIME type from file extension
 * @param {string} fileName
 * @returns {string} - MIME type
 */
const getContentType = (fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.pdf': 'application/pdf',
  };

  return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * Generate signed URL for S3 object (useful for private files)
 * @param {string} s3Key - S3 object key
 * @param {number} expiresIn - URL expiry in seconds (default 3600)
 * @returns {string} - Signed URL
 */
const getSignedUrl = (s3Key, expiresIn = 3600) => {
  if (isLocalStorage()) {
    return `${getBaseUrl()}/uploads/${s3Key}`;
  }

  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET || 'smart-garbage-images',
      Key: s3Key,
      Expires: expiresIn,
    };

    return s3.getSignedUrl('getObject', params);
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3,
  getSignedUrl,
};
