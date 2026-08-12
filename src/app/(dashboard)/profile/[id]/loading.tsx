import { Loader2 } from "lucide-react";

export default function ProfileIdLoading() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      {/* Skeleton Banner */}
      <div className="relative rounded-3xl bg-zinc-200 dark:bg-zinc-800 h-48 md:h-64 w-full mb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
      </div>

      <div className="px-4 sm:px-8">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-end -mt-28 md:-mt-32 relative z-10 mb-8">
          {/* Skeleton Avatar */}
          <div className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-zinc-300 dark:bg-zinc-700 border-4 border-white dark:border-zinc-950 shadow-xl shrink-0" />
          
          <div className="flex-1 w-full space-y-3 pb-2">
            <div className="h-8 bg-zinc-300 dark:bg-zinc-700 rounded-md w-3/4 md:w-1/2" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded-md w-1/2 md:w-1/3" />
            <div className="flex gap-2 mt-4">
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full w-20" />
              <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full w-24" />
            </div>
          </div>
        </div>

        {/* Skeleton Content Tabs */}
        <div className="flex gap-4 border-b border-zinc-200 dark:border-zinc-800 mb-8 pb-2">
          <div className="h-6 bg-zinc-300 dark:bg-zinc-700 rounded w-24" />
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-32" />
          <div className="h-6 bg-zinc-200 dark:bg-zinc-800 rounded w-28" />
        </div>

        {/* Skeleton Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="col-span-1 space-y-4">
            <div className="h-48 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full" />
            <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full" />
          </div>
          <div className="col-span-1 md:col-span-2 space-y-4">
            <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full" />
            <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full" />
            <div className="h-24 bg-zinc-200 dark:bg-zinc-800 rounded-2xl w-full" />
          </div>
        </div>
      </div>
      <div className="fixed bottom-10 right-10 flex items-center justify-center p-4 bg-white dark:bg-zinc-900 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-800">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    </div>
  );
}
