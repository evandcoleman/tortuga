CREATE TABLE `recipient_preferences` (
	`email` text PRIMARY KEY NOT NULL,
	`digest` integer DEFAULT true NOT NULL,
	`announcements` integer DEFAULT true NOT NULL,
	`libraries` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recipients_cache` ADD `suppressed_reason` text;--> statement-breakpoint
ALTER TABLE `unsubscribes` ADD `category` text DEFAULT 'digest' NOT NULL;--> statement-breakpoint
UPDATE `recipients_cache` SET `suppressed_reason` = 'admin' WHERE `active` = 0 AND `suppressed_reason` IS NULL;