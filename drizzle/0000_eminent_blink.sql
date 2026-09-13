CREATE TYPE "public"."role" AS ENUM('USER', 'VIEW', 'ADMIN', 'SUPERADMIN');--> statement-breakpoint
CREATE TABLE "access_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "role" NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"activity_code" text NOT NULL,
	"serial_number" integer NOT NULL,
	"name" text NOT NULL,
	"unit_type" text,
	"intervention" text,
	"activity_type" text,
	"unit_rate" numeric(14, 2),
	"project_target" numeric(14, 2),
	"project_budget" numeric(14, 2),
	"annual_target" numeric(14, 2),
	"annual_budget" numeric(14, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"entry_date" date NOT NULL,
	"month" integer NOT NULL,
	"year" integer NOT NULL,
	"project_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"actual_expenditure" numeric(14, 2) DEFAULT 0 NOT NULL,
	"female_26" integer DEFAULT 0 NOT NULL,
	"male_26" integer DEFAULT 0 NOT NULL,
	"pwd_26" integer DEFAULT 0 NOT NULL,
	"youth_female_15_25" integer DEFAULT 0 NOT NULL,
	"youth_male_15_25" integer DEFAULT 0 NOT NULL,
	"youth_pwd_15_25" integer DEFAULT 0 NOT NULL,
	"girl_0_14" integer DEFAULT 0 NOT NULL,
	"boy_0_14" integer DEFAULT 0 NOT NULL,
	"pwd_0_14" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"submitted_by_name" text NOT NULL,
	"submitted_by_designation" text NOT NULL,
	"branch" text NOT NULL,
	"submitted_by_role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_edited_by_name" text,
	"last_edited_by_designation" text,
	"last_edited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_codes_role_key" ON "access_codes" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "access_codes_code_key" ON "access_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_project_serial_key" ON "activities" USING btree ("project_id","serial_number");--> statement-breakpoint
CREATE INDEX "activities_project_idx" ON "activities" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "entries_project_idx" ON "entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "entries_branch_idx" ON "entries" USING btree ("branch");--> statement-breakpoint
CREATE INDEX "entries_date_idx" ON "entries" USING btree ("entry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_name_key" ON "projects" USING btree ("name");