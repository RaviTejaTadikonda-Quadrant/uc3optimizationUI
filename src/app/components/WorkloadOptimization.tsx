import { useState, useEffect, useRef } from "react";
import type { CostConsumptionDetail, CostPanelViewModel } from "../data/costApi";
import type { CostInvestigationResult } from "../data/costApi";
import { postCostInvestigation } from "../data/costApi";
import { normalizeFreshCostResult, type CachedCostInvestigationResponse } from "../data/costApi";
import {
  ChevronRight,
  ChevronDown,
  CircleDot,
  Database,
  Server,
  Cloud,
  Box,
  Activity,
  TrendingDown,
  Search,
  SlidersHorizontal,
  ChevronsUpDown,
  ChevronsDownUp,
  BadgeCheck,
  Bot,
  Play,
  RefreshCw,
  Loader2,
  ChevronUp,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Code2,
  DollarSign,
  Zap,
  Cpu,
  Sparkles,
  Layers,
  ShieldAlert,
  CheckCircle2,
  TrendingUp,
  HelpCircle,
  LogOut,
  FolderTree,
  Gauge,
  Wallet,
  FileText,
} from "lucide-react";

// ─── Interfaces & Typings ────────────────────────────────────────────────────
export interface Run {
  id: string;
  name: string;
  activityType: string;
  avgSeconds: number;
  lastSeconds: number;
  apiDeviationPct: number | null;
  health: ApiHealth | null;
  status: "slow" | "med" | "ok" | "canceled";
  run_page_url?: string;
}

export interface Card {
  emoji: string;
  heading: string;
  body: string;
}

export interface Step {
  t: string;
  c?: string;
}

// Raw API health tiers, straight from pipeline_baseline.health.
export type ApiHealth = "Healthy" | "Warning" | "Critical" | "Severe";

export interface Workload {
  id: string;
  name: string;
  wtype: string;
  avgSeconds: number;
  lastSeconds: number;
  saveCost: string | null;
  effort: string | null;
  apiHealth: ApiHealth | null;
  rootCause: string | null;
  apiDeviationPct: number | null;
  cards: Card[];
  steps: Step[];
  impact: string[];
  htmlWlKey: string | null;
  runs: Run[];
}

// A workspace (formerly called "Resource") — sits inside a Resource Group.
export interface Workspace {
  id: string;
  name: string;
  region: string;
  rtype: string;
  tier: string;
  subscriptionId?: string;
  subscriptionName?: string;
  workloads: Workload[];
}

// New level: mirrors the API's own resource_group grouping, sitting between
// a Service (Synapse/Databricks/ADF) and its Workspaces.
export interface ResourceGroup {
  id: string;
  name: string;
  subscriptionId?: string;
  subscriptionName?: string;
  workspaces: Workspace[];
}

export interface Service {
  id: string;
  name: string;
  color: string;
  bg: string;
  border: string;
  subscriptionId?: string;
  subscriptionName?: string;
  resourceGroups: ResourceGroup[];
}

// ─── Real analysis API response types ─────────────────────────────────────
// These mirror the shape returned by the `.../analyze` → `.../analysis`
// endpoint chain. Fields whose exact sub-shape isn't guaranteed by the
// backend (recommendations, code_refactoring_plan, root_causes) are typed
// loosely and read defensively in the UI below.

export interface StructuralFault {
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | string;
}

export interface AgentInfo {
  agent: string;
  stage: string;
  model: string;
  provider: string;
  latency_seconds: number;
  input_tokens: number | null;
  output_tokens: number | null;
  findings_count: number | null;
  status: string;
  error: string | null;
}

export interface PipelineTelemetryStep {
  step: string;
  at: string;
  sequence: number;
}

export interface TargetOptimizationForecast {
  summary: string;
  detailed_summary?: string;
  items: Array<Record<string, any> | string>;
}

export interface AgentRecommendationAnalysis {
  core_bottleneck: Record<string, any> | string | null;
  recommendations: Array<Record<string, any> | string>;
  target_optimization_forecast: TargetOptimizationForecast;
  compilation_adjustment: Record<string, any> | string | null;
}

export interface PipelineBaseline {
  service: string;
  resource_group: string;
  workspace_name: string;
  item_type: string;
  item_name: string;
  total_runs_available: number;
  baseline_window: number;
  avg_duration_seconds: number;
  median_duration_seconds: number;
  p95_duration_seconds: number;
  min_duration_seconds: number;
  max_duration_seconds: number;
  success_rate_pct: number;
  latest_run_duration_seconds: number;
  deviation_seconds: number;
  deviation_pct: number;
  health: ApiHealth;
  calculated_at: string;
}

export interface CodeRefactorItem {
  target?: string;
  file_name?: string;
  title?: string;
  description?: string;
  original_code?: string;
  optimized_code?: string;
  before?: string;
  after?: string;
  [key: string]: any;
}

export interface AnalysisHeader {
  investigation_id: string;
  status: string;
  error: string | null;
  skipped_reason: string | null;
  message: string | null;
  item: {
    subscription_id: string;
    service: string;
    resource_group: string;
    workspace_name: string;
    item_type: string;
    item_name: string;
  };
  pipeline_health: ApiHealth;
  pipeline_deviation_pct: number;
  pipeline_deviation_seconds: number;
  target_code_segments: any[];
  started_at: string;
  ended_at: string;
  stage_timings: Record<string, number>;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_monthly_cost: number | null;
  current_month_cost?: number | null;
  baseline_monthly_cost?: number | null;
  currency?: string;
}

export interface AnalysisResult {
  header: AnalysisHeader;
  pipeline_telemetry: PipelineTelemetryStep[];
  agents: AgentInfo[];
  agent_recommendation_analysis: AgentRecommendationAnalysis;
  structural_faults: StructuralFault[];
  structural_faults_count: number;
  code_refactoring_plan: CodeRefactorItem[];
  root_causes: string[];
  trigger_payload: {
    subscription_id: string;
    service: string;
    resource_group: string;
    workspace_name: string;
    item_type: string;
    item_name: string;
    total_runs_available: number;
    baseline_window: number;
    pipeline_baseline: PipelineBaseline;
    activities: any[];
    calculated_at: string;
  };
}

export interface AnalyzeApiResponse {
  investigation_id: string;
  status: string;
  analysis: AnalysisResult;
}

function toTitleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase → spaces
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function fmtAgentName(name: string): string {
  return name.replace(/_/g, " ");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Decimal-aware duration formatter, driven directly off the API's *_seconds
// fields (no rounding to whole seconds/minutes).
function fmtSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const totalMin = Math.floor(seconds / 60);
  const remSec = seconds - totalMin * 60;
  if (totalMin < 60) return `${totalMin}m ${remSec.toFixed(1)}s`;
  const hours = Math.floor(totalMin / 60);
  const remMin = (totalMin % 60) + remSec / 60;
  return `${hours}h ${remMin.toFixed(1)}m`;
}

function statusLabel(s: string): string {
  return s === "slow" ? "High" : s === "med" ? "Mod" : s === "canceled" ? "Canceled" : "Ok";
}

// Deviation percentage straight from the API's deviation_pct, kept to 2 decimals.
function fmtDeviation(dev: number | null | undefined): string {
  if (dev === null || dev === undefined) return "";
  return `${dev >= 0 ? "+" : ""}${dev.toFixed(2)}%`;
}

// Maps the API's own health string to a badge color bucket, reusing StatusDot's palette.
const API_HEALTH_TO_STATUS: Record<ApiHealth, string> = {
  Severe: "slow",
  Critical: "slow",
  Warning: "med",
  Healthy: "ok",
};

// Ordering used when sorting by Health State: worst first.
const API_HEALTH_RANK: Record<ApiHealth, number> = {
  Severe: 0,
  Critical: 1,
  Warning: 2,
  Healthy: 3,
};

const TILE_ACCENTS = {
  emerald: {
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-600",
    activeBorder: "border-emerald-300",
    ring: "ring-emerald-200",
  },
  amber: {
    iconBg: "bg-amber-50",
    iconText: "text-amber-600",
    activeBorder: "border-amber-300",
    ring: "ring-amber-200",
  },
  rose: {
    iconBg: "bg-rose-50",
    iconText: "text-rose-600",
    activeBorder: "border-rose-300",
    ring: "ring-rose-200",
  },
  indigo: {
    iconBg: "bg-indigo-50",
    iconText: "text-indigo-600",
    activeBorder: "border-indigo-300",
    ring: "ring-indigo-200",
  },
} as const;

function getServiceIcon(id: string) {
  const cls = "w-4 h-4 flex-shrink-0";
  switch (id) {
    case "sql":
      return <Database className={`${cls} text-blue-600`} />;
    case "dbr":
      return <CircleDot className={`${cls} text-indigo-600`} />;
    case "syn":
      return <Activity className={`${cls} text-teal-600`} />;
    case "adf":
      return <Box className={`${cls} text-blue-600`} />;
    case "aks":
      return <Server className={`${cls} text-amber-600`} />;
    case "func":
      return <Cloud className={`${cls} text-pink-600`} />;
    default:
      return <CircleDot className={`${cls} text-slate-600`} />;
  }
}

// ─── Atoms ────────────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: string }) {
  const c =
    status === "slow"
      ? "bg-rose-500 animate-pulse"
      : status === "med"
        ? "bg-amber-400"
        : status === "canceled"
          ? "bg-slate-400"
          : "bg-emerald-500";
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${c}`} />;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "slow"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : status === "med"
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
        : status === "canceled"
          ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
          : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}
    >
      <StatusDot status={status} />
      {statusLabel(status)}
    </span>
  );
}
function safeParseMaybeJSON(val: any): any {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return val;
  try {
    return JSON.parse(trimmed);
  } catch {
    return val;
  }
}
// Badge that shows the API's own health string (Healthy / Warning / Critical / Severe)
// instead of a recomputed High/Mod/Ok bucket.
function ApiHealthBadge({ health }: { health: ApiHealth }) {
  const cls =
    health === "Healthy"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
      : health === "Warning"
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
        : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"; // Critical / Severe
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}
    >
      <StatusDot status={API_HEALTH_TO_STATUS[health]} />
      {health}
    </span>
  );
}

function extractExecutiveSummary(text: string | null | undefined): string {
  if (!text) return "";
  const cutMarker = "Root cause";
  const idx = text.indexOf(cutMarker);
  let section = idx === -1 ? text : text.slice(0, idx);
  section = section.replace(/^Executive summary\s*\n+/i, "");
  return section.trim();
}

function TypePill({ label }: { label: string }) {
  return (
    <span
      className="inline-block max-w-full truncate align-middle text-[10px] tracking-wider uppercase text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded font-bold"
      title={label}
    >
      {label}
    </span>
  );
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 uppercase tracking-wider font-extrabold transition-colors ${
        active ? "text-indigo-600" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronsUpDown className="w-3 h-3 opacity-50" />
      )}
    </button>
  );
}

function ToggleBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-800 transition-all flex-shrink-0"
    >
      {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
    </button>
  );
}

// ─── Agent Analysis Panel ───────────────────────────────────────────────────
// Calls the real `/analyze` → poll → `/analysis` chain and renders whatever
// the backend actually returns. No dummy/canned workload data lives here
// anymore — every field below is read straight off `AnalysisResult`, with
// empty-state copy for sections the backend didn't populate for this run.
function AgentAnalysisPanel({
  wl,
  isApplied,
  onApply,
  service,
  resourceGroup,
  workspace,
  subscriptionId,
  costLookup,
  cacheEntry,
  onCacheUpdate,
  investigationId,
}: {
  wl: Workload;
  isApplied: boolean;
  onApply: () => void;
  service: Service;
  resourceGroup: ResourceGroup;
  workspace: Workspace;
  subscriptionId: string;
  investigationId?: string;
  costLookup?: Map<string, CostConsumptionDetail>;
  cacheEntry?: {
    agentState: "idle" | "running" | "done";
    aiResult: AnalysisResult | null;
    pollUrl: string | null;
    apiError: string | null;
  };
  onCacheUpdate: (
    entry: Partial<{
      agentState: "idle" | "running" | "done";
      aiResult: AnalysisResult | null;
      pollUrl: string | null;
      apiError: string | null;
    }>,
  ) => void;
}) {
  const [agentState, setAgentState] = useState(cacheEntry?.agentState ?? "idle");
  const [aiResult, setAiResult] = useState(cacheEntry?.aiResult ?? null);
  const [pollUrl, setPollUrl] = useState(cacheEntry?.pollUrl ?? null);
  const [apiError, setApiError] = useState(cacheEntry?.apiError ?? null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [pollStatus, setPollStatus] = useState<{
    status: string;
    current_step: string;
    active_agents?: string[];
  } | null>(null);
  const [openSecs, setOpenSecs] = useState({
    faults: true,
    code: true,
    metrics: true,
    trace: false,
  });
  const [copied, setCopied] = useState<string | null>(null);

  const apiBaseUrl = "https://uc3-agents-bgbsfqbbgkfeabfq.eastus-01.azurewebsites.net";

  // Map service.id to service key for API calls
  const getServiceKey = (serviceId: string): string => {
    const mapping: Record<string, string> = {
      syn: "synapse",
      dbr: "databricks",
      adf: "adf",
    };
    return mapping[serviceId] || serviceId;
  };
  const costEntry =
    costLookup?.get(
      `${subscriptionId}::${getServiceKey(service.id)}::${resourceGroup.name}::${workspace.name}`,
    ) ?? null;

  // Convert workload type to lowercase item type
  const getItemType = (wtype: string): string => {
    const mapping: Record<string, string> = {
      Pipeline: "pipelines",
      "Notebook Job": "jobs",
      "Spark Pool": "spark_pools",
    };
    return mapping[wtype] || wtype.toLowerCase();
  };

  async function startFreshAnalysis() {
    try {
      const serviceKey = getServiceKey(service.id);
      const itemType = getItemType(wl.wtype);
      const analyzeUrl = `${apiBaseUrl}/api/subscriptions/${subscriptionId}/services/${serviceKey}/rg/${resourceGroup.name}/ws/${workspace.name}/items/${itemType}/${wl.name}/analyze`;

      const analyzeResponse = await fetch(analyzeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!analyzeResponse.ok) {
        console.error("Analyze API failed:", analyzeResponse.status, analyzeResponse.statusText);
        setApiError("Failed to initialize analysis");
        return;
      }

      const analyzeData = await analyzeResponse.json();

      if (analyzeData.poll_url) {
        setPollUrl(analyzeData.poll_url);
        onCacheUpdate({ pollUrl: analyzeData.poll_url });
        setApiError(null);
      } else {
        console.error("No poll_url in response");
        setApiError("Invalid response from server");
      }
    } catch (error) {
      console.error("Error calling analyze API:", error);
      setApiError("Error initializing analysis");
    }
  }

  async function loadCachedAnalysis(id: string) {
    setAgentState("running");
    setApiError(null);
    try {
      const serviceKey = getServiceKey(service.id);
      const res = await fetch(
        `${apiBaseUrl}/api/subscriptions/${subscriptionId}/services/${serviceKey}/investigations/${id}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`Failed to load cached analysis (${res.status})`);
      const data: AnalyzeApiResponse = await res.json();
      if (!data?.analysis) throw new Error("Cached analysis was empty");
      setAiResult(data.analysis);
      setAgentState("done");
      onCacheUpdate({ aiResult: data.analysis, agentState: "done" });
    } catch (err) {
      console.error("Cached analysis fetch failed, falling back to a fresh run:", err);
      setAgentState("idle");
      void startFreshAnalysis();
    }
  }

  useEffect(() => {
    if (cacheEntry?.agentState === "done" || cacheEntry?.agentState === "running") return;
    if (investigationId) {
      void loadCachedAnalysis(investigationId);
    } else {
      void startFreshAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    subscriptionId,
    service.id,
    resourceGroup.name,
    workspace.name,
    wl.wtype,
    wl.name,
    investigationId,
  ]);

  useEffect(() => {
    if (pollUrl && agentState === "idle") {
      runAgent();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollUrl]);

  function toggleSec(k: keyof typeof openSecs) {
    setOpenSecs((s) => ({ ...s, [k]: !s[k] }));
  }

  async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  async function handleRerun() {
    setPollUrl(null);
    setAgentState("idle");
    setAiResult(null);
    setApiError(null);
    onCacheUpdate({ pollUrl: null, agentState: "idle", aiResult: null, apiError: null });
    await startFreshAnalysis();
  }

  async function runAgent() {
    if (agentState === "running" || !pollUrl) return;
    setAgentState("running");
    setAiResult(null);
    setApiError(null);
    setPollAttempts(0);
    setPollStatus(null);

    try {
      let pollResponse = await fetch(`${apiBaseUrl}${pollUrl}`);
      if (!pollResponse.ok) {
        console.error("Poll API failed:", pollResponse.status, pollResponse.statusText);
        setApiError("Failed to check analysis status");
        setAgentState("idle");
        return;
      }
      let pollData = await pollResponse.json();
      setPollStatus({
        status: pollData.status,
        current_step: pollData.current_step,
        active_agents: pollData.active_agents,
      });

      // Poll until analysis is complete
      let attempts = 0;
      const maxAttempts = 250;
      while (
        pollData.status !== "completed" &&
        pollData.status !== "failed" &&
        attempts < maxAttempts
      ) {
        await sleep(2000);
        pollResponse = await fetch(`${apiBaseUrl}${pollUrl}`);
        if (pollResponse.ok) {
          pollData = await pollResponse.json();
          setPollStatus({
            status: pollData.status,
            current_step: pollData.current_step,
            active_agents: pollData.active_agents,
          });
        }
        attempts++;
        setPollAttempts(attempts);
      }

      if (pollData.status === "failed") {
        console.error("Analysis failed on backend");
        setApiError("Analysis failed on the backend. Please try again.");
        setAgentState("idle");
        return;
      }

      if (pollData.status !== "completed") {
        setApiError("Analysis is taking longer than expected. Please try again shortly.");
        setAgentState("idle");
        return;
      }

      // Fetch the analysis results
      const analysisUrl = pollData.analysis_url || pollUrl.replace(/\/status$/, "/analysis");
      if (!analysisUrl) {
        console.error("No analysis_url available");
        setApiError("No analysis results are available for this run");
        setAgentState("idle");
        return;
      }

      const analysisResponse = await fetch(`${apiBaseUrl}${analysisUrl}`);
      if (!analysisResponse.ok) {
        console.error("Analysis API failed:", analysisResponse.status, analysisResponse.statusText);
        setApiError("Failed to load analysis results");
        setAgentState("idle");
        return;
      }

      const analysisData: AnalyzeApiResponse = await analysisResponse.json();

      if (!analysisData?.analysis) {
        console.error("Analysis response missing `analysis` field:", analysisData);
        setApiError("Analysis response was empty");
        setAgentState("idle");
        return;
      }

      setAiResult(analysisData.analysis);
      setAgentState("done");
      onCacheUpdate({ aiResult: analysisData.analysis, agentState: "done" });
    } catch (error) {
      console.error("Error in runAgent:", error);
      setApiError("Error running analysis");
      setAgentState("idle");
    }
  }

  const pb = aiResult?.trigger_payload?.pipeline_baseline;
  const hdr = aiResult?.header;
  const rec = aiResult?.agent_recommendation_analysis;
  const faults = aiResult?.structural_faults ?? [];
  const faultsCount = aiResult?.structural_faults_count ?? faults.length;
  const refactorPlan = (aiResult?.code_refactoring_plan ?? []).filter(
    (item) =>
      typeof item.auto_generated_patch === "string" && item.auto_generated_patch.trim().length > 0,
  );
  const rootCauses = aiResult?.root_causes ?? [];
  const telemetry = aiResult?.pipeline_telemetry ?? [];
  const agentsRun = aiResult?.agents ?? [];

  return (
    <div className="bg-slate-50/50 border-t border-slate-200">
      {/* Agent Control Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-100 flex-shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-950 uppercase tracking-wider">
                Cloud Opti-Agent
              </span>
              <span className="text-[10px] font-bold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full border border-violet-100 animate-pulse">
                Autonomous
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Multi-agent root cause and optimization investigation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {agentState === "done" && (
            <button
              onClick={handleRerun}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Rerun Analysis
            </button>
          )}
        </div>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-200 border-b border-slate-200">
        {[
          {
            label: "Target Code Segment",
            value: hdr?.item.item_name || wl.name,
            icon: <Code2 className="w-3.5 h-3.5 text-slate-400" />,
          },
          {
            label: "Cloud Provider Tech",
            value: hdr
              ? `${hdr.item.service} · ${hdr.item.item_type}`
              : `${service.name} · ${wl.wtype}`,
            icon: <Cpu className="w-3.5 h-3.5 text-slate-400" />,
          },
          {
            label: "Execution Baseline Speed",
            value: pb
              ? `${fmtSeconds(pb.avg_duration_seconds)} → ${fmtSeconds(pb.latest_run_duration_seconds)}`
              : `${fmtSeconds(wl.avgSeconds)} → ${fmtSeconds(wl.lastSeconds)}`,
            valueClass: "text-rose-600",
            icon: <TrendingUp className="w-3.5 h-3.5 text-rose-500" />,
          },
          {
            label: "Estimated Monthly Cost",
            value:
              agentState !== "done"
                ? "Calculating…"
                : hdr?.estimated_monthly_cost !== null && hdr?.estimated_monthly_cost !== undefined
                  ? `${hdr.estimated_monthly_cost.toFixed(2)} ${hdr.currency ?? ""}/mo`.trim()
                  : "Not available",
            valueClass:
              agentState !== "done"
                ? "text-slate-400 italic animate-pulse"
                : "text-slate-800 font-bold",
            icon: <DollarSign className="w-3.5 h-3.5 text-emerald-500" />,
          },
        ].map(({ label, value, valueClass, icon }) => (
          <div key={label} className="bg-white p-4 flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-slate-50 border border-slate-100">{icon}</div>
            <div className="min-w-0">
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                {label}
              </span>
              <span
                className={`block text-xs font-semibold truncate ${valueClass || "text-slate-700"}`}
                title={value}
              >
                {value}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Idle Instruction View */}
      {agentState === "idle" && (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-white">
          {apiError ? (
            <>
              <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mb-3">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
              <p className="text-xs font-semibold text-rose-800 text-center">{apiError}</p>
              <p className="text-xs text-rose-600 text-center max-w-sm mt-1">
                Please try again or contact support if the issue persists.
              </p>
            </>
          ) : !pollUrl ? (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
              <p className="text-xs font-semibold text-slate-800 text-center">
                Initializing Analysis Engine
              </p>
              <p className="text-xs text-slate-500 text-center max-w-sm mt-1">
                Please wait while we prepare the analysis...
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-indigo-500" />
              </div>
              <p className="text-xs font-semibold text-slate-800 text-center">
                Engine Ready to Evaluate Workload
              </p>
              <p className="text-xs text-slate-500 text-center max-w-sm mt-1">
                Click <strong className="text-indigo-600 font-semibold">Analyze Workload</strong> to
                run the root cause, structural fault, and code refactoring agents against this
                workload's real telemetry.
              </p>
            </>
          )}
        </div>
      )}

      {/* Running state */}
      {agentState === "running" && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 bg-white">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-slate-100 border-t-indigo-600 animate-spin" />
            <Bot className="w-5 h-5 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-xs font-semibold text-slate-700">
            {pollStatus?.current_step
              ? toTitleCase(pollStatus.current_step)
              : "Preparing analysis..."}
          </p>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
            Status: {pollStatus?.status ?? "Running"}
          </span>
          {pollStatus?.active_agents && pollStatus.active_agents.length > 0 && (
            <span className="text-[11px] font-medium text-slate-500 text-center max-w-md">
              {pollStatus.active_agents.map(toTitleCase).join(", ")}
            </span>
          )}
        </div>
      )}

      {/* Done state — every value below comes straight from the analysis API */}
      {agentState === "done" && aiResult && (
        <div className="divide-y divide-slate-200 bg-white">
          {/* Pipeline Execution Telemetry — always-visible horizontal bar, no toggle */}
          {telemetry.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex-shrink-0">
                Analysis pipeline telemetry:
              </span>
              <div className="flex flex-wrap items-center gap-y-2 gap-x-4">
                {telemetry.map((t, i) => (
                  <div key={t.sequence} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-slate-800">
                      {toTitleCase(t.step)}
                    </span>
                    {i < telemetry.length - 1 && (
                      <span className="text-slate-300 hidden md:inline">/</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 1: Agent Recommendation Analysis */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Agent Recommendation Analysis
                </h3>
              </div>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded border border-indigo-100">
                {hdr?.pipeline_health ?? "Analyzed"}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" /> Core Bottleneck
                </span>
                {rec?.core_bottleneck ? (
                  typeof rec.core_bottleneck === "string" ? (
                    <p className="text-xs text-rose-950 font-medium leading-relaxed">
                      {rec.core_bottleneck}
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-xs text-rose-950 font-medium leading-relaxed">
                        {rec.core_bottleneck.description}
                      </p>
                    </div>
                  )
                ) : (
                  <p className="text-xs text-rose-950 font-medium leading-relaxed">
                    No significant bottleneck was identified for this run.
                  </p>
                )}
              </div>

              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-blue-700 flex items-center gap-1.5 mb-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  Code Recommendations
                </span>
                {rec && rec.recommendations.length > 0 ? (
                  <ul className="text-xs text-blue-950 font-medium leading-relaxed space-y-1 list-disc list-inside">
                    {rec.recommendations.map((rRaw, i) => {
                      const r = safeParseMaybeJSON(rRaw);
                      return (
                        <li key={i}>
                          {typeof r === "string"
                            ? r
                            : r.title || r.description || JSON.stringify(r)}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-blue-950 font-medium leading-relaxed">
                    No recommendations were generated for this workload.
                  </p>
                )}
              </div>

              <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-700 flex items-center gap-1.5 mb-1.5">
                  <BadgeCheck className="w-3.5 h-3.5" /> Configuration Recommendations
                </span>
                {rec?.compilation_adjustment ? (
                  typeof rec.compilation_adjustment === "string" ? (
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                      {rec.compilation_adjustment}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                      {rec.compilation_adjustment.description ||
                        rec.compilation_adjustment.summary ||
                        JSON.stringify(rec.compilation_adjustment)}
                    </p>
                  )
                ) : (
                  <p className="text-xs text-emerald-950 font-medium leading-relaxed">
                    No compilation adjustments were required for this run.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Structural Faults */}
          <div className="p-6 bg-slate-50/30">
            <button
              onClick={() => toggleSec("faults")}
              className="w-full flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800 mb-3"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Structural Faults Detected ({faultsCount})
              </span>
              {openSecs.faults ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {openSecs.faults &&
              (faults.length > 0 ? (
                <div className="space-y-3">
                  {faults.map((iss, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-lg p-3 border border-slate-200 flex items-start gap-3"
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${iss.severity === "critical" ? "bg-rose-500" : iss.severity === "high" ? "bg-amber-500" : "bg-blue-400"}`}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900">{iss.title}</span>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${iss.severity === "critical" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"}`}
                          >
                            {iss.severity}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{iss.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  No structural faults were detected for this workload.
                </p>
              ))}
          </div>

          {/* Section 3: Code Refactoring Plan */}
          <div className="p-6">
            <button
              onClick={() => toggleSec("code")}
              className="w-full flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800 mb-3"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-indigo-500" /> Code Refactoring Plan (
                {refactorPlan.length})
              </span>
              {openSecs.code ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {openSecs.code &&
              (refactorPlan.length > 0 ? (
                <div className="space-y-4">
                  {refactorPlan.map((item, i) => {
                    // "Before" code — what's currently deployed
                    const beforeCode =
                      item.baseline_script || item.original_code || item.before || "";
                    // "After" code — auto_generated_patch is a plain code string
                    // in the API response, not fix metadata.
                    const afterCode =
                      typeof item.auto_generated_patch === "string"
                        ? item.auto_generated_patch
                        : item.optimized_code || item.after || "";
                    const label =
                      item.activity_name ||
                      item.title ||
                      item.target ||
                      item.file_name ||
                      `Change ${i + 1}`;

                    return (
                      <div key={i} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-900">{label}</span>
                        </div>

                        {beforeCode || afterCode ? (
                          <div
                            className={`grid grid-cols-1 gap-3 ${afterCode ? "lg:grid-cols-2" : ""}`}
                          >
                            {/* Before */}
                            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-950">
                              <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                                <span className="text-[10px] uppercase tracking-wider font-bold text-rose-400">
                                  BASELINE SCRIPT (UNOPTIMIZED)
                                </span>
                                {beforeCode && (
                                  <button
                                    onClick={() => copyText(beforeCode, `before-${i}`)}
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                                  >
                                    {copied === `before-${i}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                              {beforeCode ? (
                                <pre className="p-4 overflow-x-auto text-[11px] font-mono text-slate-200 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre">
                                  {beforeCode}
                                </pre>
                              ) : (
                                <p className="p-4 text-xs text-slate-500 font-medium">
                                  No baseline code available.
                                </p>
                              )}
                            </div>

                            {/* After — only rendered when the backend actually returned a patch */}
                            {afterCode && (
                              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-slate-950">
                                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                                    AUTO-GENERATED PATCH (COMPILE SUCCESS)
                                  </span>
                                  <button
                                    onClick={() => copyText(afterCode, `after-${i}`)}
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all"
                                  >
                                    {copied === `after-${i}` ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <pre className="p-4 overflow-x-auto text-[11px] font-mono text-slate-200 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre">
                                  {afterCode}
                                </pre>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 font-medium">
                            No code was returned for this change.
                          </p>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 font-semibold">
                      Verify code semantics before updating cloud run paths.
                    </span>
                    <button
                      onClick={onApply}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        isApplied
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-100"
                      }`}
                    >
                      {isApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Patch Applied
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 fill-current" /> Apply Code Optimization Patch
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  No code refactoring recommendations were generated for this workload.
                </p>
              ))}
          </div>

          {/* Section 4: Baseline / performance metrics — all real numbers */}
          <div className="p-6 bg-slate-50/20">
            <button
              onClick={() => toggleSec("metrics")}
              className="w-full flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800 mb-3"
            >
              <span className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-emerald-500" />
                Baseline & Run Metrics
              </span>
              {openSecs.metrics ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {openSecs.metrics &&
              (pb ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-sans">
                  {[
                    { label: "Avg Duration", value: fmtSeconds(pb.avg_duration_seconds) },
                    { label: "Median Duration", value: fmtSeconds(pb.median_duration_seconds) },
                    { label: "P95 Duration", value: fmtSeconds(pb.p95_duration_seconds) },
                    { label: "Latest Run", value: fmtSeconds(pb.latest_run_duration_seconds) },
                    {
                      label: "Min / Max",
                      value: `${fmtSeconds(pb.min_duration_seconds)} / ${fmtSeconds(pb.max_duration_seconds)}`,
                    },
                    {
                      label: "Deviation",
                      value: `${pb.deviation_pct.toFixed(2)}% (${fmtSeconds(pb.deviation_seconds)})`,
                    },
                    { label: "Success Rate", value: `${pb.success_rate_pct}%` },
                    {
                      label: "Runs Analyzed",
                      value: `${pb.total_runs_available} (${pb.baseline_window}d window)`,
                    },
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-lg p-3 border border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        {m.label}
                      </span>
                      <span className="text-sm font-extrabold text-slate-800">{m.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  No baseline metrics were returned for this run.
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
function WorkspaceCostPanel({
  entry,
  workspace,
  resourceGroup,
  service,
  isApplied,
  onApply,
  cacheEntry,
  onCacheUpdate,
  investigationId,
}: {
  entry: CostConsumptionDetail;
  workspace: Workspace;
  resourceGroup: ResourceGroup;
  service: Service;
  isApplied: boolean;
  onApply: () => void;
  cacheEntry?: CostCacheEntry;
  onCacheUpdate: (entry: Partial<CostCacheEntry>) => void;
  investigationId?: string;
}) {
  const [state, setState] = useState<"loading" | "done" | "error">(cacheEntry?.state ?? "loading");
  const [result, setResult] = useState<CostPanelViewModel | null>(cacheEntry?.result ?? null);
  const [error, setError] = useState<string | null>(cacheEntry?.error ?? null);
  const [openSecs, setOpenSecs] = useState({ recs: true });

  const agentsBaseUrl = "https://uc3-agents-bgbsfqbbgkfeabfq.eastus-01.azurewebsites.net";

  function toggleSec(k: keyof typeof openSecs) {
    setOpenSecs((s) => ({ ...s, [k]: !s[k] }));
  }

  // Fresh run → POST returns the flat CostInvestigationResult shape.
  async function runFreshInvestigation() {
    setState("loading");
    onCacheUpdate({ state: "loading", result: null, error: null });
    try {
      const raw = await postCostInvestigation(entry);
      const vm = normalizeFreshCostResult(raw);
      setResult(vm);
      setState("done");
      onCacheUpdate({ result: vm, state: "done", error: null });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Cost investigation failed";
      setError(msg);
      setState("error");
      onCacheUpdate({ error: msg, state: "error", result: null });
    }
  }

  // "View Fix" on an already-investigated workspace → GET now returns the
  // SAME flat CostInvestigationResult shape as the fresh POST, wrapped in
  // `analysis`. So it goes through the same normalizer as the fresh run.
  async function loadCachedCostAnalysis(id: string) {
    setState("loading");
    onCacheUpdate({ state: "loading", result: null, error: null });
    try {
      const subId = workspace.subscriptionId || resourceGroup.subscriptionId || "";
      const serviceKey = serviceCostKey(service.id);
      const res = await fetch(
        `${agentsBaseUrl}/api/subscriptions/${subId}/services/${serviceKey}/cost-investigations/${id}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) throw new Error(`Failed to load cached cost analysis (${res.status})`);
      const data: CachedCostInvestigationResponse = await res.json();
      if (!data?.analysis) throw new Error("Cached cost analysis was empty");
      const vm = normalizeFreshCostResult(data.analysis);
      setResult(vm);
      setState("done");
      onCacheUpdate({ result: vm, state: "done", error: null });
    } catch (err) {
      console.error("Cached cost analysis fetch failed, falling back to a fresh run:", err);
      void runFreshInvestigation();
    }
  }

  async function handleRerun() {
    setResult(null);
    setError(null);
    await runFreshInvestigation();
  }

  useEffect(() => {
    if (cacheEntry?.state === "done" || cacheEntry?.state === "loading") return;
    if (investigationId) {
      void loadCachedCostAnalysis(investigationId);
    } else {
      void runFreshInvestigation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entry.subscription_id,
    entry.service,
    entry.resource_group,
    entry.workspace_name,
    investigationId,
  ]);

  const currency = result?.currency ?? entry.currency ?? "INR";
  const recommendations = result?.recommendations ?? [];
  const rootCauses = result?.root_causes ?? [];

  return (
    <div className="bg-slate-50/50 border-t border-slate-200">
      <div className="flex items-center justify-between gap-4 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-100 flex-shrink-0">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-950 uppercase tracking-wider">
              Cost Investigation Agent
            </span>
            <p className="text-xs text-slate-500 font-medium">
              {service.name} · {resourceGroup.name} · {workspace.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {state === "done" && (
            <button
              onClick={handleRerun}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Rerun Analysis
            </button>
          )}
          <button
            onClick={onApply}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
              isApplied
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <BadgeCheck className="w-4 h-4 text-emerald-500" />
            {isApplied ? "Target Resolved" : "Flag as Manually Applied"}
          </button>
        </div>
      </div>

      {state === "loading" && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-white">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          <p className="text-xs font-semibold text-slate-700">Running cost investigation…</p>
        </div>
      )}

      {state === "error" && (
        <div className="flex flex-col items-center justify-center py-12 px-6 bg-white">
          <AlertTriangle className="w-5 h-5 text-rose-500 mb-2" />
          <p className="text-xs font-semibold text-rose-800">{error}</p>
        </div>
      )}

      {state === "done" && result && (
        <div className="divide-y divide-slate-200 bg-white">
          {/* Root Causes */}
          {rootCauses.length > 0 && (
            <div className="p-6 bg-slate-50/30">
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Root Causes
              </span>
              <div className="space-y-2">
                {rootCauses.map((rc, i) => (
                  <div key={i} className="bg-white rounded-lg p-3 border border-slate-200">
                    <p className="text-xs text-slate-700 leading-relaxed">{rc.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendations — from action_roadmap (fresh) or suggested_fixes
              (fallback), both normalized into the same shape */}
          <div className="p-6">
            <button
              onClick={() => toggleSec("recs")}
              className="w-full flex items-center justify-between font-bold text-xs uppercase tracking-wider text-slate-800 mb-3"
            >
              <span className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-indigo-500" /> Recommended Steps to Fix (
                {recommendations.length})
              </span>
              {openSecs.recs ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {openSecs.recs &&
              (recommendations.length > 0 ? (
                <div className="space-y-3">
                  {recommendations.map((item, i) => (
                    <div key={i} className="border border-slate-200 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-slate-900">{item.title}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {item.estimated_gain_pct !== undefined && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600">
                              ~{item.estimated_gain_pct}% gain
                            </span>
                          )}
                          {item.effort && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                              {item.effort} effort
                            </span>
                          )}
                          {item.risk && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">
                              {item.risk} risk
                            </span>
                          )}
                          {item.confidence !== undefined && (
                            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-500">
                              {Math.round(item.confidence * 100)}% confidence
                            </span>
                          )}
                        </div>
                      </div>
                      {item.target_activity && (
                        <p className="text-[10px] text-slate-400 font-semibold mb-2">
                          Target: {item.target_activity}
                        </p>
                      )}
                      <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-medium">
                  No recommendations were generated for this workspace.
                </p>
              ))}
          </div>
          {result.executive_summary && (
            <div className="p-6">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" /> Investigation Findings
              </span>
              <div className="bg-gradient-to-br from-indigo-50/60 to-emerald-50/40 border border-indigo-100 rounded-xl p-4 max-h-72 overflow-y-auto">
                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap font-medium">
                  {result.executive_summary}
                </p>
              </div>
            </div>
          )}

          {/* KPI grid */}
          <div className="p-6 bg-slate-50/20 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Current Month Cost",
                value: fmtCurrency(result.current_month_cost, currency),
              },
              {
                label: "Estimated Monthly Cost",
                value: fmtCurrency(result.estimated_monthly_cost, currency),
              },
              {
                label: "Forecast Deviation",
                value:
                  result.forecast_deviation_pct !== null
                    ? `${result.forecast_deviation_pct! >= 0 ? "+" : ""}${result.forecast_deviation_pct!.toFixed(2)}% (${fmtCurrency(result.forecast_deviation, currency)})`
                    : "—",
              },
              {
                label: "Forecast Status",
                value: result.forecast_status
                  ? (COST_STATUS_LABEL[result.forecast_status] ?? result.forecast_status)
                  : "—",
              },
            ].map((m) => (
              <div key={m.label} className="bg-white rounded-lg p-3 border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                  {m.label}
                </span>
                <span className="text-xs font-extrabold text-slate-800 break-all">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AI Recommendation Panel ─────────────────────────────────────────────────
function AIRecommendationPanel({
  wl,
  isApplied,
  onApply,
  service,
  resourceGroup,
  workspace,
  subscriptionId,
  costLookup,
  cacheEntry,
  onCacheUpdate,
  investigationId,
}: {
  wl: Workload;
  isApplied: boolean;
  onApply: () => void;
  service: Service;
  resourceGroup: ResourceGroup;
  workspace: Workspace;
  subscriptionId: string;
  costLookup?: Map<string, CostConsumptionDetail>;
  cacheEntry?: AgentCacheEntry;
  onCacheUpdate: (entry: Partial<AgentCacheEntry>) => void;
  investigationId?: string;
}) {
  const baseVal = fmtSeconds(wl.avgSeconds);
  const lastVal = fmtSeconds(wl.lastSeconds);

  return (
    <tr className="bg-slate-50/55">
      <td colSpan={9} className="p-0 border-b border-slate-200">
        <div className="bg-white">
          {/* Quick Stats panel before agent details */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200/60 font-sans">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Run Variance
                </span>
                <span className="text-xs font-bold bg-slate-200 px-2 py-0.5 rounded text-slate-700">
                  {baseVal} avg baseline
                </span>
                <span className="text-xs text-slate-400">→</span>
                <span className="text-xs font-bold bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded">
                  {lastVal} last run
                </span>
              </div>
              <div className="w-px h-4 bg-slate-300 hidden md:block" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {wl.impact.map((imp: string) => (
                  <span
                    key={imp}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded-full"
                  >
                    <TrendingDown className="w-2.5 h-2.5" /> {imp}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={onApply}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all self-end md:self-auto ${
                isApplied
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm"
              }`}
            >
              <BadgeCheck className="w-4 h-4 text-emerald-500" />
              {isApplied ? "Target Resolved" : "Flag as Manually Applied"}
            </button>
          </div>

          <AgentAnalysisPanel
            wl={wl}
            isApplied={isApplied}
            onApply={onApply}
            service={service}
            resourceGroup={resourceGroup}
            workspace={workspace}
            subscriptionId={subscriptionId}
            costLookup={costLookup}
            cacheEntry={cacheEntry}
            onCacheUpdate={onCacheUpdate}
            investigationId={investigationId}
          />
        </div>
      </td>
    </tr>
  );
}

const SERVICE_ID_TO_COST_KEY: Record<string, string> = {
  syn: "synapse",
  dbr: "databricks",
  adf: "adf",
};
function serviceCostKey(serviceId: string): string {
  return SERVICE_ID_TO_COST_KEY[serviceId] || serviceId;
}

function fmtCurrency(amount: number | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `${amount.toFixed(2)} ${currency}`;
}

const COST_STATUS_LABEL: Record<string, string> = {
  above_baseline: "Above Baseline",
  below_baseline: "Below Baseline",
  at_baseline: "At Baseline",
};
const COST_STATUS_RANK: Record<string, number> = {
  above_baseline: 0,
  at_baseline: 1,
  below_baseline: 2,
};

function isUnhealthyState(h: ApiHealth | null | undefined): boolean {
  return h === "Warning" || h === "Critical" || h === "Severe";
}

function CostStatusBadge({ status }: { status: string }) {
  const cls =
    status === "above_baseline"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : status === "below_baseline"
        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
        : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  const dot =
    status === "above_baseline"
      ? "bg-rose-500"
      : status === "below_baseline"
        ? "bg-emerald-500"
        : "bg-slate-400";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${cls}`}
    >
      <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
      {COST_STATUS_LABEL[status] ?? status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export interface SubscriptionOption {
  id: string;
  name: string;
}

export interface WorkloadOptimizationProps {
  data: Service[];
  subscriptions: SubscriptionOption[];
  user: { name: string; email: string; initials: string };
  onLogout: () => void;
  loading?: boolean;
  costLookup?: Map<string, CostConsumptionDetail>;
  runtimeInvestigationLookup?: Map<string, string>;
  costInvestigationLookup?: Map<string, string>;
}

type SortKey = "none" | "last" | "health" | "deviation";
type SortDir = "asc" | "desc";
type DeviationMode = "runtime" | "cost";

// The four summary tiles, each pulling from a distinct dimension of the data
// so they never restate one another: health, reliability, scope, and volume.
type TileKey = "healthy" | "highdeviation" | "services" | "totalruns";

// NOTE: getCostEntry / workspaceCostMatches previously lived here at module
// scope, but they need `costLookup`, `search`, and `filterDev` — all of
// which are component state/props. They are now defined INSIDE
// WorkloadOptimization, right after `toggle`. See below.

export default function WorkloadOptimization({
  data,
  subscriptions,
  user,
  onLogout,
  loading = false,
  costLookup,
  runtimeInvestigationLookup,
  costInvestigationLookup,
}: WorkloadOptimizationProps) {
  const SERVICE_DISPLAY_ORDER: Record<string, number> = { syn: 0, dbr: 1, adf: 2 };
  const DATA = [...data].sort(
    (a, b) =>
      (SERVICE_DISPLAY_ORDER[a.id] ?? Number.MAX_SAFE_INTEGER) -
      (SERVICE_DISPLAY_ORDER[b.id] ?? Number.MAX_SAFE_INTEGER),
  );
  const [openSvc, setOpenSvc] = useState<Set<string>>(new Set(DATA.map((s) => s.id)));
  const [openRG, setOpenRG] = useState<Set<string>>(new Set());
  const [openWs, setOpenWs] = useState<Set<string>>(new Set());
  const [openWl, setOpenWl] = useState<Set<string>>(new Set());
  const [openAI, setOpenAI] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [filterSvc, setFilterSvc] = useState("");
  const [filterSub, setFilterSub] = useState("all");
  const [filterDev, setFilterDev] = useState<"all" | "high" | "mod" | "low">("all");
  const [topScope, setTopScope] = useState<"top5" | "all">("top5");
  const [sortKey, setSortKey] = useState<SortKey>("none");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "applied" | "cost">("all");
  const [tileFilter, setTileFilter] = useState<null | TileKey>(null);
  const [deviationMode, setDeviationMode] = useState<DeviationMode>("runtime");
  const [openCostAI, setOpenCostAI] = useState<Set<string>>(new Set());
  const [appliedCost, setAppliedCost] = useState<Set<string>>(new Set());
  const seenSvcIdsRef = useRef<Set<string>>(new Set(DATA.map((s) => s.id)));
  // Keep open-service set in sync when the dataset changes.
  useEffect(() => {
    const newIds = DATA.map((s) => s.id).filter((id) => !seenSvcIdsRef.current.has(id));
    if (newIds.length > 0) {
      setOpenSvc((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.add(id));
        return next;
      });
      newIds.forEach((id) => seenSvcIdsRef.current.add(id));
    }
  }, [DATA]);

  type AgentCacheEntry = {
    agentState: "idle" | "running" | "done";
    aiResult: AnalysisResult | null;
    pollUrl: string | null;
    apiError: string | null;
  };
  const [analysisCache, setAnalysisCache] = useState<Map<string, AgentCacheEntry>>(new Map());

  function updateAnalysisCache(id: string, entry: Partial<AgentCacheEntry>) {
    setAnalysisCache((prev) => {
      const next = new Map(prev);
      next.set(id, {
        ...(next.get(id) ?? { agentState: "idle", aiResult: null, pollUrl: null, apiError: null }),
        ...entry,
      });
      return next;
    });
  }

  type CostCacheEntry = {
    state: "loading" | "done" | "error";
    result: CostPanelViewModel | null;
    error: string | null;
  };
  const [costAnalysisCache, setCostAnalysisCache] = useState<Map<string, CostCacheEntry>>(
    new Map(),
  );

  function updateCostAnalysisCache(id: string, entry: Partial<CostCacheEntry>) {
    setCostAnalysisCache((prev) => {
      const next = new Map(prev);
      next.set(id, {
        ...(next.get(id) ?? { state: "loading", result: null, error: null }),
        ...entry,
      });
      return next;
    });
  }

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  }

  // ── Cost-mode helpers ──────────────────────────────────────────────────
  // These live INSIDE the component (unlike the earlier draft) because they
  // depend on `costLookup`, `search`, and `filterDev`, which only exist here.
  function getCostEntry(
    svc: Service,
    rg: ResourceGroup,
    ws: Workspace,
  ): CostConsumptionDetail | null {
    if (!costLookup) return null;
    const subId = ws.subscriptionId || rg.subscriptionId || "";
    const key = `${subId}::${serviceCostKey(svc.id)}::${rg.name}::${ws.name}`;
    return costLookup.get(key) ?? null;
  }

  function workspaceCostMatches(svc: Service, rg: ResourceGroup, ws: Workspace): boolean {
    const q = search.toLowerCase();
    if (q && !ws.name.toLowerCase().includes(q)) return false;
    const entry = getCostEntry(svc, rg, ws);
    if (!entry) return false;
    if (filterDev !== "all") {
      const a = Math.abs(entry.deviation.deviation_pct);
      if (filterDev === "high" && !(a > 70)) return false;
      if (filterDev === "mod" && !(a > 30 && a <= 70)) return false;
      if (filterDev === "low" && !(a <= 30)) return false;
    }
    if (tileFilter === "healthy" && entry.deviation.status === "above_baseline") return false;
    if (tileFilter === "highdeviation" && entry.deviation.status !== "above_baseline") return false;
    return true;
  }

  function expandAll() {
    setOpenSvc(new Set(DATA.map((s) => s.id)));
    setOpenRG(new Set(DATA.flatMap((s) => s.resourceGroups.map((rg) => rg.id))));
    setOpenWs(
      new Set(
        DATA.flatMap((s) => s.resourceGroups.flatMap((rg) => rg.workspaces.map((ws) => ws.id))),
      ),
    );
    setOpenWl(
      new Set(
        DATA.flatMap((s) =>
          s.resourceGroups.flatMap((rg) =>
            rg.workspaces.flatMap((ws) => ws.workloads.map((w) => w.id)),
          ),
        ),
      ),
    );
  }

  function collapseAll() {
    setOpenSvc(new Set());
    setOpenRG(new Set());
    setOpenWs(new Set());
    setOpenWl(new Set());
    setOpenAI(new Set());
    setOpenCostAI(new Set());
  }

  const appliedCount = applied.size;

  // Cost mode vs runtime mode — computed once per render, used by the KPI
  // tiles below AND the DATA.forEach render loop further down.
  const isCost = deviationMode === "cost";

  const scopedWorkloads = DATA.flatMap((s) => s.resourceGroups)
    .filter((rg) => filterSub === "all" || rg.subscriptionId === filterSub)
    .flatMap((rg) => rg.workspaces)
    .flatMap((ws) => ws.workloads);

  const scopedCostEntries: CostConsumptionDetail[] = [];
  DATA.forEach((svc) => {
    svc.resourceGroups
      .filter((rg) => filterSub === "all" || rg.subscriptionId === filterSub)
      .forEach((rg) => {
        rg.workspaces.forEach((ws) => {
          const entry = getCostEntry(svc, rg, ws);
          if (entry) scopedCostEntries.push(entry);
        });
      });
  });

  // One unified list of deviation % values — pulled from whichever mode is
  // active. Runtime uses apiDeviationPct, cost uses deviation.deviation_pct.
  // Everything below reads from this single list, so the KPIs never care
  // about health status or cost status — only the deviation number itself.
  const scopedDeviations: number[] = isCost
    ? scopedCostEntries.map((e) => e.deviation.deviation_pct)
    : scopedWorkloads
        .map((w) => w.apiDeviationPct)
        .filter((d): d is number => d !== null && d !== undefined);

  // Tile 1 — moderate-or-worse deviation (>30%, same threshold as the
  // "Moderate" bucket in the deviation filter dropdown).
  const needsAttentionCount = scopedDeviations.filter((d) => Math.abs(d) > 30).length;

  // Tile 2 — high deviation (>70%, same threshold used elsewhere).
  const highDeviationCount = isCost
    ? scopedCostEntries.filter((e) => e.deviation.status === "above_baseline").length
    : scopedWorkloads.filter((w) => isUnhealthyState(w.apiHealth)).length;
  const healthyCount = isCost
    ? scopedCostEntries.filter((e) => e.deviation.status !== "above_baseline").length
    : scopedWorkloads.filter((w) => w.apiHealth === "Healthy").length;
  // Tile 3 — scope indicator, same for both modes.
  const scopedServicesCount = DATA.filter((s) =>
    s.resourceGroups.some((rg) => filterSub === "all" || rg.subscriptionId === filterSub),
  ).length;

  // Tile 4 — total items with deviation data tracked in this mode.
  const totalRunsTracked = isCost
    ? scopedCostEntries.length
    : scopedWorkloads.reduce((sum, w) => sum + w.runs.length, 0);

  const tiles = [
    {
      key: "highdeviation" as const,
      label: isCost ? "Workspaces with High Deviation" : " High Deviation Workloads",
      value: highDeviationCount,
      icon: AlertTriangle,
      accent: "rose",
      filterable: true,
      description: isCost
        ? "Workspaces whose cost is currently above baseline."
        : "Workloads currently in Warning, Critical, or Severe health state.",
    },
    {
      key: "healthy" as const,
      label: isCost ? "Healthy Workspaces" : "Healthy Worloads",
      value: healthyCount,
      icon: CheckCircle2,
      accent: "emerald",
      filterable: true,
      description: isCost
        ? "Workspaces currently at or below their cost baseline."
        : "Workloads currently reporting a Healthy status.",
    },
    {
      key: "services" as const,
      label: " Azure Services Monitored",
      value: scopedServicesCount,
      icon: Layers,
      accent: "indigo",
      filterable: false,
      description: "Distinct Azure services covered by the current subscription filter.",
    },
    {
      key: "totalruns" as const,
      label: isCost ? "Workspaces Tracked" : "Workloads Analyzed",
      value: isCost ? scopedCostEntries.length : scopedWorkloads.length,
      icon: Activity,
      accent: "emerald",
      filterable: false,
      description: isCost
        ? "Total workspaces with cost data in the current scope."
        : "Total workloads with runtime data in the current scope.",
    },
  ];
  const rows: React.ReactNode[] = [];

  // Does an individual workload pass the search / tab / health / deviation filters?
  function workloadMatches(wl: Workload): boolean {
    const q = search.toLowerCase();
    if (q && !wl.name.toLowerCase().includes(q)) return false;

    const isWlApplied = applied.has(wl.id);
    if (activeTab === "pending" && (!wl.saveCost || isWlApplied)) return false;
    if (activeTab === "applied" && !isWlApplied) return false;

    const dev = wl.apiDeviationPct;

    if (filterDev !== "all") {
      const a = dev === null ? null : Math.abs(dev);
      if (a === null) return false;
      if (filterDev === "high" && !(a > 70)) return false;
      if (filterDev === "mod" && !(a > 30 && a <= 70)) return false;
      if (filterDev === "low" && !(a <= 30)) return false;
    }

    // Summary-tile quick filters. "services" and "totalruns" are scope/volume
    // tiles, not per-workload predicates, so they don't filter rows (see
    // `filterable: false` above — they're rendered as non-clickable info cards).
    if (tileFilter === "healthy" && wl.apiHealth !== "Healthy") return false;
    if (tileFilter === "highdeviation" && !isUnhealthyState(wl.apiHealth)) return false;

    return true;
  }

  // True when any filter that operates on workloads is active, so parent rows
  // should only render when they contain a matching workload.
  const filtersWorkloads =
    search !== "" || activeTab !== "all" || filterDev !== "all" || tileFilter !== null;

  function sortWorkloads(list: Workload[]): Workload[] {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === "none") {
      return [...list].sort(
        (a, b) =>
          (API_HEALTH_RANK[a.apiHealth ?? "Healthy"] ?? 3) -
          (API_HEALTH_RANK[b.apiHealth ?? "Healthy"] ?? 3),
      );
    }
    return [...list].sort((a, b) => {
      let av = 0;
      let bv = 0;
      if (sortKey === "last") {
        av = a.lastSeconds ?? 0;
        bv = b.lastSeconds ?? 0;
      } else if (sortKey === "deviation") {
        av = Math.abs(a.apiDeviationPct ?? 0);
        bv = Math.abs(b.apiDeviationPct ?? 0);
      } else if (sortKey === "health") {
        av = API_HEALTH_RANK[a.apiHealth ?? "Healthy"];
        bv = API_HEALTH_RANK[b.apiHealth ?? "Healthy"];
      }
      return (av - bv) * dir;
    });
  }

  // Cost mode vs runtime mode — computed once per render, used throughout
  // the DATA.forEach loop below to branch rendering at the workspace level.
  // Global Top-5 by |deviation|, respecting the current service/subscription
  // filters — computed once per render, reused across every service section.
  const topScopeIds = new Set<string>();
  if (topScope === "top5") {
    DATA.filter((svc) => !filterSvc || svc.id === filterSvc).forEach((svc) => {
      const svcWorkloads = svc.resourceGroups
        .filter((rg) => filterSub === "all" || rg.subscriptionId === filterSub)
        .flatMap((rg) => rg.workspaces)
        .flatMap((ws) => ws.workloads)
        .filter((w) => isUnhealthyState(w.apiHealth));

      [...svcWorkloads]
        .sort((a, b) => Math.abs(b.apiDeviationPct ?? 0) - Math.abs(a.apiDeviationPct ?? 0))
        .slice(0, 5)
        .forEach((w) => topScopeIds.add(w.id));
    });
  }

  DATA.forEach((svc) => {
    // Service filter (operates on the merged service level).
    if (filterSvc && svc.id !== filterSvc) return;

    // Subscription filter now applies at the resource-group level, since a
    // merged service spans multiple subscriptions.
    const subResourceGroups =
      filterSub === "all"
        ? svc.resourceGroups
        : svc.resourceGroups.filter((rg) => rg.subscriptionId === filterSub);

    if (subResourceGroups.length === 0) return;

    const totalWl = subResourceGroups.reduce(
      (a, rg) => a + rg.workspaces.reduce((b, ws) => b + ws.workloads.length, 0),
      0,
    );
    const isWlVisible = (wl: Workload) =>
      workloadMatches(wl) && (topScope === "all" || topScopeIds.has(wl.id));
    const isSvcOpen = openSvc.has(svc.id);

    // ── Branch: cost mode matches at the workspace level, runtime mode at
    // the workload level ──────────────────────────────────────────────
    const hasWlMatch = isCost
      ? subResourceGroups.some((rg) =>
          rg.workspaces.some((ws) => workspaceCostMatches(svc, rg, ws)),
        )
      : subResourceGroups.some((rg) =>
          rg.workspaces.some((ws) => ws.workloads.some((wl) => isWlVisible(wl))),
        );

    if (!hasWlMatch) return;

    rows.push(
      <tr
        key={svc.id}
        className="bg-slate-50/75 hover:bg-slate-100/60 transition-colors border-b border-slate-200"
      >
        <td
          className="py-3.5 px-3 font-semibold text-slate-900"
          style={{ borderLeft: `4px solid ${svc.color}` }}
        >
          <div className="flex items-center gap-2">
            <ToggleBtn open={isSvcOpen} onClick={() => toggle(openSvc, svc.id, setOpenSvc)} />
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center border"
              style={{ background: svc.bg, borderColor: svc.color + "20" }}
            >
              {getServiceIcon(svc.id)}
            </div>
            <span className="text-xs font-extrabold text-slate-900 tracking-wide">{svc.name}</span>
          </div>
        </td>
        <td className="py-3.5 px-3" />
        <td className="py-3.5 px-3" />

        <td className="py-3.5 px-3 text-xs text-slate-400 font-medium" />
        <td className="py-3.5 px-3 text-xs text-slate-400 font-medium" />
        <td className="py-3.5 px-3 text-xs text-slate-400 font-medium" />
        <td className="py-3.5 px-3" />
        <td className="py-3.5 px-3 text-xs font-bold text-slate-500" />
      </tr>,
    );

    if (!isSvcOpen) return;

    subResourceGroups.forEach((rg) => {
      const isRGOpen = openRG.has(rg.id);

      const hasRGMatch = isCost
        ? rg.workspaces.some((ws) => workspaceCostMatches(svc, rg, ws))
        : rg.workspaces.some((ws) => ws.workloads.some((wl) => isWlVisible(wl)));

      if (!hasRGMatch) return;

      const rgTotalWl = rg.workspaces.reduce((a, ws) => a + ws.workloads.length, 0);

      // ── Resource Group row (new level) ─────────────────────────────────
      rows.push(
        <tr
          key={rg.id}
          className="bg-slate-100/70 hover:bg-slate-100 transition-colors border-b border-slate-200"
        >
          <td
            className="py-3 px-3"
            style={{ borderLeft: `4px solid ${svc.color}30`, paddingLeft: "2.25rem" }}
          >
            <div className="flex items-center gap-2">
              <ToggleBtn open={isRGOpen} onClick={() => toggle(openRG, rg.id, setOpenRG)} />
              <FolderTree className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-xs font-bold text-slate-800 truncate" title={rg.name}>
                {rg.name}
              </span>
            </div>
          </td>
          <td
            className="py-3 px-3 text-xs text-slate-500 font-semibold truncate"
            title={rg.subscriptionName}
          >
            {rg.subscriptionName ?? ""}
          </td>
          <td className="py-3 px-3">
            <span className="text-[10px] uppercase font-extrabold tracking-wider bg-slate-200/70 text-slate-500 px-2 py-0.5 rounded">
              Resource Group
            </span>
          </td>

          <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
          <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
          <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
          <td className="py-3 px-3" />
          <td className="py-3 px-3 text-xs text-slate-400 font-semibold" />
        </tr>,
      );

      if (!isRGOpen) return;

      rg.workspaces.forEach((ws) => {
        // ── COST MODE: render a single workspace-level row + panel, then
        // stop — cost data doesn't drill down into workloads/activities. ──
        if (isCost) {
          if (!workspaceCostMatches(svc, rg, ws)) return;
          const entry = getCostEntry(svc, rg, ws)!;
          const isWsOpen = openCostAI.has(ws.id);
          const isWsApplied = appliedCost.has(ws.id);

          rows.push(
            <tr
              key={ws.id}
              className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 ${
                isWsOpen ? "bg-slate-50/30" : "bg-white"
              }`}
            >
              <td
                className="py-3 px-3"
                style={{ borderLeft: `4px solid ${svc.color}20`, paddingLeft: "3.75rem" }}
              >
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate" title={ws.name}>
                    {ws.name}
                  </span>
                </div>
              </td>
              <td
                className="py-3 px-3 text-xs text-slate-500 font-semibold truncate"
                title={ws.subscriptionName}
              >
                {ws.subscriptionName ?? ""}
              </td>
              <td className="py-3 px-3 overflow-hidden">
                <TypePill label="Workspace" />
              </td>
              <td className="py-3 px-3 text-xs text-slate-800 font-bold">
                {fmtCurrency(entry.baseline_monthly_cost, entry.currency)}
              </td>
              <td className="py-3 px-3 text-xs text-slate-800 font-bold">
                {fmtCurrency(entry.last_30_days.total_cost, entry.currency)}
              </td>
              <td className="py-3 px-3 text-xs font-bold text-slate-700">
                {`${entry.deviation.deviation_pct >= 0 ? "+" : ""}${entry.deviation.deviation_pct.toFixed(2)}%`}
              </td>
              <td className="py-3 px-3">
                <CostStatusBadge status={entry.deviation.status} />
              </td>
              <td className="py-3 px-3">
                {entry.deviation.status !== "below_baseline" ? (
                  <button
                    onClick={() => toggle(openCostAI, ws.id, setOpenCostAI)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                      isWsApplied
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : isWsOpen
                          ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                          : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {isWsApplied ? "Applied ✓" : isWsOpen ? "Hide Fix" : "View Fix"}
                  </button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold">No action needed</span>
                )}
              </td>
            </tr>,
          );

          if (isWsOpen) {
            rows.push(
              <tr key={`${ws.id}-cost-ai`}>
                <td colSpan={9} className="p-0 border-b border-slate-200">
                  <WorkspaceCostPanel
                    entry={entry}
                    workspace={ws}
                    resourceGroup={rg}
                    service={svc}
                    isApplied={isWsApplied}
                    onApply={() => toggle(appliedCost, ws.id, setAppliedCost)}
                    cacheEntry={costAnalysisCache.get(ws.id)}
                    onCacheUpdate={(e) => updateCostAnalysisCache(ws.id, e)}
                    investigationId={costInvestigationLookup?.get(
                      `${ws.subscriptionId || rg.subscriptionId || ""}::${serviceCostKey(svc.id)}::${ws.name}`,
                    )}
                  />
                </td>
              </tr>,
            );
          }

          return; // cost mode stops at the workspace — no workload/activity drilldown
        }

        // ── RUNTIME MODE (unchanged): full Workspace → Workload → Activity
        // drill-down. ──────────────────────────────────────────────────
        const isWsOpen = openWs.has(ws.id);

        const hasWorkloadAfterFilter = ws.workloads.some((wl) => isWlVisible(wl));

        if (!hasWorkloadAfterFilter) return;

        rows.push(
          <tr
            key={ws.id}
            className="bg-white hover:bg-slate-50/50 transition-colors border-b border-slate-100"
          >
            <td
              className="py-3 px-3"
              style={{ borderLeft: `4px solid ${svc.color}20`, paddingLeft: "3.75rem" }}
            >
              <div className="flex items-center gap-2">
                <ToggleBtn open={isWsOpen} onClick={() => toggle(openWs, ws.id, setOpenWs)} />
                <Server className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-xs font-bold text-slate-800 truncate" title={ws.name}>
                  {ws.name}
                </span>
              </div>
            </td>
            <td
              className="py-3 px-3 text-xs text-slate-500 font-semibold truncate"
              title={ws.subscriptionName}
            >
              {ws.subscriptionName ?? ""}
            </td>
            <td className="py-3 px-3 overflow-hidden">
              <span className="text-[10px] uppercase font-extrabold tracking-wider bg-slate-200/70 text-slate-500 px-2 py-0.5 rounded">
                Workspace
              </span>
            </td>

            <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
            <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
            <td className="py-3 px-3 text-xs text-slate-400 font-medium" />
            <td className="py-3 px-3"></td>
            <td className="py-3 px-3 text-xs text-slate-400 font-semibold"></td>
          </tr>,
        );

        if (!isWsOpen) return;

        const sorted = sortWorkloads(ws.workloads);

        sorted.forEach((wl) => {
          if (!isWlVisible(wl)) return;

          const isWlApplied = applied.has(wl.id);
          const baseDisp = fmtSeconds(wl.avgSeconds);
          const lastDisp = fmtSeconds(wl.lastSeconds);

          const isWlOpen = openWl.has(wl.id);
          const isAIOpen = openAI.has(wl.id);

          const hasRec = isUnhealthyState(wl.apiHealth);

          rows.push(
            <tr
              key={wl.id}
              className={`hover:bg-slate-50/50 transition-colors border-b border-slate-100 ${isAIOpen ? "bg-slate-50/30" : "bg-white"}`}
            >
              <td
                className="py-3 px-3"
                style={{ borderLeft: `4px solid ${svc.color}15`, paddingLeft: "5.25rem" }}
              >
                <div className="flex items-center gap-2">
                  <ToggleBtn open={isWlOpen} onClick={() => toggle(openWl, wl.id, setOpenWl)} />
                  <Activity className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-slate-900 truncate" title={wl.name}>
                    {wl.name}
                  </span>
                </div>
              </td>
              <td
                className="py-3 px-3 text-xs text-slate-500 font-semibold truncate"
                title={ws.subscriptionName}
              >
                {ws.subscriptionName ?? ""}
              </td>
              <td className="py-3 px-3 overflow-hidden">
                <TypePill label={wl.wtype} />
              </td>

              <td className="py-3 px-3 text-xs text-slate-800 font-bold">{baseDisp}</td>
              <td className="py-3 px-3 text-xs text-slate-800 font-bold">{lastDisp}</td>
              <td className="py-3 px-3 text-xs font-bold text-slate-700">
                {fmtDeviation(wl.apiDeviationPct)}
              </td>
              <td className="py-3 px-3">
                {wl.apiHealth && <ApiHealthBadge health={wl.apiHealth} />}
              </td>
              <td className="py-3 px-3">
                {hasRec ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggle(openAI, wl.id, setOpenAI)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                        isWlApplied
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : isAIOpen
                            ? "border-slate-300 bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                            : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      {isWlApplied ? "Applied ✓" : isAIOpen ? "Hide Fix" : "View Fix"}
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold">No action needed</span>
                )}
              </td>
            </tr>,
          );

          if (hasRec && isAIOpen) {
            rows.push(
              <AIRecommendationPanel
                key={`${wl.id}-ai`}
                wl={wl}
                cacheEntry={analysisCache.get(wl.id)}
                onCacheUpdate={(entry) => updateAnalysisCache(wl.id, entry)}
                isApplied={isWlApplied}
                onApply={() => toggle(applied, wl.id, setApplied)}
                service={svc}
                resourceGroup={rg}
                workspace={ws}
                subscriptionId={ws.subscriptionId || ""}
                costLookup={costLookup}
                investigationId={runtimeInvestigationLookup?.get(
                  `${ws.subscriptionId || ""}::${serviceCostKey(svc.id)}::${wl.name}`,
                )}
              />,
            );
          }

          if (!isWlOpen) return;

          // Activities (Level 5 details) — only the API's own activities are
          // shown here now; the old synthetic "latest run" pseudo-row that
          // duplicated the workload's own baseline has been removed.
          wl.runs.forEach((run) => {
            rows.push(
              <tr
                key={run.id}
                className="bg-slate-50/40 hover:bg-slate-100/30 transition-colors border-b border-slate-100/50"
              >
                <td
                  className="py-2.5 px-3"
                  style={{ borderLeft: "4px solid transparent", paddingLeft: "6.75rem" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs text-slate-600 font-semibold truncate max-w-[220px]"
                      title={run.name}
                    >
                      {run.name}
                    </span>
                    {run.run_page_url && (
                      <a
                        href={run.run_page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                        title="External Run Profiler"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td
                  className="py-2.5 px-3 text-xs text-slate-500 font-semibold truncate"
                  title={ws.subscriptionName}
                >
                  {ws.subscriptionName ?? ""}
                </td>
                <td className="py-2.5 px-3 overflow-hidden">
                  <TypePill label={run.activityType} />
                </td>

                <td className="py-2.5 px-3 text-xs text-slate-700 font-bold">
                  {fmtSeconds(run.avgSeconds)}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-700 font-bold">
                  {fmtSeconds(run.lastSeconds)}
                </td>
                <td className="py-2.5 px-3 text-xs font-bold text-slate-500">
                  {fmtDeviation(run.apiDeviationPct)}
                </td>
                <td className="py-2.5 px-3">
                  {run.health ? (
                    <ApiHealthBadge health={run.health} />
                  ) : (
                    <StatusBadge status={run.status} />
                  )}
                </td>
                <td className="py-2.5 px-3 text-xs text-slate-400 italic font-medium"></td>
              </tr>,
            );
          });
        });
      });
    });
  });

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 font-sans">
      {/* ── Top header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4 flex-wrap sticky top-0 z-30">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-100 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            Azure Workload Intelligence
          </span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          <div className="text-right hidden sm:block leading-tight">
            <div className="text-sm font-bold text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
          <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {user.initials}
          </div>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-rose-600 font-semibold text-sm transition-colors"
          >
            <LogOut className="w-5 h-5" /> Logout
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-2">
        {loading && (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading workloads
            </span>
          </div>
        )}

        {/* Summary tiles */}
        <div className="flex gap-3 overflow-x-auto pb-1">
          {tiles.map((t) => {
            const Icon = t.icon;
            const active = t.filterable && tileFilter === t.key;
            const a = TILE_ACCENTS[t.accent as keyof typeof TILE_ACCENTS];
            return (
              <button
                key={t.key}
                onClick={() => t.filterable && setTileFilter(active ? null : t.key)}
                aria-pressed={t.filterable ? active : undefined}
                disabled={!t.filterable}
                title={t.description}
                className={`flex-1 min-w-[210px] shrink-0 text-left bg-white border rounded-2xl p-4 shadow-sm transition-all ${
                  t.filterable ? "cursor-pointer" : "cursor-default"
                } ${active ? `${a.activeBorder} ring-2 ${a.ring}` : "border-slate-200 hover:border-slate-300"} ${
                  !t.filterable ? "hover:border-slate-200" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">
                      {t.label}
                    </div>
                    <div className="mt-1 text-2xl font-extrabold text-slate-900">{t.value}</div>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${a.iconText}`} />
                  </div>
                </div>
                <div
                  className={`mt-2 text-[11px] font-bold ${t.filterable && active ? a.iconText : "text-transparent"}`}
                >
                  {t.filterable ? "Filter active · click to clear" : "\u00A0"}
                </div>
              </button>
            );
          })}
        </div>

        {/* Controls & Tools Bar — single compact row */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto">
            {/* Search */}
            <div className="relative flex-1 min-w-[160px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workloads..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium"
              />
            </div>

            {/* Expand / Collapse — icon only */}
            {/* <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={expandAll}
                title="Expand all"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <ChevronsUpDown className="w-4 h-4" />
              </button>
              <button
                onClick={collapseAll}
                title="Collapse all"
                className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all"
              >
                <ChevronsDownUp className="w-4 h-4" />
              </button>
            </div> */}

            {/* Subscription filter */}
            <div className="relative min-w-[150px] shrink-0">
              <Layers className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filterSub}
                onChange={(e) => setFilterSub(e.target.value)}
                className="appearance-none w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium cursor-pointer"
                aria-label="Filter by subscription"
              >
                <option value="all">All subscriptions</option>
                {subscriptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Service filter */}
            <div className="relative min-w-[130px] shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filterSvc}
                onChange={(e) => setFilterSvc(e.target.value)}
                className="appearance-none w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium cursor-pointer"
                aria-label="Filter by service"
              >
                <option value="">All services</option>
                {Array.from(new Map(DATA.map((s) => [s.id, s])).values()).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Top scope filter */}
            <div className="relative min-w-[130px] shrink-0">
              <Layers className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={topScope}
                onChange={(e) => setTopScope(e.target.value as "top5" | "all")}
                className="appearance-none w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium cursor-pointer"
                aria-label="Filter by scope"
              >
                <option value="top5">Top 5 Deviations</option>
                <option value="all">All Deviations </option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Deviation type (runtime vs cost) — now inline with the rest */}
            <div className="relative min-w-[170px] shrink-0">
              <Gauge className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={deviationMode}
                onChange={(e) => setDeviationMode(e.target.value as DeviationMode)}
                className="appearance-none w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium cursor-pointer"
                aria-label="Deviation type"
              >
                <option value="runtime">Runtime Deviation</option>
                <option value="cost">Cost Deviation</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            {/* Deviation filter */}
            {/* <div className="relative min-w-[150px] shrink-0">
              <TrendingUp className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={filterDev}
                onChange={(e) => setFilterDev(e.target.value as "all" | "high" | "mod" | "low")}
                className="appearance-none w-full pl-8 pr-7 py-1.5 text-sm border border-slate-200 rounded-lg bg-slate-50/60 text-slate-800 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100/50 transition-all font-medium cursor-pointer"
                aria-label="Filter by deviation"
              >
                <option value="all">All deviations</option>
                <option value="high">High (&gt;70%)</option>
                <option value="mod">Moderate (30% – 70%)</option>
                <option value="low">Ok (&lt;30%)</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div> */}
          </div>
        </div>

        {/* Drilldown Nested Table Container */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="max-w-full max-h-[70vh] overflow-auto">
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col style={{ width: "26%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
                  <th className="text-left py-3 px-3">Name</th>
                  <th className="text-left py-3 px-3">Subscription</th>
                  <th className="text-left py-3 px-3">Type</th>

                  <th className="text-left py-3 px-3">
                    {deviationMode === "cost" ? "Baseline Monthly Cost" : "Avg Baseline"}
                  </th>
                  <th className="text-left py-3 px-3">
                    <SortHeader
                      label={deviationMode === "cost" ? "MTD Cost" : "Last Execution"}
                      active={sortKey === "last"}
                      dir={sortDir}
                      onClick={() => handleSort("last")}
                    />
                  </th>
                  <th className="text-left py-3 px-3">
                    <SortHeader
                      label="Deviation %"
                      active={sortKey === "deviation"}
                      dir={sortDir}
                      onClick={() => handleSort("deviation")}
                    />
                  </th>
                  <th className="text-left py-3 px-3">
                    <SortHeader
                      label={deviationMode === "cost" ? "Cost Status" : "Health State"}
                      active={sortKey === "health"}
                      dir={sortDir}
                      onClick={() => handleSort("health")}
                    />
                  </th>
                  <th className="text-left py-3 px-3">Optimization Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length > 0 ? (
                  rows
                ) : (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center py-12 px-3 text-slate-400 text-xs font-semibold"
                    >
                      No workloads matching the current filters were found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
