import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import WorkloadOptimization from "../components/WorkloadOptimization";
import { useAuth } from "../auth/AuthContext";
import { fetchAllWorkloadData } from "../data/subscriptions";
import type { Subscription } from "../data/subscriptions";
import type { Service } from "../components/WorkloadOptimization";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, signOut, subscriptions: azureSubs, subscriptionsLoading, subscriptionsError } = useAuth();
  const [data, setData] = useState<Service[]>();
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);

  const loadWorkloads = useCallback(async () => {
    if (azureSubs.length === 0) return;

    const subs: Subscription[] = azureSubs.map((s) => ({ id: s.subscriptionId, name: s.displayName }));
    const accessToken = localStorage.getItem("msalAccessToken") || "";

    setIsError(false);
    setIsFetching(true);
    try {
      const workloads = await fetchAllWorkloadData(subs, accessToken);
      setData(workloads);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [azureSubs]);

  useEffect(() => {
    // Wait for AuthContext to finish fetching ARM subscriptions before
    // hitting the baseline API with them.
    if (subscriptionsLoading) return;
    void loadWorkloads();
  }, [subscriptionsLoading, loadWorkloads]);

  function handleLogout() {
    signOut();
    navigate("/", { replace: true });
  }

  if (!user) return null;

  if ((isLoading || subscriptionsLoading) && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="text-sm font-semibold">Loading workloads…</span>
        </div>
      </div>
    );
  }

  if (isError || subscriptionsError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-sm text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Couldn't load data</h2>
          <p className="mt-1 text-sm text-slate-500">The workload API request failed. Please try again.</p>
          <button
            onClick={() => void loadWorkloads()}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <WorkloadOptimization
      data={data}
      subscriptions={azureSubs.map((s) => ({ id: s.subscriptionId, name: s.displayName }))}
      user={{ name: user.name, email: user.email, initials: user.initials }}
      onLogout={handleLogout}
      loading={isFetching}
    />
  );
}