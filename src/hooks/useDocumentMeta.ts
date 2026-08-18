import { useEffect } from 'react';

interface ArticleSchema {
  headline: string;
  datePublished: string;
  dateModified?: string;
  image?: string[];
  authorName?: string;
}

interface MetaConfig {
  title: string;
  description?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogUrl?: string;
  canonicalUrl?: string;
  articleSchema?: ArticleSchema;
}

function setMetaByName(name: string, content?: string) {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setMetaByProperty(property: string, content?: string) {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('property', property);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function setCanonicalLink(href: string) {
  let tag = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', 'canonical');
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

const LD_JSON_ID = 'rawindia-article-ld-json';

function setArticleSchema(schema: ArticleSchema) {
  let tag = document.getElementById(LD_JSON_ID) as HTMLScriptElement | null;
  if (!tag) {
    tag = document.createElement('script');
    tag.type = 'application/ld+json';
    tag.id = LD_JSON_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: schema.headline,
    datePublished: schema.datePublished,
    dateModified: schema.dateModified ?? schema.datePublished,
    image: schema.image ?? [],
    author: schema.authorName ? { '@type': 'Person', name: schema.authorName } : undefined,
    publisher: { '@type': 'Organization', name: 'RAWINDIA' },
  });
}

function removeArticleSchema() {
  document.getElementById(LD_JSON_ID)?.remove();
}

// Zero-dependency per-page <title>/meta updater. There's no SSR here, so this
// only benefits same-session in-app navigation and JS-executing crawlers —
// it does NOT fix social-media link-unfurl previews (WhatsApp/Twitter/etc.
// fetch raw HTML without running JS and will keep seeing index.html's static
// tags). That's a known, accepted limitation of staying SSR-free.
export function useDocumentMeta(meta: MetaConfig) {
  useEffect(() => {
    document.title = meta.title;
    setMetaByName('description', meta.description);
    setMetaByProperty('og:title', meta.ogTitle ?? meta.title);
    setMetaByProperty('og:description', meta.ogDescription ?? meta.description);
    setMetaByProperty('og:image', meta.ogImage);
    setMetaByProperty('og:url', meta.ogUrl ?? window.location.href);
    setMetaByName('twitter:title', meta.ogTitle ?? meta.title);
    setMetaByName('twitter:description', meta.ogDescription ?? meta.description);
    setMetaByName('twitter:image', meta.ogImage);
    setCanonicalLink(meta.canonicalUrl ?? window.location.href);

    // NewsArticle structured data only applies on real article pages — other
    // routes simply never pass articleSchema, so this is a no-op there.
    if (meta.articleSchema) {
      setArticleSchema(meta.articleSchema);
    } else {
      removeArticleSchema();
    }

    // Removes the LD+JSON script on unmount/navigation-away so it never
    // lingers stale on a route that no longer represents that article.
    return () => removeArticleSchema();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta.title, meta.description, meta.ogTitle, meta.ogDescription, meta.ogImage, meta.ogUrl, meta.canonicalUrl, meta.articleSchema]);
}
