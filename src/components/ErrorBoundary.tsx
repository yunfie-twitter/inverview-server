import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Text } from "@fluentui/react-components";
import { Sentry } from "../lib/sentry";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
  title?: string;
  message?: string;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(): State {
    return { hasError: true, error: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary", error, errorInfo);
    this.setState({ error });
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onRetry) this.props.onRetry();
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const title = this.props.title ?? i18n.t("app.renderErrorTitle");
    const message = this.props.message ?? i18n.t("app.renderErrorMessage");

    return (
      <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "16px", maxWidth: "600px" }}>
        <Text size={600} weight="bold">{title}</Text>
        <Text style={{ color: "#666" }}>{message}</Text>
        {import.meta.env.DEV && this.state.error?.message ? (
          <Text style={{ color: "#b42318", wordBreak: "break-word" }}>{this.state.error.message}</Text>
        ) : null}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button appearance="primary" onClick={this.handleRetry} style={{ width: "fit-content" }}>
            {i18n.t("common.retry")}
          </Button>
          <Button appearance="secondary" onClick={() => window.location.reload()} style={{ width: "fit-content" }}>
            {i18n.t("common.reload")}
          </Button>
        </div>
      </div>
    );
  }
}
