import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export async function uploadBufferToGCS({ buffer, destination, mimetype }) {
  const bucketName = process.env.GCS_BUCKET_NAME;

  if (!bucketName) {
    throw new Error("GCS_BUCKET_NAME is not set.");
  }

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(destination);

  await file.save(buffer, {
    metadata: {
      contentType: mimetype || "application/octet-stream",
    },
    resumable: false,
    validation: false,
  });

  return {
    bucketName,
    gcsUri: `gs://${bucketName}/${destination}`,
    publicUrl: `https://storage.googleapis.com/${bucketName}/${destination}`,
  };
}