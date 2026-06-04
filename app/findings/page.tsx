import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/top-bar";
import { formatScanDateTime } from "@/lib/scan-format";

export const dynamic = "force-dynamic";

function asPosInt(v: string | undefined, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : fallback;
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const typeFilter = typeof sp.type === "string" ? sp.type : undefined;
  const sourceFilter = typeof sp.source === "string" ? sp.source : undefined;
  const page = asPosInt(typeof sp.page === "string" ? sp.page : undefined, 1);
  const perPage = 50;

  const where = {
    ...(typeFilter ? { findingType: typeFilter } : {}),
    ...(sourceFilter ? { source: sourceFilter as "URL_STRING" | "RESPONSE_BODY" } : {}),
  };

  const [total, findings, typeGroups] = await Promise.all([
    prisma.analysisFinding.count({ where }),
    prisma.analysisFinding.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      include: {
        discoveredUrl: {
          select: {
            urlText: true,
            externalSeenAt: true,
            engines: true,
            targetDomain: { select: { domainNormalized: true, id: true } },
          },
        },
      },
    }),
    prisma.analysisFinding.groupBy({
      by: ["findingType"],
      _count: { _all: true },
      orderBy: { _count: { findingType: "desc" } },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);

  function filterUrl(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    const t = "type" in overrides ? overrides.type : typeFilter;
    const s = "source" in overrides ? overrides.source : sourceFilter;
    const pg = overrides.page ?? "1";
    if (t) p.set("type", t);
    if (s) p.set("source", s);
    if (pg !== "1") p.set("page", pg);
    const qs = p.toString();
    return `/findings${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <TopBar breadcrumb="/ findings" />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <PageHeader
          eyebrow="Analysis"
          title="Findings"
          description="Sensitive data detected in URL strings and downloaded content across all targets."
        />

        <div className="mt-8 space-y-6">
          {/* ── Filter pills ── */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={filterUrl({ type: undefined })}
              className={[
                "rounded-lg border px-3 py-1.5 text-[12px] transition-colors",
                !typeFilter
                  ? "border-accent/60 bg-accent/10 text-cream"
                  : "border-line text-muted hover:bg-[var(--nav-hover-bg)] hover:text-cream",
              ].join(" ")}
            >
              All ({(typeGroups.reduce((s, g) => s + g._count._all, 0)).toLocaleString()})
            </Link>
            {typeGroups.map((g) => (
              <Link
                key={g.findingType}
                href={filterUrl({ type: g.findingType })}
                className={[
                  "rounded-lg border px-3 py-1.5 text-[12px] transition-colors",
                  typeFilter === g.findingType
                    ? "border-accent/60 bg-accent/10 text-cream"
                    : "border-line text-muted hover:bg-[var(--nav-hover-bg)] hover:text-cream",
                ].join(" ")}
              >
                {g.findingType} ({g._count._all.toLocaleString()})
              </Link>
            ))}
          </div>

          {/* ── Source filter ── */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              Source:
            </span>
            {[
              { label: "All", value: undefined },
              { label: "URL String", value: "URL_STRING" },
              { label: "Response Body", value: "RESPONSE_BODY" },
            ].map((opt) => (
              <Link
                key={opt.label}
                href={filterUrl({ source: opt.value })}
                className={[
                  "rounded-lg border px-3 py-1.5 text-[11px] transition-colors",
                  sourceFilter === opt.value || (!sourceFilter && !opt.value)
                    ? "border-accent/40 bg-accent/8 text-cream"
                    : "border-line text-muted hover:bg-[var(--nav-hover-bg)] hover:text-cream",
                ].join(" ")}
              >
                {opt.label}
              </Link>
            ))}
          </div>

          {/* ── Table ── */}
          <div className="glass-panel overflow-hidden rounded-2xl">
            {/* Header */}
            <div className="hidden border-b border-line bg-[var(--table-header-bg)] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted lg:grid lg:grid-cols-12 lg:gap-3">
              <div className="col-span-1">Type</div>
              <div className="col-span-1">Engines</div>
              <div className="col-span-5">URL</div>
              <div className="col-span-2">Snippet</div>
              <div className="col-span-1">Source</div>
              <div className="col-span-2 text-right">Date</div>
            </div>

            <div className="divide-y divide-line">
              {findings.length === 0 ? (
                <div className="px-5 py-8 text-center text-[13px] text-muted">
                  No findings match this filter.
                </div>
              ) : (
                findings.map((f) => (
                  <div
                    key={f.id}
                    className="flex flex-col gap-2 px-5 py-4 lg:grid lg:grid-cols-12 lg:items-start lg:gap-3"
                  >
                    <div className="col-span-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-accent">
                        {f.findingType}
                      </div>
                    </div>
                    <div className="col-span-1 text-[10px] text-muted">
                      {f.discoveredUrl.engines.map((e) =>
                        e === "VIRUSTOTAL" ? "VirusTotal" :
                        e === "WAYBACK_MACHINE" ? "Wayback" :
                        e === "URLSCAN" ? "URLScan" : e
                      ).join(", ")}
                    </div>
                    <div className="col-span-5 min-w-0">
                      <div className="break-all font-mono text-[11px] text-cream/90" title={f.discoveredUrl.urlText}>
                        {f.discoveredUrl.urlText}
                      </div>
                      <Link
                        href={`/targets/${f.discoveredUrl.targetDomain.id}`}
                        className="mt-1 text-[10px] text-accent/70 hover:text-accent hover:underline"
                      >
                        {f.discoveredUrl.targetDomain.domainNormalized}
                      </Link>
                    </div>
                    <div className="col-span-2 min-w-0">
                      {f.snippet ? (
                        <div className="break-all rounded-md border border-line bg-black/15 px-2 py-1.5 font-mono text-[10px] text-cream/80" title={f.snippet}>
                          {f.snippet}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </div>
                    <div className="col-span-1">
                      <span className="text-[9px] font-medium tracking-wide text-muted">
                        {f.source === "URL_STRING" ? "URL" : "Body"}
                      </span>
                    </div>
                    <div className="col-span-2 text-right font-mono text-[10px] text-muted">
                      <div title="Date found by our scanner">
                        Found: {formatScanDateTime(f.createdAt)}
                      </div>
                      {f.discoveredUrl.externalSeenAt && (
                        <div title="Date reported in threat intel" className="mt-1 text-accent/70">
                          Intel: {formatScanDateTime(f.discoveredUrl.externalSeenAt)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-line px-5 py-3">
                <div className="text-[11px] text-muted">
                  Page <span className="font-mono text-cream">{safePage}</span> of{" "}
                  <span className="font-mono text-cream">{totalPages}</span> ·{" "}
                  <span className="font-mono text-cream">{total.toLocaleString()}</span> findings
                </div>
                <div className="flex gap-2">
                  <Link
                    href={filterUrl({ page: String(Math.max(1, safePage - 1)) })}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-[11px]",
                      safePage <= 1
                        ? "pointer-events-none border-line/50 text-muted/40"
                        : "border-line text-cream hover:bg-[var(--nav-hover-bg)]",
                    ].join(" ")}
                  >
                    ← Prev
                  </Link>
                  <Link
                    href={filterUrl({ page: String(Math.min(totalPages, safePage + 1)) })}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-[11px]",
                      safePage >= totalPages
                        ? "pointer-events-none border-line/50 text-muted/40"
                        : "border-line text-cream hover:bg-[var(--nav-hover-bg)]",
                    ].join(" ")}
                  >
                    Next →
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
