// ============================================================
// ACADIA — STOCKAGE DE DOCUMENTS : FOURNISSEUR CLOUDFLARE R2 (P18-FINAL)
//
// Implémentation réelle derrière l'interface DocumentStorageProvider
// (lib/server/documents/DocumentStorageProvider.ts) — R2 est
// compatible S3, on utilise donc le SDK AWS S3 officiel avec
// l'endpoint R2. Ce fichier est du CODE PRÊT, jamais activé tant que
// STORAGE_PROVIDER="r2" et les identifiants R2 ne sont pas fournis
// (voir resolveDocumentStorageProvider() dans DocumentStorageProvider.ts
// et ACADIA_STORAGE_SETUP.md pour la procédure d'activation).
//
// Aucun document n'est rendu public par défaut : getSignedUrl()
// génère une URL signée à expiration courte (1h), jamais un accès
// public permanent au bucket.
// ============================================================

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl as presign } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import type { DocumentMetadata, DocumentStorageProvider } from "./DocumentStorageProvider";

export interface R2Config {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

const METADATA_KEY_PREFIX = "meta:";

export class R2DocumentStorageProvider implements DocumentStorageProvider {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async upload(input: { fileName: string; contentType: string; data: Buffer }): Promise<DocumentMetadata> {
    const id = randomUUID();
    const meta: DocumentMetadata = {
      id,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.data.byteLength,
      createdAt: new Date().toISOString(),
    };

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: id,
        Body: input.data,
        ContentType: input.contentType,
        Metadata: { fileName: encodeURIComponent(input.fileName) },
      })
    );

    // Métadonnées stockées à part (objet JSON séparé) plutôt que devinées
    // depuis les en-têtes S3, pour rester strictement identiques au
    // contrat de LocalDevDocumentStorageProvider.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `${METADATA_KEY_PREFIX}${id}`,
        Body: JSON.stringify(meta),
        ContentType: "application/json",
      })
    );

    return meta;
  }

  async download(id: string): Promise<Buffer | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: id }));
      if (!res.Body) return null;
      const chunks: Uint8Array[] = [];
      // @ts-expect-error - Body est un stream Node dans le runtime S3Client Node.js
      for await (const chunk of res.Body) chunks.push(chunk);
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: id }));
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: `${METADATA_KEY_PREFIX}${id}` }));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(id: string): Promise<DocumentMetadata | null> {
    const buffer = await this.download(`${METADATA_KEY_PREFIX}${id}`);
    if (buffer) {
      try {
        return JSON.parse(buffer.toString("utf8"));
      } catch {
        // tombe au repli ci-dessous
      }
    }
    try {
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: id }));
      return {
        id,
        fileName: id,
        contentType: head.ContentType ?? "application/octet-stream",
        sizeBytes: head.ContentLength ?? 0,
        createdAt: head.LastModified?.toISOString() ?? new Date().toISOString(),
      };
    } catch {
      return null;
    }
  }

  async getSignedUrl(id: string): Promise<string | null> {
    try {
      return await presign(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: id }), { expiresIn: 3600 });
    } catch {
      return null;
    }
  }
}
