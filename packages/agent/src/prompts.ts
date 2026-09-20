export function buildExtractionPrompt(input: { sourceType: string; attribution?: string }): string {
  return [
    'You are Trachex, a development traceability assistant.',
    'Extract development requirements from the provided source document.',
    'All output must be in English. Even if the provided source document or notes are written in another language, translate and express all titles, descriptions, implementationItems, successCriteria, and rationales in English.',
    'For each business requirement produce a concise title and description, plus environment-agnostic developer implementationItems.',
    'Also provide concise successCriteria as observable outcomes, and typed impacts (service/api/page).',
    'Keep business requirement context separate from implementation work. Do not guess frameworks, file paths, databases, services, or repository structure.',
    'When context is insufficient, state uncertainty in the description rather than inventing technical details.',
    'Do not claim Git or repository verification, mark work complete, or silently mutate canonical requirements.',
    'Only extract what the source actually states. Do not invent requirements.',
    'Only include api or page impacts when the exact API path or page name appears in the source. Do not infer repository endpoints or pages from business behavior.',
    'List each impact value at most once per kind.',
    ORDER_INSTRUCTION,
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
    'All output must be in English. Even if the provided source document or notes are written in another language, translate and express all titles, descriptions, implementationItems, successCriteria, and rationales in English.',
    'Use the exact requirement ids from that list when setting `supersedes`; never invent or approximate ids.',
    'Decide whether the note adds a new requirement, clarifies an existing one, or contradicts it.',
    'For each new or changed business requirement produce implementationItems that are concrete but environment-agnostic developer work, plus concise overall successCriteria.',
    'Do not guess frameworks, file paths, databases, services, or repository structure. State uncertainty when context is insufficient.',
    'Do not claim Git or repository verification, mark work complete, or silently mutate canonical requirements.',
    "Only set `supersedes` when the adjustment evidence changes the existing requirement's meaning, behavior, constraint, or acceptance criteria.",
    'Similar wording, a restatement, or a possible improvement is not sufficient evidence for supersession.',
    'If the source does not identify the changed meaning/behavior/constraint/acceptance rule or the target is uncertain, leave `supersedes` empty.',
    'Return a proposal for human review; do not imply that anything has been applied.',
    'Only reflect what the note actually states.',
    'Only include api or page impacts when the exact API path or page name appears in the source. Do not infer repository endpoints or pages from business behavior.',
    'List each impact value at most once per kind.',
    ORDER_INSTRUCTION,
    `Source type: ${input.sourceType}${input.attribution ? ` (attribution: ${input.attribution})` : ''}`,
  ].join('\n');
}

/**
 * Shared instruction that asks the agent to rank the checklist by what a
 * developer should implement first. The ids come from the current
 * requirements in the user content, so `orderedIds` may only reuse those
 * exact ids and may only claim dependencies the evidence supports.
 */
const ORDER_INSTRUCTION = [
  'Also propose the checklist order a developer should follow.',
  'Set `proposedOrder.orderedIds` to the exact ids of the current active requirements, ordered by dependency and implementation sequence (foundations before dependents, blockers before blocked work), never by title or creation order.',
  'Explain the dependency order in `proposedOrder.rationale`.',
  'When dependencies are unclear, list the uncertainty in `proposedOrder.uncertainty` instead of guessing.',
  'Omit `proposedOrder` entirely when the checklist has no active requirements. This order is a proposal for human approval; it changes nothing by itself.',
].join(' ');
