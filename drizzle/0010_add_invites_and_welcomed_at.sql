CREATE TABLE `invites` (
	`email` text PRIMARY KEY NOT NULL,
	`section_ids` text NOT NULL,
	`sent_at` integer NOT NULL,
	`welcome_sent_at` integer,
	`status` text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `recipients_cache` ADD `welcomed_at` integer;
--> statement-breakpoint
-- Grandfather every pre-existing recipient: rollout of the "not welcomed"
-- badge should never retroactively flag users who joined before this feature.
UPDATE `recipients_cache` SET `welcomed_at` = (unixepoch() * 1000) WHERE `welcomed_at` IS NULL;