import React from 'react';
import type { Article } from '../types';

interface BreakingTickerProps {
  breakingArticles: Article[];
  onSelectArticle: (article: Article) => void;
}

const LABELS = ['BREAKING', 'UPDATE', 'FLASH', 'DEVELOPING', 'BREAKING', 'LIVE', 'FLASH', 'UPDATE'];

export const BreakingTicker: React.FC<BreakingTickerProps> = ({
  breakingArticles,
  onSelectArticle
}) => {
  const items = breakingArticles.slice(0, 8);

  return (
    <div className="ticker-wrap" title="Hover to pause">
      <div className="ticker">
        {items.map((art, idx) => (
          <span
            key={art.id + idx}
            onClick={() => onSelectArticle(art)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectArticle(art);
              }
            }}
            tabIndex={0}
            role="button"
            aria-label={art.title}
            className="ticker-item cursor-pointer text-on-secondary-fixed hover:text-secondary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="text-on-secondary-fixed font-bold mr-2">
              {art.isLiveBlog ? 'LIVE:' : LABELS[idx % LABELS.length] + ':'}
            </span>
            {art.title}
            <span className="text-on-secondary-fixed/50 mx-4">◆</span>
          </span>
        ))}
      </div>
    </div>
  );
};
