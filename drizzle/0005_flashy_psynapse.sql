CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`recipient_emails` text NOT NULL,
	`status` text NOT NULL,
	`rendered_html` text,
	`created_at` integer NOT NULL,
	`sent_at` integer,
	`error` text
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text,
	`announcement_id` text,
	`recipient_email` text NOT NULL,
	`recipient_name` text NOT NULL,
	`provider_message_id` text,
	`provider` text,
	`status` text NOT NULL,
	`sent_at` integer,
	`error` text,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sends`("id", "digest_id", "announcement_id", "recipient_email", "recipient_name", "provider_message_id", "provider", "status", "sent_at", "error") SELECT "id", "digest_id", NULL, "recipient_email", "recipient_name", "provider_message_id", "provider", "status", "sent_at", "error" FROM `sends`;--> statement-breakpoint
DROP TABLE `sends`;--> statement-breakpoint
ALTER TABLE `__new_sends` RENAME TO `sends`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sends_digest_idx` ON `sends` (`digest_id`);--> statement-breakpoint
CREATE INDEX `sends_announcement_idx` ON `sends` (`announcement_id`);--> statement-breakpoint
CREATE INDEX `sends_email_idx` ON `sends` (`recipient_email`);