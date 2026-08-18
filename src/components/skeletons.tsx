import React from 'react';

// Loading placeholder shaped to match ArticleView's real layout — same
// breadcrumb/headline/hero-image/two-column body structure — so content
// doesn't jump when it replaces these blocks. Muted pulse only, no new
// colors introduced. Used for the one genuine loading gap in the app: a
// direct link to /article/:slugId opened before the local archive resolves
// (see ArticleRoute in App.tsx). The home route has no equivalent gap —
// `articles` state is seeded with real static content synchronously, so it
// never renders blank/empty; a forced skeleton there would only add a
// delay that isn't currently there.
export const ArticleSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg animate-fade-in animate-pulse">
    <div className="h-3 w-48 bg-surface-container-low mb-3" />
    <div className="hairline-b pb-3 mb-6">
      <div className="h-4 w-24 bg-surface-container-low" />
    </div>
    <div className="flex flex-col lg:flex-row gap-gutter">
      <div className="flex-grow lg:w-8/12">
        <div className="h-10 w-full bg-surface-container-low mb-3" />
        <div className="h-10 w-2/3 bg-surface-container-low mb-4" />
        <div className="h-4 w-full bg-surface-container-low mb-6" />
        <div className="w-full aspect-video bg-surface-container-low news-border mb-6" />
        {[95, 88, 70, 92, 60].map((w, i) => (
          <div key={i} className="h-4 bg-surface-container-low mb-3" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="lg:w-4/12 flex flex-col gap-4">
        <div className="h-32 w-full bg-surface-container-low news-border" />
        <div className="h-32 w-full bg-surface-container-low news-border" />
      </div>
    </div>
  </div>
);
