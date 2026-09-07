// ============================================================
// ACADIA — DÉTECTION DE TYPE DE FICHIER PAR SIGNATURE (MAGIC BYTES)
//
// Le type déclaré par le client (file.type / Content-Type du
// multipart) n'est jamais fiable — un appelant peut y mettre
// n'importe quelle valeur indépendamment du contenu réel envoyé.
// Ces vérifications inspectent les premiers octets réels du
// fichier, seule source fiable pour confirmer un format (voir
// audit sécurité — Section 8.1).
// ============================================================

export function isPng(buf: Buffer): boolean {
  return buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
}

export function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

export function isWebp(buf: Buffer): boolean {
  return buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP";
}

export function isAllowedImage(buf: Buffer): boolean {
  return isPng(buf) || isJpeg(buf) || isWebp(buf);
}

// DOCX (comme tout format Office Open XML) est une archive ZIP —
// signature "PK\x03\x04" (ou variantes PK\x05\x06 / PK\x07\x08 pour
// une archive vide/spannée, improbable ici mais couvert par sûreté).
export function isZipArchive(buf: Buffer): boolean {
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) return false;
  return (buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06) || (buf[2] === 0x07 && buf[3] === 0x08);
}
