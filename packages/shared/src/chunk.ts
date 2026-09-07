import { sha256 } from './hash.ts';

export interface ChunkResult {
  id: string;
  index: number;
  content: string;
  location: string | null;
}

export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_MAX_CHARS = 2000;
const DEFAULT_OVERLAP = 100;

export function chunkText(
  text: string,
  relPath: string,
  options: ChunkOptions = {},
): ChunkResult[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  const normalized = text.replace(/\r\n/g, '\n');
  const segments = splitSegments(normalized, maxChars, overlap);
  return segments.map((segment, index) => {
    const startLine = lineNumberAt(normalized, segment.start);
    const endLine = lineNumberAt(normalized, segment.start + segment.text.length - 1);
    const location =
      startLine === endLine ? `${relPath}:${startLine}` : `${relPath}:${startLine}-${endLine}`;
    return {
      id: sha256(`${relPath}:${index}:${segment.text}`),
      index,
      content: segment.text,
      location,
    };
  });
}

interface Segment {
  text: string;
  start: number;
}

function splitSegments(text: string, maxChars: number, overlap: number): Segment[] {
  const segments: Segment[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const newline = text.lastIndexOf('\n', end);
      const space = text.lastIndexOf(' ', end);
      const boundary = Math.max(newline, space);
      if (boundary > start) {
        end = boundary;
      }
    }
    segments.push({ text: text.slice(start, end), start });
    if (end >= text.length) {
      break;
    }
    start = end - overlap;
    if (start < 0) {
      start = 0;
    }
  }
  return segments;
}

function lineNumberAt(text: string, offset: number): number {
  if (offset < 0) {
    return 1;
  }
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line++;
    }
  }
  return line;
}
