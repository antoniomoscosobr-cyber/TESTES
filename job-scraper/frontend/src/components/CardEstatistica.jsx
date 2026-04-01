export default function CardEstatistica({ titulo, valor, icone: Icon, cor = "primary" }) {
  const cores = {
    primary: "text-[var(--color-primary)]",
    success: "text-[var(--color-success)]",
    warning: "text-[var(--color-warning)]",
    danger: "text-[var(--color-danger)]",
    info: "text-[var(--color-info)]",
  };

  return (
    <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">{titulo}</p>
          <p className="text-3xl font-bold mt-1">{valor}</p>
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg bg-[var(--color-bg-hover)] ${cores[cor]}`}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </div>
  );
}
