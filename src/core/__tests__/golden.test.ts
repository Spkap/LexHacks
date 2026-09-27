import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AttackProposal, RepairProposal, type Span } from '../contracts';
import { groundProposal, groundRepair } from '../grounding';

const DIR = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018');

function readJson(name: string): unknown {
  return JSON.parse(readFileSync(join(DIR, name), 'utf8'));
}

const source = readJson('source.json') as { spans: Span[] };
const candidatesFile = readJson('candidates.original.json') as { candidates: { label: string; proposal: unknown }[] };
const repairFile = readJson('repair.recorded.json') as { proposals: unknown[]; lazy: unknown };

describe('golden fixtures ground against source.json', () => {
  it('has 8 candidates C1-C8', () => {
    expect(candidatesFile.candidates.map((c) => c.label)).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
  });

  for (const { label, proposal } of candidatesFile.candidates) {
    it(`${label} quotes are grounded in source.json`, () => {
      const parsed = AttackProposal.parse(proposal);
      expect(groundProposal(parsed, source.spans)).toEqual({ ok: true });
    });
  }

  it('recorded repair proposals ground against source.json', () => {
    for (const proposal of repairFile.proposals) {
      const parsed = RepairProposal.parse(proposal);
      expect(groundRepair(parsed, source.spans)).toEqual({ ok: true });
    }
  });

  it('lazy fix grounds against source.json', () => {
    const parsed = RepairProposal.parse(repairFile.lazy);
    expect(groundRepair(parsed, source.spans)).toEqual({ ok: true });
  });
});
