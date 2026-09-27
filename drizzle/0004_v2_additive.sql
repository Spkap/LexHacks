CREATE TABLE "finding_rulings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"ruling" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"proposal" jsonb NOT NULL,
	"votes" jsonb NOT NULL,
	"verdict" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "findings_candidate_id_key" UNIQUE("candidate_id")
);
--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "certificate_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "repairs" ALTER COLUMN "base_formalization_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attack_candidates" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "attack_candidates" ADD COLUMN "source_id" uuid;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "finding_id" uuid;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "base_source_id" uuid;--> statement-breakpoint
ALTER TABLE "repairs" ADD COLUMN "repaired_source_id" uuid;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "parent_source_id" uuid;--> statement-breakpoint
ALTER TABLE "test_fixtures" ADD COLUMN "scenario" text;--> statement-breakpoint
ALTER TABLE "finding_rulings" ADD CONSTRAINT "finding_rulings_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_rulings" ADD CONSTRAINT "finding_rulings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_candidate_id_attack_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."attack_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finding_rulings_finding_id_idx" ON "finding_rulings" USING btree ("finding_id");--> statement-breakpoint
CREATE INDEX "findings_source_id_idx" ON "findings" USING btree ("source_id");--> statement-breakpoint
ALTER TABLE "attack_candidates" ADD CONSTRAINT "attack_candidates_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_base_source_id_sources_id_fk" FOREIGN KEY ("base_source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;