import type { ActivityBucket } from "@/lib/dashboard-stats";

export type DiscoveryChartPoint = {
  label: string;
  pointId: string;
  urlCount: number;
  findingCount: number;
  subdomainCount: number;
  isCurrent?: boolean;
};

/** Dashboard chart pairs findings with subdomains (URLs excluded — scale is too large). */
export function buildDashboardDiscoveryPoints(
  templateBuckets: ActivityBucket[],
  findingBuckets: ActivityBucket[],
  subdomainBuckets: ActivityBucket[],
): DiscoveryChartPoint[] {
  const findingByKey = new Map(findingBuckets.map((b) => [b.key, b.count]));
  const subdomainByKey = new Map(subdomainBuckets.map((b) => [b.key, b.count]));

  return templateBuckets.map((bucket) => ({
    label: bucket.label,
    pointId: bucket.key,
    urlCount: 0,
    findingCount: findingByKey.get(bucket.key) ?? 0,
    subdomainCount: subdomainByKey.get(bucket.key) ?? 0,
  }));
}

export function hasDiscoveryActivity(points: DiscoveryChartPoint[]): boolean {
  return points.some((p) => p.findingCount > 0 || p.subdomainCount > 0);
}

export type DiscoveryChartLegacyPoint = {
  label: string;
  scanId: string;
  urlCount: number;
  findingCount: number;
  subdomainCount?: number;
  isCurrent: boolean;
};

export function toDiscoveryChartPoints(
  points: Array<DiscoveryChartPoint | DiscoveryChartLegacyPoint>,
): DiscoveryChartPoint[] {
  return points.map((p) =>
    "pointId" in p
      ? p
      : {
          label: p.label,
          pointId: p.scanId,
          urlCount: p.urlCount,
          findingCount: p.findingCount,
          subdomainCount: "subdomainCount" in p ? (p.subdomainCount ?? 0) : 0,
          isCurrent: p.isCurrent,
        },
  );
}
