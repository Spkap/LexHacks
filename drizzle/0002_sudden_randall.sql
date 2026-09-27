ALTER TABLE "certificates" DROP CONSTRAINT "certificates_hash_key";--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_candidate_id_key" UNIQUE("candidate_id");