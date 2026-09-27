import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Candidate, Fixture, Formalization, PurposeContract } from '../ir';

const DIR = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

export interface GoldenCase {
  original: Formalization;
  repaired: Formalization;
  overbroad: Formalization;
  purpose: PurposeContract;
  fixtures: Fixture[];
  candidates: Candidate[];
}

export function loadGolden(): GoldenCase {
  const original = Formalization.parse(readJson('formalization.original.json'));
  const repaired = Formalization.parse(readJson('formalization.repaired.json'));
  const overbroad = Formalization.parse(readJson('formalization.overbroad.json'));
  const purpose = PurposeContract.parse(readJson('purpose.json'));
  const fixtures = (readJson('fixtures.json') as unknown[]).map((f) => Fixture.parse(f));
  const candidatesFile = readJson('candidates.original.json') as { candidates: unknown[] };
  const candidates = candidatesFile.candidates.map((c) => Candidate.parse(c));
  return { original, repaired, overbroad, purpose, fixtures, candidates };
}

export function findCandidate(candidates: Candidate[], id: string): Candidate {
  const c = candidates.find((x) => x.id === id);
  if (!c) throw new Error(`candidate '${id}' not found in golden fixtures`);
  return c;
}
