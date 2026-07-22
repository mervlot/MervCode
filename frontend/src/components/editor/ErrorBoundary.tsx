import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label?: string;
  resetKey?: string | number;
}

interface ErrorBoundaryState {
  error: Error | null;
  lastResetKey: string | number | undefined;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, lastResetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.lastResetKey) {
      return { error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[MervCode] Panel crashed:", error, info.componentStack);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className='flex h-full w-full flex-col items-center justify-center gap-3 bg-canvas p-6 text-center'>
          <div className='flex h-10 w-10 items-center justify-center rounded-lg border border-subtle-strong bg-surface'>
            <i className='bi bi-exclamation-triangle text-lg text-accent' />
          </div>
          <p className='text-[13px] font-medium text-primary'>
            {this.props.label
              ? `Panel crashed: "${this.props.label}"`
              : "Panel crashed"}
          </p>
          <p className='max-w-sm text-[11px] text-tertiary'>
            {this.state.error.message || "An unexpected error occurred."} The
            rest of the editor is unaffected.
          </p>
          <button
            onClick={this.reset}
            className='mt-1 rounded border border-subtle-strong bg-surface px-3 py-1.5 text-[11px] text-secondary hover:text-primary hover:bg-hover transition-colors'
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
