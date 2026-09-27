import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { buildCertificate } from '@/core/certificate';
import { certify } from '@/core/engine';
import { Candidate, Formalization, PurposeContract } from '@/core/ir';
import { getSolverVersion } from '@/core/z3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readGoldenJson(name: string): unknown {
  const path = join(process.cwd(), 'fixtures', 'golden', 'ccpa-2018', name);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export async function GET() {
  try {
    const formalization = Formalization.parse(readGoldenJson('formalization.original.json'));
    const purpose = PurposeContract.parse(readGoldenJson('purpose.json'));
    const candidatesFile = readGoldenJson('candidates.original.json') as { candidates: unknown[] };
    const c1Raw = candidatesFile.candidates.find((c) => (c as { id?: string }).id === 'C1');
    if (!c1Raw) throw new Error('golden candidate C1 not found');
    const c1 = Candidate.parse(c1Raw);

    const result = await certify(formalization, purpose, c1);
    const solverVersion = getSolverVersion();
    const certificate = buildCertificate({
      candidateId: c1.id,
      formalizationHash: formalization.id,
      invariantHash: c1.targetInvariantId,
      candidateHash: c1.id,
      result: result.result,
      model: result.model ?? null,
      smtlib: result.smtlib,
      solverVersion,
      elapsedMs: result.elapsedMs,
    });

    return NextResponse.json({
      result: result.result,
      status: result.status,
      elapsedMs: result.elapsedMs,
      solverVersion,
      hash: certificate.hash,
    });
  } catch (error) {
    return NextResponse.json({ error: 'solver_health_check_failed', detail: (error as Error).message }, { status: 500 });
  }
}
