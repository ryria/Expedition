import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth, useAutoSignin } from "react-oidc-context";
import { SpacetimeDBProvider, useSpacetimeDB } from "spacetimedb/react";
import App from "./App.tsx";
import "./index.css";
import { DbConnection } from "./spacetime/generated";

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
const STRICT_MODE_ENABLED =
  (import.meta.env.VITE_REACT_STRICT_MODE as string | undefined)?.toLowerCase() !== "false";
const STDB_TOKEN_STORAGE_KEY = "expedition.stdb.id_token";
const STDB_URI = import.meta.env.VITE_STDB_URI as string;
const STDB_DB = "expedition";

function readPersistedStdbToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const token = window.localStorage.getItem(STDB_TOKEN_STORAGE_KEY);
    return token && token.trim() ? token : undefined;
  } catch {
    return undefined;
  }
}

function persistStdbToken(token: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STDB_TOKEN_STORAGE_KEY, token);
  } catch {
    // no-op: storage can fail in privacy modes
  }
}

function clearPersistedStdbToken() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STDB_TOKEN_STORAGE_KEY);
  } catch {
    // no-op: storage can fail in privacy modes
  }
}

function isStravaCallbackPath(pathname: string): boolean {
  return pathname.endsWith("/strava/callback") || pathname.endsWith("/strava/callback/");
}

function normalizeStravaCallbackParams() {
  const current = new URL(window.location.href);
  if (!isStravaCallbackPath(current.pathname)) return;

  const hasRawStravaParams = current.searchParams.has("code") || current.searchParams.has("error");
  if (!hasRawStravaParams) return;

  const next = new URL(window.location.origin + APP_BASE);
  if (current.searchParams.has("code")) {
    next.searchParams.set("strava_code", current.searchParams.get("code") ?? "");
  }
  if (current.searchParams.has("state")) {
    next.searchParams.set("strava_state", current.searchParams.get("state") ?? "");
  }
  if (current.searchParams.has("scope")) {
    next.searchParams.set("strava_scope", current.searchParams.get("scope") ?? "");
  }
  if (current.searchParams.has("error")) {
    next.searchParams.set("strava_error", current.searchParams.get("error") ?? "");
  }

  window.history.replaceState({}, document.title, next.toString());
}

normalizeStravaCallbackParams();

const shouldSkipOidcSigninCallback = isStravaCallbackPath(window.location.pathname);

const oidcConfig = {
  authority: "https://auth.spacetimedb.com/oidc",
  client_id: AUTH_CLIENT_ID,
  redirect_uri: REDIRECT_URI,
  post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
  scope: "openid profile email",
  response_type: "code",
  automaticSilentRenew: true,
  skipSigninCallback: shouldSkipOidcSigninCallback,
};

function onSigninCallback() {
  window.history.replaceState({}, document.title, APP_BASE);
}

function validateProviderUri(uri: string): string {
  const trimmed = uri.trim();
  if (!trimmed) {
    throw new Error("Missing VITE_STDB_URI for SpacetimeDB connection");
  }

  const parsed = new URL(trimmed);
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error(`VITE_STDB_URI must use ws:// or wss:// (received ${parsed.protocol})`);
  }

  return trimmed;
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
  showActivity,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  detail?: string;
  showActivity?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const [dotCount, setDotCount] = React.useState(1);

  React.useEffect(() => {
    setElapsedSeconds(0);
    setDotCount(1);
  }, [message, showActivity, title]);

  React.useEffect(() => {
    if (!showActivity) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
      setDotCount((prev) => (prev % 3) + 1);
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [showActivity]);

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
        {showActivity ? (
          <div
            aria-live="polite"
            style={{
              fontSize: "0.82rem",
              color: "var(--text-dim)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "0.55rem 0.7rem",
              background: "color-mix(in srgb, var(--surface-raised) 82%, transparent)",
            }}
          >
            Still working{".".repeat(dotCount)} {elapsedSeconds}s
          </div>
        ) : null}
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

function ProviderGate({
  hasConnectedOnce,
  retryNow,
}: {
  hasConnectedOnce: boolean;
  retryNow: () => void;
}) {
  const state = useSpacetimeDB();

  if (state.isActive) {
    return <App />;
  }

  const hasError = Boolean(state.connectionError);
  const title = hasError ? (hasConnectedOnce ? "Connection issue" : "Connection failed") : "Connecting";
  const message = hasError
    ? "Unable to establish a stable connection right now."
    : "Connecting to server…";

  return (
    <ConnectionIntermission
      title={title}
      message={message}
      showActivity={!hasError}
      detail={hasError ? state.connectionError?.message ?? "Unknown connection error" : undefined}
      actionLabel="Retry now"
      onAction={retryNow}
    />
  );
}

function ProviderConnectionApp({ connectionToken }: { connectionToken?: string }) {
  const [hasConnectedOnce, setHasConnectedOnce] = React.useState(false);
  const [retryNonce, setRetryNonce] = React.useState(0);

  const retryNow = React.useCallback(() => {
    setRetryNonce((prev) => prev + 1);
  }, []);

  React.useEffect(() => {
    setRetryNonce((prev) => prev + 1);
  }, [connectionToken]);

  const builder = React.useMemo(() => {
    let stdbUri = "";
    try {
      stdbUri = validateProviderUri(STDB_URI);
    } catch {
      return null;
    }

    return DbConnection.builder()
      .withUri(stdbUri)
      .withDatabaseName(STDB_DB)
      .withToken(connectionToken)
      .onConnect((ctx) => {
        void ctx;
        setHasConnectedOnce(true);
      })
      .onDisconnect((_ctx, err) => {
        if (err) {
          console.error("[SpacetimeDB][Provider] disconnected with error:", err);
        }
      })
      .onConnectError((_ctx, err) => {
        console.error("[SpacetimeDB][Provider] connection failed:", err);
      });
  }, [connectionToken, retryNonce]);

  if (!builder) {
    return (
      <ConnectionIntermission
        title="Connection failed"
        message="Unable to initialize provider connection."
        detail="Invalid or missing VITE_STDB_URI"
        actionLabel="Retry now"
        onAction={retryNow}
      />
    );
  }

  return (
    <SpacetimeDBProvider key={retryNonce} connectionBuilder={builder}>
      <ProviderGate hasConnectedOnce={hasConnectedOnce} retryNow={retryNow} />
    </SpacetimeDBProvider>
  );
}

function AuthenticatedApp() {
  const auth = useAuth();
  useAutoSignin();
  const [persistedToken, setPersistedToken] = React.useState<string | undefined>(() =>
    readPersistedStdbToken(),
  );

  const liveToken = auth.user?.id_token;

  React.useEffect(() => {
    if (liveToken) {
      persistStdbToken(liveToken);
      setPersistedToken(liveToken);
      return;
    }

    if (!auth.isAuthenticated && !auth.isLoading) {
      clearPersistedStdbToken();
      setPersistedToken(undefined);
    }
  }, [auth.isAuthenticated, auth.isLoading, liveToken]);

  const isTransientAuthWindow = auth.isLoading || auth.activeNavigator === "signinSilent";
  const connectionToken = liveToken ?? (isTransientAuthWindow ? persistedToken : undefined);

  if (auth.isLoading) {
    return (
      <ConnectionIntermission
        title="Preparing session"
        message="Loading authentication…"
        showActivity
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

  return <ProviderConnectionApp connectionToken={connectionToken} />;
}

const appRoot = AUTH_CLIENT_ID ? (
  <AuthProvider {...oidcConfig} onSigninCallback={onSigninCallback}>
    <AuthenticatedApp />
  </AuthProvider>
) : (
  <MissingAuthConfig />
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  STRICT_MODE_ENABLED ? <React.StrictMode>{appRoot}</React.StrictMode> : appRoot,
);
