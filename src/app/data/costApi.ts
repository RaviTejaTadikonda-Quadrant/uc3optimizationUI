import type { AgentRecommendationAnalysis, StructuralFault } from "../components/WorkloadOptimization";

export interface CostDeviation {
  deviation_amount: number;
  deviation_pct: number;
  status: string;
}

export interface CostConsumptionDetail {
  service: string;
  factory_name?: string;
  workspace_name?: string;
  resource_group: string;
  total_cost: number;
  currency: string;
  baseline_monthly_cost: number;
  deviation: CostDeviation;
  fetched_at: string;
  note: string;
  estimated_monthly_cost: number | null;
}

export interface CachedCostAnalysisResult {
  header: {
    investigation_id: string;
    status: string;
    item: {
      subscription_id: string;
      service: string;
      resource_group: string;
      workspace_name: string;
      item_type: string;
      item_name: string;
    };
    current_month_cost: number;
    baseline_monthly_cost: number;
    estimated_monthly_cost: number;
    currency: string;
  };
  agent_recommendation_analysis: AgentRecommendationAnalysis;
  structural_faults: StructuralFault[];
  structural_faults_count: number;
  root_causes: Array<{
    category: string;
    description: string;
    causal_chain?: string[];
    supporting_findings?: string[];
    confidence?: number;
  }>;
  trigger_payload: {
    total_cost: number;
    currency: string;
    baseline_monthly_cost: number;
    deviation: {
      deviation_amount: number;
      deviation_pct: number;
      status: "above_baseline" | "below_baseline" | "at_baseline";
    };
    [key: string]: any;
  };
}


export interface CachedCostInvestigationResponse {
  investigation_id: string;
  status: string;
  analysis: CostInvestigationResult;
}

export interface CostPanelViewModel {
  currency: string;
  current_month_cost: number | null;
  estimated_monthly_cost: number | null;
  baseline_monthly_cost: number | null;
  forecast_deviation: number | null;
  forecast_deviation_pct: number | null;
  forecast_status: string | null;
  executive_summary: string;
  root_causes: Array<{ category: string; description: string; confidence?: number }>;
  recommendations: Array<{
    title: string;
    description: string;
    target_activity?: string;
    confidence?: number;
    estimated_gain_pct?: number;
    effort?: string;
    risk?: string;
  }>;
}

export function normalizeFreshCostResult(
  r: CostInvestigationResult | CachedCostAnalysisResult,
): CostPanelViewModel {
  const isLegacyShape = "header" in r || "agent_recommendation_analysis" in r || "trigger_payload" in r;

  if (isLegacyShape) {
    const old = r as CachedCostAnalysisResult;
    const rec = old.agent_recommendation_analysis;
    const rawRecs = Array.isArray(rec?.recommendations) ? rec.recommendations : [];

    return {
      currency: old.header?.currency ?? old.trigger_payload?.currency ?? "INR",
      current_month_cost: old.header?.current_month_cost ?? null,
      estimated_monthly_cost: old.header?.estimated_monthly_cost ?? null,
      baseline_monthly_cost:
        old.header?.baseline_monthly_cost ?? old.trigger_payload?.baseline_monthly_cost ?? null,
      forecast_deviation: old.trigger_payload?.deviation?.deviation_amount ?? null,
      forecast_deviation_pct: old.trigger_payload?.deviation?.deviation_pct ?? null,
      forecast_status: old.trigger_payload?.deviation?.status ?? null,
      executive_summary: "",
      root_causes: old.root_causes ?? [],
      recommendations: rawRecs.map((x) => {
        const item = typeof x === "string" ? { title: x } : x;
        return {
          title: item.title ?? item.description ?? "Recommendation",
          description: item.description ?? "",
        };
      }),
    };
  }

  const flat = r as CostInvestigationResult;
  return {
    currency: flat.currency,
    current_month_cost: flat.current_month_cost ?? null,
    estimated_monthly_cost: flat.estimated_monthly_cost ?? null,
    baseline_monthly_cost: flat.baseline_monthly_cost ?? null,
    forecast_deviation: flat.forecast_deviation ?? null,
    forecast_deviation_pct: flat.forecast_deviation_pct ?? null,
    forecast_status: flat.forecast_status ?? null,
    executive_summary: flat.executive_summary ?? "",
    root_causes: flat.root_causes ?? [],
    recommendations:
      (flat.action_roadmap ?? []).length > 0
        ? flat.action_roadmap.map((a) => ({
          title: a.title,
          description: a.description,
          target_activity: a.target_activity,
          estimated_gain_pct: a.estimated_gain_pct,
          effort: a.effort,
          risk: a.risk,
        }))
        : (flat.suggested_fixes ?? []).map((fx) => ({
          title: fx.fix_title,
          description: fx.fix_description,
          target_activity: fx.target_activity,
          confidence: fx.confidence,
        })),
  };
}
interface CostConsumptionEntry {
  factory_name?: string;
  workspace_name?: string;
  resource_group: string;
  cost_consumption: CostConsumptionDetail;
}

interface CostConsumptionResponse {
  subscription_id: string;
  adf: CostConsumptionEntry[];
  synapse: CostConsumptionEntry[];
  databricks: CostConsumptionEntry[];
}


export interface CostRootCause {
  category: string;
  description: string;
  confidence: number;
}

export interface CostActionRoadmapItem {
  priority: number;
  title: string;
  target_activity: string;
  description: string;
  effort: string;
  risk: string;
  estimated_gain_pct: number;
}

export interface CostSuggestedFix {
  target_activity: string;
  fix_title: string;
  fix_description: string;
  confidence: number;
}

export interface CostApplyFixPayload {
  subscription_id: string;
  service: string;
  resource_group: string;
  workspace_name: string;
  item_name: string;
  target_activity: string;
  fix_title: string;
  status: string;
}

export interface CostInvestigationResult {
  investigation_id: string;
  executive_summary: string;
  compilation_adjustment: string;
  currency: string;
  current_month_cost: number;
  baseline_monthly_cost: number;
  estimated_monthly_cost: number;
  forecast_deviation: number;
  forecast_deviation_pct: number;
  forecast_status: "above_baseline" | "below_baseline" | "at_baseline";
  root_causes: Array<{ category: string; description: string; confidence: number }>;
  action_roadmap: Array<{
    priority: number;
    title: string;
    target_activity: string;
    description: string;
    effort: string;
    risk: string;
    estimated_gain_pct: number;
  }>;
  suggested_fixes: Array<{
    target_activity: string;
    fix_title: string;
    fix_description: string;
    confidence: number;
  }>;
}




const COST_AGENTS_BASE = "https://uc3-agents-bgbsfqbbgkfeabfq.eastus-01.azurewebsites.net";

const COST_API_BASE =
  "https://azureoptimisationadlruns-apbhh8febxg3fpfw.eastus-01.azurewebsites.net/api/v1/adls/subscription";

function nameOf(entry: CostConsumptionEntry): string {
  return entry.factory_name || entry.workspace_name || "";
}

// Key format matches what AgentAnalysisPanel will look up with:
// `${subscriptionId}::${serviceKey}::${resourceGroup}::${workspaceName}`
function buildCostLookup(
  subscriptionId: string,
  raw: CostConsumptionResponse,
): Map<string, CostConsumptionDetail> {
  const map = new Map<string, CostConsumptionDetail>();
  (["adf", "synapse", "databricks"] as const).forEach((serviceKey) => {
    (raw[serviceKey] || []).forEach((entry) => {
      const key = `${subscriptionId}::${serviceKey}::${entry.resource_group}::${nameOf(entry)}`;
      map.set(key, entry.cost_consumption);
    });
  });
  return map;
}

async function fetchCostConsumption(subscriptionId: string): Promise<CostConsumptionResponse> {
  const res = await fetch(`${COST_API_BASE}/${subscriptionId}/cost-consumption`);
  if (!res.ok) throw new Error(`Failed to fetch cost consumption (${res.status})`);
  return res.json();
}

// Fetches cost for every subscription and merges into one lookup map.
// Same "one bad subscription shouldn't kill the dashboard" pattern as fetchAllWorkloadData.
export async function fetchAllCostData(
  subscriptions: { id: string }[],
): Promise<Map<string, CostConsumptionDetail>> {
  const merged = new Map<string, CostConsumptionDetail>();
  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const raw = await fetchCostConsumption(sub.id);
        buildCostLookup(sub.id, raw).forEach((v, k) => merged.set(k, v));
      } catch {
        /* skip this subscription's cost data */
      }
    }),
  );
  return merged;
}

export async function postCostInvestigation(
  entry: CostConsumptionDetail,
): Promise<CostInvestigationResult> {
  const res = await fetch(`${COST_AGENTS_BASE}/post-cost-investigation`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(`Cost investigation failed (${res.status})`);
  return res.json();
}