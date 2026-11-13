# reading-pusher

pushes what I'm reading to Upstash, for the reading line on jopcmelo.dev.

runs in the `reading` Coolify stack next to Calibre-Web and kosync. every 5 minutes it fingerprints the Calibre library the way KOReader does, asks kosync for each book's progress, and writes the newest one to `reading:current` (plus a resized cover to `reading:cover`). spec: `docs/superpowers/specs/2026-11-13-reading-line-design.md` in `terminal-portfolio`.

## cover budget

covers are resized to 240px wide JPEG before they go to Upstash. measured on 2026-11-13 over the 8 books in the library (`bun scripts/measure-covers.ts /books`): resized sizes 9,729 to 20,785 B. the biggest original was 2,326,744 B (_Ordem_, 1043×1500) and came out at 18,335 B.

`COVER_MAX_BYTES` is 90,000 B: 4× the largest measured cover, rounded up to the next 10 KB. a cover over it is skipped (the line still shows, without a cover) and the log names the limit, the size and the file.
