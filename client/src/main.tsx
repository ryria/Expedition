import React from "react";
import ReactDOM from "react-dom/client";
import { AuthProvider, useAuth, useAutoSignin } from "react-oidc-context";
import App from "./App.tsx";
import "./index.css";
import { disconnectConnection, initConnection } from "./spacetime/connection";

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
  window.history.replaceState({}, document.title, window.location.pathname);
}

function MissingAuthConfig() {
  return (
    <pre style={{ color: "red", padding: "2rem", whiteSpace: "pre-wrap" }}>
      Missing SpacetimeAuth client ID.
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

function AuthenticatedApp() {
  const auth = useAuth();
  useAutoSignin();
  const [ready, setReady] = React.useState(false);
  const [connError, setConnError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!auth.isAuthenticated || !auth.user?.id_token) {
      setReady(false);
      disconnectConnection();
      return;
    }

    setConnError(null);
    setReady(false);

    try {
      initConnection(
        () => setReady(true),
        (err) => setConnError(err.message),
        auth.user.id_token,
      );
    } catch (err) {
      setConnError(err instanceof Error ? err.message : String(err));
    }

    return () => {
      disconnectConnection();
    };
  }, [auth.isAuthenticated, auth.user?.id_token]);

  if (auth.isLoading) {
    return <div style={{ padding: "2rem" }}>Loading authentication…</div>;
  }

  if (auth.error) {
    return <pre style={{ color: "red", padding: "2rem" }}>Authentication failed:\n{auth.error.message}</pre>;
  }

  if (!auth.isAuthenticated) {
    return <div style={{ padding: "2rem" }}>Redirecting to login…</div>;
  }

  if (connError) {
    return <pre style={{ color: "red", padding: "2rem" }}>SpacetimeDB connection failed:\n{connError}</pre>;
  }

  if (!ready) {
    return <div style={{ padding: "2rem" }}>Connecting to SpacetimeDB…</div>;
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
