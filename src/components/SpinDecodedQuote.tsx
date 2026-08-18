import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { getSpinPhrases, type SpinPhrase, type SpinContext } from '../services/spinDecoderService';

/**
 * Renders a quote as plain text until the reader asks to "Decode the Spin" —
 * then re-renders it with any detected euphemisms highlighted. Clicking a
 * highlighted phrase reveals its plain-English translation inline (same
 * click-to-reveal pattern as the tag explainers, not a hover tooltip — works
 * the same on mobile as desktop).
 */
export const SpinDecodedQuote: React.FC<{ quote: string; context?: SpinContext }> = ({ quote, context }) => {
  const [checked, setChecked]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [phrases, setPhrases]     = useState<SpinPhrase[]>([]);
  const [activeTerm, setActiveTerm] = useState<string | null>(null);

  const handleDecode = async () => {
    if (checked || loading) return;
    setLoading(true);
    const result = await getSpinPhrases(quote, context);
    setPhrases(result);
    setChecked(true);
    setLoading(false);
  };

  // Splits the quote around each detected phrase (case-insensitive, first
  // match only per phrase) so the matched text can render as a highlighted,
  // clickable span while everything else stays plain.
  const renderQuote = () => {
    if (phrases.length === 0) return quote;

    type Segment = { text: string; phrase: SpinPhrase | null };
    let segments: Segment[] = [{ text: quote, phrase: null }];

    phrases.forEach(p => {
      segments = segments.flatMap(seg => {
        if (seg.phrase) return [seg]; // already matched to an earlier phrase
        const idx = seg.text.toLowerCase().indexOf(p.term.toLowerCase());
        if (idx === -1) return [seg];
        const before = seg.text.slice(0, idx);
        const match  = seg.text.slice(idx, idx + p.term.length);
        const after  = seg.text.slice(idx + p.term.length);
        return [
          { text: before, phrase: null },
          { text: match, phrase: p },
          { text: after, phrase: null },
        ].filter(s => s.text.length > 0);
      });
    });

    return segments.map((seg, i) =>
      seg.phrase ? (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActiveTerm(activeTerm === seg.phrase!.term ? null : seg.phrase!.term);
          }}
          className={`underline decoration-dotted decoration-2 underline-offset-4 transition-colors ${
            activeTerm === seg.phrase.term ? 'bg-secondary text-on-secondary' : 'text-secondary hover:bg-secondary/20'
          }`}
        >
          {seg.text}
        </button>
      ) : (
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      )
    );
  };

  const active = phrases.find(p => p.term === activeTerm);

  return (
    <div>
      <p>"{renderQuote()}"</p>

      {!checked && (
        <button
          type="button"
          onClick={handleDecode}
          disabled={loading}
          className="mt-3 flex items-center gap-1.5 font-label-caps text-[10px] uppercase font-bold text-primary hover:text-secondary transition-colors disabled:opacity-60 not-italic"
        >
          <Search size={11} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning for spin…' : 'Decode the Spin'}
        </button>
      )}

      {checked && phrases.length === 0 && (
        <p className="mt-3 font-meta text-meta text-on-surface-variant not-italic">
          No PR-softened language detected in this quote.
        </p>
      )}

      {active && (
        <div className="mt-3 pl-3 border-l-2 border-secondary font-meta text-meta text-on-surface-variant not-italic">
          <strong className="text-primary">"{active.term}"</strong> really means: {active.translation}
        </div>
      )}
    </div>
  );
};
