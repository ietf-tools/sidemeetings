CREATE TYPE "public"."activity_kind" AS ENUM('submitted', 'confirmed', 'rejected', 'cancelled', 'updated');--> statement-breakpoint
CREATE TYPE "public"."booking_state" AS ENUM('pending', 'confirmed', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"booking_id" uuid,
	"action" "activity_kind" NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"organizer_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"state" "booking_state" DEFAULT 'pending' NOT NULL,
	"is_irtf" boolean DEFAULT false NOT NULL,
	"areas" varchar(10)[] DEFAULT '{}'::varchar[] NOT NULL,
	"co_organizers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp NOT NULL,
	"duration" integer NOT NULL,
	"ends_at" timestamp GENERATED ALWAYS AS ("starts_at" + ("duration" * INTERVAL '1 minute')) STORED,
	"video_link_url" varchar(2048),
	"video_link_name" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"num" varchar(10) NOT NULL,
	"city" varchar(255) NOT NULL,
	"country" varchar(255) NOT NULL,
	"venue" varchar(255) NOT NULL,
	"timezone" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"allow_requests_from" timestamp,
	"is_active" boolean DEFAULT false NOT NULL,
	"buffer" integer DEFAULT 15 NOT NULL,
	"min_notice" integer DEFAULT 60 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"capacity" integer DEFAULT 0 NOT NULL,
	"color" varchar(50) DEFAULT 'sky' NOT NULL,
	"availability" jsonb DEFAULT '[[],[],[],[],[]]'::jsonb NOT NULL,
	"video_link_url" varchar(2048),
	"video_link_name" varchar(255) DEFAULT 'Webex',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"from_email" varchar(255),
	"reply_to" varchar(255),
	"approvers" varchar(255)[] DEFAULT '{}'::varchar[] NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"auth_user_id" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_organizer_id_users_id_fk" FOREIGN KEY ("organizer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_meeting_id_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_created_at_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_meeting_id_idx" ON "bookings" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "bookings_room_id_idx" ON "bookings" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "bookings_organizer_id_idx" ON "bookings" USING btree ("organizer_id");--> statement-breakpoint
CREATE INDEX "bookings_state_idx" ON "bookings" USING btree ("state");--> statement-breakpoint
CREATE INDEX "rooms_meeting_id_idx" ON "rooms" USING btree ("meeting_id");