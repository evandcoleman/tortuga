ALTER TABLE `digests` ADD `slug` text;--> statement-breakpoint
ALTER TABLE `digests` ADD `web_html` text;--> statement-breakpoint
CREATE UNIQUE INDEX `digests_slug_uniq` ON `digests` (`slug`);