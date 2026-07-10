// src/pages/AuthRedirect.tsx
import { useEffect } from "react";

// Must match the keys your opener polls with (waitForToken calls).
// Use "graph" params if this popup was opened for the Graph-scope silent call,
// otherwise the default management-token keys.
export default function AuthRedirect() {
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const hashParams = new URLSearchParams(hash);

    const authCode = searchParams.get("code") || hashParams.get("code");
    const accessToken = searchParams.get("access_token") || hashParams.get("access_token");
    const idToken = searchParams.get("id_token") || hashParams.get("id_token");
    const error =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      hashParams.get("error_description") ||
      hashParams.get("error");
    const state = searchParams.get("state") || hashParams.get("state"); // "management" or "silent_graph" from your authorize URL

    const tokenKey = state === "silent_graph" ? "msalGraphToken" : "msalAccessToken";
    const errorKey = state === "silent_graph" ? "msalGraphError" : "msalError";

    if (authCode) {
      localStorage.setItem("azureAuthCode", authCode);
    } else if (accessToken) {
      localStorage.setItem(tokenKey, accessToken);
    }

    if (idToken) {
      localStorage.setItem("msalIdToken", idToken);
    }

    if (error) {
      localStorage.setItem("azureAuthError", error);
      localStorage.setItem(errorKey, error);
    } else if (!authCode && !accessToken && !idToken) {
      localStorage.setItem("azureAuthError", "No response returned from Microsoft.");
      localStorage.setItem(errorKey, "No response returned from Microsoft.");
    }

    // Popup's job is done.
    window.close();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">
      Completing sign-in…
    </div>
  );
}