# Magestic AI Hub — Feed Algorithm & Weighting Reference

Prepared by Matt MacLean, Director of AI · July 21, 2026 (supersedes the July 17 one-pager). Source of truth: the `FEEDS` array and gate definitions in `scripts/update-feed.mjs`.

## 1. Pipeline overview

The hub is a static site on GitHub Pages. A GitHub Actions workflow is scheduled every 5 minutes (GitHub batches scheduled runs as capacity allows, so real cadence is typically 10–20 minutes). Each run executes `scripts/update-feed.mjs` on GitHub's servers: it pulls roughly 175 public RSS/Atom feeds plus per-company news queries, filters and scores every item, rewrites `data/feed-live.js`, and commits. That commit triggers a Pages redeploy, so the site anyone loads is already fresh. No human or AI is in the loop.

## 2. Source classes

**AI vendors** — official channels and blogs: Anthropic, OpenAI, Google, GitHub, Microsoft, and the leading agentic-coding alternatives (Cursor, Windsurf, Replit, Cognition/Devin, Mistral, xAI, Perplexity, AWS, JetBrains).

**Trade press** — CompositesWorld, The Fabricator, Modern Machine Shop, MTDCNC, Aerospace Manufacturing & Design, Additive Manufacturing Media, Production Machining, Manufacturing Dive, MoldMaking Technology, Plastics Technology, TCT Magazine, 3D Printing Industry, Interesting Engineering, and peers. Every industry publication passes through the AI keyword gate before anything reaches the feed.

**Expert voices** — vendor-neutral SMEs with open blogs/newsletters (Simon Willison, Ethan Mollick, Chip Huyen, …). Same rules as everyone else; nobody is pinned.

**YouTube** — official Anthropic and OpenAI channels (up to 8 videos each per run, weight +3) plus vetted instructional channels (AI Engineer, IndyDevDan, machining/fabrication vendor channels). A video slot guarantee prevents text items from crowding videos out.

**Topical lanes** — Bing News queries for Magestic-specific themes: sheet metal AI, CNC & machining AI, composites AI, CAM/nesting software, smart factory aero & defense, generative design, quality inspection & machine vision, fabrication equipment (press brake / punching / laser), JEC World, FABTECH, IMTS.

**AI Regulatory & Compliance** (added July 21) — a dedicated bucket so regulation news surfaces on equal footing with model news: US and EU AI regulation (AI Act, executive orders), export controls and ITAR as they touch AI, security/privacy scrutiny of Chinese open models (bans, restrictions, national-security reviews), AI governance frameworks (NIST AI RMF, ISO/IEC 42001), and defense-supplier compliance (data sovereignty, CMMC, DFARS). Sources: five Bing News lanes plus the EU AI Act Newsletter, CSET Georgetown, and FedScoop (AI-titled items only). These carry topic "Regulatory", have their own feed filter pill, count on the industry side of the mix, and persist in the archive without needing an AI keyword match (the lanes are already AI-scoped).

**Company Watch** — all 305 watchlist companies: the original 265 from the AI Landscape workbook plus a July 21 expansion covering machine-tool builders (Mazak, DMG Mori, Haas, Okuma, TRUMPF peers), CAD/CAE vendors (PTC, Ansys, Altair, ESI), additive manufacturing (Stratasys, EOS, Velo3D, Nikon SLM), metrology and machine vision (Renishaw, Zeiss, Cognex), robotics (FANUC, KUKA, ABB), and aero OEMs (Bombardier, Embraer, Gulfstream, Bell, Joby, Archer). The 38 priority companies (Boeing, Lockheed Martin, Leonardo, GKN, Dassault, Autodesk, Siemens, Northrop Grumman, RTX, Electric Boat, Wabtec, GE, SigmaTEK, Greenheck Fan, …) are queried every run and may land 4 stories each; the remaining 267 rotate 70 per run, so the full list cycles roughly every 4 hours, 2 stories each.

## 3. Filter gates (closed by default)

An item must clear every applicable gate to enter the feed. The design principle: nothing gets in unless a rule affirmatively admits it.

| Gate | What it does |
| --- | --- |
| AI keyword gate | Every trade-press item and every aggregator/company item must match AI vocabulary (AI, machine learning, generative, LLM, copilot, Claude, GPT, Codex, agentic, …) in the title or body. Applies structurally to all industry-class sources. |
| Manufacturing context | Magestic-domain vocabulary (nesting, punching, AFP/ATL, prepreg, laser projection, TruLaser, waterjet, press brake, CAM/CAD/PLM, toolpath, genetic algorithm, material yield, …) qualifies items for the core-relevance boost and rescues defense stories with a manufacturing angle. |
| Financial noise ban | Stock/analyst genre blocked outright: price targets, ratings, "Seeking Alpha"-style coverage, earnings chatter. Applied to aggregator results, company news, and the carried archive. |
| Weapons-product ban | Weapons-system product news is excluded unless the story is about manufacturing technology itself. |
| Off-topic ban | Supply-chain/logistics commentary and webinar/promo content excluded unless core manufacturing vocabulary is present. |
| Recency & dedupe | Company news older than 14 days is dropped; duplicates removed by link and normalized title-vs-body overlap. |
| 100% media | Live items without an image or video thumbnail are dropped after og:image enrichment (up to 100 article pages fetched per run). |

## 4. Weighting

Weights break ties within a publication day — the feed sorts newest-first, then by weight. Weights accumulate per item.

| Signal | Weight | Rationale |
| --- | --- | --- |
| Core Magestic relevance (nesting, composites, CAM, fabrication vocabulary) | +3 | The reason the hub exists; these must surface first. |
| Anthropic / OpenAI official video channels | +3 (channel) | Requested emphasis: developer how-to content from the two primary vendors. |
| Developer education (Tools topic + video or Developers tag) | +2 | Hands-on Claude Code / Codex instruction ranks above news. |
| Premium trade press (CompositesWorld, Modern Machine Shop, MTDCNC, MoldMaking Technology, Manufacturing Dive) | +2 (source) | Highest-signal industry outlets. |
| Claude Code / Codex news lanes | +2 (source) | Tool-specific coverage of the two flagship coding agents. |
| AI Regulatory & Compliance lanes | +3 (source) | Regulation, export control, ITAR, and compliance news ranks at the top tier alongside core Magestic relevance — employees seeing Chinese-model progress must equally see the regulatory response. |
| Any video | +1 | Video preferred at equal relevance. |
| General AI media (MIT Tech Review, Synced, MarkTechPost, The Decoder, O'Reilly, McKinsey, …) | −2 (source) | Allowed through the gates but always ranked beneath industry-specific coverage. |

## 5. Mix balancing — industry-weighted

After filtering, items split into an industry side (Industry AI + Company Watch) and an AI side (models, tools, training, adoption). The industry side keeps up to 1.6× the smaller side's count and the AI side up to 1.1×, targeting roughly a 60/40 industry-to-AI mix (updated July 21 from the earlier 50/50). Caps per run: 150 general items, 90 company items, with guaranteed video slots.

## 6. Rolling archive

Fresh items merge into the previous feed rather than replacing it. Carried items are re-screened against the current rules on every run — a rule added today also purges yesterday's archive — then everything is deduplicated and capped at 400 posts, newest first. The "Updated" badge in the header reads the archive's real generation timestamp.

## 7. What the algorithm never does

- No engagement optimization: nothing is ranked by clicks, and there is no personalization — every team member sees the same feed (saves and comments are personal; the ranking is not).
- No financial content, no stock analysis, no weapons-product promotion, no non-AI content.
- No LinkedIn scraping (platform terms prohibit it); LinkedIn-only voices are linked from the Experts page instead.
