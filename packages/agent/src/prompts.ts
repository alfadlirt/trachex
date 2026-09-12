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
    'Reconcile the provided adjustment note against the current requirements listed in the user content.',
    'Use the exact requirement ids from that list when setting `supersedes`; never invent or approximate ids.',
    'Decide whether the note adds a new requirement, clarifies an existing one, or contradicts it.',
    'For each new or changed requirement produce a draft with typed impacts and test scenarios.',
    "Only set `supersedes` when the adjustment evidence changes the existing requirement's meaning, behavior, constraint, or acceptance criteria.",
    'Similar wording, a restatement, or a possible improvement is not sufficient evidence for supersession.',
    'If the source does not identify the changed meaning/behavior/constraint/acceptance rule or the target is uncertain, leave `supersedes` empty.',
    'Return a proposal for human review; do not imply that anything has been applied.',
    'Only reflect what the note actually states.',
    `Source type: ${input.sourceType}${input.attribution ? ` (attribution: ${input.attribution})` : ''}`,
  ].join('\n');
}
