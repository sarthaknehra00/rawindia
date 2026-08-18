// @ts-nocheck
import { chromium } from 'playwright';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

/**
 * RAWINDIA - Lightweight Ingestion Pipeline
 * Scrapes primary Government sources and Tier-3 Commercial RSS feeds
 * to provide direct source URLs (e.g. PDF links) for the frontend to use.
 */

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/ingestedSources.json');
const scrapedData: any[] = [];

// ── TIER 1: SEBI (Playwright - Extracts PDF Links) ───────────────────────────

async function scrapeSebi() {
  console.log('Starting SEBI Playwright scrape for PDF links...');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=1&ssid=7&smid=0');
  
  const sebiItems = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tr')).slice(1); // skip header
    return rows.map(row => {
      const linkEl = row.querySelector('a');
      const dateEl = row.querySelector('td:first-child');
      if (!linkEl) return null;
      
      const href = linkEl.href;
      // Only return rows that link to a PDF
      if (href.includes('/sebi_data/') && href.toLowerCase().endsWith('.pdf')) {
        return {
          title: linkEl.textContent?.trim(),
          sourceUrl: href,
          date: dateEl?.textContent?.trim(),
          tier: 'Tier-1 Government',
          publisher: 'SEBI'
        };
      }
      return null;
    }).filter(Boolean);
  });

  console.log(`Found ${sebiItems.length} SEBI PDFs.`);
  scrapedData.push(...sebiItems);
  
  await browser.close();
}

// ── TIER 1: PIB (Custom HTML Scraper) ────────────────────────────────────────

async function scrapePib() {
  console.log('Starting PIB HTML scrape...');
  const res = await fetch('https://pib.gov.in/indexd.aspx');
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const releaseLinks: any[] = [];
  $('a[href*="PressReleasePage.aspx"]').each((i, el) => {
    releaseLinks.push({
      title: $(el).text().trim() || 'PIB Press Release',
      sourceUrl: `https://pib.gov.in/${$(el).attr('href')}`,
      tier: 'Tier-1 Government',
      publisher: 'PIB'
    });
  });
  
  console.log(`Found ${releaseLinks.length} PIB press release links.`);
  scrapedData.push(...releaseLinks);
}

// ── TIER 1: SANSAD LOK SABHA ─────────────────────────────────────────────────

async function scrapeSansad() {
  console.log('Fetching Lok Sabha Questions...');
  // Hitting JSON API - mock url output
  scrapedData.push({
    title: 'Lok Sabha Question Hour - Session 8',
    sourceUrl: 'https://sansad.in/api/loksabha/questions/pdf/12345',
    tier: 'Tier-1 Government',
    publisher: 'Sansad'
  });
}

// ── TIER 3: COMMERCIAL OUTLETS ───────────────────────────────────────────────

const RSS_FEEDS = [
  'https://www.livemint.com/rss/news',
  'https://www.livemint.com/rss/markets',
  'https://www.livemint.com/rss/technology',
  'https://www.business-standard.com/rss/latest.rss',
  'https://www.business-standard.com/rss/markets.rss',
  'https://www.business-standard.com/rss/technology.rss',
  'https://feeds.feedburner.com/ndtvnews-top-stories',
  'https://feeds.feedburner.com/ndtvnews-india-news',
  'https://feeds.feedburner.com/ndtvprofit-latest',
  'https://www.indiatoday.in/rss/home'
];

async function ingestRss() {
  console.log('Ingesting Tier-3 RSS feeds...');
  // Example of how the output will look without full rss-parser implementation
  scrapedData.push({
    title: 'Latest updates from LiveMint',
    sourceUrl: 'https://www.livemint.com/example-article',
    tier: 'Tier-3 Commercial',
    publisher: 'LiveMint'
  });
}

// ── MAIN RUNNER ──────────────────────────────────────────────────────────────

async function main() {
  console.log('--- RAWINDIA LINK EXTRACTOR STARTED ---');
  try {
    await scrapeSebi();
    await scrapePib();
    await scrapeSansad();
    await ingestRss();
    
    await fs.writeFile(OUTPUT_FILE, JSON.stringify(scrapedData, null, 2));
    console.log(`\n--- COMPLETE ---`);
    console.log(`Successfully saved ${scrapedData.length} source links to: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('Ingestion failed:', err);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

