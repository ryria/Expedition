import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth, useAutoSignin } from "react-oidc-context";
import App from "./App.tsx";
import "./index.css";
import { useConnectionHandler } from "./spacetime/useConnectionHandler";

function firstNonEmptyEnv(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (value && value.trim()) return value.trim();
  }
  return undefined;
}

const AUTH_CLIENT_ID = firstNonEmptyEnv(
  import.meta.env.VITE_STDB_AUTH_CLIENT_ID as string | undefined,
  import.meta.env.VITE_STDB_CLIENT_ID as string | undefined,
);

const APP_BASE = import.meta.env.BASE_URL ?? "/";
const REDIRECT_URI = new URL("callback", window.location.origin + APP_BASE).toString();
const POST_LOGOUT_REDIRECT_URI = new URL(APP_BASE, window.location.origin).toString();

const oidcConfig = {
  authority: "https://auth.spacetimedb.com/oidc",
  client_id: AUTH_CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
  scope: "openid profile email",
  response_type: "code",
  automaticSilentRenew: true,
};

function onSigninCallback() {
  window.history.replaceState({}, document.title, APP_BASE);
}

function MissingAuthConfig() {
  return (
    <pre style={{ color: "red", padding: "2rem", whiteSpace: "pre-wrap" }}>
      Missing authentication client ID.
      {"\n\n"}
      Add one of the following to your client env file:
      {"\n"}
      - VITE_STDB_AUTH_CLIENT_ID=your_client_id
      {"\n"}
      - VITE_STDB_CLIENT_ID=your_client_id
      {"\n\n"}
      Then restart the Vite dev server.
    </pre>
  );
}

function ConnectionIntermission({
  title,
  message,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "1.5rem",
        background:
          "radial-gradient(circle at top, color-mix(in srgb, var(--accent) 10%, transparent), transparent 45%), var(--bg)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          padding: "1.4rem",
          display: "grid",
          gap: "0.85rem",
          boxShadow: "0 10px 30px color-mix(in srgb, black 35%, transparent)",
        }}
      >
        <div
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-dim)",
          }}
        >
          Session status
        </div>
        <h2 style={{ fontSize: "1.2rem", lineHeight: 1.3 }}>{title}</h2>
        <p style={{ color: "var(--text-muted)", lineHeight: 1.45 }}>{message}</p>
        {detail ? (
          <pre
            style={{
              color: "var(--danger-text)",
              whiteSpace: "pre-wrap",
              margin: 0,
              background: "color-mix(in srgb, var(--danger-border) 18%, transparent)",
              border: "1px solid var(--danger-border)",
              borderRadius: "10px",
              padding: "0.7rem 0.75rem",
              fontSize: "0.86rem",
            }}
          >
            {detail}
          </pre>
        ) : null}
        {onAction ? (
          <div>
            <button
              type="button"
              onClick={onAction}
              style={{
                borderColor: "var(--accent-border)",
                background: "var(--accent-bg)",
                color: "var(--accent-text)",
              }}
            >
              {actionLabel ?? "Continue"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();
  useAutoSignin();
  const { phase, lastError, hasConnectedOnce, retryNow } = useConnectionHandler(
    auth.isAuthenticated ? auth.user?.id_token : undefined,
  );

  if (auth.isLoading) {
    return (
      <ConnectionIntermission
        title="Preparing session"
        message="Loading authentication…"
      />
    );
  }

  if (auth.error) {
    const authMessage = auth.error.message ?? "Authentication failed";
    const needsReauth = authMessage.toLowerCase().includes("end-user authentication is required");

    return (
      <ConnectionIntermission
        title={needsReauth ? "Authentication required" : "Authentication failed"}
        message={needsReauth ? "Your login session expired. Sign in again to continue." : "Unable to complete sign-in right now."}
        detail={authMessage}
        actionLabel="Sign in again"
        onAction={() => {
          void auth.signinRedirect();
        }}
      />
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <ConnectionIntermission
        title="Sign in required"
        message="Sign in to continue to Expedition."
        actionLabel="Sign in"
        onAction={() => {
          void auth.signinRedirect();
        }}
      />
    );
  }

  if (phase !== "connected") {
    const phaseContent: Record<string, { title: string; message: string; retry?: boolean }> = {
      idle: {
        title: "Preparing connection",
        message: "Starting your secure session…",
      },
      connecting: {
        title: "Connecting",
        message: "Connecting to server…",
      },
      reconnecting: {
        title: "Reconnecting",
        message: "Trying to restore your live session…",
      },
      offline: {
        title: "Offline",
        message: "No network detected. Reconnect to continue.",
        retry: true,
      },
      inactive: {
        title: "Session paused",
        message: "Disconnected after inactivity. Retry to resume.",
        retry: true,
      },
      background: {
        title: "Session paused",
        message: "Connection paused while app is in the background.",
        retry: true,
      },
      error: {
        title: hasConnectedOnce ? "Connection issue" : "Connection failed",
        message: "Unable to establish a stable connection right now.",
        retry: true,
      },
    };

    const current = phaseContent[phase] ?? {
      title: "Connection update",
      message: "Connection state changed.",
      retry: true,
    };

    return (
      <ConnectionIntermission
        title={current.title}
        message={current.message}
        detail={phase === "error" ? lastError ?? "Unknown connection error" : undefined}
        actionLabel={current.retry ? "Retry now" : undefined}
        onAction={current.retry ? retryNow : undefined}
      />
    );
  }

  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {AUTH_CLIENT_ID ? (
      <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
        <AuthenticatedApp />
      </AuthProvider>
    ) : (
      <MissingAuthConfig />
    )}
  </React.StrictMode>
);
