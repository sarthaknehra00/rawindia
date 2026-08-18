import React from 'react';

interface State { hasError: boolean; message: string }

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[RAWINDIA] Render error:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-2xl mx-auto px-margin-mobile py-section-gap text-center">
          <div className="border-2 border-error p-stack-lg bg-error-container">
            <div className="font-label-caps text-label-caps text-on-error-container uppercase mb-3">
              Dispatch Render Error
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-error-container mb-2">
              Something went wrong loading this section
            </h2>
            <p className="font-meta text-meta text-on-error-container mb-stack-lg opacity-80">
              {this.state.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="bg-primary text-on-primary font-label-caps text-label-caps px-4 py-2 uppercase hover:bg-secondary transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
