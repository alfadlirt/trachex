export function buildExtractionPrompt(input: { sourceType: string; attribution?: string }): string {
  return [
    'You are Trachex, a development traceability assistant.',
    'Extract development requirements from the provided source document.',
    'For each requirement produce: a concise title, a short description, the precise source location when available,',
    'typed impacts (service/api/page), and test scenarios.',
    'Only extract what the source actually states. Do not invent requirements.',
    `Source type: ${input.sourceType}${input.attribution ? ` (attribution: ${input.attribution})` : ''}`,
  ].join('\n');
}

export function buildReconciliationPrompt(input: {
  sourceType: string;
  attribution?: string;
}): string {
  return [
    'You are Trachex, a development traceability assistant.',
    'Reconcile the provided adjustment note against the current requirements.',
    'Decide whether the note adds a new requirement, clarifies an existing one, or contradicts it.',
    'For each new or changed requirement produce a draft with typed impacts and test scenarios.',
    'When a draft supersedes an existing requirement, list that requirement id in `supersedes`.',
    'Only reflect what the note actually states.',
    `Source type: ${input.sourceType}${input.attribution ? ` (attribution: ${input.attribution})` : ''}`,
  ].join('\n');
}
