function SkeletonCard() {
  return (
    <div
      className="rounded-2xl p-7 bg-white"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="skeleton h-5 w-36 mb-2.5" />
          <div className="skeleton h-5 w-20 rounded-full" />
        </div>
        <div className="text-right">
          <div className="skeleton h-10 w-10 mb-1.5 ml-auto" />
          <div className="skeleton h-3 w-16 ml-auto" />
        </div>
      </div>
      <div className="h-px mb-6" style={{ background: '#EAE6DF' }} />
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="skeleton h-7 w-12 mb-1.5" />
          <div className="skeleton h-3 w-10" />
        </div>
        <div>
          <div className="skeleton h-7 w-12 mb-1.5" />
          <div className="skeleton h-3 w-14" />
        </div>
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div>
      <div className="mb-10">
        <div className="skeleton h-3 w-24 mb-4" />
        <div className="skeleton h-8 w-44 mb-2" />
        <div className="skeleton h-4 w-32" />
      </div>
      <div className="skeleton h-3 w-20 mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}
