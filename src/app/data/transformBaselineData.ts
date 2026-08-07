import type {
  Service,
  ResourceGroup,
  Workspace,
  Workload,
  Run,
  ApiHealth,
} from "../components/WorkloadOptimization";

const HEALTH_TO_RUN_STATUS: Record<ApiHealth, Run["status"]> = {
  Healthy: "ok",
  Warning: "med",
  Critical: "slow",
  Severe: "slow",
};

const SERVICE_META: Record<
  string,
  {
    id: string;
    name: string;
    color: string;
    bg: string;
    border: string;
    rtype: string;
    tier: string;
  }
> = {
  synapse: {
    id: "syn",
    name: "Azure Synapse Analytics",
    color: "#0d9488",
    bg: "#f0fdfa",
    border: "border-teal-100",
    rtype: "Synapse Workspace",
    tier: "Workspace Multi-Engine",
  },
  databricks: {
    id: "dbr",
    name: "Azure Databricks",
    color: "#6366f1",
    bg: "#f5f3ff",
    border: "border-indigo-100",
    rtype: "Databricks Workspace",
    tier: "Serverless Premium",
  },
  adf: {
    id: "adf",
    name: "Azure Data Factory",
    color: "#2563eb",
    bg: "#eff6ff",
    border: "border-blue-100",
    rtype: "Data Factory",
    tier: "V2 Managed VNet",
  },
};

const ITEM_TYPE_TO_WTYPE: Record<string, string> = {
  pipelines: "Pipeline",
  jobs: "Notebook Job",
  spark_pools: "Spark Pool",
};

// The real API has no before/after code — cycle real workloads through the
// canned demo entries in HTML_WORKLOADS purely so "View Fix" has content.
const HTML_KEYS_BY_SERVICE: Record<string, string[]> = {
  syn: ["syn1", "syn2", "syn3"],
  dbr: ["db1", "db2", "db3"],
  adf: ["syn1"],
};

function slug(s: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function fmtDurationLabel(seconds: number): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const totalMin = Math.floor(seconds / 60);
  const remSec = seconds - totalMin * 60;
  if (totalMin < 60) return `${totalMin}m ${remSec.toFixed(1)}s`;
  const hours = Math.floor(totalMin / 60);
  const remMin = (totalMin % 60) + remSec / 60;
  return `${hours}h ${remMin.toFixed(1)}m`;
}

interface RawActivity {
  activity_name: string;
  activity_type: string;
  avg_duration_seconds: number;
  latest_duration_seconds: number;
  deviation_pct: number;
  success_rate_pct: number;
  health: ApiHealth;
}

interface RawBaseline {
  service: string;
  resource_group: string;
  workspace_name: string;
  item_type: string;
  item_name: string;
  total_runs_available: number;
  pipeline_baseline: {
    avg_duration_seconds: number;
    success_rate_pct: number;
    latest_run_duration_seconds: number;
    deviation_pct: number;
    health: ApiHealth;
  } | null;
  activities: RawActivity[] | null | undefined;
}

export interface RawBaselineResponse {
  subscription_id: string;
  data: Record<
    string,
    Record<string, Record<string, Record<string, Record<string, RawBaseline>>>>
  >;
}

// Fallback health used when the API doesn't give us one — keeps ApiHealth
// exhaustive so HEALTH_TO_RUN_STATUS[...] lookups never come back undefined.
const DEFAULT_HEALTH: ApiHealth = "Healthy";

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null;
}

function buildRuns(baseline: RawBaseline): Run[] {
  const activities = Array.isArray(baseline.activities) ? baseline.activities : [];
  return activities.map((act, index) => {
    const health = act?.health ?? DEFAULT_HEALTH;
    return {
      id: `${slug(act?.activity_name || baseline.item_name)}-${index + 1}`,
      name: act?.activity_name ?? "Unnamed activity",
      activityType: act?.activity_type ?? "Unknown",
      avgSeconds: act?.avg_duration_seconds ?? 0,
      lastSeconds: act?.latest_duration_seconds ?? 0,
      apiDeviationPct: act?.deviation_pct ?? null,
      health,
      status: HEALTH_TO_RUN_STATUS[health] ?? "ok",
    };
  });
}

function buildImpact(b: NonNullable<RawBaseline["pipeline_baseline"]>): string[] {
  return [
    `${b.deviation_pct >= 0 ? "+" : ""}${b.deviation_pct.toFixed(2)}% deviation`,
    `${b.success_rate_pct.toFixed(2)}% success rate`,
    `${b.health} baseline`,
  ];
}

export function transformBaselineResponse(raw: RawBaselineResponse): Service[] {
  const services: Service[] = [];
  const htmlKeyCursor: Record<string, number> = {};

  if (!raw || !isPlainObject(raw.data)) return services;

  Object.entries(raw.data).forEach(([serviceKey, resourceGroupMap]) => {
    if (!isPlainObject(resourceGroupMap)) return;

    const meta =
      SERVICE_META[serviceKey] ?? {
        id: serviceKey,
        name: serviceKey,
        color: "#64748b",
        bg: "#f8fafc",
        border: "border-slate-100",
        rtype: serviceKey,
        tier: "Standard",
      };

    const resourceGroups: ResourceGroup[] = [];

    Object.entries(resourceGroupMap).forEach(([resourceGroupName, workspaces]) => {
      if (!isPlainObject(workspaces)) return;

      const workspaceEntries: Workspace[] = [];

      Object.entries(workspaces).forEach(([workspaceName, itemTypes]) => {
        if (!isPlainObject(itemTypes)) return;

        const workloads: Workload[] = [];

        Object.entries(itemTypes).forEach(([itemType, items]) => {
          if (!isPlainObject(items)) return;

          Object.values(items).forEach((baseline: RawBaseline) => {
            if (!baseline) return;

            const b = baseline.pipeline_baseline;
            // Skip items that don't have a computed baseline yet (e.g. new
            // pipeline, zero runs so far) rather than crashing the transform.
            if (!b) return;

            const itemName = baseline.item_name ?? "Unnamed item";

            const cursorList = HTML_KEYS_BY_SERVICE[meta.id] ?? ["syn1"];
            const cursorIdx = (htmlKeyCursor[meta.id] ?? 0) % cursorList.length;
            htmlKeyCursor[meta.id] = cursorIdx + 1;

            workloads.push({
              id: `${meta.id}-${slug(resourceGroupName)}-${slug(workspaceName)}-${slug(itemName)}`,
              name: itemName,
              wtype: ITEM_TYPE_TO_WTYPE[itemType] ?? itemType,
              avgSeconds: b.avg_duration_seconds ?? 0,
              lastSeconds: b.latest_run_duration_seconds ?? 0,
              saveCost: null,
              effort: null,
              apiHealth: b.health ?? DEFAULT_HEALTH,
              apiDeviationPct: b.deviation_pct ?? null,
              rootCause: `${itemName} shows ${b.health ?? "unknown"} baseline health with latest run deviation of ${(
                b.deviation_pct ?? 0
              ).toFixed(2)}% and ${(b.success_rate_pct ?? 0).toFixed(2)}% success rate.`,
              cards: [
                {
                  emoji: b.health === "Healthy" ? "✅" : b.health === "Warning" ? "⚡" : "⚠️",
                  heading:
                    b.health === "Healthy"
                      ? "Within normal range"
                      : "Optimization opportunity detected",
                  body: `Latest run for ${itemName} deviated ${(b.deviation_pct ?? 0).toFixed(
                    2,
                  )}% from its ${fmtDurationLabel(b.avg_duration_seconds)} baseline.`,
                },
              ],
              steps: [
                {
                  t: `Open the ${ITEM_TYPE_TO_WTYPE[itemType] ?? itemType} run and inspect the slowest activities.`,
                },
                { t: "Apply the AI-recommended optimized code and re-run to validate." },
              ],
              impact: buildImpact(b),
              htmlWlKey: cursorList[cursorIdx],
              runs: buildRuns(baseline),
            });
          });
        });

        workspaceEntries.push({
          id: `${meta.id}-${slug(resourceGroupName)}-${slug(workspaceName)}`,
          name: workspaceName,
          region: "East US",
          rtype: meta.rtype,
          tier: meta.tier,
          workloads,
        });
      });

      resourceGroups.push({
        id: `${meta.id}-${slug(resourceGroupName)}`,
        name: resourceGroupName,
        workspaces: workspaceEntries,
      });
    });

    services.push({
      id: meta.id,
      name: meta.name,
      color: meta.color,
      bg: meta.bg,
      border: meta.border,
      resourceGroups,
    });
  });

  return services;
}