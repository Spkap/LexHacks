ALTER TABLE "certificates" ADD COLUMN "formalization_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "invariant_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN "candidate_hash" text NOT NULL;