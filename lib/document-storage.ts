import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

export type StoredDocument = { key: string };
export type StoredDocumentRead = { body: BodyInit; contentType?: string };

export interface DocumentStorage {
  store(key: string, contents: Buffer, contentType: string): Promise<StoredDocument>;
  read(key: string): Promise<StoredDocumentRead | null>;
  delete(key: string): Promise<void>;
}

function localPath(key: string) {
  const root = path.resolve(process.cwd(), ".private-uploads");
  const resolved = path.resolve(root, key);
  if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Invalid document storage key.");
  return resolved;
}

export const localDocumentStorage: DocumentStorage = {
  async store(key, contents) {
    const filePath = localPath(key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
    return { key };
  },
  async read(key) {
    try {
      const contents = await readFile(localPath(key));
      return { body: new Blob([new Uint8Array(contents)]) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  },
  async delete(key) {
    try {
      await unlink(localPath(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  },
};

export const blobDocumentStorage: DocumentStorage = {
  async store(key, contents, contentType) {
    const result = await put(key, contents, { access: "private", addRandomSuffix: false, contentType });
    return { key: result.url };
  },
  async read(key) {
    // Historical local keys cannot exist in a Vercel function deployment.
    if (!/^https:\/\//i.test(key)) return null;
    try {
      const result = await get(key, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return { body: result.stream, contentType: result.blob.contentType };
    } catch (error) {
      if ((error as { name?: string }).name === "BlobNotFoundError") return null;
      throw error;
    }
  },
  async delete(key) {
    if (/^https:\/\//i.test(key)) await del(key);
  },
};

export function documentStorage() {
  const production = Boolean(process.env.VERCEL);
  return {
    store: production ? blobDocumentStorage.store : localDocumentStorage.store,
    read(key: string) {
      if (/^https:\/\//i.test(key)) return blobDocumentStorage.read(key);
      return production ? Promise.resolve(null) : localDocumentStorage.read(key);
    },
    delete(key: string) {
      if (/^https:\/\//i.test(key)) return blobDocumentStorage.delete(key);
      return production ? Promise.resolve() : localDocumentStorage.delete(key);
    },
  } satisfies DocumentStorage;
}

export async function storeDocumentWithRollback<T>(input: {
  storage: DocumentStorage;
  key: string;
  contents: Buffer;
  contentType: string;
  commit: (storedKey: string) => Promise<T>;
}) {
  const stored = await input.storage.store(input.key, input.contents, input.contentType);
  try {
    return await input.commit(stored.key);
  } catch (error) {
    try {
      await input.storage.delete(stored.key);
    } catch {
      // Preserve the database error. Cleanup is best-effort and targets only this object.
    }
    throw error;
  }
}
