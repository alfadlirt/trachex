import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  approveProposal,
  createProject,
  createTicket,
  editProposal,
  resetProposal,
} from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import { extractionOutputSchema, runExtraction } from '../index.ts';
import { CHECKLIST_FIXTURES, type ChecklistFixture, promptGuardrails } from './corpus.ts';

export type EvalCategory =
  | 'Basic eval'
  | 'Contains'
  | 'Relevancy'
  | 'Faithfulness'
  | 'G-Eval'
  | 'Prompt alignment';

export interface EvalScore {
  category: EvalCategory;
  metric: string;
  name: string;
  passed: boolean;
  score: number;
  detail: string;
  metadata: Record<string, string | number | boolean>;
}

export interface LensEvalResult extends EvalScore {}

export interface EvalReport {
  scores: EvalScore[];
  passed: boolean;
  lensResults: LensEvalResult[];
}

const forbiddenAssumptions =
  /(?:\b(?:react|vue|svelte|postgres(?:ql)?|mysql|sqlite|qdrant|redis)\b|(?:^|\s)src\/|\.tsx?\b|\btable\b)/i;
const words = (value: string): Set<string> =>
  new Set(value.toLowerCase().match(/[a-z][a-z-]{2,}/g) ?? []);

function drafts(fixture: ChecklistFixture) {
  return fixture.output.requirements;
}

function basic(fixture: ChecklistFixture): EvalScore {
  const result = extractionOutputSchema.safeParse(fixture.output);
  const draft = result.success ? result.data.requirements[0] : undefined;
  const valid =
    result.success &&
    Boolean(draft?.title.trim()) &&
    (draft?.implementationItems?.length ?? 0) > 0 &&
    (draft?.successCriteria?.length ?? 0) > 0;
  return score(
    'Basic eval',
    'structured-output',
    valid,
    valid ? 1 : 0,
    'Requires valid structured output, a business requirement, implementation items, and overall success criteria.',
    fixture,
  );
}

function contains(fixture: ChecklistFixture): EvalScore {
  const text = JSON.stringify(fixture.output);
  const present = fixture.concepts.filter((concept) => text.toLowerCase().includes(concept));
  const conceptsPass = present.length >= Math.max(1, Math.ceil(fixture.concepts.length * 0.5));
  const noGuess = !forbiddenAssumptions.test(text);
  const passed = fixture.expected === 'fail' ? !conceptsPass || !noGuess : conceptsPass && noGuess;
  return score(
    'Contains',
    'grounded-concepts',
    passed,
    (Number(conceptsPass) + Number(noGuess)) / 2,
    `concepts=${present.length}/${fixture.concepts.length}, repository guesses=${!noGuess}`,
    fixture,
  );
}

function relevancy(fixture: ChecklistFixture): EvalScore {
  const sourceWords = words(fixture.source);
  const items = drafts(fixture).flatMap((draft) => draft.implementationItems ?? []);
  const relevant = items.filter((item) => [...words(item)].some((word) => sourceWords.has(word)));
  const ratio = items.length === 0 ? 0 : relevant.length / items.length;
  const passed = fixture.expected === 'fail' ? ratio < 0.5 : ratio >= 0.5;
  return score(
    'Relevancy',
    'business-to-work-fit',
    passed,
    ratio,
    `implementation items sharing source concepts=${relevant.length}/${items.length}`,
    fixture,
  );
}

function faithfulness(fixture: ChecklistFixture): EvalScore {
  const unsupported = JSON.stringify(fixture.output).match(forbiddenAssumptions)?.[0] ?? '';
  const passed = fixture.expected === 'fail' ? Boolean(unsupported) : !unsupported;
  return score(
    'Faithfulness',
    'source-supported-claims',
    passed,
    passed ? 1 : 0,
    unsupported
      ? `unsupported repository-specific claim: ${unsupported}`
      : 'No invented technology, path, or database claim.',
    fixture,
  );
}

function geval(fixture: ChecklistFixture): EvalScore {
  const draft = drafts(fixture)[0];
  const actionable = (draft?.implementationItems?.length ?? 0) >= 2;
  const concise =
    (draft?.successCriteria?.length ?? 0) >= 1 && (draft?.successCriteria?.length ?? 0) <= 4;
  const agnostic = !forbiddenAssumptions.test(JSON.stringify(fixture.output));
  const complete = Boolean(
    draft?.title && draft?.implementationItems?.length && draft?.successCriteria?.length,
  );
  const uncertaintySatisfied =
    !fixture.requiresUncertainty ||
    (draft?.description?.toLowerCase().includes('uncertain') ?? false);
  const value =
    [complete, actionable, concise, agnostic, uncertaintySatisfied].filter(Boolean).length / 5;
  const passed = fixture.expected === 'fail' ? value < 1 : value >= 0.75;
  return score(
    'G-Eval',
    'checklist-rubric',
    passed,
    value,
    `completeness=${complete}, actionable=${actionable}, concise=${concise}, environment-agnostic=${agnostic}, uncertainty=${uncertaintySatisfied}`,
    fixture,
  );
}

function score(
  category: EvalCategory,
  metric: string,
  passed: boolean,
  value: number,
  detail: string,
  fixture: ChecklistFixture,
): EvalScore {
  return {
    category,
    metric,
    name: `${fixture.id}:${metric}`,
    passed,
    score: Number(value.toFixed(2)),
    detail,
    metadata: {
      deterministic: true,
      fixture: fixture.id,
      expected: fixture.expected,
      reportVersion: 2,
    },
  };
}

function promptAlignment(fixture: ChecklistFixture): EvalScore {
  const prompt = promptGuardrails();
  const guardrails = [
    'environment-agnostic',
    'Do not guess frameworks',
    'uncertainty',
    'successCriteria',
  ];
  const present = guardrails.filter((rule) => prompt.includes(rule));
  const outputViolates = forbiddenAssumptions.test(JSON.stringify(fixture.output));
  const passed =
    fixture.expected === 'fail'
      ? present.length === guardrails.length && outputViolates
      : present.length === guardrails.length && !outputViolates;
  return score(
    'Prompt alignment',
    'guardrails',
    passed,
    present.length / guardrails.length,
    `prompt guardrails=${present.length}/${guardrails.length}, fixture violates=${outputViolates}`,
    fixture,
  );
}

function tempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'trachex-eval-'));
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  return { dir, db };
}

async function approvalInvariant(): Promise<EvalScore> {
  const fixture = CHECKLIST_FIXTURES[0];
  assertFixture(fixture);
  const { dir, db } = tempDb();
  try {
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'eval', name: 'Eval' });
    const ticket = await createTicket(uow, { projectId: project.id, key: 'EVAL', title: 'Eval' });
    const proposal = await runExtraction(
      uow,
      { runAgent: async () => fixture.output },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'brd',
        relPath: 'requirements.md',
        contentKind: 'markdown',
        content: fixture.source,
      },
    );
    const before = await uow.requirements.listByTicket(ticket.id);
    await approveProposal(uow, { proposalId: proposal.proposal.id });
    const after = await uow.requirements.listByTicket(ticket.id);
    const passed = before.length === 0 && after.length > 0;
    return score(
      'Prompt alignment',
      'human-approval-guardrail',
      passed,
      passed ? 1 : 0,
      `canonical requirements before approval=${before.length}, after=${after.length}`,
      fixture,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

async function editResetInvariant(): Promise<EvalScore> {
  const fixture = CHECKLIST_FIXTURES[0];
  assertFixture(fixture);
  const { dir, db } = tempDb();
  try {
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'edit-eval', name: 'Edit eval' });
    const ticket = await createTicket(uow, {
      projectId: project.id,
      key: 'EDIT',
      title: 'Edit eval',
    });
    const result = await runExtraction(
      uow,
      { runAgent: async () => fixture.output },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'brd',
        relPath: 'requirements.md',
        contentKind: 'markdown',
        content: fixture.source,
      },
    );
    const edited = {
      ...fixture.output,
      requirements: fixture.output.requirements.map((requirement) => ({
        ...requirement,
        title: `${requirement.title} (edited)`,
      })),
    };
    await editProposal(uow, { proposalId: result.proposal.id, editedOutput: edited });
    const versionsAfterEdit = await uow.proposals.listVersions(result.proposal.id);
    const editPreservedHistory =
      versionsAfterEdit.length === 2 &&
      versionsAfterEdit[0]?.modelOutput === JSON.stringify(fixture.output) &&
      versionsAfterEdit[1]?.editedOutput === JSON.stringify(edited);
    await resetProposal(uow, { proposalId: result.proposal.id });
    const versionsAfterReset = await uow.proposals.listVersions(result.proposal.id);
    const resetRestoredOriginal = versionsAfterReset.at(-1)?.editedOutput === null;
    const passed = editPreservedHistory && resetRestoredOriginal;
    return score(
      'Basic eval',
      'human-edit-reset',
      passed,
      passed ? 1 : 0,
      `edited history preserved=${editPreservedHistory}, reset restored original=${resetRestoredOriginal}`,
      fixture,
    );
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertFixture(fixture: ChecklistFixture | undefined): asserts fixture is ChecklistFixture {
  if (!fixture) throw new Error('approval fixture is missing');
}

export async function runEvalHarness(): Promise<EvalReport> {
  const scores = CHECKLIST_FIXTURES.flatMap((fixture) => [
    basic(fixture),
    contains(fixture),
    relevancy(fixture),
    faithfulness(fixture),
    geval(fixture),
    promptAlignment(fixture),
  ]);
  scores.push(await approvalInvariant());
  scores.push(await editResetInvariant());
  return { scores, passed: scores.every((result) => result.passed), lensResults: scores };
}
