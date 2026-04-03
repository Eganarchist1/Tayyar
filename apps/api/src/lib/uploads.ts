import path from "path";

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".pdf": "application/pdf",
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "application/pdf": ".pdf",
};

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set(Object.keys(EXTENSION_BY_MIME_TYPE));

export function sanitizeUploadSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "file";
}

export function resolveUploadExtension(filename: string, mimetype: string) {
  const normalizedMimeType = mimetype.toLowerCase();
  const mimeExtension = EXTENSION_BY_MIME_TYPE[normalizedMimeType];
  if (mimeExtension) {
    return mimeExtension;
  }

  const fileExtension = path.extname(filename).toLowerCase();
  if (fileExtension && MIME_TYPE_BY_EXTENSION[fileExtension]) {
    return fileExtension;
  }

  return ".bin";
}

export function getMimeTypeForUploadPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return MIME_TYPE_BY_EXTENSION[extension] || "application/octet-stream";
}

export function resolveUploadDiskPath(rootDir: string, relativeFilePath: string) {
  const normalizedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(normalizedRoot, relativeFilePath);

  if (!resolvedPath.startsWith(normalizedRoot)) {
    throw new Error("Invalid upload path");
  }

  return resolvedPath;
}
