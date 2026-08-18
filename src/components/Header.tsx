import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActiveTab } from '../types';
import { Search, X, Menu, User, Scale, Swords } from 'lucide-react';

interface HeaderProps {
  activeTab: ActiveTab;
  selectedVerticalId: number | null;
  onSelectTab: (tab: ActiveTab) => void;
  onSelectVertical?: (id: number) => void;
  onOpenSearch: () => void;
  onOpenStandards: () => void;
}

// Exact brand-mark path data — not a generic icon-set substitute, since the
// point of matching the reference "small to small" is these specific marks.
const XLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
  </svg>
);
const FacebookLogo: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// Vertical IDs from taxonomyData: 1=National, 2=States, 3=World, 4=Business, 5=Tech, 6=Science, 7=Sports, 8=Entertainment
const NAV_ITEMS = [
  { label: 'National',   tab: 'home'     as ActiveTab, verticalId: null },
  { label: '⬤ Today',   tab: 'today'    as ActiveTab, verticalId: null },
  { label: 'This Week',  tab: 'week'     as ActiveTab, verticalId: null },
  { label: 'This Month', tab: 'month'    as ActiveTab, verticalId: null },
  { label: 'Live Wire',  tab: 'live'     as ActiveTab, verticalId: null },
  { label: 'Timeline',   tab: 'timeline' as ActiveTab, verticalId: null },
  { label: 'States',     tab: 'taxonomy' as ActiveTab, verticalId: 2 },
  { label: 'Business',   tab: 'taxonomy' as ActiveTab, verticalId: 4 },
];

const MOBILE_NAV_ITEMS = [
  ...NAV_ITEMS,
  { label: 'World',         tab: 'taxonomy' as ActiveTab, verticalId: 3 },
  { label: 'Tech',          tab: 'taxonomy' as ActiveTab, verticalId: 5 },
  { label: 'Sports',        tab: 'taxonomy' as ActiveTab, verticalId: 7 },
  { label: 'Entertainment', tab: 'taxonomy' as ActiveTab, verticalId: 8 },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  selectedVerticalId,
  onSelectTab,
  onSelectVertical,
  onOpenSearch,
  onOpenStandards,
}) => {
  const navigate = useNavigate();
  const [istTime, setIstTime] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hiddenOnScroll, setHiddenOnScroll] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const update = () => {
      setIstTime(new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }) + ' IST');
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileMenuOpen(false); }, [activeTab]);

  // Auto-hide on scroll-down, reappear on scroll-up — a quiet, editorial-site
  // pattern (the masthead gets out of the way while reading, returns the
  // moment you want it) rather than staying pinned and eating screen space.
  // rAF-throttled so this runs at most once per paint, not once per scroll
  // event. Never hides near the very top (avoids a flicker as the page
  // settles) or while the mobile drawer is open (its own toggle lives in
  // this header — hiding it mid-interaction would strand the close button).
  useEffect(() => {
    let ticking = false;
    const HIDE_AFTER_PX = 96;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (mobileMenuOpen) {
          setHiddenOnScroll(false);
        } else if (y <= HIDE_AFTER_PX) {
          setHiddenOnScroll(false);
        } else if (y > lastScrollY.current) {
          setHiddenOnScroll(true);   // scrolling down
        } else if (y < lastScrollY.current) {
          setHiddenOnScroll(false); // scrolling up
        }
        lastScrollY.current = y;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mobileMenuOpen]);

  const handleNavClick = (tab: ActiveTab, verticalId: number | null) => {
    onSelectTab(tab);
    if (verticalId !== null && onSelectVertical) onSelectVertical(verticalId);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header
        className={`bg-surface/90 backdrop-blur-sm hairline-b sticky top-0 z-40 w-full flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hiddenOnScroll ? '-translate-y-full' : 'translate-y-0'
        }`}
      >
        {/* Masthead — three even columns: utility icons | centered wordmark |
            social + profile. The category row lives entirely in TaxonomyNav
            below this, so this row stays exactly as clean as the reference —
            no inline nav competing with it for space. */}
        <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop w-full h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6 w-1/3">
            <button onClick={onOpenSearch} className="text-on-surface hover:text-secondary transition-colors" aria-label="Search">
              <Search size={19} strokeWidth={1.5} />
            </button>
            <div className="h-4 w-px bg-outline-variant" />
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="text-on-surface hover:text-secondary transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X size={19} strokeWidth={1.5} /> : <Menu size={19} strokeWidth={1.5} />}
            </button>
          </div>

          <div className="w-1/3 text-center">
            <button
              onClick={() => handleNavClick('home', null)}
              className="font-headline-lg text-xl md:text-2xl font-bold uppercase tracking-widest text-on-surface hover:opacity-70 transition-opacity"
              aria-label="RAWINDIA home"
            >
              RAWINDIA
            </button>
          </div>

          <div className="flex items-center justify-end gap-4 md:gap-6 w-1/3 text-on-surface">
            <span className="hidden xl:inline font-meta text-[11px] text-on-surface-variant whitespace-nowrap mr-1">{istTime}</span>
            <a href="https://x.com/rawindia" target="_blank" rel="noopener noreferrer" aria-label="RAWINDIA on X" className="hover:text-secondary transition-colors">
              <XLogo size={15} />
            </a>
            <a href="https://facebook.com/rawindia" target="_blank" rel="noopener noreferrer" aria-label="RAWINDIA on Facebook" className="hover:text-secondary transition-colors">
              <FacebookLogo size={15} />
            </a>
            <div className="hidden sm:block h-4 w-px bg-outline-variant" />
            <button onClick={onOpenStandards} className="hover:text-secondary transition-colors" aria-label="About RAWINDIA">
              <User size={19} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Menu drawer — a full-screen panel at every breakpoint now that the
          menu icon lives in the topbar year-round, not just on mobile; also
          where The Ledger lives, since the reference topbar has no room for
          it alongside its icon set. */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-surface border-r-0 flex flex-col" style={{ top: 0 }}>
          <div className="flex items-center justify-between px-margin-mobile py-stack-md hairline-b bg-surface">
            <span className="font-display-lg text-2xl font-bold uppercase">RAWINDIA</span>
            <button onClick={() => setMobileMenuOpen(false)} className="text-primary" aria-label="Close menu"><X size={24} /></button>
          </div>

          <nav className="flex-1 overflow-y-auto px-margin-mobile py-stack-md flex flex-col gap-1 max-w-md w-full mx-auto">
            {MOBILE_NAV_ITEMS.map(({ label, tab, verticalId }) => {
              const isActive = activeTab === tab && (verticalId === null || verticalId === selectedVerticalId);
              return (
                <button
                  key={label}
                  onClick={() => handleNavClick(tab, verticalId)}
                  className={`w-full text-left font-label-caps text-label-caps uppercase px-3 py-3 hairline-b transition-colors ${
                    isActive ? 'bg-primary text-on-primary font-bold' : 'hover:bg-surface-container text-on-surface'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Search + The Ledger + Netaji Report Card */}
          <div className="px-margin-mobile py-stack-md hairline-t flex items-center gap-4 flex-wrap max-w-md w-full mx-auto">
            <button onClick={onOpenSearch} className="font-label-caps text-label-caps uppercase news-border px-3 py-1.5 hover:bg-surface-container">
              Search
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); navigate('/ledger'); }}
              className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase news-border px-3 py-1.5 hover:bg-surface-container"
            >
              <Scale size={13} /> The Ledger
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); navigate('/institutions'); }}
              className="flex items-center gap-1.5 font-label-caps text-label-caps uppercase news-border px-3 py-1.5 hover:bg-surface-container"
            >
              <Swords size={13} /> Netaji Report Card
            </button>
          </div>
        </div>
      )}
    </>
  );
};
