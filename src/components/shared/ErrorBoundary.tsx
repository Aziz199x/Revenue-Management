import React from "react";

type State = {
  hasError: boolean;
  error?: Error;
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100dvh",
    padding: 24,
    textAlign: "center",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    margin: "0 0 8px",
  },
  message: {
    color: "#666",
    margin: "0 0 24px",
    fontSize: 14,
    lineHeight: 1.5,
    maxWidth: 320,
  },
  errorDetails: {
    color: "#999",
    fontSize: 11,
    marginBottom: 24,
    maxWidth: "100%",
    overflow: "auto",
    padding: 8,
    background: "#f5f5f5",
    borderRadius: 8,
    direction: "ltr",
    textAlign: "left",
    wordBreak: "break-all",
  },
  reloadBtn: {
    padding: "10px 24px",
    borderRadius: 12,
    border: "none",
    background: "#2563eb",
    color: "#fff",
    fontSize: 16,
    cursor: "pointer",
    marginBottom: 8,
    width: "100%",
    maxWidth: 200,
  },
  homeBtn: {
    padding: "10px 24px",
    borderRadius: 12,
    border: "1px solid #ccc",
    background: "#fff",
    color: "#333",
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
    maxWidth: 200,
  },
};

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[App Crash] Error:", error);
    console.error("[App Crash] Component stack:", info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div dir="rtl" style={styles.container}>
          <h2 style={styles.title}>حدث خطأ غير متوقع</h2>
          <p style={styles.message}>
            يرجى إغلاق التطبيق وفتحه مرة أخرى، أو المحاولة لاحقًا.
          </p>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre style={styles.errorDetails}>
              {this.state.error.name}: {this.state.error.message}
              {"\n"}
              {this.state.error.stack?.slice(0, 500)}
            </pre>
          )}
          <button
            style={styles.reloadBtn}
            onClick={() => window.location.reload()}
          >
            إعادة تحميل التطبيق
          </button>
          <button
            style={styles.homeBtn}
            onClick={() => { window.location.href = "/"; }}
          >
            العودة للرئيسية
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
