import { z } from 'zod';
import { Definition, RedlineEdit, Rule, type Candidate, type Fixture, type Formalization, type PurposeContract, type RepairProposal } from '@/core/ir';
import { callStructured } from './call';
import { buildRepairPrompt, SYSTEM_REPAIR } from './prompts/repair';

const RuleInput = Rule.omit({ status: true });
const DefinitionInput = Definition.omit({ status: true });
// Every property must be listed in `required` for Groq's strict structured-output mode,
// which a zod .default() silently drops from `required` (it becomes optional in the JSON
// schema) — so the model must always return both keys explicitly, empty array if unused.
const IrPatchInput = z.object({
  addDefinitions: z.array(DefinitionInput),
  replaceRules: z.array(RuleInput),
});
const RepairProposalInput = z.object({
  title: z.string().max(200),
  redline: z.array(RedlineEdit).min(1),
  irPatch: IrPatchInput,
  rationale: z.string().max(1000),
});
const RepairBatchOutput = z.object({ proposals: z.array(RepairProposalInput).max(3) });

export interface GenerateRepairProposalsArgs {
  baseFormalization: Formalization;
  candidate: Candidate;
  purpose: PurposeContract;
  fixtures: Fixture[];
  runId?: string;
  mode?: 'demo' | 'live';
}

export async function generateRepairProposals(args: GenerateRepairProposalsArgs): Promise<RepairProposal[]> {
  const prompt = buildRepairPrompt(args.baseFormalization, args.candidate, args.purpose, args.fixtures);
  const result = await callStructured('repair', {
    runId: args.runId,
    mode: args.mode,
    model: 'reasoning',
    schema: RepairBatchOutput,
    system: SYSTEM_REPAIR,
    prompt,
  });

  if (!result.ok) throw new Error(`repair synthesis failed: ${result.error}`);

  return result.data.proposals.map((p) => ({
    title: p.title,
    redline: p.redline,
    rationale: p.rationale,
    irPatch: {
      addDefinitions: p.irPatch.addDefinitions.map((d) => ({ ...d, status: 'proposed' as const })),
      replaceRules: p.irPatch.replaceRules.map((r) => ({ ...r, status: 'proposed' as const })),
    },
  }));
}
