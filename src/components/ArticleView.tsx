import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Article } from '../types';
import { Volume2, VolumeX, Share2, ArrowLeft, ChevronDown, ChevronRight, RotateCcw, Edit3, Clock, Info, ImageDown } from 'lucide-react';
import { timeAgo, isJustIn, toISTString } from '../utils/timeUtils';
import { tagToPath, verticalToPath, institutionToPath } from '../utils/routing';
import { synthesizeRawArticle } from '../services/groqWriterService';
import { getExplainer } from '../services/explainerService';
import { getSpinPhrases } from '../services/spinDecoderService';
import { ensureArticleEmbedded } from '../services/archiveEmbeddingService';
import { CoverageComparison } from './CoverageComparison';
import { SpinDecodedQuote } from './SpinDecodedQuote';
import { VerdictCardModal } from './VerdictCardModal';

// Citation strings are plain text like "Google News: https://..." — split off
// the embedded URL and render it as a real clickable link instead of dumping
// the raw address as visible text. Falls back to plain text when a citation
// has no URL at all (e.g. an official-document reference).
function CitationText({ text }: { text: string }) {
  const match = text.match(/https?:\/\/\S+/);
  if (!match) return <>{text}</>;

  const url = match[0];
  let label = text.slice(0, match.index).replace(/[:\s]+$/, '').trim();
  if (!label) {
    try { label = new URL(url).hostname.replace(/^www\./, ''); } catch { label = 'View Source'; }
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-primary/40 hover:decoration-primary text-primary hover:text-secondary transition-colors"
    >
      {label}
    </a>
  );
}

interface ArticleViewProps {
  article: Article;
  onBack: () => void;
  allArticles?: Article[];
  onSelectArticle?: (article: Article) => void;
  onInspectRanking?: (article: Article) => void;
  onArticleSynthesized?: (article: Article) => void;
}

export const ArticleView: React.FC<ArticleViewProps> = ({
  article: initialArticle,
  onBack,
  onInspectRanking,
  onSelectArticle,
  onArticleSynthesized,
  allArticles = [],
}) => {
  const navigate = useNavigate();
  const [article, setArticle] = useState<Article>(initialArticle);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [sourceDrawerOpen, setSourceDrawerOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  // "The Basics" — one shared inline explainer slot for whichever tag the
  // reader last asked about, rather than a popover per pill (simpler to
  // position correctly on mobile, and only one is ever open at a time anyway).
  const [explainerTag, setExplainerTag] = useState<string | null>(null);
  const [explainerText, setExplainerText] = useState<string | null>(null);
  const [explainerLoading, setExplainerLoading] = useState(false);

  const handleExplainTag = async (tag: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (explainerTag === tag) { setExplainerTag(null); return; }
    setExplainerTag(tag);
    setExplainerText(null);
    setExplainerLoading(true);
    const result = await getExplainer(tag);
    setExplainerLoading(false);
    setExplainerText(result);
  };

  useEffect(() => {
    setArticle(initialArticle);
  }, [initialArticle]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, [article.id]);

  // Always reflects the currently-displayed article id, updated on every
  // render (not inside an effect) — lets the synthesis effect below tell
  // "still the same article" apart from "reader navigated to a different
  // one while the Groq call was in flight" at resolution time.
  const activeArticleId = useRef(initialArticle.id);
  activeArticleId.current = initialArticle.id;

  // Guards against React 19 StrictMode's dev-only double-invoke firing two
  // concurrent Groq calls for the same article before either resolves — the
  // service's own per-article cache only populates AFTER a call resolves,
  // so it can't catch a same-tick double-fire on its own.
  const synthesisRequestedFor = useRef<string | null>(null);

  // Instant, on-demand rewrite: archive/historical articles are deliberately
  // never bulk-queued into the background Groq worker (see newsApiService.ts's
  // ingestArticles — proactively rewriting a year of rarely-read archive
  // content was starving the live-article queue). The first reader to open
  // one triggers a single fast Groq call here instead. No loading indicator
  // by design: raw content shows immediately, then silently swaps to the
  // rewritten version when ready — the same "never block the UI on Groq"
  // pattern the rest of the site already uses.
  useEffect(() => {
    if (initialArticle.isGroqSynthesized || initialArticle.isLiveBlog) return;
    if (synthesisRequestedFor.current === initialArticle.id) return;
    synthesisRequestedFor.current = initialArticle.id;

    const requestedId = initialArticle.id;
    synthesizeRawArticle(initialArticle).then(result => {
      if (activeArticleId.current !== requestedId) return; // navigated away — drop stale response
      setArticle(current => current.id === requestedId ? result : current);
      onArticleSynthesized?.(result);
      // Background spin-scan for the same reason as groqQueueService.ts's
      // hook — this on-demand path (archive articles a reader opens first)
      // is the OTHER place a quoteHighlight first appears, so it needs the
      // same automatic ledger logging, not just a manual "Decode the Spin"
      // click.
      if (result.quoteHighlight?.quote) {
        getSpinPhrases(result.quoteHighlight.quote, {
          speaker:      result.quoteHighlight.speaker,
          articleId:    result.id,
          articleTitle: result.title,
        }).catch(() => {});
      }
      ensureArticleEmbedded(result).catch(() => {});
    }).catch(() => {});
  }, [initialArticle, onArticleSynthesized]);

  const toggleAudio = () => {
    if (!('speechSynthesis' in window)) return;
    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      const text = `${article.title}. ${article.factBlock.bullets.join('. ')}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isGroundReport = article.contentType?.toUpperCase() === 'GROUND REPORT';

  // Real related articles — same vertical or matching tags, exclude current
  const contextualBriefs = allArticles
    .filter(a =>
      a.id !== article.id &&
      (a.verticalId === article.verticalId ||
        a.tags.some(t => article.tags.includes(t)))
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 3)
    .map(a => ({ date: timeAgo(a.publishedAt), title: a.title, article: a }));

  const paragraphs = article.bodyParagraphs;

  return (
    <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in">
      {/* Breadcrumb — same treatment as TaxonomyExplorer's */}
      <div className="font-label-caps text-[11px] text-on-surface-variant mb-3 flex items-center gap-1.5 uppercase">
        <button onClick={onBack} className="hover:text-primary transition-colors">Home</button>
        {article.verticalName && (
          <>
            <ChevronRight size={11} />
            <button
              onClick={() => navigate(verticalToPath(article.verticalId))}
              className="hover:text-primary transition-colors"
            >
              {article.verticalName}
            </button>
          </>
        )}
        <ChevronRight size={11} />
        <span className="text-primary font-bold truncate max-w-[40ch]">{article.title}</span>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between hairline-b pb-3 mb-6 flex-wrap gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase text-on-surface-variant hover:text-secondary transition-colors font-bold"
        >
          <ArrowLeft size={13} />
          Back to Feed
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          {article.ranking && (
            <button
              onClick={() => onInspectRanking?.(article)}
              className="flex items-center gap-1 px-3 py-1.5 news-border font-label-caps text-label-caps uppercase text-primary hover:bg-primary hover:text-on-primary transition-colors font-bold"
            >
              {article.ranking.priorityTier} — Why is this here?
            </button>
          )}
          <button
            onClick={toggleAudio}
            className={`flex items-center gap-1 px-3 py-1.5 news-border font-label-caps text-label-caps uppercase transition-colors ${
              isPlayingAudio ? 'bg-primary text-on-primary' : 'hover:bg-surface-container'
            }`}
          >
            {isPlayingAudio ? <VolumeX size={13} /> : <Volume2 size={13} />}
            {isPlayingAudio ? 'Stop' : 'Listen'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1 px-3 py-1.5 news-border font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
          >
            <Share2 size={12} />
            {copied ? 'Copied!' : 'Share'}
          </button>
          <button
            onClick={() => setCardModalOpen(true)}
            className="flex items-center gap-1 px-3 py-1.5 news-border font-label-caps text-label-caps uppercase hover:bg-surface-container transition-colors"
          >
            <ImageDown size={12} />
            Share Card
          </button>
        </div>
      </div>

      {cardModalOpen && (
        <VerdictCardModal type="quote" article={article} onClose={() => setCardModalOpen(false)} />
      )}

      {/* 2-column layout */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-gutter">
        {/* ── ARTICLE MAIN COLUMN ── */}
        <article className="flex-grow lg:w-8/12 lg:border-r lg:border-outline-variant pr-0 lg:pr-gutter">
          {/* Headline block */}
          <header className="mb-stack-lg">
            <div className="flex items-center gap-2 mb-stack-sm flex-wrap">
              <div className="news-border px-3 py-1">
                <span className="font-label-caps text-label-caps uppercase text-primary tracking-widest">
                  {article.contentType || 'NEWS'}
                </span>
              </div>
              {isJustIn(article.publishedAt) && (
                <span className="bg-error text-on-error font-label-caps text-label-caps px-2 py-1 uppercase animate-pulse">
                  Just In
                </span>
              )}
            </div>

            <h1
              className="font-headline-xl text-headline-xl text-primary mb-stack-md leading-tight"
              aria-live="polite"
            >
              {article.title}
            </h1>

            <p className="font-body-md text-body-md text-on-surface-variant mb-stack-md leading-relaxed max-w-3xl">
              {article.subtitle}
            </p>

            <div className="flex items-center gap-4 hairline-t hairline-b py-3 mb-stack-lg flex-wrap">
              <div className="flex items-center gap-2">
                <Edit3 size={13} className="text-outline" />
                <span className="font-meta text-meta uppercase text-on-surface-variant tracking-wider">
                  By {article.author.name}
                </span>
              </div>
              <span className="text-outline-variant">|</span>
              <div className="flex items-center gap-2">
                <Clock size={13} className="text-outline" />
                <time className="font-meta text-meta uppercase text-on-surface-variant tracking-wider">
                  {toISTString(article.publishedAt)} • {timeAgo(article.publishedAt)}
                </time>
              </div>
            </div>
          </header>

          {/* Hero image — borderless editorial photography */}
          <figure className="mb-section-gap">
            <div className="img-wrapper img-wrapper-hero">
              {article.heroImage ? (
                <img
                  src={article.heroImage}
                  alt={article.title}
                  fetchPriority="high"
                  onError={e => { (e.target as HTMLImageElement).src = `https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=1200&auto=format&fit=crop&q=80`; }}
                  className={`w-full h-auto object-cover aspect-video ${isGroundReport ? 'editorial-img-hard' : 'editorial-img'}`}
                />
              ) : (
                <div className="img-placeholder w-full aspect-video flex items-center justify-center news-border">
                  <span className="font-label-caps text-label-caps uppercase text-outline">
                    Image Archived — Article Over 24h
                  </span>
                </div>
              )}
            </div>
            <figcaption className="font-meta text-meta text-on-surface-variant mt-2 pb-2 hairline-b italic text-right">
              {article.heroImageCaption || 'File photo. [Image: RAWINDIA Visuals]'}
            </figcaption>
          </figure>

          {/* ── THE FACT LAYER ── */}
          <div className="bg-wash-warm news-border p-stack-md mb-section-gap relative">
            <div className="absolute -top-3 left-4 bg-primary text-on-primary px-3 py-1">
              <span className="font-label-caps text-label-caps uppercase tracking-widest flex items-center gap-2">
                <span className="text-sm">✓</span>
                The Fact Layer
              </span>
            </div>
            <ul className="mt-stack-sm space-y-4">
              {article.factBlock.bullets.map((bullet, idx) => {
                const [label, ...rest] = bullet.split(':');
                const value = rest.join(':');
                return (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="text-secondary mt-1 flex-shrink-0 font-bold text-lg leading-none">→</span>
                    <div>
                      {value ? (
                        <>
                          <strong className="font-body-md text-body-md font-bold block mb-1">{label}:</strong>
                          <span className="font-body-sm text-body-sm">{value.trim()}</span>
                        </>
                      ) : (
                        <span className="font-body-sm text-body-sm">{bullet}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {article.factBlock.primarySources?.length > 0 && (
              <div className="mt-stack-md pt-stack-sm hairline-t font-meta text-meta text-on-surface-variant">
                <strong className="text-primary uppercase">Primary Citations:</strong>{' '}
                {article.factBlock.primarySources.map((src, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && ' • '}
                    <CitationText text={src} />
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* ── Article body ── */}
          {/* Serif "poetic reading" register for long-form copy — the one
              place on the site where atmosphere matters more than density. */}
          <div className="font-body-serif text-lg leading-loose text-on-surface space-y-6 mb-section-gap max-w-none">
            {paragraphs.map((para, i) => (
              <React.Fragment key={i}>
                {i === 0 ? (
                  <p>
                    <span className="font-bold text-xl float-left mr-2 mt-1 leading-none font-display-lg">
                      {para.charAt(0)}
                    </span>
                    {para.slice(1)}
                  </p>
                ) : (
                  <>
                    {i === 2 && (
                      <h3 className="font-headline-lg text-headline-lg mt-stack-lg mb-stack-md border-b border-primary inline-block pb-1">
                        The Ground Reality
                      </h3>
                    )}
                    <p>{para}</p>
                  </>
                )}
              </React.Fragment>
            ))}

            {/* Pull quote — spin-decodable: reveals euphemism translations on demand */}
            {article.quoteHighlight && (
              <blockquote className="my-section-gap border-l-4 border-secondary pl-stack-md py-2 bg-surface-container-low italic font-headline-lg-mobile text-headline-lg-mobile text-on-surface-variant">
                <SpinDecodedQuote
                  quote={article.quoteHighlight.quote}
                  context={{
                    speaker:      article.quoteHighlight.speaker,
                    articleId:    article.id,
                    articleTitle: article.title,
                  }}
                />
                <footer className="mt-4 font-meta text-meta not-italic text-outline-variant uppercase">
                  —{' '}
                  <button
                    onClick={() => navigate(institutionToPath(article.quoteHighlight!.speaker))}
                    className="underline decoration-dotted hover:text-secondary transition-colors"
                    title={`View ${article.quoteHighlight.speaker}'s institutional profile`}
                  >
                    {article.quoteHighlight.speaker}
                  </button>
                  {article.quoteHighlight.context ? `, ${article.quoteHighlight.context}` : ''}
                </footer>
              </blockquote>
            )}
          </div>

          {/* ── Counterpoint / Debate — two opposing stances, side by side ──
              This entire content type (isCounterpoint + counterpoint.stanceA/B)
              existed in the data model and seed data but had NO rendering
              anywhere in the app — a debate article's body text would promise
              "read both cases below" and then show nothing of the kind. */}
          {article.isCounterpoint && article.counterpoint && (
            <section className="mb-section-gap">
              <h2 className="font-headline-lg text-headline-lg font-bold text-primary mb-stack-md text-center">
                {article.counterpoint.debateTitle}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                {[article.counterpoint.stanceA, article.counterpoint.stanceB].map((stance, i) => (
                  <div
                    key={i}
                    className={`news-border p-stack-md bg-surface border-t-4 ${i === 0 ? 'border-t-primary' : 'border-t-secondary'}`}
                  >
                    <div className="flex items-center gap-3 mb-stack-sm pb-stack-sm hairline-b">
                      <img
                        src={stance.authorAvatar}
                        alt={stance.author}
                        className="w-12 h-12 rounded-full object-cover grayscale flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div>
                        <div className="font-body-sm font-bold text-primary">{stance.author}</div>
                        <div className="font-meta text-meta text-on-surface-variant">{stance.authorRole}</div>
                      </div>
                    </div>
                    <h3 className={`font-headline-lg text-base font-bold uppercase mb-2 ${i === 0 ? 'text-primary' : 'text-secondary'}`}>
                      {stance.title}
                    </h3>
                    <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-sm">{stance.summary}</p>
                    <ul className="list-disc pl-5 space-y-2 mb-stack-sm">
                      {stance.keyArguments.map((arg, j) => (
                        <li key={j} className="font-body-sm text-body-sm">{arg}</li>
                      ))}
                    </ul>
                    {stance.declarationOfIndependence && (
                      <p className="font-meta text-[11px] text-on-surface-variant italic hairline-t pt-2">
                        <strong className="text-primary not-italic">Declaration of Independence: </strong>
                        {stance.declarationOfIndependence}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Source Transparency Ledger ── */}
          <section className="news-border bg-surface p-stack-md mb-6">
            <div
              className="flex justify-between items-center cursor-pointer hairline-b pb-2 mb-3"
              onClick={() => setSourceDrawerOpen(!sourceDrawerOpen)}
            >
              <h3 className="font-label-caps text-label-caps uppercase font-bold text-primary">
                Source Transparency Ledger ({article.sourceTransparency.length} Sources)
              </h3>
              <ChevronDown
                size={14}
                className={`transition-transform duration-150 ${sourceDrawerOpen ? 'rotate-180' : ''}`}
              />
            </div>
            {sourceDrawerOpen && (
              <div className="flex flex-col gap-2">
                {article.sourceTransparency.map((src) => (
                  <div key={src.id} className="p-3 bg-surface-container-low news-border flex flex-col md:flex-row justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="bg-primary text-on-primary font-label-caps text-[10px] px-1.5 py-0.5 uppercase">
                          {src.type}
                        </span>
                        <span className="font-body-sm text-body-sm font-semibold text-primary">{src.name}</span>
                      </div>
                      <p className="font-meta text-meta text-on-surface-variant">{src.description}</p>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-1 font-meta text-meta underline decoration-primary/40 hover:decoration-primary text-primary hover:text-secondary transition-colors"
                        >
                          View Source →
                        </a>
                      )}
                    </div>
                    <div className="font-meta text-meta text-verified-text font-bold whitespace-nowrap self-start">
                      {src.reliabilityScore}% Reliable
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Coverage Comparison (only renders if other outlets covered this too) ── */}
          <CoverageComparison articleId={article.id} />

          {/* ── Correction Log ── */}
          <div className="mt-section-gap pt-stack-md border-t border-dashed border-hairline-grey mb-6">
            <h4 className="font-label-caps text-label-caps uppercase tracking-widest text-on-surface-variant mb-3 flex items-center gap-2">
              <RotateCcw size={12} /> Correction Log
            </h4>
            <div className="bg-surface-container-lowest border border-outline-variant p-4">
              {article.correctionLog.length > 0 ? (
                article.correctionLog.map((c, i) => (
                  <p key={i} className="font-body-sm text-body-sm text-on-surface-variant">
                    <strong className="text-primary">{c.timestamp}:</strong> {c.note}{c.editor ? ` (${c.editor})` : ''}
                  </p>
                ))
              ) : (
                <p className="font-meta text-meta text-on-surface-variant italic">No corrections logged for this dispatch.</p>
              )}
            </div>
          </div>

          {/* ── Tags ── */}
          {article.tags.length > 0 && (
            <div className="mb-6 pb-6 hairline-b">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-label-caps text-[10px] uppercase text-outline">Tagged:</span>
                {article.tags.map(tag => (
                  <span key={tag} className="inline-flex items-stretch news-border">
                    <button
                      onClick={() => navigate(tagToPath(tag))}
                      className="font-label-caps text-[10px] uppercase px-2 py-1 text-primary hover:bg-primary hover:text-on-primary transition-colors"
                    >
                      {tag}
                    </button>
                    <button
                      onClick={(e) => handleExplainTag(tag, e)}
                      className={`px-1.5 flex items-center border-l border-hairline-grey transition-colors ${
                        explainerTag === tag ? 'bg-secondary text-on-secondary' : 'text-outline hover:text-secondary'
                      }`}
                      aria-label={`What is ${tag}?`}
                      title={`What is ${tag}?`}
                    >
                      <Info size={11} />
                    </button>
                  </span>
                ))}
              </div>
              {explainerTag && (
                <div className="mt-3 pl-3 border-l-2 border-secondary font-body-sm text-body-sm text-on-surface-variant animate-fade-in">
                  {explainerLoading ? (
                    <span className="italic">Looking up "{explainerTag}"…</span>
                  ) : explainerText ? (
                    <><strong className="text-primary">{explainerTag}:</strong> {explainerText}</>
                  ) : (
                    <span className="italic">No reliable basic explainer available for "{explainerTag}".</span>
                  )}
                </div>
              )}
            </div>
          )}

        </article>

        {/* ── SIDEBAR ── */}
        <aside className="lg:w-4/12 flex flex-col gap-stack-lg">
          {/* Contextual Briefs */}
          <div className="news-border p-4 bg-surface">
            <h3 className="font-label-caps text-label-caps uppercase tracking-widest hairline-b pb-2 mb-4">
              Contextual Briefs
            </h3>
            {contextualBriefs.length === 0 ? (
              <p className="font-meta text-meta text-on-surface-variant italic">No related dispatches found.</p>
            ) : (
              <ul className="space-y-4 divide-y divide-hairline-grey">
                {contextualBriefs.map((b, i) => (
                  <li
                    key={i}
                    className={`${i > 0 ? 'pt-4' : ''} cursor-pointer group`}
                    onClick={() => b.article && onSelectArticle?.(b.article)}
                  >
                    <span className="font-meta text-meta text-secondary mb-1 block">{b.date}</span>
                    <h4 className="font-body-sm text-body-sm font-bold group-hover:underline">
                      {b.title}
                    </h4>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
