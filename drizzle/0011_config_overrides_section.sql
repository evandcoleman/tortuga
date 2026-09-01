ALTER TABLE `config_overrides` ADD `section` text DEFAULT 'newsletter' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `config_overrides_section_unique` ON `config_overrides` (`section`);