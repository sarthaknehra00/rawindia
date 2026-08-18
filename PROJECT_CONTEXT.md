# RAWINDIA — Complete Project Context & Architecture Reference

> **Brand Tagline:** *"100% Raw. 100% Real. No Spin."*  
> **Mission:** India's brutally honest, non-partisan, evidence-first digital news platform and strategic intelligence portal.

---

## 1. Executive Summary & Brand Positioning

**RAWINDIA** is designed to solve the two biggest structural flaws of mainstream Indian digital media:
1. **Extreme partisan spin and narrative dilution:** Fluffy, agenda-driven journalism that hedges facts and buries institutional accountability.
2. **Tabloid drift:** Clickbait algorithms prioritizing celebrity trivia over critical national policy.

**RAWINDIA's core approach:** Report Indian and global news with zero sugarcoating. **Facts first, context second, analysis clearly attributed.** Every story is powered by a real-time multi-API ingestion pipe, an uncompromising analytical editorial voice (powered by Groq LLaMA-3.3-70B), and a formalized dual-factor **News Prioritization & Ranking Framework**.

---

## 2. Core Product Architecture & Distinctive Features

### A. The Raw Fact Layer (Signature Component)
- Every single article displays a dedicated, high-contrast **"What Actually Happened"** box at the top before narrative commentary.
- Contains **4–5 empirical bullet points** answering who, what, when, where, and the exact financial/legal metrics.
- Cites **primary documentary sources** (e.g., Official Gazettes, PIB communiqués, Supreme Court orders, corporate filings).

### B. Source Transparency Ledger & Public Correction Log
- **Source Transparency:** Discloses every source classification (*Official Statement*, *Document*, *Eyewitness*, *Wire/Verified Reporter*) with a calculated reliability score (0–100%) and direct URLs.
- **Correction Log:** Permanent, timestamped editorial revision history visible at the bottom of every article.
- **Community Factual Balance Voting:** Real-time reader sentiment on dispatch accuracy (*Accurate*, *Needs Context*, *Disputed*).

### C. News Prioritization & Ranking Framework
RAWINDIA uses a mathematical formula to rank news dynamically across the homepage and category verticals:

$$\text{Priority Score} = (\text{Interest Score} \times 0.6) + (\text{Importance Score} \times 0.4) + \text{Importance Floor Override}$$

- **Interest Score ($I$ — Demand):** CTR, social velocity, search trend index, read time, and comment volume. Decays exponentially:
  $$I(t) = I_0 \times 0.5^{(t / t_{1/2})} \quad (t_{1/2} = 4.5\text{h for standard news, } 2.5\text{h for breaking})$$
- **Importance Score ($M$ — Magnitude):** Formal editorial checklist evaluating **Scale of Impact** (Local $\rightarrow$ Global), **Severity** (Minor $\rightarrow$ Critical), **Institutional Significance** (Parliament, Supreme Court, RBI, Armed Forces), **Irreversibility**, **Public Accountability Value**, **Long-Term Relevance**, and **Vulnerability of Affected Groups**.
- **Importance Floor Override:** Any critical constitutional, safety, or corruption investigation is **guaranteed a protected P0/P1 top placement** regardless of buzz so it never gets buried by viral entertainment.
- **Priority Tiers:**
  - **P0:** Breaking / Critical Magnitude (Top homepage banner, live blog, push alerts)
  - **P1:** High Priority (Top homepage rails, category leads)
  - **P2:** Standard Wire (General category feeds)
  - **P3:** Long-Tail / Archive (Preserved and searchable)
  - **Evergreen:** Deep explainers contextually resurfaced
- **Ranking Inspector Modal ("Why is this here?"):** Users can click any story's priority badge to inspect the real-time mathematical breakdown and factor checklist. Interest-signal inputs (CTR, social velocity, etc.) are honestly labeled as illustrative example values, not live measured analytics — the site has no per-article view-tracking backend yet.

### D. Tag & Topic Pages (`TagFeedView.tsx`)
- Every article's tags are clickable, routing to `/tag/:tagSlug` — a real "all stories tagged X" view built on existing article data, no fabricated engagement numbers.

### E. 16-Vertical & 36 States/UTs Explorer (`TaxonomyExplorer.tsx`)
- Structured taxonomy covering 16 Indian journalistic verticals (National, States/UTs, Judiciary & Law, Economy & Markets, Technology, Environment, Defense, etc.) and all 36 States/Union Territories with metro hub monitors. (Two placeholder verticals — a fake "Social Pulse" sentiment category and a fake "Claim Tracker" category — were removed along with the fabricated features they represented: a fake live-sentiment dashboard with invented social-listening numbers, and a fake fact-check database with invented verification claims.)

---

## 3. Active External APIs & Integrations

All external API calls are proxied server-side via Vercel serverless functions (`api/groq.ts`, `api/news.ts`) — no key is ever shipped to the client. Real keys live only in `.env` (local dev) and the Vercel project's environment variables (production), under the plain (non-`VITE_`-prefixed) names below.

| Service | Env var name | Role & Endpoints Used |
|---|---|---|
| **NewsAPI (Primary News Pipe)** | `NEWSAPI_KEY` | • **Live Top Headlines:** `https://newsapi.org/v2/top-headlines?country=in`<br>• **Archive / Historical Search:** `https://newsapi.org/v2/everything?q=India&sortBy=publishedAt` |
| **Currents API (Secondary Live Wire)** | `CURRENTS_KEY` | • **Real-Time News Stream:** `https://api.currentsapi.services/v1/latest-news?language=en` |
| **Groq Cloud AI (LLaMA-3.3-70B / 3.1-8B)** | `GROQ_KEY` | • **Models:** `llama-3.3-70b-versatile` (hero/immediate synthesis), `llama-3.1-8b-instant` (background queue)<br>• **Role:** Real-time editorial synthesis in RAWINDIA's signature sharp, uncompromising, evidence-based voice — now including genuine Hindi translation. |

---

## 4. Real-Time Data Flow & Background Cron Architecture

```
[NewsAPI Top Headlines / Everything] + [Currents API]
                     │  (via /api/news.ts — server-side proxy, key never reaches client)
                     ▼
  [newsApiService.ts Ingestion Engine]  ─── non-blocking: raw articles return immediately
                     │
                     ├─► [groqQueueService.ts Background Queue]
                     │        Batched Groq synthesis via /api/groq.ts (server-side proxy)
                     │        llama-3.1-8b-instant (background) / llama-3.3-70b-versatile (hero)
                     │        Now also generates a genuine Hindi translation per article.
                     │
                     ├─► [Persistent Archive: IndexedDB via persistenceService.ts]
                     │        (Deduplicates by ID/title, preserves historical dispatches)
                     │
                     ▼
  [rankingEngineService.ts]
     • Computes Interest Score (I) with Time-Decay
     • Evaluates Importance Score (M) & Floor Override
     • Calculates Priority Score & Tiers (P0 / P1 / P2 / P3)
                     │
                     ▼
  [react-router-dom — real per-page URLs, not client-only state]
     ├── / — #1 Top Story Slot (Dynamic P0/P1 Lead)
     ├── /section/:verticalSlug, /today, /week, /month, /live
     ├── /article/:slugId — shareable article URL, dynamic <title>/OG tags
     ├── /tag/:tagSlug — topic pages
     └── Smooth Breaking Ticker (110s loop, hover-pause)
                     ▲
                     │
  [cronSchedulerService.ts] (Background cycle every 90s/10min auto-rotates channels)
```

---

## 5. UI/UX Design System & Aesthetics

- **Design Style:** Editorial Brutalism & Minimalist Broadsheet.
- **Typography:**
  - Headlines & Serifs: `Libre Caslon Text`
  - Labels, Caps & Badges: `Archivo Narrow` (tracking +0.09em, uppercase)
  - Body Copy & Meta Data: `Work Sans`
- **Color Palette:**
  - Paper Background: `#FCF9F8` (Dark mode: `#121212`)
  - Ink Primary Text: `#1C1B1B` (Dark mode: `#F3F0EF`)
  - Accent / Critical Red: `#AB2C5D`
  - Ticker Ribbon Pink: `#FFD9E1` (Dark mode: `#3F001B`)
  - Hairline Borders: `border-primary/15`
- **Theme & Language:** Single theme — newspaper/light only. English only (the Hindi toggle and dark theme were removed by product decision; see §7).

---

## 6. Directory Structure & Key Files

```
c:/Users/Sarthak nehra/Desktop/new project/
├── api/                                # Vercel serverless functions — real API keys live only here (server-side)
│   ├── groq.ts                         # POST proxy to Groq chat completions, rate-limited
│   ├── news.ts                         # GET proxy for NewsAPI (top/everything) + Currents, rate-limited
│   └── _rateLimit.ts                   # Shared in-memory per-IP fixed-window limiter
├── src/
│   ├── components/
│   │   ├── Header.tsx                 # Minimal masthead, IST clock, search & nav tabs
│   │   ├── BreakingTicker.tsx         # Smooth 110s ticker for P0/breaking news with hover pause
│   │   ├── HeroStory.tsx              # 12-column broadsheet with dynamic top story
│   │   ├── ArticleView.tsx            # 2-column article reader with The Raw Fact Layer & Source Ledger
│   │   ├── RankingInspectorModal.tsx  # "Why is this here?" modal — honest about which inputs are illustrative
│   │   ├── TaxonomyNav.tsx            # Broadsheet navigation bar
│   │   ├── TaxonomyExplorer.tsx       # 16-vertical & 36 States/UTs dynamic dispatch explorer
│   │   ├── TagFeedView.tsx            # /tag/:tagSlug topic pages
│   │   ├── LiveFeedView.tsx           # /live — paginated live wire + archive
│   │   ├── SectionFeedView.tsx        # /today, /week, /month
│   │   ├── LiveBlogView.tsx           # Timestamped real-time live event coverage
│   │   ├── SearchModal.tsx            # Instant full-text search across articles
│   │   ├── AiNewsroomModal.tsx        # Generate a fresh dispatch on demand via Groq
│   │   ├── EditorialStandardModal.tsx # IT Rules 2021 & editorial charter disclosures
│   │   ├── ErrorBoundary.tsx          # Scoped per-section (not just one app-wide boundary)
│   │   └── Footer.tsx                 # Dark minimalist broadsheet footer
│   ├── services/
│   │   ├── rankingEngineService.ts    # Dual-factor Prioritization, Time-Decay & Floor Override engine
│   │   ├── newsApiService.ts          # Ingestion via /api/news.ts + persistent archival store
│   │   ├── groqWriterService.ts       # Groq synthesis via /api/groq.ts — English + genuine Hindi output
│   │   ├── groqQueueService.ts        # Background batch synthesis queue (fast model tier)
│   │   └── cronSchedulerService.ts    # Background recurring cron runner (90s / 10min cycles)
│   ├── hooks/
│   │   ├── useDocumentMeta.ts         # Zero-dep per-route <title>/OG/Twitter meta updater
│   │   └── useModalA11y.ts            # Shared Escape-to-close + focus-trap + focus-return for every modal
│   ├── utils/
│   │   └── routing.ts                 # Route <-> tab/vertical/article-slug mapping (URL is the source of truth)
│   ├── data/
│   │   ├── articlesData.ts            # Baseline curated investigations & dispatches
│   │   └── taxonomyData.ts            # 16 verticals, sub-categories, and 36 States/UTs definitions
│   ├── styles/
│   │   └── index.css                  # Tailwind v4 theme variables, typography & layout utilities
│   ├── types.ts                       # Complete TypeScript interfaces for articles, ranking & taxonomy
│   └── App.tsx                        # Route-driven app shell (react-router-dom) — no more client-only tab state
├── public/
│   ├── robots.txt / sitemap.xml / manifest.json   # Real SEO/PWA files — sitemap covers static routes only
│   ├── favicon.svg / icons.svg
├── vite.config.ts                     # Vite + Tailwind v4 config + dev-only /api proxy plugin + vendor chunking
├── vite-plugin-api-dev.ts             # Mounts api/*.ts handlers onto `npm run dev` (no `vercel dev` needed)
├── vercel.json                        # Vercel deploy config (SPA rewrite; /api/* routed before it)
├── package.json                       # Project dependencies
└── PROJECT_CONTEXT.md                 # This file
```

> **Security note:** as of this pass, no real API key is ever shipped to the browser — see §3. Previously this file (and the client bundle) contained plaintext keys; both have been remediated.

---

## 7. Current Project Status & Build Commands

- **Build Status:** Verified with `npm run build` (`tsc -b && vite build`) — **0 errors**. Main JS chunk ~196KB (down from ~451KB pre-code-splitting) plus separate on-demand chunks for search, AI newsroom, editorial standards, ranking inspector, taxonomy explorer, live feed, and section feed.
- **Development Server:** `npm run dev` (Vite) — `/api/groq` and `/api/news` are mounted locally via a dev-only Vite plugin, no `vercel dev` required.
- **Primary Entrypoint:** `src/App.tsx` (now route-driven via `react-router-dom`).
- **Before deploying to Vercel:** set `GROQ_KEY`, `NEWSAPI_KEY`, `CURRENTS_KEY` as environment variables in the Vercel project dashboard (plain names, **not** `VITE_`-prefixed — a `VITE_`-prefixed var gets inlined into the client bundle and defeats the whole point of the `/api` proxy). `.env.example` documents this.
- **Known limitation, by design:** this stays a client-rendered SPA (no SSR). Social share previews (WhatsApp/Twitter/Facebook link-unfurl) will show a generic site-wide card rather than per-article — only a real SSR/prerendering setup or a backend datastore removes this ceiling, and both were deliberately kept out of scope to preserve the site's minimal-dependency architecture. In-app navigation, browser back/forward, and organic search (JS-executing crawlers) are unaffected.
- **Known limitation:** `public/sitemap.xml` uses relative URLs since no production domain is set yet — replace with absolute URLs once deployed.
- **Product decision:** the Hindi language toggle and dark theme were removed entirely (not just hidden) — no `lang`/`viewMode` state, no per-article Hindi generation or seed data, single newspaper/light theme only. `taxonomyData.ts`'s `nameHi` fields are inert leftover data (nothing reads them) and were left in place rather than stripped across 100+ occurrences for zero functional gain.
