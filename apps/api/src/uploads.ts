import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { PDFParse } from 'pdf-parse';

export const DEFAULT_UPLOAD_LIMIT = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['.md', '.markdown', '.pdf']);

export class UploadError extends Error {
  readonly code = 'INVALID_UPLOAD';
}

export interface ValidatedUpload {
  extension: '.md' | '.markdown' | '.pdf';
  displayName: string;
  content: string;
  storagePath: string;
}

function uploadLimit(): number {
  const configured = Number(process.env.TRACHEX_MAX_UPLOAD_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_UPLOAD_LIMIT;
}

export async function validateAndReadUpload(file: File, appDir: string): Promise<ValidatedUpload> {
  const displayName = basename(file.name || 'upload');
  const extension = extname(displayName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension))
    throw new UploadError('Only Markdown (.md/.markdown) and PDF (.pdf) files are supported.');
  if (file.size > uploadLimit())
    throw new UploadError(
      `Upload exceeds the ${Math.round(uploadLimit() / 1024 / 1024)} MB limit.`,
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  let content: string;
  if (extension === '.pdf') {
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
      throw new UploadError('The file is not a valid PDF document.');
    let parser: PDFParse | undefined;
    try {
      parser = new PDFParse({ data: bytes });
      const result = await parser.getText();
      content = result.text.trim();
    } catch {
      throw new UploadError(
        'This PDF could not be read. Use a text-based PDF rather than an image scan.',
      );
    } finally {
      await parser?.destroy();
    }
    if (!content)
      throw new UploadError('This PDF contains no readable text. OCR is not supported.');
  } else {
    try {
      content = new TextDecoder('utf-8', { fatal: true }).decode(bytes).trim();
    } catch {
      throw new UploadError('The Markdown file is not valid UTF-8.');
    }
    if (!content) throw new UploadError('The Markdown file is empty.');
  }
  const uploadDir = join(appDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const storagePath = join(uploadDir, `${randomUUID()}${extension}`);
  writeFileSync(storagePath, bytes, { flag: 'wx' });
  return {
    extension: extension as ValidatedUpload['extension'],
    displayName,
    content,
    storagePath,
  };
}
