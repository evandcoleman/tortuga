import { registerNewsletterModule } from './newsletter/module';
import { registerAnnouncementsModule } from './announcements/module';
import { registerTemplatesModule } from './templates/module';

export function registerAllModules() {
  registerNewsletterModule();
  registerAnnouncementsModule();
  registerTemplatesModule();
}
