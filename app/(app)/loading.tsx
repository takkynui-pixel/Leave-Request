export default function Loading() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true">
      <div className="h-6 w-56 rounded-full bg-slate-200/70" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="h-52 rounded-[32px] bg-slate-200/70" />
        <div className="h-52 rounded-[28px] bg-white" />
        <div className="h-52 rounded-[28px] bg-white" />
      </div>
      <div className="h-64 rounded-[28px] bg-white" />
    </div>
  );
}
