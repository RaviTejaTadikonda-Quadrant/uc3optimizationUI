import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from "@azure/msal-browser";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const AZURE_SSO_CLIENT_ID = import.meta.env.VITE_AZURE_SSO_CLIENT_ID;
const AZURE_TENANT_ID = import.meta.env.VITE_AZURE_TENANT_ID;
const ARM_SCOPE = "https://management.azure.com/user_impersonation";
const STORAGE_KEY = "aco.auth.user";
const AZURE_EMAIL_STORAGE_KEY = "aco.auth.azure.email";
const AZURE_ACCESS_TOKEN_STORAGE_KEY = "aco.auth.azure.accessToken";

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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

let msalInstance: PublicClientApplication | null = null;
let msalInitialized: Promise<PublicClientApplication> | null = null;
let azureSignInPromise: Promise<void> | null = null;

function getMsalInstance(): Promise<PublicClientApplication> {
  if (!AZURE_SSO_CLIENT_ID) {
    return Promise.reject(
      new Error("Azure SSO is not configured (missing VITE_AZURE_SSO_CLIENT_ID)."),
    );
  }

  if (!msalInstance) {
    msalInstance = new PublicClientApplication({
      auth: {
        clientId: AZURE_SSO_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID || "common"}`,
        redirectUri: `${window.location.origin}/auth-redirect`,
        postLogoutRedirectUri: `${window.location.origin}/auth-redirect`,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
  }

  if (!msalInitialized) {
    msalInitialized = msalInstance.initialize().then(() => msalInstance!);
  }
  return msalInitialized;
}

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
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function userFromAccount(account: AccountInfo): AuthUser {
  const name = account.name || nameFromEmail(account.username);
  return {
    name,
    email: account.username,
    initials: initialsFromName(name),
    method: "sso",
  };
}

function storeAzureSession(email: string, accessToken?: string) {
  localStorage.setItem(AZURE_EMAIL_STORAGE_KEY, email);
  if (accessToken) localStorage.setItem(AZURE_ACCESS_TOKEN_STORAGE_KEY, accessToken);
}

function clearAzureSession() {
  localStorage.removeItem(AZURE_EMAIL_STORAGE_KEY);
  localStorage.removeItem(AZURE_ACCESS_TOKEN_STORAGE_KEY);
}

async function fetchAzureSubscriptions(accessToken: string): Promise<AzureSubscription[]> {
  const subscriptions: AzureSubscription[] = [];
  let url: string | undefined = "https://management.azure.com/subscriptions?api-version=2022-12-01";

  while (url) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error?.message || `Failed to fetch subscriptions (${response.status})`);
    }

    const data: ArmSubscriptionsResponse = await response.json();
    subscriptions.push(...data.value);
    url = data.nextLink;
  }

  return subscriptions;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);
  const [subscriptionsError, setSubscriptionsError] = useState<string | null>(null);

  function persist(userToPersist: AuthUser | null) {
    setUser(userToPersist);
    if (userToPersist?.method === "password")
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userToPersist));
    else localStorage.removeItem(STORAGE_KEY);
  }

  async function getAccessToken(currentAccount: AccountInfo): Promise<string> {
    const client = await getMsalInstance();
    try {
      const accessToken = (
        await client.acquireTokenSilent({ account: currentAccount, scopes: [ARM_SCOPE] })
      ).accessToken;
      storeAzureSession(currentAccount.username, accessToken);
      return accessToken;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        const accessToken = (
          await client.acquireTokenPopup({ account: currentAccount, scopes: [ARM_SCOPE] })
        ).accessToken;
        storeAzureSession(currentAccount.username, accessToken);
        return accessToken;
      }
      throw error;
    }
  }

  async function loadSubscriptions(currentAccount: AccountInfo) {
    setSubscriptionsLoading(true);
    setSubscriptionsError(null);
    try {
      setSubscriptions(await fetchAzureSubscriptions(await getAccessToken(currentAccount)));
    } catch (error) {
      setSubscriptions([]);
      setSubscriptionsError(
        error instanceof Error ? error.message : "Failed to load Azure subscriptions.",
      );
    } finally {
      setSubscriptionsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const client = await getMsalInstance();
        const activeAccount = client.getActiveAccount() || client.getAllAccounts()[0] || null;
        if (activeAccount) {
          client.setActiveAccount(activeAccount);
          if (!cancelled) {
            setAccount(activeAccount);
            persist(userFromAccount(activeAccount));
            storeAzureSession(activeAccount.username);
            void loadSubscriptions(activeAccount);
            setLoading(false);
          }
          return;
        }
      } catch {
        // Password login remains available when Azure SSO is not configured.
      }

      try {
        const storedUser = localStorage.getItem(STORAGE_KEY);
        if (!cancelled && storedUser) setUser(JSON.parse(storedUser));
      } catch {
        // Ignore malformed browser storage.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      subscriptions,
      subscriptionsLoading,
      subscriptionsError,
      signInWithPassword: async (email: string) => {
        const name = nameFromEmail(email);
        setAccount(null);
        persist({ name, email, initials: initialsFromName(name), method: "password" });
        setSubscriptions([]);
      },
      signInWithAzure: () => {
        // React state disables the button after a render, but two very quick
        // clicks can happen before that render. MSAL permits only one active
        // interactive request, so share the in-flight request explicitly.
        if (azureSignInPromise) return azureSignInPromise;

        azureSignInPromise = (async () => {
          const client = await getMsalInstance();
          const result = await client.loginPopup({
            scopes: ["openid", "profile", "email", ARM_SCOPE],
            prompt: "select_account",
            // If a user closes a previous account-picker popup, MSAL can keep
            // its interaction marker in session storage. Starting a new popup
            // should recover from that abandoned interaction.
            overrideInteractionInProgress: true,
          });
          const signedInAccount = result.account;
          if (!signedInAccount)
            throw new Error("Microsoft did not return an account for this sign-in.");

          client.setActiveAccount(signedInAccount);
          setAccount(signedInAccount);
          persist(userFromAccount(signedInAccount));
          storeAzureSession(signedInAccount.username);
          void loadSubscriptions(signedInAccount);
        })().finally(() => {
          azureSignInPromise = null;
        });

        return azureSignInPromise;
      },
      signOut: () => {
        const signingOutAccount = account;
        setAccount(null);
        persist(null);
        setSubscriptions([]);
        setSubscriptionsError(null);
        clearAzureSession();
        // Local sign-out intentionally does not call logoutPopup: that starts
        // another Entra interaction and can collide with a pending popup.
        if (msalInstance) {
          msalInstance.setActiveAccount(null);
          void msalInstance.clearCache({ account: signingOutAccount ?? undefined });
        }
      },
      refreshSubscriptions: async () => {
        if (account) await loadSubscriptions(account);
      },
    }),
    [account, loading, subscriptions, subscriptionsError, subscriptionsLoading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
