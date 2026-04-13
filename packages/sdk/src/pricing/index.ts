/**
 * Provider pricing — live where APIs exist, documented static fallbacks elsewhere.
 *
 * Sources:
 *   AWS Lambda  : https://aws.amazon.com/lambda/pricing/ (verified 2025-01)
 *   GCP Cloud Run: https://cloud.google.com/run/pricing (verified 2025-01)
 *   Azure ACI   : https://prices.azure.com/api/retail/prices (live)
 *   Cloudflare  : https://developers.cloudflare.com/workers/platform/pricing/ (verified 2025-01)
 *   Fly.io      : https://fly.io/docs/about/pricing/ (verified 2025-01)
 */

export interface ProviderPricing {
  // AWS Lambda
  awsLambdaGbSec: number;       // per GB-second of compute
  awsLambdaRequest: number;     // per invocation

  // GCP Cloud Run
  gcpRunVcpuSec: number;        // per vCPU-second
  gcpRunGibSec: number;         // per GiB-second of memory
  gcpRunRequest: number;        // per request

  // Azure ACI (Linux containers)
  azureAciVcpuSec: number;      // per vCPU-second
  azureAciGibSec: number;       // per GiB-second of memory

  // Cloudflare Workers (paid plan)
  cfWorkerRequest: number;      // per request
  cfWorkerFreePerDay: number;   // free tier daily requests

  // Fly.io Machines
  flySharedCpu1xHour: number;   // shared-cpu-1x per hour
  flySharedCpu2xHour: number;   // shared-cpu-2x per hour

  // Metadata
  fetchedAt: Date;
  source: 'live' | 'static';
}

// Static fallback constants (documented with sources)
export const STATIC_PRICING: ProviderPricing = {
  awsLambdaGbSec:      0.0000166667, // $0.0000166667 per GB-sec (us-east-1) — aws.amazon.com/lambda/pricing
  awsLambdaRequest:    0.0000002,    // $0.20 per 1M requests — unchanged since 2020
  gcpRunVcpuSec:       0.00002400,   // $0.00002400 per vCPU-sec — cloud.google.com/run/pricing
  gcpRunGibSec:        0.00000250,   // $0.00000250 per GiB-sec
  gcpRunRequest:       0.0000004,    // $0.40 per 1M requests
  azureAciVcpuSec:     0.0000135,    // $0.0000135 per vCPU-sec (Linux) — azure.microsoft.com/pricing/details/container-instances
  azureAciGibSec:      0.0000015,    // $0.0000015 per GiB-sec (Linux)
  cfWorkerRequest:     0.0000005,    // $0.50 per 1M requests (Workers Paid) — developers.cloudflare.com/workers/platform/pricing
  cfWorkerFreePerDay:  100_000,      // 100k req/day free tier
  flySharedCpu1xHour:  0.0101,       // $0.0101/hr shared-cpu-1x (256MB) — fly.io/docs/about/pricing
  flySharedCpu2xHour:  0.0202,       // $0.0202/hr shared-cpu-2x
  fetchedAt: new Date('2025-01-01'),
  source: 'static',
};

// In-memory cache
let cachedPricing: ProviderPricing | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function fetchAzureLivePricing(): Promise<Partial<ProviderPricing>> {
  // Azure Retail Prices API — public, no auth required
  // Filters to Container Instances, Linux, eastus, Consumption pricing
  const url = new URL('https://prices.azure.com/api/retail/prices');
  url.searchParams.set('api-version', '2023-01-01-preview');
  url.searchParams.set('$filter',
    "serviceName eq 'Container Instances' and " +
    "armRegionName eq 'eastus' and " +
    "priceType eq 'Consumption' and " +
    "contains(skuName, 'Linux')"
  );

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(5_000),
    headers: { 'Accept': 'application/json' },
  });

  if (!res.ok) throw new Error(`Azure pricing API returned ${res.status}`);

  const data = await res.json() as {
    Items?: Array<{
      skuName: string;
      retailPrice: number;
      unitOfMeasure: string;
    }>
  };

  const result: Partial<ProviderPricing> = {};

  for (const item of data.Items ?? []) {
    const sku = item.skuName.toLowerCase();
    const unit = item.unitOfMeasure.toLowerCase();

    // "1 vCPU Duration" measured per second
    if (sku.includes('vcpu') && unit.includes('second')) {
      result.azureAciVcpuSec = item.retailPrice;
    }
    // "1 GB Duration" measured per second
    if ((sku.includes(' gb ') || sku.endsWith(' gb')) && unit.includes('second')) {
      result.azureAciGibSec = item.retailPrice;
    }
  }

  return result;
}

/**
 * Return current pricing. Tries to fetch live Azure pricing from the Azure
 * Retail Prices API; overlays the live values on top of static constants.
 * Always falls back to STATIC_PRICING on any error.
 */
export async function getPricing(): Promise<ProviderPricing> {
  if (cachedPricing && Date.now() < cacheExpiresAt) return cachedPricing;

  try {
    const azurePrices = await fetchAzureLivePricing();
    const pricing: ProviderPricing = {
      ...STATIC_PRICING,
      ...azurePrices,
      fetchedAt: new Date(),
      source: 'live',
    };
    cachedPricing = pricing;
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return pricing;
  } catch {
    // Silent fallback — never throw from estimate()
    return STATIC_PRICING;
  }
}

/** Reset the in-memory pricing cache. Useful in tests. */
export function clearPricingCache(): void {
  cachedPricing = null;
  cacheExpiresAt = 0;
}
