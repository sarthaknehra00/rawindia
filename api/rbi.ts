// @ts-nocheck
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isRateLimited, clientKey, isLoopback } from './_rateLimit.js';

// RBI's public press-release RSS — no key, no auth, no CAPTCHA. Verified live
// (curl, real browser UA) to be a genuine RSS 2.0 feed with <title>/<description>
// CDATA fields and a <link> to the full press-release page.
const RBI_FEED_URL = 'https://www.rbi.org.in/pressreleases_rss.xml';

// Individual press-release pages ARE fetchable (200, real HTML) but their
// <h2> title is populated client-side by JS and isn't in the raw HTML a
// server fetch gets — so this proxy only uses these pages to pull the one
// thing that IS reliably in the raw HTML: the real PDF link, tagged with an
// id='APDF_...' anchor (verified consistent across multiple live prid pages).
// The article's title/body always come from the RSS feed itself, never here.
const ALLOWED_LINK_PREFIX = 'https://www.rbi.org.in/scripts/BS_PressReleaseDisplay.aspx?prid=';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

function extractField(block: string, tag: string): string {
  const cdata = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  if (cdata) return cdata[1].trim();
  const plain = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return plain ? plain[1].trim() : '';
}

interface RbiFeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
}

function parseRbiFeed(xml: string): RbiFeedItem[] {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks
    .map(block => ({
      title:       extractField(block, 'title'),
      description: extractField(block, 'description'),
      link:        extractField(block, 'link'),
      pubDate:     extractField(block, 'pubDate'),
    }))
    .filter(item => item.title && item.link);
}

// Only the real per-release PDF, never the two generic boilerplate PDFs
// (RTI/disclaimer links) that are present on every RBI page regardless of
// which release it is — those don't carry the id='APDF_' marker.
function extractPdfUrl(html: string): string | null {
  const aTag = html.match(/<a\s+id='APDF_[^']*'[^>]*>/i);
  if (!aTag) return null;
  const href = aTag[0].match(/href='([^']*)'/i);
  return href ? href[1] : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Modest limit — this hits RBI's own site directly, not a metered API, so
  // stay a light, respectful caller rather than maximizing throughput.
  if (!isLoopback(req) && isRateLimited(`rbi:${clientKey(req)}`, 20)) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  const type = req.query.type;

  try {
    if (type === 'feed') {
      const upstream = await fetch(RBI_FEED_URL, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
      if (!upstream.ok) {
        res.status(502).json({ error: `RBI feed returned ${upstream.status}` });
        return;
      }
      const xml = await upstream.text();
      res.status(200).json({ items: parseRbiFeed(xml) });
      return;
    }

    if (type === 'pdf') {
      const link = req.query.link;
      if (typeof link !== 'string' || !link.startsWith(ALLOWED_LINK_PREFIX)) {
        res.status(400).json({ error: 'link must be an RBI press-release page URL' });
        return;
      }
      const upstream = await fetch(link, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
      if (!upstream.ok) {
        res.status(200).json({ pdfUrl: null });
        return;
      }
      const html = await upstream.text();
      res.status(200).json({ pdfUrl: extractPdfUrl(html) });
      return;
    }

    res.status(400).json({ error: 'type must be "feed" or "pdf"' });
  } catch (err) {
    res.status(502).json({ error: 'Upstream RBI request failed', detail: String(err) });
  }
}
