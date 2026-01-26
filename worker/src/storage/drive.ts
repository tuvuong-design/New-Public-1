import fs from "node:fs";
import { google } from "googleapis";

export async function makeDriveClient(serviceAccountJson: string) {
  const creds = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({ credentials: creds, scopes: ["https://www.googleapis.com/auth/drive"] });
  const client = await auth.getClient();
  return google.drive({ version: "v3", auth: client });
}

export async function uploadFileToDrive(args: { drive: any; folderId: string; filePath: string; name: string; mimeType: string }) {
  const fileMetadata = { name: args.name, parents: [args.folderId] };
  const media = { mimeType: args.mimeType, body: fs.createReadStream(args.filePath) };
  const res = await args.drive.files.create({ requestBody: fileMetadata, media, fields: "id,name" });
  return res.data as { id: string; name: string };
}

export async function downloadFileFromDrive(args: { drive: any; fileId: string; destPath: string }) {
  const res = await args.drive.files.get({ fileId: args.fileId, alt: "media" }, { responseType: "stream" });
  const stream = res.data as any as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    const ws = fs.createWriteStream(args.destPath);
    stream.pipe(ws);
    stream.on("error", reject);
    ws.on("error", reject);
    ws.on("finish", () => resolve());
  });
}
