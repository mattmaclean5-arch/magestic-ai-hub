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
const MAX_COMPANY_ITEMS = 60;

/* Public feeds. Each entry: url, display name, avatar key (from data/content.js AV), post type, role tags, topic. */
const FEEDS = [
  /* news organizations & industry press (max 3 each) */
  { url: "https://openai.com/news/rss.xml", who: "Official OpenAI newsroom", a: "OpenAI", av: "openai", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { url: "https://blog.google/technology/ai/rss/", who: "Official Google AI blog", a: "Google AI", av: "google", t: "official", tags: ["Everyone"], topic: "Models", max: 2 },
  { url: "https://github.blog/feed/", who: "Official GitHub blog", a: "GitHub", av: "github", t: "official", tags: ["Developers"], topic: "Tools", max: 3 },
  { url: "https://www.compositesworld.com/rss/news", kw: true, who: "The composites manufacturing industry's leading publication", a: "CompositesWorld", av: "industry", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 4 },
  { url: "https://mtdcnc.com/feed/", kw: true, who: "CNC machining industry news & video (UK)", a: "MTDCNC", av: "industry", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
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
  { url: "https://www.artificialintelligence-news.com/feed/", a: "AI News (TechForge)", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://bair.berkeley.edu/blog/feed.xml", a: "BAIR Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://blog.ml.cmu.edu/feed/", a: "CMU ML Blog", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://news.mit.edu/rss/topic/artificial-intelligence2", a: "MIT News · AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://thegradient.pub/rss/", a: "The Gradient", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.lesswrong.com/feed.xml", a: "LessWrong", av: "auto", t: "voice", tags: ["Developers"], topic: "Adoption" },
  { url: "https://artificialintelligenceact.eu/feed/", a: "EU AI Act Newsletter", av: "auto", t: "voice", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://www.technologyreview.com/feed/", kw: "title", skip: /^The Download/i, a: "MIT Technology Review", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", a: "TechCrunch AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://venturebeat.com/category/ai/feed/", a: "VentureBeat AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", a: "IEEE Spectrum AI", av: "auto", t: "industry", tags: ["Developers"], topic: "Models" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", a: "The Verge AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://www.wired.com/feed/tag/ai/latest/rss", a: "WIRED AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
  { url: "https://www.zdnet.com/topic/artificial-intelligence/rss.xml", a: "ZDNET AI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Tools" },
  { url: "https://feeds.arstechnica.com/arstechnica/technology-lab", kw: "title", a: "Ars Technica", av: "auto", t: "industry", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://www.marktechpost.com/feed/", a: "MarkTechPost", av: "auto", t: "industry", tags: ["Developers"], topic: "Models" },
  { url: "https://syncedreview.com/feed/", a: "Synced", av: "auto", t: "industry", tags: ["Developers"], topic: "Models" },
  { url: "https://bdtechtalks.com/feed/", a: "Ben Dickson · TechTalks", av: "auto", t: "voice", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://the-decoder.com/feed/", a: "The Decoder", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://towardsdatascience.com/feed", a: "Towards Data Science", av: "auto", t: "industry", tags: ["Developers", "Database Engineers"], topic: "Tools" },
  { url: "https://www.oreilly.com/radar/feed/index.xml", kw: "title", a: "O'Reilly Radar", av: "auto", t: "industry", tags: ["Developers"], topic: "Adoption" },
  { url: "https://flowingdata.com/feed", kw: "title", a: "FlowingData", av: "auto", t: "voice", tags: ["Database Engineers"], topic: "Tools" },
  { url: "https://sloanreview.mit.edu/feed/", kw: "title", a: "MIT Sloan Mgmt Review", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://knowledge.wharton.upenn.edu/feed/", kw: "title", a: "Knowledge at Wharton", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://www.mckinsey.com/insights/rss", kw: "title", a: "McKinsey Insights", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Adoption" },
  { url: "https://www.mmsonline.com/rss/news", kw: true, who: "Modern Machine Shop · machining technology", a: "Modern Machine Shop", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.additivemanufacturing.media/rss/news", kw: true, who: "Industrial 3D printing publication", a: "Additive Manufacturing Media", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.productionmachining.com/rss/news", kw: true, who: "Precision machining publication", a: "Production Machining", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.manufacturingdive.com/feeds/news/", kw: true, who: "Manufacturing industry business news", a: "Manufacturing Dive", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://iiot-world.com/feed/", who: "Industrial IoT & AI publication", a: "IIoT World", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://www.therobotreport.com/feed/", who: "Robotics business & engineering news", a: "The Robot Report", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
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
  { url: "https://dailyai.com/feed/", a: "DailyAI", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI" },
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
  { url: "https://semiengineering.com/feed/", kw: "title", who: "Semiconductor & industrial electronics", a: "Semiconductor Engineering", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  { url: "https://singularityhub.com/feed/", kw: "title", a: "Singularity Hub", av: "auto", t: "industry", tags: ["Everyone"], topic: "Adoption" },
  { url: "https://www.quantamagazine.org/feed/", kw: "title", a: "Quanta Magazine", av: "auto", t: "industry", tags: ["Everyone"], topic: "Models" },
  { url: "https://hnrss.org/newest?q=AI+manufacturing", a: "Hacker News · AI x mfg", av: "auto", t: "voice", tags: ["Developers"], topic: "Industry AI" },
  { url: "https://www.reddit.com/r/MachineLearning/.rss", a: "r/MachineLearning", av: "auto", t: "voice", tags: ["Developers"], topic: "Models" },
  { url: "https://www.eetimes.com/feed/", kw: "title", who: "Electronics industry news", a: "EE Times", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI" },
  /* Magestic-industry topical news (Google News RSS queries) */
  { url: "https://www.bing.com/news/search?q=AI%20%22sheet%20metal%22%20fabrication&format=rss", a: "AI in Sheet Metal", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Developers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=AI%20CNC%20machining&format=rss", a: "AI in CNC & Machining", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=composites%20manufacturing%20AI%20aerospace&format=rss", a: "AI in Composites", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22CAM%20software%22%20OR%20%22nesting%20software%22%20AI&format=rss", a: "CAM & Nesting Software News", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22smart%20factory%22%20aerospace%20OR%20defense&format=rss", a: "Smart Factory · Aero & Defense", av: "auto", t: "industry", tags: ["C-Suite", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22generative%20design%22%20OR%20%22AI%20toolpath%22%20manufacturing&format=rss", a: "Generative Design & AI CAM", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", max: 3 },
  { url: "https://www.bing.com/news/search?q=%22material%20utilization%22%20OR%20%22material%20yield%22%20manufacturing&format=rss", a: "Material Yield & Optimization", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", max: 2 },
  /* Company video channels (YouTube RSS; thumbnails render in the feed) */
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCrDwWp7EBBv4NwvScIpBDOA", a: "Anthropic (video)", av: "anthropic", t: "official", tags: ["Everyone"], topic: "Models", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCXZCJLdBC09xxGZ6gcdrc6A", a: "OpenAI (video)", av: "openai", t: "official", tags: ["Everyone"], topic: "Models", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCP7jMXSY2xbc3KCAE0MHQ-A", a: "Google DeepMind (video)", av: "google", t: "official", tags: ["Everyone"], topic: "Models", vid: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UC9IEkprr46ScglWU79HF5qQ", a: "Boeing (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJWcF0ex7_doPdIQGbVpDsQ", a: "Lockheed Martin (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCYR5Kgzn6suihs56iJ8_vfw", a: "Siemens Software (video)", av: "siemens", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCaEEm-0s0x3MHg9jzFcHuQQ", a: "Siemens (video)", av: "siemens", t: "industry", tags: ["C-Suite"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCL-g3eGJi1omSDSz48AML-g", a: "NVIDIA (video)", av: "auto", t: "official", tags: ["Developers", "C-Suite"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCJ1cS4hALCDHPnygfv6VOhQ", a: "Airbus (video)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Company Watch", vid: true, kw: true, max: 2 },
  { url: "https://www.youtube.com/feeds/videos.xml?channel_id=UCD98uquOUa1kKSdcHgCKEXA", a: "Autodesk (video)", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", vid: true, kw: true, max: 2 },
  /* Magestic-niche industry press (verified Jul 17 2026) */
  { url: "https://develop3d.com/feed/", a: "Develop3D", who: "CAD/CAM & product development magazine", av: "auto", t: "industry", tags: ["Developers", "Product Managers"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.engineering.com/feed/", a: "Engineering.com", who: "Engineering technology news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://breakingdefense.com/feed/", a: "Breaking Defense", who: "Defense industry & procurement news", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://spacenews.com/feed/", a: "SpaceNews", who: "Space industry business news", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.defensenews.com/arc/outboundfeeds/rss/category/industry/?outputType=xml", a: "Defense News · Industry", who: "Defense industrial base coverage", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.navalnews.com/feed/", a: "Naval News", who: "Naval shipbuilding & defense (Electric Boat's world)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.marinelog.com/feed/", a: "MarineLog", who: "Shipbuilding & marine industry news", av: "auto", t: "industry", tags: ["C-Suite"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.offshorewind.biz/feed/", a: "OffshoreWind.biz", who: "Wind energy industry (Vestas/TPI's world)", av: "auto", t: "industry", tags: ["C-Suite", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://www.roboticstomorrow.com/rss/news.xml", a: "Robotics Tomorrow", who: "Industrial robotics & automation news", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.fabricatingandmetalworking.com/feed/", a: "Fabricating & Metalworking", who: "Metal fabrication industry magazine", av: "auto", t: "industry", tags: ["Application Specialists", "C-Suite"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.jeccomposites.com/feed/", a: "JEC Composites", who: "The composites industry's global trade body", av: "auto", t: "industry", tags: ["C-Suite", "Application Specialists", "Marketing & Sales"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.aerospacetestinginternational.com/feed", a: "Aerospace Testing Intl", who: "Aerospace test & certification tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://newatlas.com/index.rss", a: "New Atlas", who: "Emerging technology news", av: "auto", t: "industry", tags: ["Everyone"], topic: "Industry AI", kw: true, max: 2 },
  { url: "https://www.etmm-online.com/rss/news.xml", a: "ETMM", who: "European toolmaking & mould making", av: "auto", t: "industry", tags: ["Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
  { url: "https://metrology.news/feed/", a: "Metrology News", who: "Precision measurement & inspection tech", av: "auto", t: "industry", tags: ["Developers", "Application Specialists"], topic: "Industry AI", kw: true, max: 1 },
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

const AI_KW = /\b(AI|A\.I\.|artificial intelligence|machine learning|automation|automated|robot|robotic|digital twin|generative|copilot|smart factory|neural|LLM|autonomous)\b/i;

const posts = [];
for (const f of FEEDS) {
  try {
    const res = await fetch(f.url, { headers: { "user-agent": "MagesticAIHub/1.0 (+github pages feed refresh)" }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    let feedItems = items(xml);
    if (f.skip) feedItems = feedItems.filter(i => !f.skip.test(i.title));
    if (f.kw) feedItems = feedItems.filter(i => AI_KW.test(f.kw === "title" ? i.title : i.title + " " + i.desc));
    for (const it of feedItems.slice(0, f.max || DEFAULT_PER_FEED)) {
      posts.push({
        a: f.a, s: f.who || `via ${new URL(f.url).hostname}`, av: f.av, t: f.t,
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: `${it.title}${it.desc ? "\n\n" + it.desc + "…" : ""}`,
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
const companiesSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "data", "companies.js"), "utf8");
const COMPANIES = new Function(companiesSrc + ";return COMPANIES;")();
const gnUrl = (n) => `https://news.google.com/rss/search?q=${encodeURIComponent('"' + n.replace(/\s*\(.*?\)/g, "") + '" AI')}&hl=en-US&gl=US&ceid=US:en`;
const bingUrl = (n) => `https://www.bing.com/news/search?q=${encodeURIComponent('"' + n.replace(/\s*\(.*?\)/g, "") + '" AI')}&format=rss`;
const prio = COMPANIES.filter(c => c.p);
const rest = COMPANIES.filter(c => !c.p);
const slice = Math.floor(new Date().getUTCHours() / 1) % Math.ceil(rest.length / 30);
const batch = [...prio, ...rest.slice(slice * 30, slice * 30 + 30)];
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
    const cutoff = Date.now() - 14 * 86400000; // only news from the last 2 weeks
    for (const it of its.filter(i => i.date.getTime() > cutoff).slice(0, c.p ? 2 : 1)) {
      companyPosts.push({
        a: c.n, s: `Company Watch · ${c.side === "s" ? "competitor/supplier" : "customer/market"}${c.score != null ? ` · AI ${c.score}/10` : ""}`,
        av: "auto", t: "industry",
        d: it.date.toISOString().slice(0, 10),
        when: it.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        body: it.title + (it.desc ? "\n\n" + it.desc + "…" : ""), tags: ["C-Suite", "Marketing & Sales", "Product Managers"], topic: "Company Watch",
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
const allPosts = [...posts.slice(0, MAX_TOTAL), ...companyTop];
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
const withImg = allPosts.filter(p => p.img);
const noImg = allPosts.filter(p => !p.img);
const keepNoImg = noImg.slice(0, Math.max(8, Math.ceil(withImg.length * 0.25)));
const finalPosts = [...withImg, ...keepNoImg].sort((x, y) => y.d.localeCompare(x.d));
console.log(`media coverage: ${withImg.length}/${finalPosts.length} posts have image or video (${Math.round(100*withImg.length/finalPosts.length)}%)`);
const top = finalPosts;

const banner = `/* AUTO-GENERATED by scripts/update-feed.mjs — do not edit by hand.
   Generated: ${new Date().toISOString()} · ${top.length} items from ${FEEDS.length} feeds. */\n`;
writeFileSync(OUT, banner + "const POSTS_LIVE = " + JSON.stringify(top, null, 1) + ";\n");
console.log(`wrote ${top.length} live posts -> data/feed-live.js`);
