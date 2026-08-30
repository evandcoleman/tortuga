import type { NewsletterConfig } from '@/kernel/config/schema';
import { mergeAndValidate, type ParseResult } from '../_lib/config-patch';
import { str, bool, num } from '../_lib/form-values';

export function parseGeneralForm(fd: FormData, current: NewsletterConfig): ParseResult {
  const serverId = str(fd, 'plex.server_id');
  return mergeAndValidate(current, {
    schedule: str(fd, 'schedule'),
    schedule_enabled: bool(fd, 'schedule_enabled'),
    timezone: str(fd, 'timezone'),
    lookback_days: num(fd, 'lookback_days'),
    plex: serverId ? { server_id: serverId } : undefined,
  });
}
