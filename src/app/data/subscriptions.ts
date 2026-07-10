import type { Service } from "../components/WorkloadOptimization";
import { transformBaselineResponse, type RawBaselineResponse } from "./transformBaselineData";

export interface Subscription {
  id: string;
  name: string;
}

const BASELINE_API_BASE =
  "https://azureoptimisationadlruns-apbhh8febxg3fpfw.eastus-01.azurewebsites.net/api/v1/telemetry/baseline";

function tagServices(services: Service[], sub: Subscription): Service[] {
  return services.map((svc) => ({
    ...svc,
    subscriptionId: sub.id,
    subscriptionName: sub.name,
    resourceGroups: svc.resourceGroups.map((rg) => ({
      ...rg,
      subscriptionId: sub.id,
      subscriptionName: sub.name,
      workspaces: rg.workspaces.map((ws) => ({
        ...ws,
        subscriptionId: sub.id,
        subscriptionName: sub.name,
      })),
    })),
  }));
}

function mergeServicesByType(services: Service[]): Service[] {
  const merged = new Map<string, Service>();
  for (const svc of services) {
    const existing = merged.get(svc.name);
    if (existing) {
      existing.resourceGroups = [...existing.resourceGroups, ...svc.resourceGroups];
    } else {
      merged.set(svc.name, {
        ...svc,
        subscriptionId: undefined,
        subscriptionName: undefined,
        resourceGroups: [...svc.resourceGroups],
      });
    }
  }
  return Array.from(merged.values());
}

async function fetchBaseline(subscriptionId: string, accessToken: string): Promise<RawBaselineResponse> {
  const res = await fetch(`${BASELINE_API_BASE}/${subscriptionId}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch workload baseline (${res.status})`);
  }
  return res.json();
}

// Fetches every subscription's baseline data and merges same-named services
// (Synapse/Databricks/ADF) into one row each, aggregating resources from
// every subscription underneath it — same behavior as the old mock version.
export async function fetchAllWorkloadData(
  subscriptions: Subscription[],
  accessToken: string,
): Promise<Service[]> {
  const perSub = await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        const raw = await fetchBaseline(sub.id, accessToken);
        return tagServices(transformBaselineResponse(raw), sub);
      } catch {
        return [] as Service[]; // one bad subscription shouldn't kill the whole dashboard
      }
    }),
  );
  return mergeServicesByType(perSub.flat());
}