import BadgeStatus from "./BadgeStatus";

export default function TabelaVagas({ vagas, onStatusChange, compact = false }) {
  if (!vagas || vagas.length === 0) {
    return (
      <div className="text-center py-8 text-[var(--color-text-muted)]">
        Nenhuma vaga encontrada
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Titulo</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Empresa</th>
            {!compact && (
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Local</th>
            )}
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Fonte</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Status</th>
            {!compact && (
              <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Acoes</th>
            )}
          </tr>
        </thead>
        <tbody>
          {vagas.map((vaga) => (
            <tr key={vaga.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)] transition-colors">
              <td className="py-3 px-4">
                <a
                  href={vaga.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-primary-light)] hover:underline text-sm"
                >
                  {vaga.titulo}
                </a>
              </td>
              <td className="py-3 px-4 text-sm">{vaga.empresa}</td>
              {!compact && <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">{vaga.localizacao}</td>}
              <td className="py-3 px-4">
                <span className={`text-xs font-medium px-2 py-1 rounded ${
                  vaga.fonte === "linkedin" ? "bg-blue-600/20 text-blue-400" : "bg-purple-600/20 text-purple-400"
                }`}>
                  {vaga.fonte === "linkedin" ? "LinkedIn" : "Indeed"}
                </span>
              </td>
              <td className="py-3 px-4"><BadgeStatus status={vaga.status} /></td>
              {!compact && onStatusChange && (
                <td className="py-3 px-4">
                  <select
                    value={vaga.status}
                    onChange={(e) => onStatusChange(vaga.id, e.target.value)}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
                  >
                    <option value="nova">Nova</option>
                    <option value="interessante">Interessante</option>
                    <option value="descartada">Descartada</option>
                  </select>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
