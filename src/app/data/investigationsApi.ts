
export interface InvestigationsResponse {
    adf?: Record<string, string>;
    databricks?: Record<string, string>;
    synapse?: Record<string, string>;
}

const AGENTS_BASE = "https://uc3-agents-bgbsfqbbgkfeabfq.eastus-01.azurewebsites.net";

async function fetchInvestigations(
    subscriptionId: string,
    kind: "runtime" | "cost",
): Promise<InvestigationsResponse> {
    const res = await fetch(
        `${AGENTS_BASE}/api/subscriptions/${subscriptionId}/investigations/${kind}`,
        { headers: { accept: "application/json" } },
    );
    if (!res.ok) throw new Error(`Failed to fetch ${kind} investigations (${res.status})`);
    return res.json();
}


function buildLookup(subscriptionId: string, raw: InvestigationsResponse): Map<string, string> {
    const map = new Map<string, string>();
    (["adf", "synapse", "databricks"] as const).forEach((serviceKey) => {
        const items = raw[serviceKey];
        if (!items) return;
        Object.entries(items).forEach(([itemName, investigationId]) => {
            map.set(`${subscriptionId}::${serviceKey}::${itemName}`, investigationId);
        });
    });
    return map;
}

async function fetchAllInvestigations(
    subscriptions: { id: string }[],
    kind: "runtime" | "cost",
): Promise<Map<string, string>> {
    const merged = new Map<string, string>();
    await Promise.all(
        subscriptions.map(async (sub) => {
            try {
                const raw = await fetchInvestigations(sub.id, kind);
                buildLookup(sub.id, raw).forEach((v, k) => merged.set(k, v));
            } catch {
                /* best-effort, same pattern as fetchAllCostData */
            }
        }),
    );
    return merged;
}

export const fetchAllRuntimeInvestigations = (subs: { id: string }[]) =>
    fetchAllInvestigations(subs, "runtime");

export const fetchAllCostInvestigations = (subs: { id: string }[]) =>
    fetchAllInvestigations(subs, "cost");