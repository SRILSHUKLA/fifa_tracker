import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading state for every signed-in route. The shapes deliberately
 * mirror the dashboard so the page does not jump when data arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-40" />
      </div>

      <Skeleton className="h-36 w-full rounded-2xl" />

      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
        <Skeleton className="h-[68px] w-full rounded-xl" />
      </div>
    </div>
  );
}
