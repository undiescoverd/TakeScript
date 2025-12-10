/**
 * Cloudflare R2 Storage Utility
 *
 * Provides cheap, S3-compatible object storage for script content and versions.
 * R2 is ~$0.015/GB/month vs Convex $25/month for 8GB.
 * No egress fees - perfect for frequently accessed content.
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// R2 client configuration
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "takescript-content";

// R2 uses S3-compatible API
const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true, // R2 requires path-style URLs, not virtual-hosted style
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * Upload script content to R2
 * @param scriptId - Script ID to use as key
 * @param content - JSON stringified script content
 * @returns R2 URL reference
 */
export async function uploadScriptContent(scriptId: string, content: string): Promise<string> {
  const key = `scripts/${scriptId}/content.json`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: "application/json",
      Metadata: {
        scriptId,
        uploadedAt: new Date().toISOString(),
      },
    })
  );

  return `r2://${R2_BUCKET_NAME}/${key}`;
}

/**
 * Upload version snapshot to R2
 * @param scriptId - Script ID
 * @param versionNumber - Version number
 * @param content - JSON stringified version content
 * @returns R2 URL reference
 */
export async function uploadVersionContent(
  scriptId: string,
  versionNumber: number,
  content: string
): Promise<string> {
  const key = `scripts/${scriptId}/versions/${versionNumber}.json`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: content,
      ContentType: "application/json",
      Metadata: {
        scriptId,
        versionNumber: versionNumber.toString(),
        uploadedAt: new Date().toISOString(),
      },
    })
  );

  return `r2://${R2_BUCKET_NAME}/${key}`;
}

/**
 * Download content from R2
 * @param r2Url - R2 URL (r2://bucket/key)
 * @returns Content string
 */
export async function downloadContent(r2Url: string): Promise<string> {
  // Parse R2 URL: r2://bucket/key
  const match = r2Url.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid R2 URL: ${r2Url}`);
  }

  const [, bucket, key] = match;

  const response = await r2Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`No content found at ${r2Url}`);
  }

  // Convert stream to string
  return await response.Body.transformToString();
}

/**
 * Delete content from R2
 * @param r2Url - R2 URL (r2://bucket/key)
 */
export async function deleteContent(r2Url: string): Promise<void> {
  const match = r2Url.match(/^r2:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid R2 URL: ${r2Url}`);
  }

  const [, bucket, key] = match;

  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Delete all versions for a script (cleanup)
 * @param scriptId - Script ID
 */
export async function deleteScriptVersions(scriptId: string): Promise<void> {
  // Note: For production, you'd want to use ListObjectsV2 and batch delete
  // For now, this is a helper that individual version deletes will call
  // Actual deletion happens when version records are deleted from Convex
  console.log(`Cleanup marker for script ${scriptId} versions`);
}

/**
 * Health check - verify R2 is accessible
 */
export async function healthCheck(): Promise<boolean> {
  try {
    // Try to list bucket (minimal operation)
    await r2Client.send(
      new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: "_healthcheck", // Doesn't need to exist
      })
    );
    return true;
  } catch (error: any) {
    // NoSuchKey is expected and means bucket is accessible
    if (error.name === "NoSuchKey") {
      return true;
    }
    console.error("R2 health check failed:", error);
    return false;
  }
}
