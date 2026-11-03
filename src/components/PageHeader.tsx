export default function PageHeader({ kicker, title, children }: { kicker?: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 print:hidden">
      <div>
        {kicker && <p className="text-sm font-semibold capitalize text-muted">{kicker}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
