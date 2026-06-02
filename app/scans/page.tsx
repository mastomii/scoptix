import Link from "next/link";
import { ScanJobStatus } from "@prisma/client";
import { ActiveScansPanel } from "@/components/active-scans-panel";
import { NewScanDialog } from "@/components/new-scan-dialog";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";
import { TopBar } from "@/components/top-bar";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: "bg-accent/15 text-accent",
  RUNNING: "bg-accent/25 text-cream",
  QUEUED: "bg-muted/15 text-muted",
  FAILED: "bg-warn/15 text-warn",
  CANCELLED: "bg-muted/10 text-muted",
  PAUSED: "bg-warn/10 text-warn",
};

function formatDateTime(value: Date | null) {
  if (!value) return "—";
  return value.toISOString().slice(0, 16).replace("T", " ");
}

/** Shared column tracks — full class string so Tailwind JIT includes it. */
const SCAN_HISTORY_TABLE_GRID_CLASS =
  "lg:grid-cols-[minmax(0,1.25fr)_minmax(8rem,max-content)_minmax(0,7.75rem)_minmax(7rem,0.85fr)_5rem_minmax(6.5rem,1fr)_minmax(6.5rem,1fr)]";

/** Status column: header uses the same padded box as badges so text aligns on the same edge. */
const STATUS_COL_CLASS = "justify-self-start";
const STATUS_BOX_CLASS =
  "inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-normal";

export default async function ScansPage() {
  const scans = await prisma.scanJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      targetDomain: true,
      _count: {
        select: {
          analysisFindings: true,
        },
      },
    },
  });
  const activeScans = scans.filter(
    (scan) =>
      scan.status === ScanJobStatus.RUNNING ||
      scan.status === ScanJobStatus.QUEUED,
  );
  const historyScans = scans.filter(
    (scan) =>
      scan.status !== ScanJobStatus.RUNNING &&
      scan.status !== ScanJobStatus.QUEUED,
  );

  return (
    <>
      <TopBar breadcrumb="/ scans" />
      <main className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            eyebrow="Reconnaissance"
            title="Scans"
            description="Track running scans and review previous results."
          />
          <div className="shrink-0">
            <NewScanDialog />
          </div>
        </div>

        <div className="mt-8 space-y-6">
          {activeScans.length > 0 && (
            <ActiveScansPanel
              scans={activeScans.map((scan) => ({
                id: scan.id,
                status: scan.status,
                phase: scan.phase,
                progressCurrent: scan.progressCurrent,
                progressTotal: scan.progressTotal,
                createdAt: scan.createdAt.toISOString(),
                targetDomain: {
                  domainNormalized: scan.targetDomain.domainNormalized,
                },
              }))}
            />
          )}

          <div className="glass-panel overflow-hidden rounded-2xl">
            <div className="border-b border-line bg-[var(--table-header-bg)] px-5 py-4">
              <div className="text-[13px] font-semibold text-cream">Scan history</div>
              <div className="mt-1 text-[12px] text-muted">
                Review completed, failed, cancelled, and paused scans.
              </div>
            </div>

            {historyScans.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <div className="text-[13px] text-muted">
                  {activeScans.length > 0 ? "No previous scans yet." : "No scans yet."}
                </div>
                <div className="mt-2 text-[12px] text-muted">
                  Start a new scan to begin collecting URLs and findings.
                </div>
                <div className="mt-5 flex justify-center">
                  <NewScanDialog
                    buttonClassName="shadow-clay inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-accent to-accent-dim px-4 py-3 text-[13px] font-semibold text-void transition-transform hover:scale-[1.02]"
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Mobile: stacked rows */}
                <div className="divide-y divide-line lg:hidden">
                  {historyScans.map((s) => {
                    const isCompleted = s.status === ScanJobStatus.COMPLETED;
                    const href = isCompleted ? `/scans/${s.id}/observed` : `/scans/${s.id}`;
                    const statusCls = STATUS_STYLE[s.status] ?? "bg-muted/10 text-muted";
                    const findingsCount =
                      s.observedFindingCount ?? s._count.analysisFindings;

                    return (
                      <Link
                        key={s.id}
                        href={href}
                        className="flex flex-col gap-2 px-5 py-4 text-left transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Target
                          </div>
                          <div className="truncate font-mono text-[12px] text-cream">
                            {s.targetDomain.domainNormalized}
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Status
                          </div>
                          <span
                            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${statusCls}`}
                          >
                            {s.status}
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-muted">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Phase
                          </div>
                          {s.phase ?? "—"}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Progress
                          </div>
                          {(s.progressCurrent ?? 0).toLocaleString()}/
                          {(s.progressTotal ?? 0).toLocaleString()}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Findings
                          </div>
                          {findingsCount.toLocaleString()}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Finished
                          </div>
                          {formatDateTime(s.completedAt)}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                            Created
                          </div>
                          {formatDateTime(s.createdAt)}
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Desktop: one grid + subgrid rows so columns line up with headers */}
                <div
                  className={`hidden lg:grid ${SCAN_HISTORY_TABLE_GRID_CLASS} lg:gap-x-3 lg:px-5`}
                >
                  <div className="col-span-full grid grid-cols-subgrid gap-x-3 border-b border-line bg-[var(--table-header-bg)] py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    <div className="min-w-0 truncate">Target</div>
                    <div className={STATUS_COL_CLASS}>
                      <span className={`${STATUS_BOX_CLASS} text-muted`}>Status</span>
                    </div>
                    <div className="min-w-0 truncate">Phase</div>
                    <div className="tabular-nums">Progress</div>
                    <div className="tabular-nums">Findings</div>
                    <div className="tabular-nums">Finished</div>
                    <div className="tabular-nums">Created</div>
                  </div>

                  {historyScans.map((s) => {
                    const isCompleted = s.status === ScanJobStatus.COMPLETED;
                    const href = isCompleted ? `/scans/${s.id}/observed` : `/scans/${s.id}`;
                    const statusCls = STATUS_STYLE[s.status] ?? "bg-muted/10 text-muted";
                    const findingsCount =
                      s.observedFindingCount ?? s._count.analysisFindings;

                    return (
                      <Link
                        key={s.id}
                        href={href}
                        className="col-span-full grid grid-cols-subgrid items-center gap-x-3 border-b border-line py-3 text-left transition-colors last:border-b-0 hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0 truncate font-mono text-[12px] text-cream">
                          {s.targetDomain.domainNormalized}
                        </div>
                        <div className={STATUS_COL_CLASS}>
                          <span className={`${STATUS_BOX_CLASS} ${statusCls}`}>
                            {s.status}
                          </span>
                        </div>
                        <div className="min-w-0 truncate font-mono text-[11px] text-muted">
                          {s.phase ?? "—"}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          {(s.progressCurrent ?? 0).toLocaleString()}/
                          {(s.progressTotal ?? 0).toLocaleString()}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          {findingsCount.toLocaleString()}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          {formatDateTime(s.completedAt)}
                        </div>
                        <div className="font-mono text-[11px] tabular-nums text-muted">
                          {formatDateTime(s.createdAt)}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
