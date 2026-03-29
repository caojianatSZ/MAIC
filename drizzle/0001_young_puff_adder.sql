CREATE TABLE "homework_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"explanation_text" text NOT NULL,
	"explanation_audio_url" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"question_image_url" text,
	"grade" text,
	"subject" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "practice_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_id" uuid NOT NULL,
	"question_text" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text,
	"question_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"openid" text NOT NULL,
	"unionid" text,
	"nick_name" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_openid_unique" UNIQUE("openid")
);
--> statement-breakpoint
ALTER TABLE "homework_results" ADD CONSTRAINT "homework_results_submission_id_homework_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."homework_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_questions" ADD CONSTRAINT "practice_questions_result_id_homework_results_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."homework_results"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_homework_results_submission" ON "homework_results" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "idx_homework_submissions_user" ON "homework_submissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_homework_submissions_created" ON "homework_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_practice_questions_result" ON "practice_questions" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "idx_users_openid" ON "users" USING btree ("openid");