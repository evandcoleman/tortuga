PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_send_events` (
	`id` text PRIMARY KEY NOT NULL,
	`send_id` text,
	`provider_message_id` text,
	`provider` text,
	`type` text NOT NULL,
	`received_at` integer NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`send_id`) REFERENCES `sends`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_send_events`("id", "send_id", "provider_message_id", "provider", "type", "received_at", "payload") SELECT "id", "send_id", "provider_message_id", "provider", "type", "received_at", "payload" FROM `send_events`;--> statement-breakpoint
DROP TABLE `send_events`;--> statement-breakpoint
ALTER TABLE `__new_send_events` RENAME TO `send_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;