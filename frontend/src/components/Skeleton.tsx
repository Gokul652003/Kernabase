/**
 * Loading placeholders that mirror the shape of the content they stand in for.
 *
 * A skeleton is only an improvement over a spinner when it matches the real layout —
 * same row heights, same column count, same card grid — so the page does not jump when
 * the data lands. Each composite below is paired with the component it replaces.
 *
 * `motion-reduce:animate-none` keeps the pulse from firing for anyone who has asked the
 * OS to reduce motion.
 */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded bg-overlay-3 motion-reduce:animate-none ${className}`} />;
}

/** Varies the widths so a column of bars does not read as a solid block. */
const WIDTHS = ['w-[85%]', 'w-[60%]', 'w-[72%]', 'w-[45%]', 'w-[78%]', 'w-[55%]'];

function widthAt(index: number): string {
  return WIDTHS[index % WIDTHS.length] ?? 'w-[70%]';
}

/** Stands in for the data grid: sticky header row plus body rows. */
export function TableSkeleton({ columns = 5, rows = 8 }: { columns?: number; rows?: number }) {
  return (
    <div role="status" aria-label="Loading table" className="flex flex-1 flex-col overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div key={colIndex} className="flex-1">
                <Skeleton className={`h-3 ${widthAt(rowIndex + colIndex)}`} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Stands in for the sidebar's table list. */
export function TableListSkeleton({ rows = 7 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading tables" className="flex flex-col gap-0.5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-md px-2.5 py-2">
          <Skeleton className="h-3.5 w-3.5 shrink-0" />
          <Skeleton className={`h-3 ${widthAt(i)}`} />
        </div>
      ))}
    </div>
  );
}

/** Stands in for the dashboard's project cards, matching the 2-column grid. */
export function ProjectCardsSkeleton({ cards = 4 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading projects" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {Array.from({ length: cards }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4 shrink-0" />
            <Skeleton className={`h-3.5 ${widthAt(i)}`} />
          </div>
          <Skeleton className="h-2.5 w-[65%]" />
        </div>
      ))}
    </div>
  );
}

/** Stands in for the policy list inside the policies panel. */
export function PolicyListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading policies" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="mt-2.5 h-2.5 w-[70%]" />
        </div>
      ))}
    </div>
  );
}

/** Stands in for the column list inside the edit-table panel. */
export function ColumnListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading columns" className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-overlay-1 px-3 py-3">
          <div className="min-w-0 flex-1">
            <Skeleton className={`h-3.5 ${widthAt(i)}`} />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </div>
          <Skeleton className="h-6 w-6 shrink-0" />
          <Skeleton className="h-6 w-6 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/**
 * Stands in for the settings and MCP pages: a header line plus stacked cards, so the
 * page keeps its shape instead of collapsing to a centred spinner.
 */
export function DetailPageSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div role="status" aria-label="Loading" className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
      <Skeleton className="mb-5 h-3 w-[80%]" />
      {Array.from({ length: cards }).map((_, cardIndex) => (
        <div key={cardIndex} className="mb-4 rounded-lg border border-border bg-surface p-5">
          <Skeleton className="mb-4 h-3.5 w-32" />
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <Skeleton key={rowIndex} className={`h-3 ${widthAt(cardIndex + rowIndex)}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
