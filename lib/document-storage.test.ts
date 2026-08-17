import assert from "node:assert/strict";
import test from "node:test";
import { canUploadToCase, documentAccessWhere } from "./document-access";
import { storeDocumentWithRollback, type DocumentStorage } from "./document-storage";

function memoryStorage(options: { failStore?: boolean } = {}) {
  const objects = new Map<string, Buffer>();
  const storage: DocumentStorage = {
    async store(key, contents) { if (options.failStore) throw new Error("storage failed"); objects.set(key, contents); return { key }; },
    async read(key) { const body = objects.get(key); return body ? { body: new Blob([new Uint8Array(body)]) } : null; },
    async delete(key) { objects.delete(key); },
  };
  return { storage, objects };
}

test("client and assigned professional upload authorization is case-scoped", () => {
  assert.equal(canUploadToCase({ id: "client", role: "CLIENT" }, "client", "pro"), true);
  assert.equal(canUploadToCase({ id: "other-client", role: "CLIENT" }, "client", "pro"), false);
  assert.equal(canUploadToCase({ id: "pro", role: "PROFESSIONAL" }, "client", "pro"), true);
  assert.equal(canUploadToCase({ id: "other-pro", role: "PROFESSIONAL" }, "client", "pro"), false);
});

test("document reads retain client release and assigned-professional restrictions", () => {
  assert.deepEqual(documentAccessWhere("doc", { id: "client", role: "CLIENT" }), { id: "doc", case: { clientId: "client" }, OR: [{ folder: "CLIENT" }, { folder: "PROFESSIONAL", releasedToClientAt: { not: null } }] });
  assert.deepEqual(documentAccessWhere("doc", { id: "pro", role: "PROFESSIONAL" }), { id: "doc", case: { professional: { userId: "pro" } } });
});

test("storage failure does not run the database commit", async () => {
  const { storage } = memoryStorage({ failStore: true });
  let committed = false;
  await assert.rejects(storeDocumentWithRollback({ storage, key: "case/doc", contents: Buffer.from([1]), contentType: "text/plain", commit: async () => { committed = true; } }));
  assert.equal(committed, false);
});

test("database failure cleans up only the newly stored object", async () => {
  const { storage, objects } = memoryStorage();
  objects.set("unrelated", Buffer.from([9]));
  await assert.rejects(storeDocumentWithRollback({ storage, key: "case/new", contents: Buffer.from([1]), contentType: "text/plain", commit: async () => { throw new Error("db failed"); } }));
  assert.equal(objects.has("case/new"), false);
  assert.equal(objects.has("unrelated"), true);
});

test("unavailable historical objects return null without throwing", async () => {
  const { storage } = memoryStorage();
  assert.equal(await storage.read("historical/missing"), null);
});

test("successful upload preserves the stored key used with requirement evidence", async () => {
  const { storage } = memoryStorage();
  const evidence = await storeDocumentWithRollback({ storage, key: "case/required-doc", contents: Buffer.from([1]), contentType: "text/plain", commit: async (storedKey) => ({ requirementId: "requirement", uploadedById: "client", uploadActor: "CLIENT", storageKey: storedKey }) });
  assert.deepEqual(evidence, { requirementId: "requirement", uploadedById: "client", uploadActor: "CLIENT", storageKey: "case/required-doc" });
});
