// Built-in default copy for the three portal content pages, per
// docs/specs/2026-08-31-user-portal.md ("Pages" / "Content model"). Rendered
// through `renderPortalMarkdown` (substitution + markdown), and replaced
// wholesale by a per-page `markdown` override when one is configured.

export const GETTING_STARTED_TITLE = 'Getting started';

export const GETTING_STARTED_MARKDOWN = `Welcome! Here's how to get watching in a few minutes.

## 1. Accept your invite

Check your email for the Plex invite and accept it, or sign in at
[plex.tv](https://plex.tv) — **{{server_name}}** will show up under your
servers once it's accepted.

## 2. Install an app

Pick whichever fits how you watch — you can install as many as you like:

- **TV / streaming box** — the Plex app on Apple TV, Roku, Fire TV, or your
  smart TV.
- **Desktop** — [plex.tv/apps](https://plex.tv/apps) for Windows, Mac, and
  Linux.
- **Mobile** — Plex on iOS or Android.

## 3. Pick {{server_name}}

Open the app, sign in with the account you accepted the invite with, and
select **{{server_name}}** from your list of servers.

## 4. Stream

That's it — browse the libraries and press play.

## Recommended devices

For the smoothest experience, an Apple TV, a recent Roku, Fire TV, or a
smart TV with a native Plex app will give you the best playback quality.
Casting from a laptop or phone works too, but a dedicated streaming device
is usually more reliable for day-to-day watching.

## Here for music? (Plexamp)

If you're mainly here for the music library, try
[Plexamp](https://plexamp.com) — Plex's dedicated music player. It signs in
with the same account and gives you a much better listening experience than
the general Plex app: gapless playback, better queueing, and a music-first
interface.`;

export const RULES_TITLE = 'House rules';

export const RULES_MARKDOWN = `A few ground rules so **{{server_name}}** stays good for everyone.

- **Share within your household only.** Access is for you and the people you
  live with — please don't hand out your login or invite outside your
  household.
- **Report broken files.** If something won't play, stutters, or looks
  wrong, let us know so it can get fixed or re-added.
- **Request freely.** If it's not on the server, ask — that's what the
  request link is for. No need to ask permission first.
- **Report missing episodes or seasons.** If a show is incomplete, flag it
  rather than assuming it's intentional.

Thanks for keeping things running smoothly.`;

export const REPORT_ISSUE_TITLE = 'Report an issue';

export const REPORT_ISSUE_MARKDOWN = `Something not playing right, missing, or broken? Here's how to report it.

## Content issues

Use the **Report Issue** flow in {{request_label}} — it routes straight to
the person who can fix it: [{{request_label}}]({{request_url}}).

This covers things like:

- A video or audio file that won't play or is corrupted
- Wrong subtitles, or subtitles that are missing entirely
- A movie or episode that's the wrong version, or has the wrong metadata

## Something else?

If it's not a content issue — the server itself seems down, or something
outside of a specific title is broken — reach out directly instead of using
the request flow above.

There's no form here: everything routes through {{request_label}}.`;
