// src/authSubscriptions.ts
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

export async function fetchAzureSubscriptions(accessToken: string): Promise<AzureSubscription[]> {
  const subscriptions: AzureSubscription[] = [];
  let url: string | undefined =
    "https://management.azure.com/subscriptions?api-version=2022-12-01";

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error?.message || `Failed to fetch subscriptions (${res.status})`);
    }

    const data: ArmSubscriptionsResponse = await res.json();
    subscriptions.push(...data.value);
    url = data.nextLink; // ARM paginates if the tenant has many subs
  }

  return subscriptions;
}