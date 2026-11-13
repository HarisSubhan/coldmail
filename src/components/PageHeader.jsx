function PageHeader({ title, subtitle, action }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>;
}
function StatusBadge({ status }) {
  const map = {
    draft: "bg-muted text-muted-foreground",
    approved: "bg-accent text-aqua",
    running: "bg-primary/20 text-primary",
    paused: "bg-warning/20 text-warning",
    stopped: "bg-destructive/20 text-destructive",
    completed: "bg-success/20 text-success",
    sent: "bg-success/20 text-success",
    failed: "bg-destructive/20 text-destructive"
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? "bg-muted"}`}>{status}</span>;
}
export {
  PageHeader,
  StatusBadge
};
