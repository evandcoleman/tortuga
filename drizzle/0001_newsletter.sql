CREATE TABLE `digests` (
	`id` text PRIMARY KEY NOT NULL,
	`scheduled_at` integer NOT NULL,
	`ran_at` integer,
	`window_start` integer NOT NULL,
	`window_end` integer NOT NULL,
	`status` text NOT NULL,
	`item_count` integer DEFAULT 0 NOT NULL,
	`rendered_html` text,
	`rendered_subject` text,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `digests_scheduled_at_uniq` ON `digests` (`scheduled_at`);--> statement-breakpoint
CREATE TABLE `items_cache` (
	`guid` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`added_at` integer NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recipients_cache` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`plex_username` text,
	`last_synced` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `send_events` (
	`id` text PRIMARY KEY NOT NULL,
	`send_id` text,
	`resend_message_id` text NOT NULL,
	`type` text NOT NULL,
	`received_at` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`send_id`) REFERENCES `sends`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sends` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`recipient_name` text NOT NULL,
	`resend_message_id` text,
	`status` text NOT NULL,
	`sent_at` integer,
	`error` text,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `sends_digest_idx` ON `sends` (`digest_id`);--> statement-breakpoint
CREATE INDEX `sends_email_idx` ON `sends` (`recipient_email`);--> statement-breakpoint
CREATE TABLE `unsubscribes` (
	`token` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	`used_at` integer
);
