import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initConnection } from "./spacetime/connection";

initConnection(
  () => {
    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  },
  (err) => {
    document.getElementById("root")!.innerHTML =
      `<pre style="color:red;padding:2rem">SpacetimeDB connection failed:\n${err.message}</pre>`;
  }
);
