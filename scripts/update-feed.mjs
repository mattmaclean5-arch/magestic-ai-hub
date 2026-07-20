#!/usr/bin/env node
/* Regenerates data/feed-live.js from public RSS/Atom feeds.
   No dependencies — plain Node 20+ (global fetch).
   Run locally:  node scripts/update-feed.mjs
   Run on GitHub: .github/workflows/update-feed.yml calls this hourly and commits changes. */

import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "data", "feed-live.js");
const DEFAULT_PER_FEED = 2;
const MAX_TOTAL = 100;
const MAX_COMPANY_ITEMS = 50;

/* Public feeds. Each entry: url, display name, avatar key (from data/content.js AV), post type, role tags, topic. */
const FEEDS = [
  /* news organizations & industry press (max 3 each) */
  { url: "https://openai.com/news/rss.xml", who: "Official OpenAI newsroom", a: "OpenAI", av: "openai", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { url: "https://blog.google/technology/ai/rss/", who: "Official Google AI blog", a: "Google AI", av: "google", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { url: "https://github.blog/feed/", who: "Official GitHub blog", a: "GitHub", av: "github", t: "official", tags: ["Developers"], topic: "Tools", max: 3 },
  { w: 2, url: "https://www.compositesworld.com/rss/news", kw: true, who: "The composites manufacturing industry's leading publication", a: "CompositesWorld", av: "industry", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 4 },
  { w: 2, url: "https://mtdcnc.com/feed/", kw: true, who: "CNC machining industry news & video (UK)", a: "MTDCNC", av: "industry", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
  /* SMEs & thought leaders with open feeds (max 2 each, all equal) */
  { url: "https://simonwillison.net/atom/everything/", who: "Independent AI researcher & blogger", a: "Simon Willison", av: "willison", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Adoption" },
  { url: "https://www.oneusefulthing.org/feed", who: "Wharton professor · AI adoption (One Useful Thing)", a: "Ethan Mollick", av: "mollick", t: "voice", tags: ["C-Suite", "Product Managers", "Everyone"], topic: "Adoption" },
  { url: "https://newsletter.kentbeck.com/feed", who: "Creator of test-driven development", a: "Kent Beck", av: "beck", t: "voice", tags: ["Developers"], topic: "Adoption" },
  { url: "https://thezvi.substack.com/feed", a: "Zvi Mowshowitz", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://garymarcus.substack.com/feed", a: "Gary Marcus", av: "auto", t: "voice", tags: ["C-Suite", "Everyone"], topic: "Adoption" },
  { url: "https://www.interconnects.ai/feed", a: "Nathan Lambert", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.platformer.news/rss", kw: "title", a: "Casey Newton", av: "auto", t: "voice", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://www.thealgorithmicbridge.com/feed", a: "Alberto Romero", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://stratechery.com/feed", kw: "title", a: "Ben Thompson", av: "auto", t: "voice", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://huyenchip.com/feed.xml", a: "Chip Huyen", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://tomtunguz.com/index.xml", a: "Tomasz Tunguz", av: "auto", t: "voice", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://magazine.sebastianraschka.com/feed", a: "Sebastian Raschka", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.exponentialview.co/feed", a: "Azeem Azhar", av: "auto", t: "voice", tags: ["C-Suite"], topic: "Adoption" },
  { url: "https://www.dwarkesh.com/feed", a: "Dwarkesh Patel", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.aisnakeoil.com/feed", a: "AI Snake Oil (Narayanan & Kapoor)", av: "auto", t: "voice", tags: ["C-Suite", "Everyone"], topic: "Adoption" },
  { url: "https://joereis.substack.com/feed", a: "Joe Reis", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://blog.eladgil.com/feed", a: "Elad Gil", av: "auto", t: "voice", tags: ["C-Suite"], topic: "Industry AI" },
  { url: "https://kozyrkov.medium.com/feed", a: "Cassie Kozyrkov", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://www.latent.space/feed", a: "swyx · Latent Space", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://hamel.dev/index.xml", a: "Hamel Husain", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://www.ben-evans.com/benedictevans?format=rss", a: "Benedict Evans", av: "auto", t: "voice", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI" },
  /* auto-verified expansion: 83 additional working feeds (Jul 17, 2026) */
  { url: "https://newsletter.pragmaticengineer.com/feed", a: "Gergely Orosz", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://aiweirdness.com/rss/", a: "Janelle Shane", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.understandingai.org/feed", a: "Timothy B. Lee", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.wheresyoured.at/rss/", a: "Ed Zitron", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Industry AI" },
  { url: "https://lastweekin.ai/feed", a: "Last Week in AI", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models" },
  { url: "https://thesequence.substack.com/feed", a: "TheSequence", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://natesnewsletter.substack.com/feed", a: "Nate B. Jones", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://aisupremacy.substack.com/feed", a: "Michael Spencer", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.chinatalk.media/feed", kw: "title", a: "Jordan Schneider", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.semianalysis.com/feed", a: "Dylan Patel", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Industry AI" },
  { url: "https://www.lennysnewsletter.com/feed", kw: "title", a: "Lenny Rachitsky", av: "auto", t: "voice", tags: ["Product Managers"], topic: "Adoption" },
  { url: "https://benn.substack.com/feed", kw: "title", a: "Benn Stancil", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://www.dataengineeringweekly.com/feed", a: "Data Engineering Weekly", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://seattledataguy.substack.com/feed", a: "Ben Rogojan (newsletter)", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://roundup.getdbt.com/feed", a: "Analytics Engineering Roundup", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://vickiboykis.com/index.xml", a: "Vicki Boykis", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Adoption" },
  { url: "https://cameronrwolfe.substack.com/feed", a: "Cameron R. Wolfe", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://newsletter.maartengrootendorst.com/feed", a: "Maarten Grootendorst", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://karpathy.bearblog.dev/feed/", a: "Andrej Karpathy (blog)", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.astralcodexten.com/feed", kw: "title", a: "Scott Alexander", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.gradientflow.com/feed/", a: "Ben Lorica", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://machinelearningmastery.com/blog/feed/", a: "Machine Learning Mastery", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://jurgengravestein.substack.com/feed", a: "Jurgen Gravestein", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://eugeneyan.com/rss/", a: "Eugene Yan (feed)", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://bair.berkeley.edu/blog/feed.xml", a: "BAIR Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://blog.ml.cmu.edu/feed/", a: "CMU ML Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://news.mit.edu/rss/topic/artificial-intelligence2", a: "MIT News · AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://thegradient.pub/rss/", a: "The Gradient", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.lesswrong.com/feed.xml", a: "LessWrong", av: "auto", t: "voice", tags: ["Developers"], topic: "Adoption" },
  { url: "https://artificialintelligenceact.eu/feed/", a: "EU AI Act Newsletter", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://www.technologyreview.com/feed/", kw: "title", skip: /^The Download/i, a: "MIT Technology Review", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 1 },
  { domain: true, url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", a: "IEEE Spectrum AI", av: "auto", t: "industry", tags: ["Developers"], topic: "Models" },
  { w: -2, url: "https://www.marktechpost.com/feed/", a: "MarkTechPost", av: "auto", t: "industry", tags: ["Developers"], topic: "Models", max: 1 },
  { w: -2, url: "https://syncedreview.com/feed/", a: "Synced", av: "auto", t: "industry", tags: ["Developers"], topic: "Models", max: 1 },
  { url: "https://bdtechtalks.com/feed/", a: "Ben Dickson · TechTalks", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { w: -2, url: "https://the-decoder.com/feed/", a: "The Decoder", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models", max: 1 },
  { url: "https://towardsdatascience.com/feed", a: "Towards Data Science", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { w: -2, url: "https://www.oreilly.com/radar/feed/index.xml", kw: "title", a: "O'Reilly Radar", av: "auto", t: "industry", tags: ["Developers"], topic: "Adoption" },
  { url: "https://flowingdata.com/feed", kw: "title", a: "FlowingData", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { w: -2, url: "https://sloanreview.mit.edu/feed/", kw: "title", a: "MIT Sloan Mgmt Review", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://knowledge.wharton.upenn.edu/feed/", kw: "title", a: "Knowledge at Wharton", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { w: -2, url: "https://www.mckinsey.com/insights/rss", kw: "title", a: "McKinsey Insights", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { w: 2, url: "https://www.mmsonline.com/rss/news", kw: true, who: "Modern Machine Shop · machining technology", a: "Modern Machine Shop", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.additivemanufacturing.media/rss/news", kw: true, who: "Industrial 3D printing publication", a: "Additive Manufacturing Media", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.productionmachining.com/rss/news", kw: true, who: "Precision machining publication", a: "Production Machining", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { w: 2, url: "https://www.manufacturingdive.com/feeds/news/", kw: true, who: "Manufacturing industry business news", a: "Manufacturing Dive", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://iiot-world.com/feed/", who: "Industrial IoT & AI publication", a: "IIoT World", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { domain: true, url: "https://www.therobotreport.com/feed/", who: "Robotics business & engineering news", a: "The Robot Report", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://compositesmanufacturingmagazine.com/feed/", who: "American Composites Manufacturers Association magazine", a: "Composites Manufacturing", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.aerospacemanufacturinganddesign.com/rss/", a: "Aerospace Mfg & Design", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://changelog.com/practicalai/feed", a: "Practical AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://lexfridman.com/feed/podcast/", kw: "title", a: "Lex Fridman Podcast", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://blogs.nvidia.com/feed/", a: "NVIDIA Blog", av: "auto", t: "official", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://aws.amazon.com/blogs/machine-learning/feed/", a: "AWS ML Blog", av: "auto", t: "official", tags: ["Developers"], topic: "Tools" },
  { url: "https://deepmind.google/blog/rss.xml", a: "Google DeepMind", av: "auto", t: "official", tags: ["Everyone"], topic: "Models" },
  { url: "https://tldr.tech/api/rss/ai", a: "TLDR AI", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models" },
  { url: "https://news.smol.ai/rss.xml", a: "AI News (smol.ai)", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://emerj.com/feed/", a: "Emerj", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://www.answer.ai/index.xml", a: "Answer.AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://www.fast.ai/index.xml", a: "fast.ai", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools" },
  { url: "https://www.kdnuggets.com/feed", a: "KDnuggets", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://rss.arxiv.org/rss/cs.AI", a: "arXiv cs.AI", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://research.google/blog/rss/", a: "Google Research", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://huggingface.co/blog/feed.xml", a: "Hugging Face", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://machinelearning.apple.com/rss.xml", a: "Apple ML Research", av: "auto", t: "official", tags: ["Developers"], topic: "Models" },
  { url: "https://stackoverflow.blog/feed/", kw: "title", a: "Stack Overflow Blog", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools" },
  { url: "https://github.blog/changelog/feed/", a: "GitHub Changelog", av: "auto", t: "official", tags: ["Developers"], topic: "Tools" },
  { url: "https://feed.infoq.com/ai-ml-data-eng/", a: "InfoQ AI/ML", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://thenewstack.io/feed/", kw: "title", a: "The New Stack", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools" },
  { domain: true, url: "https://semiengineering.com/feed/", kw: "title", who: "Semiconductor & industrial electronics", a: "Semiconductor Engineering", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { w: -2, url: "https://www.quantamagazine.org/feed/", kw: "title", a: "Quanta Magazine", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://hnrss.org/newest?q=AI+manufacturing", a: "Hacker News · AI x mfg", av: "auto", t: "voice", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://www.reddit.com/r/MachineLearning/.rss", a: "r/MachineLearning", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { domain: true, url: "https://www.eetimes.com/feed/", kw: "title", who: "Electronics industry news", a: "EE Times", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  /* Magestic-industry topical news (Google News RSS queries) */
  { url: "https://www.bing.com/news/search?q=AI%20%22sheet%20metal%22%20fabrication&format=rss", a: "AI in Sheet Metal", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Developers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=AI%20CNC%20machining&format=rss", a: "AI in CNC & Machining", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=composites%20manufacturing%20AI%20aerospace&format=rss", a: "AI in Composites", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22CAM%20software%22%20OR%20%22nesting%20software%22%20AI&format=rss", a: "CAM & Nesting Software News", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22smart%20factory%22%20aerospace%20OR%20defense&format=rss", a: "Smart Factory · Aero & Defense", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22generative%20design%22%20OR%20%22AI%20toolpath%22%20manufacturing&format=rss", a: "Generative Design & AI CAM", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22material%20utilization%22%20OR%20%22material%20yield%22%20manufacturing&format=rss", a: "Material Yield & Optimization", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", max: 2 },
  /* Company video channels (YouTube RSS; thumbnails render in the feed) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA", a: "Anthropic (video)", who: "Official Anthropic channel · agent & Claude Code deep dives", av: "anthropic", t: "official", tags: ["Everyone", "Developers"], topic: "Models", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 3 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A", a: "OpenAI (video)", who: "Official OpenAI channel · developer sessions & demos", av: "openai", t: "official", tags: ["Everyone", "Developers"], topic: "Models", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 3 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A", a: "Google DeepMind (video)", who: "Official DeepMind channel · research explainers", av: "google", t: "official", tags: ["Everyone"], topic: "Models", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC9IEkprr46ScglWU79HF5qQ", a: "Boeing (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJWcF0ex7_doPdIQGbVpDsQ", a: "Lockheed Martin (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYR5Kgzn6suihs56iJ8_vfw", a: "Siemens Software (video)", av: "siemens", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCaEEm-0s0x3MHg9jzFcHuQQ", a: "Siemens (video)", av: "siemens", t: "industry", tags: ["C-Suite"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCL-g3eGJi1omSDSz48AML-g", a: "NVIDIA (video)", av: "auto", t: "official", tags: ["Developers", "C-Suite"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJ1cS4hALCDHPnygfv6VOhQ", a: "Airbus (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCD98uquOUa1kKSdcHgCKEXA", a: "Autodesk (video)", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  /* Magestic-niche industry press (verified Jul 17 2026) */
  { w: 2, url: "https://develop3d.com/feed/", a: "Develop3D", who: "CAD/CAM & product development magazine", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.engineering.com/feed/", a: "Engineering.com", who: "Engineering technology news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://breakingdefense.com/feed/", a: "Breaking Defense", who: "Defense industry & procurement news", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://spacenews.com/feed/", a: "SpaceNews", who: "Space industry business news", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/industry/?outputType=xml", a: "Defense News · Industry", who: "Defense industrial base coverage", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.navalnews.com/feed/", a: "Naval News", who: "Naval shipbuilding & defense (Electric Boat's world)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.marinelog.com/feed/", a: "MarineLog", who: "Shipbuilding & marine industry news", av: "auto", t: "industry", tags: ["C-Suite"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.offshorewind.biz/feed/", a: "OffshoreWind.biz", who: "Wind energy industry (Vestas/TPI's world)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 1 },
  { domain: true, url: "https://www.roboticstomorrow.com/rss/news.xml", a: "Robotics Tomorrow", who: "Industrial robotics & automation news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { w: 2, url: "https://www.fabricatingandmetalworking.com/feed/", a: "Fabricating & Metalworking", who: "Metal fabrication industry magazine", av: "auto", t: "industry", tags: ["Application Specialists", "C-Suite"], topic: "Industry AI", kw: true, max: 2 },
  { w: 2, url: "https://www.jeccomposites.com/feed/", a: "JEC Composites", who: "The composites industry's global trade body", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.aerospacetestinginternational.com/feed", a: "Aerospace Testing Intl", who: "Aerospace test & certification tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.etmm-online.com/rss/news.xml", a: "ETMM", who: "European toolmaking & mould making", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://metrology.news/feed/", a: "Metrology News", who: "Precision measurement & inspection tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  /* Developer education & industry video channels */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCLKPca3kwwd-B59HNr-_lvA", a: "AI Engineer (video)", who: "AI Engineer conference talks · agents, harnesses, evals", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, prefer: /code|codex|context|agent|harness|prompt|how|build|engineer|tool|develop/i, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXUPKJO5MZQN11PqgIvyuvQ", a: "Andrej Karpathy (video)", who: "Deep technical LLM education from first principles", av: "auto", t: "voice", tags: ["Developers", "Database Engineers"], topic: "Models", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x5XG1OV2P6uZZ5FSM9Ttw", a: "Google for Developers (video)", who: "Official Google developer channel", av: "google", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJS9pqu9BzkAMNTmzNMNhvg", a: "Google Cloud Tech (video)", who: "Cloud + AI engineering sessions", av: "google", t: "official", tags: ["Developers", "Database Engineers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsMica-v34Irf9KVTh6xx-g", a: "Microsoft Developer (video)", who: "Official Microsoft developer channel · Copilot & M365 dev", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC7c3Kb6jYCRj4JOHHZTxKsQ", a: "GitHub (video)", who: "Official GitHub channel · Copilot & agentic workflows", av: "github", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6YYHJzM6PhZ2Yey9BQiUaw", a: "Cursor (video)", who: "Official Cursor channel · AI-native coding", av: "cursor", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZsiZ9RIRtzpoToh4noauAw", a: "TRUMPF (video)", who: "Machine OEM incumbent · punching & laser tech", av: "auto", t: "industry", tags: ["Application Specialists", "C-Suite"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYO_jab_esuFRV4b17AJtAw", a: "3Blue1Brown (video)", who: "Visual math of neural networks · evergreen education", av: "auto", t: "voice", tags: ["Developers", "Everyone"], topic: "Models", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg", a: "Two Minute Papers (video)", who: "AI research explained in minutes", av: "auto", t: "voice", tags: ["Everyone"], topic: "Models", vid: true, max: 1 },
  /* Instructional AI-dev channels (video; how to actually use Claude Code, Codex, agents) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCsBjURrPoezykLs9EqgamOA", a: "Fireship", who: "Fast, sharp dev explainers (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1, kw: true },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC8butISFwT-Wl7EV0hUK0BQ", a: "freeCodeCamp", who: "Free full-length programming courses (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1, kw: true },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCcIXc5mJsHVYTZR1maL5l9w", a: "DeepLearning.AI (video)", who: "Andrew Ng's courses and AI interviews", av: "auto", t: "voice", tags: ["Developers", "Product Managers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC_x36zCEGilGpB1m-V4gmjg", a: "IndyDevDan", who: "Agentic coding workflows: Claude Code in practice (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCMwVTLZIRRUyyVrkjDpn4pA", a: "Cole Medin", who: "AI agent build tutorials (video)", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCswG6FSbgZjbWtdf_hMLaow", a: "Matt Pocock (video)", who: "AI Hero: hands-on AI engineering training", av: "auto", t: "voice", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UChpleBmo18P08aKCIgti38g", a: "Matt Wolfe (video)", who: "Weekly AI tools roundup", av: "auto", t: "voice", tags: ["Everyone"], topic: "Tools", vid: true, max: 1 },
  /* Leading AI dev-tool vendors: news & tutorials (video, 1 slot each; Claude Code + Codex stay the majority) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC6YYHJzM6PhZ2Yey9BQiUaw", a: "Cursor (video)", who: "Official Cursor channel", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCo2ri0cvAs8Lxbp18UHZsgg", a: "xAI (video)", who: "Official xAI channel · Grok", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCTSqI4c58ffN6l5Mbdat6dg", a: "Perplexity (video)", who: "Official Perplexity channel", av: "auto", t: "official", tags: ["Everyone"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCirYnEfIjR8L1-sM2ozb7QQ", a: "Windsurf (video)", who: "Official Windsurf channel · agentic IDE", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCgoJjdR6-7AMu9fDitb6nVw", a: "Replit (video)", who: "Official Replit channel · Agent", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCk_Il3HoK3qTz1tvzyphozg", a: "Cognition (video)", who: "Official Cognition channel · Devin", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCRaz_dquopKtb4ptswKcxTA", a: "Mistral AI (video)", who: "Official Mistral channel · Codestral/Devstral", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCT-nPlVzJI-ccQXlxjSvJmw", a: "AWS Developers (video)", who: "Official AWS dev channel · Q/Kiro", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCGp4UBwpTNegd_4nCpuBcow", a: "JetBrains (video)", who: "Official JetBrains channel · Junie/AI Assistant", av: "auto", t: "official", tags: ["Developers"], topic: "Tools", vid: true, kw: true, max: 1 },
  /* AI dev-tool news lane (Bing News; direct links + thumbnails) */
  { url: "https://www.bing.com/news/search?q=%22Claude%20Code%22&format=rss", a: "Claude Code News", who: "News about Claude Code", av: "anthropic", t: "official", tags: ["Developers"], topic: "Tools", max: 2 },
  { url: "https://www.bing.com/news/search?q=%22OpenAI%20Codex%22&format=rss", a: "Codex News", who: "News about OpenAI Codex", av: "openai", t: "official", tags: ["Developers"], topic: "Tools", max: 2 },
  { url: "https://www.bing.com/news/search?q=%22Cursor%22%20AI%20editor&format=rss", a: "Cursor News", who: "News about the Cursor IDE", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22GitHub%20Copilot%22&format=rss", a: "Copilot News", who: "News about GitHub Copilot", av: "github", t: "official", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Gemini%20CLI%22%20OR%20%22Gemini%20Code%20Assist%22&format=rss", a: "Gemini Dev News", who: "News about Google's coding tools", av: "google", t: "official", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Devin%22%20Cognition%20AI&format=rss", a: "Devin News", who: "News about Cognition's Devin", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Grok%22%20xAI%20developer&format=rss", a: "Grok News", who: "News about xAI's Grok for developers", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=%22Perplexity%22%20AI&format=rss", a: "Perplexity News", who: "News about Perplexity", av: "auto", t: "industry", tags: ["Everyone"], topic: "Tools", max: 1 },
  { url: "https://www.bing.com/news/search?q=Aider%20OR%20Cline%20OR%20OpenHands%20coding%20agent&format=rss", a: "Open-Source Agents News", who: "News on open-source coding agents", av: "auto", t: "industry", tags: ["Developers"], topic: "Tools", max: 1 },
  /* Industry video: what OEMs, peers & trade media are doing with AI (AI-filtered) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC09R-RDOwz88FqD--3YWmew", a: "MTDCNC (video)", who: "CNC industry video network", av: "auto", t: "industry", tags: ["Application Specialists", "Developers"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCZsiZ9RIRtzpoToh4noauAw", a: "TRUMPF (video)", who: "Official TRUMPF channel · punch/laser OEM", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCc2lUKVOTXKlQR7Fm7h1JfQ", a: "Titans of CNC (video)", who: "Machining education powerhouse", av: "auto", t: "industry", tags: ["Application Specialists", "Developers"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCi-1bvDwzwBq0OFKiF2atkg", a: "Haas Automation (video)", who: "Official Haas CNC channel", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCE_crBpIk_NtYb_6AbLA5Cw", a: "Machina Labs (video)", who: "AI-native robotic forming · direct AI competitor class", av: "auto", t: "industry", tags: ["C-Suite", "Developers"], topic: "Industry AI", vid: true, max: 1 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCvFJMO2exEwenV_TZHwBl6g", a: "Okuma (video)", who: "Official Okuma CNC channel", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 1 },
  /* Conference watch: JEC World & FABTECH — the shows where our whole market exhibits */
  { url: "https://www.bing.com/news/search?q=%22JEC%20World%22%20OR%20%22JEC%20Composites%22&format=rss", a: "JEC World Watch", who: "Composites' global trade show · exhibitor & AI news", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22FABTECH%22%20metal%20fabrication&format=rss", a: "FABTECH Watch", who: "North America's largest metal forming/fabricating show", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=(%22JEC%22%20OR%20%22FABTECH%22%20OR%20%22IMTS%22)%20AI%20exhibitor&format=rss", a: "Trade Show AI Watch", who: "AI announcements from industry trade shows", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 2 },
];

const strip = (s = "") =>
  s.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#0?39;|&apos;/g, "'")
   .replace(/&quot;/g, '"')
   .replace(/<[^>]+>/g, " ")   // second pass: tags reconstituted by entity decoding
   .replace(/\s+/g, " ").trim();

function items(xml) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/g) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/g) || [];
  for (const b of blocks) {
    const g = (re) => (b.match(re) || [])[1] || "";
    const title = strip(g(/<title[^>]*>([\s\S]*?)<\/title>/));
    let link = g(/<link[^>]*href="([^"]+)"[^>]*\/?>/) || strip(g(/<link[^>]*>([\s\S]*?)<\/link>/));
    const date = g(/<pubDate>([\s\S]*?)<\/pubDate>/) || g(/<updated>([\s\S]*?)<\/updated>/) || g(/<published>([\s\S]*?)<\/published>/);
    const rawDesc = g(/<description[^>]*>([\s\S]*?)<\/description>/) || g(/<summary[^>]*>([\s\S]*?)<\/summary>/) || "";
    const desc = strip(rawDesc).slice(0, 260);
    const bimg = strip(g(/<News:Image>([\s\S]*?)<\/News:Image>/));
    const img = bimg || g(/<media:thumbnail[^>]*url="([^"]+)"/) || g(/<media:content[^>]*url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                g(/<enclosure[^>]*type="image[^"]*"[^>]*url="([^"]+)"/) || g(/<enclosure[^>]*url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i) ||
                (rawDesc.match(/&lt;img[^&]*src=&quot;([^&]+?)&quot;/) || rawDesc.match(/<img[^>]*src="([^"]+)"/) || [])[1] || "";
    if (title && link) out.push({ title, link, date: new Date(date || Date.now()), desc, img });
  }
  return out;
}

const MFG_KW = /\b(manufactur|fabricat|factor(?:y|ies)|CNC|machining|machine shop|machinist|composite|prepreg|fiberglass|honeycomb|unidirectional tape|tape laying|fiber placement|AFP|ATL|ply|layup|lay-up|draping|kitting|nesting|nest|aerospace|aviation|defen[cs]e|naval|shipyard|shipbuilding|sheet ?metal|plate cutting|weld|waterjet|plasma cutting|oxy[- ]?fuel|punching|nibbling|press brake|turret|laser cutting|laser projection|CAM|CAD|PLM|MES\b|NC program|post[- ]?processor|toolpath|genetic algorithm|material yield|material utilization|digital thread|digital manufacturing|Industry 4\.0|IIoT|industrial|production line|shop floor|tooling|metalwork|quoting|job shop|wind blade|turbine|generative manufacturing)\b/i;
const companiesSrcEarly = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "companies.js"), "utf8");
const WATCHLIST = new Function(companiesSrcEarly + ";return COMPANIES;")();
const COMPANY_RE = new RegExp("\\b(" + WATCHLIST.map(c => c.n.replace(/\s*\(.*?\)/g, "").trim()).filter(n => n.length > 3)
  .map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b", "i");
const WAR_NOISE = /\b(combat|weapon|missile|warhead|munition|battlefield|kamikaze|drone strike|air defen[cs]e|counter-?UAS|warfare|lethal)\b/i;
const norm = (x) => (x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const FIN_NOISE = /\b(stocks?|shares?|share price|earnings|dividend|NYSE|NASDAQ|price target|analyst rating|analysts? (?:say|rate|expect)|market cap|sell-?off|hedge fund|portfolio|52-week|strong buy|strong sell|buy rating|hold rating|undervalued|overvalued|bargain|too cheap|bullish|bearish|rall(?:y|ies)|upgraded?|downgraded?|top \d+ (?:AI )?stocks?|trading|traders?|IPO|ticker)\b|seeking ?alpha|motley ?fool|zacks|benzinga|marketbeat|barchart|insider ?monkey|investing\.com|investor.s business daily|simplywall|thestreet|barron|yahoo finance|24.7 ?wall ?st|cramer|\(NASDAQ|\(NYSE|\(ENXT|stock analysis/i;
const CORE_KW = /\b(nest(?:ing|s)?|punch(?:ing|es)?|nibbling|bin[- ]?packing|packing optimi|composite|prepreg|ply|layup|lay-up|draping|kitting|AFP|ATL|fiber placement|tape laying|honeycomb|sheet ?metal|TruLaser|TruTops|laser projection|laser cutting|laser templat|LPT|waterjet|plasma cutting|press brake|turret|CAM\b|CAD\b|toolpath|NC program|post[- ]?processor|material (?:yield|utilization)|cutting path|fabricat)\b/i;
const OFFTOPIC = /\b(supply chain|logistics|warehous(?:e|ing)|procurement|freight|shipping|inventory management|webinar|register now)\b/i;
const AI_KW = /\b(AI|A\.I\.|artificial intelligence|machine[- ]learning|deep learning|computer vision|digital twin|generative|GenAI|copilot|smart factory|neural|LLM|large language|GPT-?\d*|Claude|Gemini|Codex|agentic|autonomous)\b/i;

const posts = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, { headers: { "user-agent": "MagesticAIHub/1.0 (+github pages feed refresh)" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    let feedItems = items(xml);
    if (f.topic === "Industry AI" && !f.kw) f.kw = true; // industry sources are ALWAYS AI-filtered
    if (f.skip) feedItems = feedItems.filter(i => !f.skip.test(i.title));
    if (f.kw) feedItems = feedItems.filter(i => AI_KW.test(f.kw === "title" ? i.title : i.title + " " + i.desc));
    if (f.domain) feedItems = feedItems.filter(i => MFG_KW.test(i.title + " " + i.desc) || COMPANY_RE.test(i.title + " " + i.desc));
    if (f.topic === "Industry AI") feedItems = feedItems.filter(i => !OFFTOPIC.test(i.title + " " + i.desc) || CORE_KW.test(i.title + " " + i.desc));
    if (/bing\.com|news\.google/.test(f.url)) feedItems = feedItems.filter(i => !FIN_NOISE.test(i.title + " " + i.desc + " " + i.link));
    if (f.prefer) feedItems = [...feedItems.filter(i => f.prefer.test(i.title)), ...feedItems.filter(i => !f.prefer.test(i.title))];
    for (const it of feedItems.slice(0, f.max || DEFAULT_PER_FEED)) {
      const wt = (f.w || 0) + (CORE_KW.test(it.title + " " + it.desc) ? 3 : 0)
        + ((f.topic === "Tools" && (f.vid || (f.tags || []).includes("Developers"))) ? 2 : 0) + (f.vid ? 1 : 0);
      posts.push({
        a: f.a, s: f.who || `via ${new URL(f.url).hostname}`, av: f.av, t: f.t,
        ...(wt ? { w: wt } : {}),
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: `${it.title}${it.desc && !norm(it.desc).startsWith(norm(it.title).slice(0, 50)) ? "\n\n" + it.desc + "…" : ""}`,
        tags: f.tags, topic: f.topic,
        ...(it.img ? { img: it.img } : {}), ...(f.vid ? { vid: true } : {}),
        link: { u: it.link, b: it.title.slice(0, 90), s: new URL(it.link).hostname },
      });
    }
    console.log(`ok   ${f.a} (${f.url})`);
  } catch (e) {
    console.warn(`skip ${f.a}: ${e.message}`);
  }
}


/* ---- Company Watch: hourly Google News pull for every company in data/companies.js ----
   Priority companies (p:1) are fetched every run; the rest rotate in slices of 30 per hour,
   so the full 265-company watchlist cycles roughly every 8 hours. */
const COMPANIES = WATCHLIST;
const coQ = (n) => '"' + n.replace(/\s*\(.*?\)/g, "") + '" AI (manufacturing OR production OR factory OR engineering OR software)';
const gnUrl = (n) => `https://news.google.com/rss/search?q=${encodeURIComponent(coQ(n))}&hl=en-US&gl=US&ceid=US:en`;
const bingUrl = (n) => `https://www.bing.com/news/search?q=${encodeURIComponent(coQ(n))}&format=rss`;
const prio = COMPANIES.filter(c => c.p);
const rest = COMPANIES.filter(c => !c.p);
const slice = Math.floor(new Date().getUTCHours() / 1) % Math.ceil(rest.length / 40);
const batch = [...prio, ...rest.slice(slice * 40, slice * 40 + 40)];
console.log(`company watch: ${prio.length} priority + ${batch.length - prio.length} rotating (slice ${slice})`);
const companyPosts = [];
async function pullCompany(c) {
  try {
    let its = [];
    try {
      const rb = await fetch(bingUrl(c.n), { headers: { "user-agent": "Mozilla/5.0 (MagesticAIHub feed refresh)" }, signal: AbortSignal.timeout(15000) });
      if (rb.ok) its = items(await rb.text());
    } catch {}
    if (!its.length) {
      const res = await fetch(gnUrl(c.n), { headers: { "user-agent": "Mozilla/5.0 (MagesticAIHub feed refresh)" }, signal: AbortSignal.timeout(15000) });
      if (!res.ok) return;
      its = items(await res.text());
    }
    its = its.filter(i => AI_KW.test(i.title + " " + i.desc) && !FIN_NOISE.test(i.title + " " + i.desc + " " + i.link)
      && (!WAR_NOISE.test(i.title + " " + i.desc) || MFG_KW.test(i.title + " " + i.desc))
      && (!OFFTOPIC.test(i.title + " " + i.desc) || CORE_KW.test(i.title + " " + i.desc)));
    const cutoff = Date.now() - 14 * 86400000; // only news from the last 2 weeks
    for (const it of its.filter(i => i.date.getTime() > cutoff).slice(0, c.p ? 3 : 1)) {
      companyPosts.push({
        a: c.n, s: `Company Watch · ${c.side === "s" ? "competitor/supplier" : "customer/market"}${c.score != null ? ` · AI ${c.score}/10` : ""}`,
        av: "auto", t: "industry",
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: it.title + (it.desc && !norm(it.desc).startsWith(norm(it.title).slice(0, 50)) ? "\n\n" + it.desc + "…" : ""), tags: ["C-Suite", "Marketing & Sales", "Product Managers"], topic: "Company Watch",
        ...(CORE_KW.test(it.title + " " + it.desc) ? { w: 3 } : {}),
        ...(it.img ? { img: it.img } : {}),
        link: { u: it.link, b: it.title.slice(0, 90), s: (()=>{try{return new URL(it.link).hostname}catch{return "news"}})() },
      });
    }
  } catch { /* skip quietly */ }
}
for (let i = 0; i < batch.length; i += 10) {
  await Promise.all(batch.slice(i, i + 10).map(pullCompany));
}
companyPosts.sort((x, y) => y.d.localeCompare(x.d));
const companyTop = companyPosts.slice(0, MAX_COMPANY_ITEMS);
console.log(`company watch: ${companyTop.length} items`);

posts.sort((x, y) => y.d.localeCompare(x.d));
/* ---- og:image enrichment: fetch article pages for posts still missing media ---- */
const generalTop = posts.slice(0, MAX_TOTAL);
const vidPosts = posts.filter(p => p.vid && !generalTop.includes(p));
const allPosts = [...generalTop, ...vidPosts, ...companyTop];
const needImg = allPosts.filter(p => !p.img && p.link && !/news\.google/.test(p.link.u)).slice(0, 100);
async function enrich(p) {
  try {
    const res = await fetch(p.link.u, { headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" }, signal: AbortSignal.timeout(9000), redirect: "follow" });
    if (!res.ok) return;
    const html = (await res.text()).slice(0, 300000);
    const m = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i) ||
              html.match(/<meta[^>]*content="([^"]+)"[^>]*property="og:image"/i) ||
              html.match(/<meta[^>]*name="twitter:image"[^>]*content="([^"]+)"/i);
    if (m && /^https?:\/\//.test(m[1])) p.img = m[1].replace(/&amp;/g, "&");
  } catch { /* leave imageless */ }
}
for (let i = 0; i < needImg.length; i += 12) {
  await Promise.all(needImg.slice(i, i + 12).map(enrich));
}
/* ---- enforce media-rich feed: imageless posts capped at ~20% ---- */
/* enforce ~50/50 split: industry news vs AI training/news */
const isIndPost = (p) => p.topic === "Industry AI" || p.topic === "Company Watch";
let indSide = allPosts.filter(isIndPost);
let aiSide = allPosts.filter(p => !isIndPost(p));
const cap = Math.ceil(Math.min(indSide.length, aiSide.length) * 1.15);
indSide = indSide.slice(0, cap); aiSide = aiSide.slice(0, cap);
console.log(`mix: ${indSide.length} industry vs ${aiSide.length} AI training/news`);
const balanced = [...indSide, ...aiSide];
const withImg = balanced.filter(p => p.img);
const noImg = balanced.filter(p => !p.img);
const keepNoImg = noImg.filter(p => p.t === "internal"); // every live post carries an image or video
const finalPosts = [...withImg, ...keepNoImg].sort((x, y) => y.d.localeCompare(x.d));
console.log(`media coverage: ${withImg.length}/${finalPosts.length} posts have image or video (${Math.round(100*withImg.length/finalPosts.length)}%)`);
const top = finalPosts;

/* ---- accumulate: merge with previous feed so the archive grows ~25-50 posts/day ---- */
let previous = [];
try { previous = new Function(readFileSync(OUT, "utf8") + ";return POSTS_LIVE;")(); } catch {}
const keyOf = (p) => (p.link && p.link.u) || p.body.slice(0, 80);
const seenKeys = new Set(finalPosts.map(keyOf));
const carried = previous.filter(p => !seenKeys.has(keyOf(p)))
  .filter(p => p.t === "internal" || p.vid || AI_KW.test(p.a + " " + p.body))
  .filter(p => !FIN_NOISE.test(p.body) && (!OFFTOPIC.test(p.body) || CORE_KW.test(p.body)));
const merged = [...finalPosts, ...carried].sort((x, y) => y.d.localeCompare(x.d)).slice(0, 400);
console.log(`archive: ${finalPosts.length} fresh + ${carried.length} carried = ${merged.length} total`);

const banner = `/* AUTO-GENERATED by scripts/update-feed.mjs — do not edit by hand.
   Generated: ${new Date().toISOString()} · ${merged.length} items (rolling archive) from ${FEEDS.length} feeds. */\n`;
writeFileSync(OUT, banner + "const POSTS_LIVE = " + JSON.stringify(merged, null, 1) + ";\n");
console.log(`wrote ${merged.length} live posts -> data/feed-live.js`);
