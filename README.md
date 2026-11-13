# reading-pusher

pushes what I'm reading to Upstash, for the reading line on jopcmelo.dev.

runs in the `reading` Coolify stack next to Calibre-Web and kosync. every 5 minutes it fingerprints the Calibre library the way KOReader does, asks kosync for each book's progress, and writes the newest one to `reading:current` (plus a resized cover to `reading:cover`). spec: `docs/superpowers/specs/2026-11-13-reading-line-design.md` in `terminal-portfolio`.
