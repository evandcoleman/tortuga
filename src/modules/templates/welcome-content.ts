export const WELCOME_TEMPLATE_SLUG = 'welcome';

export const WELCOME_TEMPLATE_NAME = 'Welcome';

export const WELCOME_TEMPLATE_SUBJECT = "You're in — welcome to {{server_name}}";

// Editable-but-not-deletable seed content: accept steps, apps to install, a
// request-content pointer, and a house-rules placeholder for the admin to
// fill in per-server.
export const WELCOME_TEMPLATE_BODY = `Hi {{name}},

You've been invited to **{{server_name}}**. Here's how to get started.

## 1. Accept your invite

Check your email (**{{email}}**) for the Plex invite and accept it, or sign
in at [plex.tv](https://plex.tv) — {{server_name}} will show up under
your servers once it's accepted.

## 2. Install an app

Pick whichever fits how you watch:

- **TV / streaming box** — Plex app on Apple TV, Roku, Fire TV, or your
  smart TV.
- **Desktop** — [plex.tv/apps](https://plex.tv/apps) for Windows, Mac, and
  Linux.
- **Mobile** — Plex on iOS or Android.

## 3. Request something new

Don't see what you're looking for? Use the request link to ask for it —
we'll add it when we can.

## House rules

_(Admin: replace this section with your server's house rules.)_

Welcome aboard!`;
