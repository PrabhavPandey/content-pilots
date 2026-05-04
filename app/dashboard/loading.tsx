export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-start justify-between mb-10">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-gray-100 rounded" />
          <div className="h-6 w-48 bg-gray-100 rounded" />
          <div className="h-3 w-32 bg-gray-100 rounded" />
          <div className="h-3 w-28 bg-gray-100 rounded mt-2" />
        </div>
      </div>

      {/* Card skeletons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="border border-gray-100 rounded-lg p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="h-4 w-32 bg-gray-100 rounded" />
                <div className="h-3 w-16 bg-gray-100 rounded" />
              </div>
              <div className="space-y-1 text-right">
                <div className="h-8 w-12 bg-gray-100 rounded ml-auto" />
                <div className="h-3 w-24 bg-gray-100 rounded ml-auto" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(j => (
                <div key={j} className="space-y-1.5">
                  <div className="h-5 w-10 bg-gray-100 rounded" />
                  <div className="h-3 w-12 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-2.5">
              <div className="flex justify-between">
                <div className="h-3 w-28 bg-gray-100 rounded" />
                <div className="h-3 w-10 bg-gray-100 rounded" />
              </div>
              <div className="flex justify-between">
                <div className="h-3 w-36 bg-gray-100 rounded" />
                <div className="h-3 w-10 bg-gray-100 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
