ALTER TABLE "certificates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "formalizations" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "certificates" CASCADE;--> statement-breakpoint
DROP TABLE "formalizations" CASCADE;--> statement-breakpoint
ALTER TABLE "repairs" DROP CONSTRAINT "repairs_certificate_id_certificates_id_fk";
--> statement-breakpoint
ALTER TABLE "repairs" DROP CONSTRAINT "repairs_base_formalization_id_formalizations_id_fk";
--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "finding_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "base_source_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "test_fixtures" ALTER COLUMN "scenario" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "repairs" DROP COLUMN "certificate_id";--> statement-breakpoint
ALTER TABLE "repairs" DROP COLUMN "base_formalization_id";--> statement-breakpoint
ALTER TABLE "repairs" DROP COLUMN "repaired_formalization_id";--> statement-breakpoint
ALTER TABLE "test_fixtures" DROP COLUMN "kind";--> statement-breakpoint
ALTER TABLE "test_fixtures" DROP COLUMN "pins";--> statement-breakpoint
ALTER TABLE "test_fixtures" DROP COLUMN "expect";