/**
 * RAWINDIA — Verdict Card Engine
 *
 * One shared, brand-consistent canvas card generator, used everywhere a
 * screenshot-worthy verdict needs exporting — a quote, an L/W Ledger take,
 * or a Vaada Clock promise status. Started life as a single-purpose "Quote
 * Card" modal; generalized so four different features don't each reinvent
 * card layout, brand chrome, and export logic independently. See PRD §4.4.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import type { Article } from '../types';
import type { VerdictEvent, TrackedPromise } from '../services/persistenceService';
import { pickCardLine } from '../services/verdictCardService';
import { useModalA11y } from '../hooks/useModalA11y';

const CARD_SIZE = 1080;

// Actual brand values from src/styles/index.css — not the (slightly
// different) palette documented in PROJECT_CONTEXT.md.
const COLOR_PAPER  = '#fdf8f8';
const COLOR_INK    = '#000000';
const COLOR_ACCENT = '#9b2c3c'; // heritage-red — used for L verdicts too
const COLOR_MUTED  = '#5f5e5e';
const COLOR_WIN    = '#0f7a4d'; // "verified"-family green — W verdicts / kept promises only

export type VerdictCardProps =
  | { type: 'quote'; article: Article; onClose: () => void }
  | { type: 'lw-verdict'; verdict: VerdictEvent; onClose: () => void }
  | { type: 'promise-status'; promise: TrackedPromise; onClose: () => void };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function loadBrandFonts() {
  try {
    await Promise.all([
      document.fonts.load('700 64px "Libre Caslon Text"'),
      document.fonts.load('700 28px "Montserrat"'),
      document.fonts.load('600 22px "Montserrat"'),
      document.fonts.load('700 200px "Libre Caslon Text"'),
    ]);
  } catch { /* fonts API unsupported — draw with whatever the browser falls back to */ }
}

function drawChrome(ctx: CanvasRenderingContext2D, accentColor: string) {
  ctx.fillStyle = COLOR_PAPER;
  ctx.fillRect(0, 0, CARD_SIZE, CARD_SIZE);
  ctx.fillStyle = accentColor;
  ctx.fillRect(0, 0, CARD_SIZE, 14);

  const margin = 90;
  ctx.fillStyle = accentColor;
  ctx.font = '700 28px "Montserrat", sans-serif';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.letterSpacing = '3px';
  ctx.fillText('RAWINDIA', margin, 90);
  ctx.letterSpacing = '0px';
}

function drawFooter(ctx: CanvasRenderingContext2D, kicker: string, accentColor: string) {
  const margin = 90;
  const footerY = CARD_SIZE - 150;
  ctx.strokeStyle = COLOR_MUTED;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin, footerY);
  ctx.lineTo(CARD_SIZE - margin, footerY);
  ctx.stroke();

  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '600 20px "Montserrat", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText(kicker.toUpperCase(), margin, footerY + 28);
  ctx.letterSpacing = '0px';

  ctx.fillStyle = accentColor;
  ctx.font = '700 22px "Montserrat", sans-serif';
  ctx.letterSpacing = '1.5px';
  ctx.fillText('100% RAW. 100% REAL. NO SPIN.', margin, footerY + 62);
  ctx.letterSpacing = '0px';
}

function drawQuoteCard(canvas: HTMLCanvasElement, line: string, article: Article) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  drawChrome(ctx, COLOR_ACCENT);
  const margin = 90;

  ctx.fillStyle = COLOR_INK;
  const fontSize = line.length > 110 ? 48 : line.length > 60 ? 56 : 68;
  ctx.font = `700 ${fontSize}px "Libre Caslon Text", Georgia, serif`;
  ctx.textAlign = 'left';
  const maxWidth = CARD_SIZE - margin * 2;
  const lineHeight = fontSize * 1.3;
  const lines = wrapText(ctx, `"${line}"`, maxWidth);
  const blockHeight = lines.length * lineHeight;
  let y = (CARD_SIZE - blockHeight) / 2;
  for (const l of lines) { ctx.fillText(l, margin, y); y += lineHeight; }

  drawFooter(ctx, article.verticalName || 'RAWINDIA', COLOR_ACCENT);
}

function drawLwCard(canvas: HTMLCanvasElement, verdict: VerdictEvent) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const accent = verdict.verdict === 'W' ? COLOR_WIN : COLOR_ACCENT;
  drawChrome(ctx, accent);
  const margin = 90;

  // Giant W/L stamp
  ctx.fillStyle = accent;
  ctx.font = '700 340px "Libre Caslon Text", Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(verdict.verdict, margin - 8, 140);

  // Subject line, right of the stamp
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '600 26px "Montserrat", sans-serif';
  ctx.letterSpacing = '1px';
  ctx.fillText(`${verdict.verdict === 'W' ? 'A WIN FOR' : 'AN L FOR'}`, margin + 300, 200);
  ctx.fillStyle = accent;
  ctx.font = '700 40px "Montserrat", sans-serif';
  ctx.letterSpacing = '0.5px';
  wrapText(ctx, verdict.subjectName.toUpperCase(), CARD_SIZE - margin - (margin + 300)).forEach((l, i) => {
    ctx.fillText(l, margin + 300, 244 + i * 48);
  });
  ctx.letterSpacing = '0px';

  // Headline
  ctx.fillStyle = COLOR_INK;
  const fontSize = verdict.headline.length > 90 ? 44 : 54;
  ctx.font = `700 ${fontSize}px "Libre Caslon Text", Georgia, serif`;
  const maxWidth = CARD_SIZE - margin * 2;
  const lineHeight = fontSize * 1.3;
  const lines = wrapText(ctx, verdict.headline, maxWidth);
  let y = 540;
  for (const l of lines) { ctx.fillText(l, margin, y); y += lineHeight; }

  drawFooter(ctx, 'RAWINDIA Verified — L/W Ledger', accent);
}

function drawPromiseCard(canvas: HTMLCanvasElement, promise: TrackedPromise) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const accent = promise.status === 'kept' ? COLOR_WIN : promise.status === 'broken' ? COLOR_ACCENT : '#8a5a10';
  drawChrome(ctx, accent);
  const margin = 90;

  // Status badge
  ctx.fillStyle = accent;
  ctx.font = '700 26px "Montserrat", sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText(promise.status.replace('-', ' ').toUpperCase(), margin, 130);
  ctx.letterSpacing = '0px';

  // Subject
  ctx.fillStyle = COLOR_MUTED;
  ctx.font = '600 30px "Montserrat", sans-serif';
  ctx.fillText(promise.subjectName.toUpperCase(), margin, 180);

  // Promise text
  ctx.fillStyle = COLOR_INK;
  ctx.font = '700 48px "Libre Caslon Text", Georgia, serif';
  const maxWidth = CARD_SIZE - margin * 2;
  const lineHeight = 48 * 1.35;
  const lines = wrapText(ctx, `"${promise.promiseText}"`, maxWidth);
  let y = 270;
  for (const l of lines) { ctx.fillText(l, margin, y); y += lineHeight; }

  // Deadline chain
  const chainY = Math.max(y + 40, 680);
  ctx.font = '600 24px "Montserrat", sans-serif';
  let x = margin;
  const dates = [promise.originalDeadline, ...promise.extensionHistory.map(e => e.to)];
  dates.forEach((d, i) => {
    const isLast = i === dates.length - 1;
    ctx.fillStyle = isLast ? accent : COLOR_MUTED;
    const label = new Date(d).toLocaleDateString('en-IN', { year: 'numeric', month: 'short' });
    if (!isLast) {
      const w = ctx.measureText(label).width;
      ctx.fillText(label, x, chainY);
      ctx.strokeStyle = COLOR_MUTED;
      ctx.beginPath(); ctx.moveTo(x, chainY + 12); ctx.lineTo(x + w, chainY + 12); ctx.stroke();
      x += w + 20;
      ctx.fillStyle = COLOR_MUTED;
      ctx.fillText('→', x, chainY);
      x += 40;
    } else {
      ctx.font = '700 24px "Montserrat", sans-serif';
      ctx.fillText(label, x, chainY);
    }
  });

  if (promise.extensionHistory.length > 0) {
    ctx.fillStyle = accent;
    ctx.font = '700 20px "Montserrat", sans-serif';
    ctx.fillText(`EXTENDED ×${promise.extensionHistory.length}`, margin, chainY + 50);
  }

  drawFooter(ctx, 'RAWINDIA Verified — Vaada Clock', accent);
}

export const VerdictCardModal: React.FC<VerdictCardProps> = (props) => {
  const { onClose } = props;
  const dialogRef = useModalA11y<HTMLDivElement>(onClose);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(props.type === 'quote');
  const [drawn, setDrawn]     = useState(false);
  const [quoteLine, setQuoteLine] = useState<string | null>(null);

  useEffect(() => {
    if (props.type !== 'quote') return;
    let cancelled = false;
    pickCardLine(props.article).then(result => {
      if (cancelled) return;
      setQuoteLine(result);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.type === 'quote' ? props.article : null]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    (async () => {
      canvas.width = CARD_SIZE;
      canvas.height = CARD_SIZE;
      await loadBrandFonts();

      if (props.type === 'quote') {
        if (!quoteLine) return;
        drawQuoteCard(canvas, quoteLine, props.article);
      } else if (props.type === 'lw-verdict') {
        drawLwCard(canvas, props.verdict);
      } else {
        drawPromiseCard(canvas, props.promise);
      }
      setDrawn(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.type, quoteLine]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const idPart = props.type === 'quote' ? (props.article.slug || props.article.id)
        : props.type === 'lw-verdict' ? props.verdict.id
        : props.promise.id;
      a.download = `rawindia-${idPart}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const title = props.type === 'quote' ? 'Shareable Quote Card'
    : props.type === 'lw-verdict' ? 'Share This Verdict'
    : 'Share This Promise Card';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="modal-dialog max-w-lg animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <button className="modal-close-btn flex items-center justify-center" onClick={onClose} aria-label="Close"><X size={16} /></button>

        <h2 className="font-headline-lg text-headline-lg font-bold text-primary mb-stack-md">{title}</h2>

        {loading ? (
          <div className="news-border bg-surface-container-low p-8 text-center aspect-square flex flex-col items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-secondary mx-auto mb-2" />
            <p className="font-label-caps text-label-caps uppercase text-primary font-bold text-[11px]">
              Picking the sharpest line...
            </p>
          </div>
        ) : (
          <div className="news-border overflow-hidden mb-stack-md">
            <canvas ref={canvasRef} width={CARD_SIZE} height={CARD_SIZE} className="w-full h-auto block aspect-square" />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="font-label-caps text-label-caps uppercase px-4 py-2 news-border hover:bg-surface-container transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={!drawn}
            className="flex items-center gap-2 bg-primary text-on-primary font-label-caps text-label-caps uppercase px-4 py-2 hover:bg-secondary transition-colors disabled:opacity-50"
          >
            <Download size={13} /> Download PNG
          </button>
        </div>
      </div>
    </div>
  );
};

