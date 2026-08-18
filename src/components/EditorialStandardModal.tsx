import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useModalA11y } from '../hooks/useModalA11y';

interface EditorialStandardModalProps {
  onClose: () => void;
}

export const EditorialStandardModal: React.FC<EditorialStandardModalProps> = ({ onClose }) => {
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="The Raw Standard & Ethics Charter"
        tabIndex={-1}
        className="modal-dialog max-w-3xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close-btn" onClick={onClose} aria-label="Close">✕</button>

        <div className="flex items-center gap-3 mb-2">
          <ShieldCheck size={24} className="text-secondary flex-shrink-0" />
          <h2 className="font-headline-lg text-headline-lg font-bold text-primary">
            THE RAW STANDARD & ETHICS CHARTER
          </h2>
        </div>

        <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md leading-relaxed">
          RAWINDIA operates under a non-negotiable structural charter. Our editorial system enforces truth, transparency, and independence through code, not just goodwill.
        </p>

        {/* Non-Negotiable Rules */}
        <div className="flex flex-col gap-stack-sm mb-stack-lg">
          {[
            {
              n: '01', title: 'Fact Layer Before Narrative Layer',
              body: 'Every single article opens with a structured "What Actually Happened" bullet block with primary source links before any journalistic framing or commentary is presented.',
            },
            {
              n: '02', title: 'Source Transparency Ledger',
              body: 'Every factual assertion must carry an itemized source tag: Official statement, Eyewitness, Document, or Verified reporter. Anonymous sources require secondary documentary corroboration.',
            },
            {
              n: '03', title: 'Strict Content-Type Labeling',
              body: <>Hard color-coded tags everywhere: <code>NEWS</code> (factual verified report), <code>GROUND REPORT</code> (on-site witness), <code>ANALYSIS</code> (data-driven context), and <code>OPINION</code> (signed author viewpoint).</>,
            },
            {
              n: '04', title: 'Visible Correction & Audit Log',
              body: 'We never silently edit stories. Every correction or factual update carries a permanent timestamped note stating what changed, why, and which editor reviewed it.',
            },
          ].map(rule => (
            <div key={rule.n} className="bg-wash-warm news-border p-stack-sm">
              <h4 className="flex items-center gap-2 text-primary font-bold mb-1.5">
                <span className="font-label-caps text-[10px] bg-primary text-on-primary px-1.5 py-0.5">{rule.n}</span>
                {rule.title}
              </h4>
              <p className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed">
                {rule.body}
              </p>
            </div>
          ))}
        </div>

        {/* IT Rules 2021 Compliance & Grievance Officer */}
        <div className="bg-surface-container-low news-border p-stack-sm">
          <h4 className="font-label-caps text-label-caps uppercase text-primary font-bold mb-1.5">
            INFORMATION TECHNOLOGY (INTERMEDIARY GUIDELINES AND DIGITAL MEDIA ETHICS CODE) RULES, 2021
          </h4>
          <div className="font-body-sm text-body-sm text-on-surface-variant leading-relaxed flex flex-col gap-0.5">
            <div><strong className="text-primary">Grievance Redressal Officer:</strong> Adv. K. R. Namboodiri</div>
            <div><strong className="text-primary">Contact / Takedown Desk:</strong> grievance@rawindia.news • New Delhi, India</div>
            <div><strong className="text-primary">Self-Regulatory Body:</strong> Digital News Publishers Regulatory Body (DNPRB), Level-II Registration Active</div>
          </div>
        </div>

        <div className="mt-stack-md text-right">
          <button
            onClick={onClose}
            className="bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary transition-colors"
          >
            I Acknowledge The Raw Standard
          </button>
        </div>
      </div>
    </div>
  );
};
