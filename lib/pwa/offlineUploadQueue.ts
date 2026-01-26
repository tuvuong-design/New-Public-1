// Task 10: Offline upload queue (MVP).
// We store File blobs in IndexedDB so user can enqueue uploads while offline.

export type OfflineUploadItem = {
  id: string;
  createdAt: number;
  filename: string;
  mimeType: string;
  size: number;
  title: string;
  description: string;
  isSensitive: boolean;
  access: "PUBLIC" | "PREMIUM_PLUS" | "PRIVATE";
  file: Blob;
};

const DB_NAME = "videoshare_offline";
const DB_VERSION = 1;
const STORE = "upload_queue";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueueOfflineUpload(input: Omit<OfflineUploadItem, "id" | "createdAt">) {
  const db = await openDb();
  const item: OfflineUploadItem = { ...input, id: id(), createdAt: Date.now() };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).put(item);
  });
  db.close();
  return item;
}

export async function listOfflineUploads(): Promise<OfflineUploadItem[]> {
  const db = await openDb();
  const items = await new Promise<OfflineUploadItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as OfflineUploadItem[]) ?? []);
  });
  db.close();
  return items.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOfflineUpload(itemId: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).delete(itemId);
  });
  db.close();
}

export async function clearOfflineUploads() {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(STORE).clear();
  });
  db.close();
}
