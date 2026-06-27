import React from "react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReload() {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0f1117",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
            fontSize: 32,
          }}
        >
          ⚠️
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Tizimda vaqtincha uzilish
        </h2>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 28, maxWidth: 280 }}>
          Ilovada kutilmagan xato yuz berdi. Qayta yuklashni sinab ko'ring.
        </p>

        <button
          onClick={() => this.handleReload()}
          style={{
            background: "#facc15",
            color: "#000",
            border: "none",
            borderRadius: 12,
            padding: "12px 32px",
            fontSize: 15,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          🔄 Qayta yuklash
        </button>

        {process.env.NODE_ENV === "development" && this.state.error && (
          <pre
            style={{
              marginTop: 24,
              background: "#1e293b",
              borderRadius: 8,
              padding: "12px 16px",
              fontSize: 11,
              color: "#f87171",
              textAlign: "left",
              maxWidth: "90vw",
              overflow: "auto",
            }}
          >
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
