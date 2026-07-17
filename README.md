# Magestic AI Hub

An internal AI research and education platform for the Magestic Technologies team: a LinkedIn-style feed of AI industry news, an Industry Watch covering 200+ companies in Magestic's market, a role-based Learning Center, a tracked-tools guide, and a directory of 125+ vendor-neutral SMEs and thought leaders.

Curated by Matt MacLean, Director of AI.

## Quick start (no build step)

The site is plain HTML/CSS/JS with zero dependencies. Open `index.html` in any browser, or serve the folder:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

## Repository layout

```
index.html                    page shell and markup
assets/styles.css             all styling
assets/app.js                 rendering, filters, search, navigation
data/content.js               roles, avatars, learning center, tools, news wire
data/feed.js                  curated feed posts (hand-written, edit freely)
data/feed-live.js             AUTO-GENERATED live feed items (do not edit)
data/directory.js             featured experts + full vendor-neutral directory
data/companies.js             Industry Watch: 265 companies w/ AI-leadership scores (from the AI Landscape workbook)
scripts/update-feed.mjs       regenerates data/feed-live.js from public RSS feeds
.github/workflows/update-feed.yml   hourly feed refresh (GitHub Actions)
.github/workflows/pages.yml         GitHub Pages deploy on every push
```

## Deploying to GitHub (one-time)

1. Create a repo (e.g. `magestic-ai-hub`) and push this folder to `main`.
2. In the repo: Settings → Pages → Source → **GitHub Actions**.
3. Push (or run the "Deploy to GitHub Pages" workflow manually). The site goes live at the Pages URL.
4. The "Refresh live feed" workflow then runs every 15 minutes on its own: it pulls 100+ public RSS feeds plus per-company Google News (priority companies every run; the rest rotating so all 265 cycle roughly every 8 hours), rewrites `data/feed-live.js`, commits, and that push triggers a redeploy. No human or AI in the loop.

Note on cadence: GitHub Actions minutes are unlimited on public repos; on a private repo, 15-minute refreshes may exceed the free 2,000 min/month, so either make the repo public or change the cron in .github/workflows/update-feed.yml back to hourly ('0 * * * *').

To refresh the feed manually at any time: Actions → "Refresh live feed" → Run workflow, or locally `node scripts/update-feed.mjs` (Node 20+).

## Editing content

- **Feed posts**: add objects to `POSTS_CURATED` in `data/feed.js`. Fields: `a` author, `s` subtitle, `av` avatar key, `t` type (`official` | `industry` | `voice` | `internal`), `d` ISO date, `when` display date, `body`, `tags` (role names), `topic`, optional `link {u,b,s}`.
- **Companies**: edit `data/companies.js` (regenerated from Magestic_AI_Landscape_Competitors_and_Customers_1.xlsx). Set `p:1` to promote a company into Priority Watch and the every-run news pull. Note: social platforms (LinkedIn/X) block programmatic pulling of posts, so company tracking runs on press releases and news coverage via Google News RSS, which includes conference and industry announcements.
- **Experts**: edit `data/directory.js`. `EXPERTS` are the featured cards; `DIRECTORY` is the full list. Vendor-neutral only, by policy: no employees of AI model or tool vendors.
- **News sources for the live feed**: edit the `FEEDS` array in `scripts/update-feed.mjs`.

## Notes

- Company "Latest AI news" links are live Google News queries, so that section stays current with zero maintenance.
- The Research Library page is temporarily disabled; its data can be restored from git history when wanted.
- Content policy for this hub: educational and industry material only; no internal AI policy, security architecture, or rollout planning documents.
