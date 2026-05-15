PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`digest_id` text NOT NULL,
	`recipient_email` text NOT NULL,
	`recipient_name` text NOT NULL,
	`provider_message_id` text,
	`provider` text,
	`status` text NOT NULL,
	`sent_at` integer,
	`error` text,
	FOREIGN KEY (`digest_id`) REFERENCES `digests`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_sends`(`id`, `digest_id`, `recipient_email`, `recipient_name`, `provider_message_id`, `provider`, `status`, `sent_at`, `error`)
SELECT `id`, `digest_id`, `recipient_email`, `recipient_name`, `resend_message_id`, NULL, `status`, `sent_at`, `error` FROM `sends`;--> statement-breakpoint
DROP TABLE `sends`;--> statement-breakpoint
ALTER TABLE `__new_sends` RENAME TO `sends`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `sends_digest_idx` ON `sends` (`digest_id`);--> statement-breakpoint
CREATE INDEX `sends_email_idx` ON `sends` (`recipient_email`);--> statement-breakpoint
CREATE TABLE `__new_send_events` (
	`id` text PRIMARY KEY NOT NULL,
	`send_id` text,
	`provider_message_id` text NOT NULL,
	`provider` text,
	`type` text NOT NULL,
	`received_at` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`send_id`) REFERENCES `sends`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_send_events`(`id`, `send_id`, `provider_message_id`, `provider`, `type`, `received_at`, `payload`)
SELECT `id`, `send_id`, `resend_message_id`, NULL, `type`, `received_at`, `payload` FROM `send_events`;--> statement-breakpoint
DROP TABLE `send_events`;--> statement-breakpoint
ALTER TABLE `__new_send_events` RENAME TO `send_events`;
