// // src/authContext.tsx
// import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
// import { decodeJWT, waitForToken } from "./ssoUtils";

// const AZURE_SSO_CLIENT_ID = import.meta.env.VITE_AZURE_SSO_CLIENT_ID;
// const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

// export interface AuthUser {
//   name: string;
//   email: string;
//   initials: string;
//   method: "sso" | "password";
// }

// export interface AzureSubscription {
//   subscriptionId: string;
//   displayName: string;
//   state: string;
//   tenantId: string;
// }

// interface ArmSubscriptionsResponse {
//   value: AzureSubscription[];
//   nextLink?: string;
// }

// interface AuthContextValue {
//   user: AuthUser | null;
//   loading: boolean;
//   subscriptions: AzureSubscription[];
//   subscriptionsLoading: boolean;
//   subscriptionsError: string | null;
//   signInWithPassword: (email: string, password: string) => Promise<void>;
//   signInWithAzure: () => Promise<void>;
//   signOut: () => void;
//   refreshSubscriptions: () => Promise<void>;
// }

// const STORAGE_KEY = "aco.auth.user";
// const AUTH_CODE_STORAGE_KEY = "azureAuthCode";
// const AUTH_ERROR_STORAGE_KEY = "azureAuthError";
// const PKCE_VERIFIER_STORAGE_KEY = "azureCodeVerifier";
// const ACCESS_TOKEN_STORAGE_KEY = "msalAccessToken";

// const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// function initialsFromName(name: string): string {
//   const parts = name.trim().split(/\s+/).filter(Boolean);
//   if (parts.length === 0) return "U";
//   if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
//   return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
// }

// function nameFromEmail(email: string): string {
//   const local = email.split("@")[0] || "user";
//   return local
//     .split(/[._-]+/)
//     .filter(Boolean)
//     .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
//     .join(" ");
// }

// function profileFromToken(token: string) {
//   const payload = decodeJWT(token);
//   if (!payload) return null;

//   const name =
//     payload.fullName ||
//     payload.name ||
//     payload.preferred_username ||
//     payload.upn ||
//     payload.email ||
//     "Azure User";
//   const email = payload.email || payload.preferred_username || payload.upn || "";

//   return { name, email };
// }

// function base64UrlEncode(bytes: Uint8Array): string {
//   let binary = "";
//   bytes.forEach((byte) => {
//     binary += String.fromCharCode(byte);
//   });
//   return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
// }

// async function generatePkcePair() {
//   const randomBytes = new Uint8Array(64);
//   crypto.getRandomValues(randomBytes);
//   const verifier = base64UrlEncode(randomBytes);
//   const encoder = new TextEncoder();
//   const data = encoder.encode(verifier);
//   const digest = await crypto.subtle.digest("SHA-256", data);
//   const challenge = base64UrlEncode(new Uint8Array(digest));
//   return { verifier, challenge };
// }

// // Fetches all Azure subscriptions visible to the account behind this token.
// // Handles ARM pagination via nextLink so large tenants don't get truncated.
// async function fetchAzureSubscriptions(accessToken: string): Promise<AzureSubscription[]> {
//   const subscriptions: AzureSubscription[] = [];
//   let url: string | undefined =
//     "https://management.azure.com/subscriptions?api-version=2022-12-01";

//   while (url) {
//     const res = await fetch(url, {
//       headers: { Authorization: `Bearer ${accessToken}` },
//     });

//     if (!res.ok) {
//       const body = await res.json().catch(() => null);
//       throw new Error(body?.error?.message || `Failed to fetch subscriptions (${res.status})`);
//     }

//     const data: ArmSubscriptionsResponse = await res.json();
//     subscriptions.push(...data.value);
//     console.log("SUBSCRIPTIONS : ",data.value);
//     url = data.nextLink;
//   }

//   return subscriptions;
// }

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<AuthUser | null>(null);
//   const [loading, setLoading] = useState(true);
//   const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
//   const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
//   const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);

//   useEffect(() => {
//     try {
//       const raw = localStorage.getItem(STORAGE_KEY);
//       if (raw) setUser(JSON.parse(raw));
//     } catch {
//       /* ignore */
//     }
//     // After hydrating the user, if there's an access token in storage
//     // load subscriptions so a page refresh doesn't leave the app stuck
//     // waiting for subscriptions that were only loaded during sign-in.
//     const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
//     if (token) void loadSubscriptions(token);

//     setLoading(false);
//   }, []);

//   function persist(u: AuthUser | null) {
//     setUser(u);
//     try {
//       if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
//       else localStorage.removeItem(STORAGE_KEY);
//     } catch {
//       /* ignore */
//     }
//   }

//   async function loadSubscriptions(accessToken: string) {
//     if (!accessToken) {
//       setSubscriptions([]);
//       return;
//     }
//     setSubscriptionsLoading(true);
//     setSubscriptionsError(null);
//     try {
//       const subs = await fetchAzureSubscriptions(accessToken);
//       setSubscriptions(subs);
//     } catch (err) {
//       setSubscriptions([]);
//       setSubscriptionsError(
//         err instanceof Error ? err.message : "Failed to load Azure subscriptions.",
//       );
//     } finally {
//       setSubscriptionsLoading(false);
//     }
//   }

//   const value = useMemo<AuthContextValue>(
//     () => ({
//       user,
//       loading,
//       subscriptions,
//       subscriptionsLoading,
//       subscriptionsError,

//       // Mocked email/password sign-in — accepts any non-empty credentials.
//       // Swap this out for a real call to your backend's password-login endpoint
//       // whenever that's ready (mirrors CLOUD_LOGIN_APIS in LoginModal.tsx).
//       signInWithPassword: (email: string) =>
//         new Promise<void>((resolve) => {
//           setTimeout(() => {
//             const name = nameFromEmail(email);
//             persist({ name, email, initials: initialsFromName(name), method: "password" });
//             setSubscriptions([]); // no ARM token in the mocked flow
//             resolve();
//           }, 500);
//         }),

//       // Real Azure AD SSO via authorization code + PKCE.
//       // This avoids the unsupported implicit flow that Azure rejects for
//       // this app registration while still allowing a popup-based sign-in.
//       signInWithAzure: () =>
//         new Promise<void>(async (resolve, reject) => {
//           localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
//           localStorage.removeItem("msalIdToken");
//           localStorage.removeItem(AUTH_CODE_STORAGE_KEY);
//           localStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
//           localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);

//           if (!AZURE_SSO_CLIENT_ID) {
//             reject(new Error("Azure SSO is not configured (missing VITE_AZURE_SSO_CLIENT_ID)."));
//             return;
//           }

//           try {
//             const { verifier, challenge } = await generatePkcePair();
//             localStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);

//             const BASE_URL = window.location.origin;
//             const redirectUri = `${BASE_URL}/auth-redirect`;
//             const nonce = Math.random().toString(36).substring(2);
//             const scope = encodeURIComponent("openid profile email https://management.azure.com/user_impersonation");

//             const authorizeUrl =
//               `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize` +
//               `?client_id=${AZURE_SSO_CLIENT_ID}&response_type=code&response_mode=query&redirect_uri=${encodeURIComponent(redirectUri)}` +
//               `&scope=${scope}&nonce=${nonce}&state=management&prompt=select_account` +
//               `&code_challenge=${challenge}&code_challenge_method=S256`;

//             const popup = window.open(
//               authorizeUrl,
//               "azureSsoPopup",
//               "width=500,height=600,left=400,top=100",
//             );

//             if (!popup) {
//               reject(
//                 new Error("Popup was blocked. Please allow popups for this site and try again."),
//               );
//               return;
//             }

//             try {
//               const code = await waitForToken(AUTH_CODE_STORAGE_KEY, AUTH_ERROR_STORAGE_KEY);
//               const codeVerifier = localStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) || "";
//               localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
//               localStorage.removeItem(AUTH_CODE_STORAGE_KEY);
//               localStorage.removeItem(AUTH_ERROR_STORAGE_KEY);

//               const tokenResponse = await fetch(
//                 `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
//                 {
//                   method: "POST",
//                   headers: {
//                     "Content-Type": "application/x-www-form-urlencoded",
//                   },
//                   body: new URLSearchParams({
//                     client_id: AZURE_SSO_CLIENT_ID,
//                     scope: "openid profile email https://management.azure.com/user_impersonation",
//                     code,
//                     redirect_uri: redirectUri,
//                     grant_type: "authorization_code",
//                     code_verifier: codeVerifier,
//                   }),
//                 },
//               );

//               const tokenData = await tokenResponse.json();
//               if (!tokenResponse.ok || !tokenData.id_token) {
//                 throw new Error(tokenData.error_description || tokenData.error || "Microsoft login failed. Please try again.");
//               }

//               const idToken = tokenData.id_token;
//               const accessToken = tokenData.access_token || "";
//               localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
//               localStorage.setItem("msalIdToken", idToken);

//               const profile = profileFromToken(idToken);
//               if (!profile) {
//                 throw new Error("Unable to read your Microsoft profile. Please try again.");
//               }

//               const name = profile.name;
//               persist({
//                 name,
//                 email: profile.email,
//                 initials: initialsFromName(name),
//                 method: "sso",
//               });

//               // Fire this after resolving login so a slow/failed subscriptions
//               // call never blocks the user from getting into the app.
//               resolve();
//               void loadSubscriptions(accessToken);
//             } catch (err) {
//               reject(
//                 err instanceof Error ? err : new Error("Microsoft login failed. Please try again."),
//               );
//             } finally {
//               if (!popup.closed) popup.close();
//             }
//           } catch (err) {
//             reject(
//               err instanceof Error ? err : new Error("Microsoft login failed. Please try again."),
//             );
//           }
//         }),

//       signOut: () => {
//         persist(null);
//         setSubscriptions([]);
//         setSubscriptionsError(null);
//         localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
//         localStorage.removeItem("msalIdToken");
//       },

//       // Re-fetches subscriptions using whatever access token is currently
//       // in storage. Useful for a manual "retry" button, or to call after
//       // a silent-renewal flow refreshes msalAccessToken.
//       refreshSubscriptions: () => {
//         const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
//         return loadSubscriptions(token);
//       },
//     }),
//     [user, loading, subscriptions, subscriptionsLoading, subscriptionsError],
//   );

//   return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
// }

// export function useAuth(): AuthContextValue {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
//   return ctx;
// }

// src/authContext.tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { decodeJWT, waitForToken } from "./ssoUtils";

const AZURE_SSO_CLIENT_ID = import.meta.env.VITE_AZURE_SSO_CLIENT_ID;
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;

export interface AuthUser {
  name: string;
  email: string;
  initials: string;
  method: "sso" | "password";
}

export interface AzureSubscription {
  subscriptionId: string;
  displayName: string;
  state: string;
  tenantId: string;
}

interface ArmSubscriptionsResponse {
  value: AzureSubscription[];
  nextLink?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  subscriptions: AzureSubscription[];
  subscriptionsLoading: boolean;
  subscriptionsError: string | null;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signInWithAzure: () => Promise<void>;
  signOut: () => void;
  refreshSubscriptions: () => Promise<void>;
}

const STORAGE_KEY = "aco.auth.user";
const AUTH_CODE_STORAGE_KEY = "azureAuthCode";
const AUTH_ERROR_STORAGE_KEY = "azureAuthError";
const PKCE_VERIFIER_STORAGE_KEY = "azureCodeVerifier";
const ACCESS_TOKEN_STORAGE_KEY = "msalAccessToken";
const REFRESH_TOKEN_STORAGE_KEY = "msalRefreshToken";
const TOKEN_EXPIRES_AT_KEY = "msalTokenExpiresAt";

const AAD_SCOPE =
  "openid profile email offline_access https://management.azure.com/user_impersonation";
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // renew 5 min before actual expiry

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] || "user";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

function profileFromToken(token: string) {
  const payload = decodeJWT(token);
  if (!payload) return null;

  const name =
    payload.fullName ||
    payload.name ||
    payload.preferred_username ||
    payload.upn ||
    payload.email ||
    "Azure User";
  const email = payload.email || payload.preferred_username || payload.upn || "";

  return { name, email };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function generatePkcePair() {
  const randomBytes = new Uint8Array(64);
  crypto.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

// Persists a fresh token pair from either the initial code exchange or a
// refresh_token grant, and returns the new access token for convenience.
function storeTokenResponse(tokenData: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
}): string {
  const accessToken = tokenData.access_token || "";
  const expiresInSec = tokenData.expires_in || 3600;
  const expiresAt = Date.now() + expiresInSec * 1000;

  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  localStorage.setItem(TOKEN_EXPIRES_AT_KEY, String(expiresAt));
  // AAD rotates refresh tokens on most grants — always persist the latest one.
  if (tokenData.refresh_token) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokenData.refresh_token);
  }
  return accessToken;
}

function clearTokenStorage() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_AT_KEY);
  localStorage.removeItem("msalIdToken");
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

// Exchanges the stored refresh_token for a new access_token. Throws if
// there's no refresh token, or if AAD rejects it (revoked/expired) — in
// which case the caller should fall back to a full interactive login.
async function refreshAccessToken(): Promise<string> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
  if (!refreshToken) throw new Error("No refresh token available");

  const res = await fetch(
    `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: AZURE_SSO_CLIENT_ID,
        scope: AAD_SCOPE,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    },
  );

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    clearTokenStorage();
    throw new Error(data.error_description || data.error || "Silent refresh failed");
  }

  return storeTokenResponse(data);
}

// Fetches all Azure subscriptions visible to the account behind this token.
// Handles ARM pagination via nextLink so large tenants don't get truncated.
// On a 401, tries exactly one silent refresh + retry before giving up —
// covers the case where the proactive timer didn't fire in time (laptop
// asleep, tab backgrounded, etc).
async function fetchAzureSubscriptions(
  accessToken: string,
  { retried = false }: { retried?: boolean } = {},
): Promise<AzureSubscription[]> {
  const subscriptions: AzureSubscription[] = [];
  let url: string | undefined = "https://management.azure.com/subscriptions?api-version=2022-12-01";
  let token = accessToken;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401 && !retried) {
      token = await refreshAccessToken();
      return fetchAzureSubscriptions(token, { retried: true });
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || `Failed to fetch subscriptions (${res.status})`);
    }

    const data: ArmSubscriptionsResponse = await res.json();
    subscriptions.push(...data.value);
    url = data.nextLink;
  }

  return subscriptions;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);

  // Schedules a silent refresh ~5 min before the stored token's expiry.
  // Reschedules itself after each successful refresh. Safe to call
  // repeatedly — it always clears any previous timer first.
  function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);

    const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_AT_KEY) || 0);
    if (!expiresAt) return;

    const delay = Math.max(expiresAt - Date.now() - REFRESH_BUFFER_MS, 0);
    refreshTimer = setTimeout(async () => {
      try {
        await refreshAccessToken();
        scheduleRefresh();
      } catch {
        forceSignOut("Session expired. Please sign in again.");
      }
    }, delay);
  }

  useEffect(() => {
    let storedUser: AuthUser | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        storedUser = JSON.parse(raw);
        setUser(storedUser);
      }
    } catch {
      /* ignore */
    }

    (async () => {
      const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_AT_KEY) || 0);
      const hasToken = !!localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);

      // SSO user with no token at all (refresh token expired/cleared previously)
      if (storedUser?.method === "sso" && !hasToken) {
        forceSignOut();
        setLoading(false);
        return;
      }

      if (hasToken && Date.now() > expiresAt - REFRESH_BUFFER_MS) {
        try {
          const token = await refreshAccessToken();
          await loadSubscriptions(token);
          scheduleRefresh();
        } catch {
          forceSignOut("Session expired. Please sign in again.");
        }
      } else if (hasToken) {
        const token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
        void loadSubscriptions(token);
        scheduleRefresh();
      }

      setLoading(false);
    })();

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, []);

  function persist(u: AuthUser | null) {
    setUser(u);
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  function forceSignOut(message: string | null = null) {
    persist(null);
    setSubscriptions([]);
    setSubscriptionsError(message);
    clearTokenStorage();
  }
  async function loadSubscriptions(accessToken: string) {
    if (!accessToken) {
      setSubscriptions([]);
      return;
    }
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);
    try {
      const subs = await fetchAzureSubscriptions(accessToken);
      setSubscriptions(subs);
    } catch (err) {
      setSubscriptions([]);
      setSubscriptionsError(
        err instanceof Error ? err.message : "Failed to load Azure subscriptions.",
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      subscriptions,
      subscriptionsLoading,
      subscriptionsError,

      signInWithPassword: (email: string) =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            const name = nameFromEmail(email);
            persist({ name, email, initials: initialsFromName(name), method: "password" });
            setSubscriptions([]); // no ARM token in the mocked flow
            resolve();
          }, 500);
        }),

      signInWithAzure: () =>
        new Promise<void>(async (resolve, reject) => {
          clearTokenStorage();
          localStorage.removeItem(AUTH_CODE_STORAGE_KEY);
          localStorage.removeItem(AUTH_ERROR_STORAGE_KEY);
          localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);

          if (!AZURE_SSO_CLIENT_ID) {
            reject(new Error("Azure SSO is not configured (missing VITE_AZURE_SSO_CLIENT_ID)."));
            return;
          }

          try {
            const { verifier, challenge } = await generatePkcePair();
            localStorage.setItem(PKCE_VERIFIER_STORAGE_KEY, verifier);

            const BASE_URL = window.location.origin;
            const redirectUri = `${BASE_URL}/auth-redirect`;
            const nonce = Math.random().toString(36).substring(2);
            const scope = encodeURIComponent(AAD_SCOPE);

            const authorizeUrl =
              `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/authorize` +
              `?client_id=${AZURE_SSO_CLIENT_ID}&response_type=code&response_mode=query&redirect_uri=${encodeURIComponent(redirectUri)}` +
              `&scope=${scope}&nonce=${nonce}&state=management&prompt=select_account` +
              `&code_challenge=${challenge}&code_challenge_method=S256`;

            const popup = window.open(
              authorizeUrl,
              "azureSsoPopup",
              "width=500,height=600,left=400,top=100",
            );

            if (!popup) {
              reject(
                new Error("Popup was blocked. Please allow popups for this site and try again."),
              );
              return;
            }

            try {
              const code = await waitForToken(AUTH_CODE_STORAGE_KEY, AUTH_ERROR_STORAGE_KEY);
              const codeVerifier = localStorage.getItem(PKCE_VERIFIER_STORAGE_KEY) || "";
              localStorage.removeItem(PKCE_VERIFIER_STORAGE_KEY);
              localStorage.removeItem(AUTH_CODE_STORAGE_KEY);
              localStorage.removeItem(AUTH_ERROR_STORAGE_KEY);

              const tokenResponse = await fetch(
                `https://login.microsoftonline.com/${AZURE_TENANT_ID}/oauth2/v2.0/token`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                  },
                  body: new URLSearchParams({
                    client_id: AZURE_SSO_CLIENT_ID,
                    scope: AAD_SCOPE,
                    code,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code",
                    code_verifier: codeVerifier,
                  }),
                },
              );

              const tokenData = await tokenResponse.json();
              if (!tokenResponse.ok || !tokenData.id_token) {
                throw new Error(
                  tokenData.error_description ||
                    tokenData.error ||
                    "Microsoft login failed. Please try again.",
                );
              }

              const idToken = tokenData.id_token;
              localStorage.setItem("msalIdToken", idToken);
              const accessToken = storeTokenResponse(tokenData);

              if (!tokenData.refresh_token) {
                // Not fatal, but silent renewal won't work until this is fixed —
                // almost always means the app registration's redirect URI is
                // registered under "Web" instead of "Single-page application"
                // in Azure AD, so AAD refuses to hand back a refresh token.
                console.warn(
                  "No refresh_token returned by AAD — check that the app registration's " +
                    "redirect URI platform is 'Single-page application', not 'Web'.",
                );
              }

              const profile = profileFromToken(idToken);
              if (!profile) {
                throw new Error("Unable to read your Microsoft profile. Please try again.");
              }

              const name = profile.name;
              persist({
                name,
                email: profile.email,
                initials: initialsFromName(name),
                method: "sso",
              });

              resolve();
              void loadSubscriptions(accessToken);
              scheduleRefresh();
            } catch (err) {
              reject(
                err instanceof Error ? err : new Error("Microsoft login failed. Please try again."),
              );
            } finally {
              if (!popup.closed) popup.close();
            }
          } catch (err) {
            reject(
              err instanceof Error ? err : new Error("Microsoft login failed. Please try again."),
            );
          }
        }),

      signOut: () => {
        persist(null);
        setSubscriptions([]);
        setSubscriptionsError(null);
        clearTokenStorage();
      },

      refreshSubscriptions: async () => {
        let token = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
        const expiresAt = Number(localStorage.getItem(TOKEN_EXPIRES_AT_KEY) || 0);

        if (token && Date.now() > expiresAt - REFRESH_BUFFER_MS) {
          try {
            token = await refreshAccessToken();
            scheduleRefresh();
          } catch {
            forceSignOut("Session expired. Please sign in again.");
            return;
          }
        }

        return loadSubscriptions(token);
      },
    }),
    [user, loading, subscriptions, subscriptionsLoading, subscriptionsError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
