// ============================================================
// ACADIA — STOCKAGE DE DOCUMENTS (P17)
//
// Aucun fournisseur cloud n'est configuré (confirmé par l'audit
// P16/P17). `LocalDevDocumentStorageProvider` est la seule
// implémentation active : elle écrit sous data/documents/ (jamais
// commité). Ne jamais prétendre qu'S3/R2/Supabase Storage est
// configuré tant qu'aucun identifiant réel n'est fourni — voir
// ACADIA_P17_PRODUCTION_ARCHITECTURE.md §9.
// ============================================================

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, statSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export interface DocumentMetadata {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DocumentStorageProvider {
  upload(input: { fileName: string; contentType: string; data: Buffer }): Promise<DocumentMetadata>;
  download(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<boolean>;
  getMetadata(id: string): Promise<DocumentMetadata | null>;
  /**
   * URL signée temporaire — non applicable au fournisseur de
   * développement (retourne null) : un fournisseur cloud réel
   * (S3/R2/Supabase Storage) devra l'implémenter réellement.
   */
  getSignedUrl(id: string): Promise<string | null>;
}

const DOCS_DIR = path.join(process.cwd(), "data", "documents");
const META_SUFFIX = ".meta.json";

function ensureDir(): void {
  if (!existsSync(DOCS_DIR)) mkdirSync(DOCS_DIR, { recursive: true });
}

class LocalDevDocumentStorageProvider implements DocumentStorageProvider {
  async upload(input: { fileName: string; contentType: string; data: Buffer }): Promise<DocumentMetadata> {
    ensureDir();
    const id = randomUUID();
    const meta: DocumentMetadata = {
      id,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.data.byteLength,
      createdAt: new Date().toISOString(),
    };
    writeFileSync(path.join(DOCS_DIR, id), input.data);
    writeFileSync(path.join(DOCS_DIR, `${id}${META_SUFFIX}`), JSON.stringify(meta, null, 2), "utf8");
    return meta;
  }

  async download(id: string): Promise<Buffer | null> {
    const filePath = path.join(DOCS_DIR, id);
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath);
  }

  async delete(id: string): Promise<boolean> {
    const filePath = path.join(DOCS_DIR, id);
    const metaPath = path.join(DOCS_DIR, `${id}${META_SUFFIX}`);
    if (!existsSync(filePath)) return false;
    unlinkSync(filePath);
    if (existsSync(metaPath)) unlinkSync(metaPath);
    return true;
  }

  async getMetadata(id: string): Promise<DocumentMetadata | null> {
    const metaPath = path.join(DOCS_DIR, `${id}${META_SUFFIX}`);
    if (!existsSync(metaPath)) {
      const filePath = path.join(DOCS_DIR, id);
      if (!existsSync(filePath)) return null;
      const stats = statSync(filePath);
      return { id, fileName: id, contentType: "application/octet-stream", sizeBytes: stats.size, createdAt: stats.birthtime.toISOString() };
    }
    return JSON.parse(readFileSync(metaPath, "utf8"));
  }

  async getSignedUrl(): Promise<string | null> {
    // Le fournisseur de développement local ne sert aucune URL
    // publique — un vrai fournisseur cloud le fera.
    return null;
  }
}

function resolveDocumentStorageProvider(): DocumentStorageProvider {
  // Activé UNIQUEMENT si STORAGE_PROVIDER="r2" et les 4 identifiants
  // R2 sont tous réellement renseignés (voir ACADIA_STORAGE_SETUP.md).
  // Sans cela, on retombe silencieusement sur le stockage local de
  // développement — jamais une fausse promesse de stockage cloud.
  if (process.env.STORAGE_PROVIDER === "r2") {
    const accountId = process.env.STORAGE_R2_ACCOUNT_ID;
    const bucket = process.env.STORAGE_BUCKET;
    const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
    const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

    if (accountId && bucket && accessKeyId && secretAccessKey) {
      // Import différé : évite de charger le SDK AWS quand R2 n'est pas utilisé.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { R2DocumentStorageProvider } = require("./R2DocumentStorageProvider") as typeof import("./R2DocumentStorageProvider");
      return new R2DocumentStorageProvider({ accountId, bucket, accessKeyId, secretAccessKey });
    }

    console.error(
      "[ACADIA] STORAGE_PROVIDER=\"r2\" mais un ou plusieurs identifiants R2 manquent (STORAGE_R2_ACCOUNT_ID/STORAGE_BUCKET/STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY) — repli sur le stockage local de développement."
    );
  }

  return new LocalDevDocumentStorageProvider();
}

export const documentStorageProvider: DocumentStorageProvider = resolveDocumentStorageProvider();
