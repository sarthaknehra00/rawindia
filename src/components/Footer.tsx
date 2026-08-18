import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { ActiveTab } from '../types';

interface FooterProps {
  onSelectTab: (tab: ActiveTab) => void;
  onSelectVertical: (id: number) => void;
  onOpenStandards: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectTab,
  onOpenStandards,
}) => {
  const navigate = useNavigate();
  return (
    <footer className="bg-surface text-on-surface hairline-t mt-auto">
      <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-section-gap flex flex-col gap-stack-lg">
        {/* Top brand + quick links */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-stack-md hairline-b pb-stack-md">
          <button
            className="font-headline-xl text-2xl md:text-3xl text-on-surface tracking-tight cursor-pointer text-left"
            onClick={() => onSelectTab('home')}
          >
            RAWINDIA
          </button>
          <div className="flex gap-stack-md font-label-caps uppercase">
            <button
              onClick={onOpenStandards}
              className="text-on-surface-variant hover:text-secondary transition-colors"
            >
              Editorial Policy
            </button>
          </div>
        </div>

        {/* Nav links + copyright row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-stack-md">
          <div className="flex flex-wrap gap-x-stack-md gap-y-2 font-body-sm text-body-sm">
            <button className="text-on-surface-variant hover:text-secondary transition-colors" onClick={onOpenStandards}>Editorial Standards &amp; Policies</button>
            <button className="text-on-surface-variant hover:text-secondary transition-colors" onClick={onOpenStandards}>Grievance Redressal</button>
            <button className="text-on-surface-variant hover:text-secondary transition-colors" onClick={() => navigate('/ledger')}>The Vaada Ledger</button>
            <button className="text-on-surface-variant hover:text-secondary transition-colors" onClick={() => navigate('/institutions')}>Netaji Report Card</button>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://x.com" target="_blank" rel="noopener noreferrer" aria-label="RAWINDIA on X" className="w-8 h-8 news-border flex items-center justify-center text-on-surface hover:bg-secondary hover:text-on-secondary hover:border-secondary transition-colors font-label-caps text-xs">X</a>
            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="RAWINDIA on LinkedIn" className="w-8 h-8 news-border flex items-center justify-center text-on-surface hover:bg-secondary hover:text-on-secondary hover:border-secondary transition-colors font-label-caps text-xs">in</a>
          </div>
        </div>

        {/* Copyright */}
        <p className="font-meta text-meta text-on-surface-variant hairline-t pt-stack-sm">
          © 2026 RAWINDIA NEWS PORTAL. Compliant with IT Rules 2021. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};
