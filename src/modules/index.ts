import { registerNewsletterModule } from './newsletter/module';
import { registerAnnouncementsModule } from './announcements/module';
import { registerTemplatesModule } from './templates/module';
import { registerAlertsModule } from './alerts/module';

export function registerAllModules() {
  registerNewsletterModule();
  registerAnnouncementsModule();
  registerTemplatesModule();
  registerAlertsModule();
}
