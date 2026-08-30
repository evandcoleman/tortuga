import { registerNewsletterModule } from './newsletter/module';

// Announcements has no runtime wiring (no cron, no config registration) —
// its schema is picked up by drizzle via the modules/*/schema.ts glob in
// drizzle.config.ts, so there is nothing to register here.
export function registerAllModules() {
  registerNewsletterModule();
}
