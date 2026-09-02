export interface LibraryTemplateContent {
  slug: string;
  name: string;
  subject: string;
  body: string;
}

/**
 * Starting-point content for the template library. Short and neutral —
 * admins are expected to edit these to fit their server. Seeding is tracked
 * per-slug (see seed.ts), so a deleted library template does not come back.
 */
export const LIBRARY_TEMPLATES: readonly LibraryTemplateContent[] = [
  {
    slug: 'server-back-up',
    name: 'Server is back up',
    subject: '{{server_name}} is back online',
    body: `Hi {{name}},

Just a quick note that **{{server_name}}** is back up and running. Thanks
for your patience — you should be able to stream again now.

If anything still looks off on your end, reply to this email and we'll
take a look.`,
  },
  {
    slug: 'password-help',
    name: 'Password help',
    subject: 'Resetting your Plex password',
    body: `Hi {{name}},

Having trouble signing in to **{{server_name}}**? You can reset your Plex
password here:

[Reset your password](https://www.plex.tv/sign-in/password-reset/)

Once it's reset, sign back in and {{server_name}} should show up under
your servers as usual. Reply to this email if you're still stuck.`,
  },
  {
    slug: 'removal-notice',
    name: 'Removal notice',
    subject: 'Your access to {{server_name}}',
    body: `Hi {{name}},

Your access to **{{server_name}}** has ended. Thanks for being part of
the server — we appreciated having you.

If you have any questions, just reply to this email.`,
  },
];
