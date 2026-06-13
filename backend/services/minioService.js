import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';

let minioClient = null;
let minioConfigured = null;

export function getMinioConfig() {
  const endpoint = process.env.MINIO_ENDPOINT;
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;
  const bucketName = process.env.MINIO_BUCKET || 'flowup-attachments';

  const isConfigured = !!(endpoint && accessKey && secretKey);
  return {
    endpoint,
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey,
    secretKey,
    bucketName,
    isConfigured
  };
}

export async function getMinioClient() {
  if (minioConfigured === false) return null;
  if (minioClient) return minioClient;

  const config = getMinioConfig();
  if (!config.isConfigured) {
    minioConfigured = false;
    return null;
  }

  try {
    // Lazy initialize the official MinIO client
    minioClient = new Minio.Client({
      endPoint: config.endpoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey
    });

    // Check / create bucket in the background/lazily
    const bucketExists = await minioClient.bucketExists(config.bucketName);
    if (!bucketExists) {
      console.log(`MinIO Bucket "${config.bucketName}" doesn't exist. Creating bucket...`);
      await minioClient.makeBucket(config.bucketName, 'us-east-1');
      console.log(`MinIO Bucket "${config.bucketName}" created successfully.`);
    }

    minioConfigured = true;
    console.log(`MinIO Client configured successfully on ${config.endpoint}:${config.port}`);
    return minioClient;
  } catch (error) {
    console.warn("MinIO Client initialization failed, falling back to local file storage. Reason:", error.message);
    minioConfigured = false;
    minioClient = null;
    return null;
  }
}

/**
 * Uploads a file (from Base64 or Buffer) to MinIO.
 * Fallback to local storage if MinIO is not configured or fails.
 */
export async function uploadAttachment(fileName, buffer, mimeType, UPLOADS_DIR) {
  const client = await getMinioClient();
  const config = getMinioConfig();

  const safeFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

  if (client && minioConfigured) {
    try {
      const metaData = {
        'Content-Type': mimeType || 'application/octet-stream',
        'X-Amz-Meta-OriginalName': fileName
      };

      // Upload buffer directly to MinIO bucket
      await client.putObject(config.bucketName, safeFileName, buffer, buffer.length, metaData);
      
      // Generate a temporary 7-day presigned URL for secure, direct download of docx, images, pdf etc.
      const url = await client.presignedGetObject(config.bucketName, safeFileName, 24 * 60 * 60 * 7); // 7 days expiry

      console.log(`Successfully uploaded "${fileName}" to MinIO. Presigned URL generated.`);
      return {
        name: fileName,
        url: url,
	storageType: 'minio',
	objectName: safeFileName,
        type: mimeType || 'application/octet-stream',
        size: buffer.length
      };
    } catch (err) {
      console.error("MinIO putObject failed, trying local disk fallback:", err.message);
    }
  }

  // Local storage fallback
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  const filePath = path.join(UPLOADS_DIR, safeFileName);
  fs.writeFileSync(filePath, buffer);

  return {
    name: fileName,
    url: `/api/uploads/${safeFileName}`,
    storageType: 'local',
    objectName: safeFileName,
    type: mimeType || 'application/octet-stream',
    size: buffer.length
  };
}
