import { hashOf } from './canonical';
import type { SolveStatus } from './engine';

export interface Certificate {
  candidateId: string;
  formalizationHash: string;
  invariantHash: string;
  candidateHash: string;
  result: SolveStatus;
  model: Record<string, boolean | number | string> | null;
  smtlib: string;
  solverVersion: string;
  elapsedMs: number;
  inputHash: string;
  hash: string;
}

function computeInputHash(args: Pick<Certificate, 'formalizationHash' | 'invariantHash' | 'candidateHash' | 'solverVersion'>): string {
  return hashOf({
    formalizationHash: args.formalizationHash,
    invariantHash: args.invariantHash,
    candidateHash: args.candidateHash,
    solverVersion: args.solverVersion,
  });
}

function computeHash(inputHash: string, result: SolveStatus, model: Certificate['model'], smtlib: string): string {
  return hashOf({ inputHash, result, model, smtlib });
}

export function buildCertificate(args: Omit<Certificate, 'inputHash' | 'hash'>): Certificate {
  const inputHash = computeInputHash(args);
  const hash = computeHash(inputHash, args.result, args.model, args.smtlib);
  return { ...args, inputHash, hash };
}

export function verifyCertificate(c: Certificate): boolean {
  const inputHash = computeInputHash(c);
  if (inputHash !== c.inputHash) return false;
  const hash = computeHash(inputHash, c.result, c.model, c.smtlib);
  return hash === c.hash;
}
