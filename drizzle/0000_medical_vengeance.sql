CREATE TABLE "attack_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"tactic" text NOT NULL,
	"candidate" jsonb NOT NULL,
	"status" text DEFAULT 'generated' NOT NULL,
	"reasons" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"formalization_id" uuid NOT NULL,
	"result" text NOT NULL,
	"model" jsonb,
	"smtlib" text NOT NULL,
	"elapsed_ms" integer NOT NULL,
	"solver_version" text NOT NULL,
	"input_hash" text NOT NULL,
	"hash" text NOT NULL,
	"explanation" jsonb,
	CONSTRAINT "certificates_hash_key" UNIQUE("hash")
);
--> statement-breakpoint
CREATE TABLE "formalizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"parent_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"ir" jsonb NOT NULL,
	"ir_hash" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "formalizations_project_version_key" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "model_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"usage" jsonb,
	"mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"demo_template" text,
	"forked_from" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "purpose_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"contract" jsonb NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purpose_contracts_project_version_key" UNIQUE("project_id","version")
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"certificate_id" uuid NOT NULL,
	"base_formalization_id" uuid NOT NULL,
	"repaired_formalization_id" uuid,
	"redline" jsonb NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"stage" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_events_run_id_seq_key" UNIQUE("run_id","seq")
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"input_hash" text NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	CONSTRAINT "runs_project_type_input_hash_key" UNIQUE("project_id","type","input_hash")
);
--> statement-breakpoint
CREATE TABLE "source_spans" (
	"source_id" uuid NOT NULL,
	"id" text NOT NULL,
	"section_path" text NOT NULL,
	"label" text NOT NULL,
	"text" text NOT NULL,
	"start_offset" integer,
	"end_offset" integer,
	CONSTRAINT "source_spans_pk" UNIQUE("source_id","id")
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text NOT NULL,
	"jurisdiction" text NOT NULL,
	"canonical_url" text NOT NULL,
	"official_version_id" text NOT NULL,
	"retrieved_at" text NOT NULL,
	"sha256" text NOT NULL,
	"text" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_fixtures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"pins" jsonb NOT NULL,
	"expect" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "attack_candidates" ADD CONSTRAINT "attack_candidates_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_candidate_id_attack_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."attack_candidates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_formalization_id_formalizations_id_fk" FOREIGN KEY ("formalization_id") REFERENCES "public"."formalizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formalizations" ADD CONSTRAINT "formalizations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "formalizations" ADD CONSTRAINT "formalizations_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_calls" ADD CONSTRAINT "model_calls_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purpose_contracts" ADD CONSTRAINT "purpose_contracts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_certificate_id_certificates_id_fk" FOREIGN KEY ("certificate_id") REFERENCES "public"."certificates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repairs" ADD CONSTRAINT "repairs_base_formalization_id_formalizations_id_fk" FOREIGN KEY ("base_formalization_id") REFERENCES "public"."formalizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runs" ADD CONSTRAINT "runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_spans" ADD CONSTRAINT "source_spans_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_fixtures" ADD CONSTRAINT "test_fixtures_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attack_candidates_run_id_idx" ON "attack_candidates" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "attack_candidates_status_idx" ON "attack_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "model_calls_run_id_idx" ON "model_calls" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "source_spans_text_search_idx" ON "source_spans" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE INDEX "sources_project_id_idx" ON "sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "test_fixtures_project_id_idx" ON "test_fixtures" USING btree ("project_id");