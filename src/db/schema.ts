import { sql } from 'drizzle-orm';
import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const workspaces = pgTable('workspaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  tokenHash: text('token_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('workspaces_token_hash_key').on(t.tokenHash)]);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').references(() => workspaces.id),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  demoTemplate: text('demo_template'),
  forkedFrom: uuid('forked_from'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('projects_slug_key').on(t.slug), index('projects_workspace_id_idx').on(t.workspaceId)]);

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  parentSourceId: uuid('parent_source_id'),
  title: text('title').notNull(),
  jurisdiction: text('jurisdiction').notNull(),
  canonicalUrl: text('canonical_url').notNull(),
  officialVersionId: text('official_version_id').notNull(),
  retrievedAt: text('retrieved_at').notNull(),
  sha256: text('sha256').notNull(),
  text: text('text').notNull(),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('sources_project_id_idx').on(t.projectId)]);

export const sourceSpans = pgTable('source_spans', {
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  id: text('id').notNull(),
  sectionPath: text('section_path').notNull(),
  label: text('label').notNull(),
  text: text('text').notNull(),
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
}, (t) => [
  unique('source_spans_pk').on(t.sourceId, t.id),
  index('source_spans_text_search_idx').using('gin', sql`to_tsvector('english', ${t.text})`),
]);

export const purposeContracts = pgTable('purpose_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  version: integer('version').notNull(),
  status: text('status', { enum: ['proposed', 'approved'] }).notNull().default('proposed'),
  contract: jsonb('contract').notNull(),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('purpose_contracts_project_version_key').on(t.projectId, t.version)]);

export const testFixtures = pgTable('test_fixtures', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  label: text('label').notNull(),
  scenario: text('scenario').notNull(),
}, (t) => [index('test_fixtures_project_id_idx').on(t.projectId)]);

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  type: text('type', { enum: ['attack', 'repair', 'retest'] }).notNull(),
  mode: text('mode', { enum: ['demo', 'live'] }).notNull(),
  status: text('status', { enum: ['queued', 'running', 'succeeded', 'failed'] }).notNull().default('queued'),
  inputHash: text('input_hash').notNull(),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (t) => [unique('runs_project_type_input_hash_key').on(t.projectId, t.type, t.inputHash)]);

export const runEvents = pgTable('run_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  seq: integer('seq').notNull(),
  stage: text('stage').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('run_events_run_id_seq_key').on(t.runId, t.seq)]);

export const attackCandidates = pgTable('attack_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  tactic: text('tactic').notNull(),
  candidate: jsonb('candidate').notNull(),
  status: text('status', { enum: ['generated', 'ungrounded', 'blocked', 'harmless', 'contested', 'confirmed'] }).notNull().default('generated'),
  reasons: jsonb('reasons'),
  label: text('label'),
  sourceId: uuid('source_id').references(() => sources.id),
}, (t) => [index('attack_candidates_run_id_idx').on(t.runId), index('attack_candidates_status_idx').on(t.status)]);

export const findings = pgTable('findings', {
  id: uuid('id').primaryKey().defaultRandom(),
  candidateId: uuid('candidate_id').notNull().references(() => attackCandidates.id),
  sourceId: uuid('source_id').notNull().references(() => sources.id),
  proposal: jsonb('proposal').notNull(),
  votes: jsonb('votes').notNull(),
  verdict: text('verdict', { enum: ['confirmed', 'blocked', 'harmless', 'contested'] }).notNull(),
  hash: text('hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique('findings_candidate_id_key').on(t.candidateId), index('findings_source_id_idx').on(t.sourceId)]);

export const findingRulings = pgTable('finding_rulings', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id').notNull().references(() => findings.id),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  ruling: text('ruling', { enum: ['loophole', 'no_loophole'] }).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('finding_rulings_finding_id_idx').on(t.findingId)]);

export const repairs = pgTable('repairs', {
  id: uuid('id').primaryKey().defaultRandom(),
  findingId: uuid('finding_id').notNull().references(() => findings.id),
  baseSourceId: uuid('base_source_id').notNull().references(() => sources.id),
  repairedSourceId: uuid('repaired_source_id'),
  redline: jsonb('redline').notNull(),
  status: text('status', { enum: ['proposed', 'approved', 'rejected'] }).notNull().default('proposed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const modelCalls = pgTable('model_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => runs.id),
  stage: text('stage').notNull(),
  model: text('model').notNull(),
  promptHash: text('prompt_hash').notNull(),
  schemaVersion: integer('schema_version').notNull().default(1),
  usage: jsonb('usage'),
  mode: text('mode', { enum: ['demo', 'live'] }).notNull(),
  // Every attempt is logged (not only the winning one), so schema-validity rate
  // (scripts/eval.ts) reflects real outcomes rather than only successes.
  ok: boolean('ok').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('model_calls_run_id_idx').on(t.runId)]);

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  actor: text('actor').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
