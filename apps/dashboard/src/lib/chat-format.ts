const evidencePrefix = 'Evidence:';

export function evidenceLine(source: string) {
  return `${evidencePrefix} ${source.trim()}`;
}

export function normalizeChatContent(content: string) {
  const lines = content.split('\n').flatMap((line) => {
    const compact = line.match(/^(.+?[.:])\s+-\s+(.+)$/);
    if (!compact || /^Evidence:/i.test(line.trim())) return [line.trimEnd()];

    const introduction = compact[1];
    const bulletText = compact[2];
    if (!introduction || !bulletText) return [line.trimEnd()];
    const items = bulletText.split(/\s+-\s+/).filter(Boolean);
    return [`${introduction.trimEnd()}`, ...items.map((item) => `- ${item}`)];
  });
  const seenEvidence = new Set<string>();
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith(evidencePrefix.toLowerCase())) {
      const key = trimmed.slice(evidencePrefix.length).trim().toLowerCase();
      if (seenEvidence.has(key)) continue;
      seenEvidence.add(key);
    }
    result.push(line);
  }

  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mergeEvidence(content: string, source: string) {
  const normalized = normalizeChatContent(content);
  const line = evidenceLine(source);
  const key = line.slice(evidencePrefix.length).trim().toLowerCase();
  if (
    normalized
      .split('\n')
      .some((entry) => entry.trim().toLowerCase().slice(evidencePrefix.length).trim() === key)
  )
    return normalized;
  return normalized ? `${normalized}\n\n${line}` : line;
}
