CREATE TYPE "public"."bookingState" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookingOrganizers" (
	"bookingId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "bookingOrganizers_bookingId_userId_pk" PRIMARY KEY("bookingId","userId")
);
--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"state" "bookingState" DEFAULT 'pending' NOT NULL,
	"description" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"startsAt" timestamp NOT NULL,
	"endsAt" timestamp GENERATED ALWAYS AS ("bookings"."startsAt" + ("bookings"."duration" * INTERVAL '1 minute')) STORED,
	"duration" integer DEFAULT 0 NOT NULL,
	"videoLinkUrl" varchar(2048) NOT NULL,
	"videoLinkName" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"meetingId" uuid NOT NULL,
	"roomId" uuid NOT NULL,
	"initialOrganizerId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"timezone" varchar(255) NOT NULL,
	"startDate" date NOT NULL,
	"endDate" date NOT NULL,
	"allowRequestsFrom" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"color" varchar(255) NOT NULL,
	"banner" text NOT NULL,
	"durations" integer[] DEFAULT '{}' NOT NULL,
	"defaultDuration" integer DEFAULT 0 NOT NULL,
	"bufferBeforeEvent" integer DEFAULT 0 NOT NULL,
	"bufferAfterEvent" integer DEFAULT 0 NOT NULL,
	"minimumNotice" integer DEFAULT 0 NOT NULL,
	"videoLinkUrl" varchar(2048) NOT NULL,
	"videoLinkName" varchar(255) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"meetingId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"authUserId" varchar(255),
	"isActive" boolean DEFAULT false NOT NULL,
	"isAdmin" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bookingOrganizers" ADD CONSTRAINT "bookingOrganizers_bookingId_bookings_id_fk" FOREIGN KEY ("bookingId") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookingOrganizers" ADD CONSTRAINT "bookingOrganizers_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_meetingId_meetings_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_roomId_rooms_id_fk" FOREIGN KEY ("roomId") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_initialOrganizerId_users_id_fk" FOREIGN KEY ("initialOrganizerId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_meetingId_meetings_id_fk" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "userGroups_bookingId_idx" ON "bookingOrganizers" USING btree ("bookingId");--> statement-breakpoint
CREATE INDEX "userGroups_userId_idx" ON "bookingOrganizers" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "userGroups_composite_idx" ON "bookingOrganizers" USING btree ("bookingId","userId");