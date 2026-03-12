import React from "react";
import {
  emitObservabilitySignal,
  getSessionTraceId,
  logStructuredClient,
} from "./telemetry";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const traceId = getSessionTraceId();
    const message = error?.message ?? "Unknown UI error";

    emitObservabilitySignal({
      component: "client.ui",
      event: "ui_error_boundary_triggered",
      errorCode: "ui.runtime.unhandled",
      severity: "p0",
      message,
      traceId,
      metadata: {
        stack: error?.stack?.slice(0, 400),
        componentStack: (errorInfo.componentStack ?? "").slice(0, 400),
      },
    });

    logStructuredClient({
      component: "client.ui",
      event: "ui_error_boundary_triggered",
      errorCode: "ui.runtime.unhandled",
      severity: "p0",
      message,
      traceId,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-main">
          <section className="content-shell">
            <h2>Something went wrong</h2>
            <p>We captured diagnostic details. Please refresh the page and retry.</p>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
