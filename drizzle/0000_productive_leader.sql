CREATE TYPE "public"."event_status" AS ENUM('proposed', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('open', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('open', 'withdrawn', 'closed');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('active', 'used', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('public', 'artist', 'venue', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'email_invalid');--> statement-breakpoint
CREATE TABLE "artist_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"instagram_url" text,
	"website_url" text,
	"portfolio_blobs" jsonb
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"preferred_dates" date[],
	"capacity_wanted" integer,
	"poster_blob" text,
	"status" "proposal_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artist_id" uuid NOT NULL,
	"venue_id" uuid NOT NULL,
	"source_proposal_id" uuid,
	"source_listing_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"start_at" timestamp with time zone NOT NULL,
	"capacity" integer NOT NULL,
	"poster_blob" text,
	"status" "event_status" DEFAULT 'proposed' NOT NULL,
	"artist_ack" boolean DEFAULT false NOT NULL,
	"venue_ack" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancelled_reason" text,
	"bootstrapped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_capacity_positive" CHECK ("events"."capacity" > 0),
	CONSTRAINT "events_published_iff_both_ack" CHECK (("events"."status" = 'published') = ("events"."artist_ack" AND "events"."venue_ack"))
);
--> statement-breakpoint
CREATE TABLE "magic_link_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "magic_link_tokenhash_uq" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"qr_hash" text NOT NULL,
	"status" "ticket_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "tickets_event_user_uq" UNIQUE("event_id","user_id"),
	CONSTRAINT "tickets_qrhash_uq" UNIQUE("qr_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_uq" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venue_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"venue_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"available_dates" date[],
	"status" "listing_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venue_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address_street" text,
	"address_city" text,
	"address_postal" text,
	"geo_lat" numeric,
	"geo_lon" numeric,
	"capacity" integer NOT NULL,
	"photo_blobs" jsonb,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "artist_profiles" ADD CONSTRAINT "artist_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_messages" ADD CONSTRAINT "event_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_proposals" ADD CONSTRAINT "event_proposals_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_artist_id_users_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_venue_id_users_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_proposal_id_event_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."event_proposals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_source_listing_id_venue_listings_id_fk" FOREIGN KEY ("source_listing_id") REFERENCES "public"."venue_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_listings" ADD CONSTRAINT "venue_listings_venue_id_users_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venue_profiles" ADD CONSTRAINT "venue_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_target_created_idx" ON "audit_log" USING btree ("target","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "proposals_status_created_idx" ON "event_proposals" USING btree ("status","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_status_start_idx" ON "events" USING btree ("status","start_at");--> statement-breakpoint
CREATE INDEX "events_artist_status_idx" ON "events" USING btree ("artist_id","status");--> statement-breakpoint
CREATE INDEX "events_venue_status_idx" ON "events" USING btree ("venue_id","status");--> statement-breakpoint
CREATE INDEX "tickets_event_status_idx" ON "tickets" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "tickets_user_status_idx" ON "tickets" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "listings_status_created_idx" ON "venue_listings" USING btree ("status","created_at" DESC NULLS LAST);