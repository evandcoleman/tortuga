CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`detail` text,
	`href` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`acknowledged_at` integer,
	`emailed_at` integer,
	`email_attempts` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alerts_key_uniq` ON `alerts` (`key`);