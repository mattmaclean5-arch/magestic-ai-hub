# Magestic AI Hub · Feed Algorithm

How the self-updating feed decides what Magestic employees see. All knobs live in `scripts/update-feed.mjs`.

## 1. Sourcing (every refresh)
170+ sources: official AI labs, 15+ AI dev-tool vendors (Cursor, Windsurf, Replit, Cognition, Mistral, xAI, Perplexity…), Magestic-industry trade press, independent thought leaders, YouTube channels (labs, tool vendors, industry OEMs like TRUMPF and Machina Labs), topical craft queries (AI nesting, CAM, composites, sheet metal), JEC World / FABTECH conference watch, and the 265-company watchlist (38 priority companies every run; the rest rotate, full cycle ≈ 8h). Company queries target how firms use AI in manufacturing/production/engineering.

## 2. Hard gates (drop unless ALL pass)
- **AI relevance** — every publication-type source and every aggregator/company item must mention real AI terms (AI, machine learning, generative, copilot, LLM, Claude, GPT, Codex, agentic…). "Automation"/"robot" alone don't count.
- **Magestic-domain relevance** — broad industrial sources must match manufacturing/craft vocabulary or name a watchlist company.
- **Banned genres** — stock/investment analysis; weapons-product news (unless about production itself); supply chain/logistics; webinar promos — unless core-craft.
- **Quality** — deduplicated bodies, digest roundups skipped, and 100% of posts must carry an image or video.

## 3. Weights (ranking within each day)
| Signal | Weight | Captures |
|---|---|---|
| Core craft match | **+3** | nesting, punching, nibbling, bin-packing, composites (prepreg/ply/layup/AFP/ATL), sheet metal, TruLaser/TruTops, laser projection (LPT), waterjet, plasma, press brake, turret, CAM/CAD, toolpaths, post processors, material yield |
| Developer education | **+2** | tutorials/how-to for developers (Claude Code, Codex, agents) |
| Premium trade press | **+2** | CompositesWorld, MTDCNC, Fabricating & Metalworking, JEC, Manufacturing Dive, Develop3D, Modern Machine Shop |
| Video | **+1** | any post with playable video |
| General tech media | **−2** | MIT Tech Review, Quanta, Synced, MarkTechPost, The Decoder, O'Reilly, McKinsey, Sloan, Wharton |

Weights stack (an AI-nesting tutorial video from trade press = +6). Order: newest day first, then weight within the day — so each day reads craft-AI → dev education/video → company & trade news → general AI press.

## 4. Mix, archive, cadence
- **50/50 balance**: industry news vs AI training/news trimmed to within 15% each refresh.
- **Per-source caps**: labs 2–3, alternative tool vendors 1, thought leaders 2, trade press up to 4.
- **Rolling archive**: 400 posts, ~25–80 added/day; every refresh re-screens old posts against current rules (filter upgrades clean history retroactively).
- **Cadence**: scheduled `*/15`; GitHub throttles free-tier schedules, so delivery is at-least-hourly. Manual: Actions → "Refresh live feed" → Run workflow.
