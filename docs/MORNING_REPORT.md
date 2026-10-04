# Morning report (2026-10-04)

## STOPPED: unexpected publish found (rule: stop, write it here, wait)

While doing item 1 (audit of every Instagram call), a read-only listing of @basaer.media.bh returned **2** media items, not 1:

| Published (UTC) | Type | Media ID | Link | Made by |
|---|---|---|---|---|
| 2026-10-02 17:16:04 | **Reel** | 18105703034573681 | https://www.instagram.com/reel/Dd__1FiCdrE/ | **Unknown, NOT this project's tooling** |
| 2026-10-04 04:02:47 | Image post (94:6) | 18391121536165913 | https://www.instagram.com/p/DeDusHzFoRe/ | The one post you asked for last night (temporary one-off workflow, deleted afterwards) |

Stories: none. Account media_count = 2.

Why I think the Reel is not from this project: the full session transcript has no Instagram publish or container call before 2026-10-04 04:01 UTC; at 17:16 UTC on 2 Oct the session was installing ffmpeg locally. Every Basaer workflow's Instagram nodes have been disabled since they were built (the Reel workflow was only created at 20:44 UTC that day), and the Approve presses this morning show the disabled nodes only passed data through (no HTTP call). I did NOT look at any AH Brands workflow (your rule), so I cannot rule out something on that side; a manual test from your phone or the Meta Graph API Explorer on 2 Oct is the other possibility.

What I need from you: tell me whether that Reel was yours. If it was not, check who else has access to the Basaer Publisher app / account and rotate the token (you planned to anyway). If it was yours, say "continue overnight tasks" and I resume from item 1 (step "done" except this question).

## Nothing else was changed tonight

- No publish, no publish node enabled, Daily Post and Reel INACTIVE, active stay Draft Approval / Reel Error Alerts / Token Monitor. No token or credential changed. Nothing AH Brands touched.
- The only thing created was ONE temporary read-only workflow ("TEMP read-only IG media audit": three GET calls, output stripped of paging links that contain the token), deleted right after use.
- GitHub Actions minutes used tonight: 0. Cloudinary qa-overnight: empty. No Telegram message sent.

## Also noticed

- A file named `New folder/instagram App Graph Api token.txt` sits in your project folder on C:. I did not open it. If it holds a token, delete it after you rotate the token.

## Items 2-13

Not started (see docs/OVERNIGHT_LOG.md). The work is ready to resume as soon as you answer the question above.
