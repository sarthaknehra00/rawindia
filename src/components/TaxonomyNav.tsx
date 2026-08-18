import React, { useState, useEffect } from 'react';
import { TAXONOMY_DATA } from '../data/taxonomyData';
import type { TaxonomyVertical, ActiveTab } from '../types';
import { ChevronDown, Grid } from 'lucide-react';

interface TaxonomyNavProps {
  selectedVerticalId: number | null;
  onSelectVertical: (id: number | null, subId?: string, subSubId?: string) => void;
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const TaxonomyNav: React.FC<TaxonomyNavProps> = ({
  selectedVerticalId,
  onSelectVertical,
  activeTab,
  onSelectTab
}) => {
  const [megaMenuOpen, setMegaMenuOpen] = useState<boolean>(false);

  // Escape-to-close for the mega-menu — it's not a modal in the useModalA11y
  // sense (no focus trap needed, it's a dropdown), but it should still close
  // on Escape like every other dismissible overlay in the app.
  useEffect(() => {
    if (!megaMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMegaMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [megaMenuOpen]);

  const handleVerticalClick = (vertical: TaxonomyVertical) => {
    onSelectTab('taxonomy');
    onSelectVertical(vertical.id);
    setMegaMenuOpen(false);
  };

  return (
    <nav className="bg-surface hairline-b relative z-30">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between gap-6">
        {/* Horizontal Navigation Row. The reference centers this row, but its
            mock category words ("Home", "Sports") are far shorter than
            RAWINDIA's real vertical names ("World (India Lens)", "Science &
            Environment") — centered-with-overflow clips BOTH ends with no
            visible scroll affordance once content exceeds the viewport,
            which real content here reliably does. Left-aligned + scrollable
            keeps the same active/hover treatment without that regression. */}
        <div className="flex items-center overflow-x-auto hide-scrollbar h-14 gap-6 md:gap-8 flex-1 min-w-0">
          {/* Home / All */}
          <button
            className={`font-label-caps text-xs md:text-sm uppercase whitespace-nowrap pb-1 border-b-2 transition-colors duration-300 flex-shrink-0 ${
              activeTab === 'home' && selectedVerticalId === null
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-on-surface-variant hover:text-secondary hover:border-secondary/40'
            }`}
            onClick={() => {
              onSelectTab('home');
              onSelectVertical(null);
            }}
          >
            All Stories
          </button>

          {/* Primary Top Verticals */}
          {TAXONOMY_DATA.slice(0, 10).map((vertical) => {
            const isSelected = selectedVerticalId === vertical.id && activeTab === 'taxonomy';
            return (
              <button
                key={vertical.id}
                className={`font-label-caps text-xs md:text-sm uppercase whitespace-nowrap pb-1 border-b-2 transition-colors duration-300 flex-shrink-0 ${
                  isSelected
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-on-surface-variant hover:text-secondary hover:border-secondary/40'
                }`}
                onClick={() => handleVerticalClick(vertical)}
              >
                {vertical.name}
              </button>
            );
          })}
        </div>

        {/* Mega Menu Toggle */}
        <button
          className="flex items-center gap-1 pl-4 py-2 border-l border-outline-variant font-label-caps text-xs md:text-sm uppercase font-bold text-primary hover:text-secondary flex-shrink-0"
          onClick={() => setMegaMenuOpen(!megaMenuOpen)}
        >
          <Grid size={14} />
          <span className="hidden sm:inline">All 16 Verticals</span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${megaMenuOpen ? 'rotate-180' : 'rotate-0'}`}
          />
        </button>
      </div>

      {/* Mega Menu Dropdown */}
      {megaMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-paper-luminous hairline-b shadow-luminous max-h-[80vh] overflow-y-auto z-50 animate-fade-in">
          <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
            <div className="pb-3 hairline-b mb-6">
              <h3 className="font-headline-lg text-2xl font-bold uppercase text-primary">
                COMPLETE 16-VERTICAL TAXONOMY DIRECTORY
              </h3>
              <p className="font-meta text-xs text-on-surface-variant">
                Exhaustive 3-level deep coverage across Indian national governance, 36 states/UTs, economy, technology, and culture.
              </p>
            </div>

            {/* 16 Verticals Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {TAXONOMY_DATA.map((v) => (
                <div
                  key={v.id}
                  onClick={() => handleVerticalClick(v)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View ${v.name} vertical`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleVerticalClick(v);
                    }
                  }}
                  className="news-border p-3 bg-surface-container-low hover:bg-white hover:border-secondary cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="bg-primary text-on-primary font-label-caps text-[10px] px-1.5 py-0.5">
                      V-{v.number}
                    </span>
                    <span className="font-meta text-[11px] text-outline">
                      {v.subCategories.length} sub-sections
                    </span>
                  </div>

                  <h4 className="font-headline-lg text-base font-bold text-primary mb-1">
                    {v.name}
                  </h4>

                  <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 mb-2">
                    {v.description}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {v.subCategories.slice(0, 3).map((s) => (
                      <span
                        key={s.id}
                        className="font-label-caps text-[10px] bg-surface border border-outline/30 px-1 py-0.5"
                      >
                        {s.name}
                      </span>
                    ))}
                    {v.subCategories.length > 3 && (
                      <span className="font-meta text-[10px] text-outline">
                        +{v.subCategories.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
