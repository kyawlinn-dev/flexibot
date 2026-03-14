import { Storage } from "@google-cloud/storage";

const storage = new Storage();

export async function deleteFileFromGCS(gcsUri) {
  if (!gcsUri) return;

  const match = gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);

  if (!match) {
    throw new Error("Invalid GCS URI");
  }

  const bucketName = match[1];
  const filePath = match[2];

  const bucket = storage.bucket(bucketName);
  const file = bucket.file(filePath);

  await file.delete();

  console.log("Deleted from GCS:", gcsUri);
}