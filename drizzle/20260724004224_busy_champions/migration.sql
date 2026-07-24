CREATE TYPE "submission_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED_NOT_OOC', 'REJECTED_EXPLICIT');--> statement-breakpoint
CREATE TYPE "user_role" AS ENUM('USER', 'ADMIN', 'SUPER_ADMIN');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"action" text NOT NULL,
	"actor_id" text,
	"resource_type" text,
	"resource_id" text,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ban" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"status" "submission_status" DEFAULT 'PENDING'::"submission_status" NOT NULL,
	"forwarded_channel_id" text NOT NULL,
	"forwarded_message_ts" text NOT NULL,
	"forwarded_message_user" text NOT NULL,
	"posted_channel_id" text,
	"posted_message_ts" text,
	"submitter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user" (
	"slack_id" text PRIMARY KEY,
	"role" "user_role" DEFAULT 'USER'::"user_role" NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"opted_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warning" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_log_resource_type_resource_id_index" ON "audit_log" ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_log_action_index" ON "audit_log" ("action");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_index" ON "audit_log" ("actor_id");--> statement-breakpoint
CREATE INDEX "ban_user_id_expires_at_index" ON "ban" ("user_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_forwarded_channel_id_forwarded_message_ts_index" ON "submission" ("forwarded_channel_id","forwarded_message_ts");--> statement-breakpoint
CREATE UNIQUE INDEX "submission_posted_channel_id_posted_message_ts_index" ON "submission" ("posted_channel_id","posted_message_ts");--> statement-breakpoint
CREATE INDEX "warning_user_id_index" ON "warning" ("user_id");--> statement-breakpoint
ALTER TABLE "ban" ADD CONSTRAINT "ban_user_id_user_slack_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("slack_id");--> statement-breakpoint
ALTER TABLE "submission" ADD CONSTRAINT "submission_submitter_id_user_slack_id_fkey" FOREIGN KEY ("submitter_id") REFERENCES "user"("slack_id");--> statement-breakpoint
ALTER TABLE "warning" ADD CONSTRAINT "warning_user_id_user_slack_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("slack_id");