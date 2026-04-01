import { useState, useEffect } from "react";
import BadgeStatus from "../components/BadgeStatus";
import { applicationsAPI } from "../services/api";

export default function Candidaturas() {
  const [candidaturas, setCandidaturas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [metodo, setMetodo] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchCandidaturas = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (metodo) params.metodo = metodo;
      if (status) params.status = status;
      const { data } = await applicationsAPI.list(params);
      setCandidaturas(data.candidaturas);
      setTotal(data.total);
    } catch (err) {
      console.error("Erro ao carregar candidaturas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidaturas();
  }, [page, metodo, status]);

  const handleUpdateStatus = async (id, newStatus) => {
    try {
      await applicationsAPI.update(id, { status: newStatus });
      setCandidaturas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error("Erro ao atualizar:", err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Candidaturas</h1>
        <p className="text-[var(--color-text-muted)] text-sm">{total} candidaturas registradas</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-4">
        <select
          value={metodo}
          onChange={(e) => { setMetodo(e.target.value); setPage(1); }}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm"
        >
          <option value="">Todos os metodos</option>
          <option value="email">Email</option>
          <option value="linkedin">LinkedIn</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="pendente">Pendente</option>
          <option value="enviada">Enviada</option>
          <option value="falhou">Falhou</option>
          <option value="respondida">Respondida</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)] overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : candidaturas.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-muted)]">
            Nenhuma candidatura registrada ainda
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Vaga</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Empresa</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Metodo</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Enviada em</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-[var(--color-text-muted)]">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {candidaturas.map((c) => (
                <tr key={c.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
                  <td className="py-3 px-4 text-sm">
                    {c.vaga ? (
                      <a href={c.vaga.url} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary-light)] hover:underline">
                        {c.vaga.titulo}
                      </a>
                    ) : "Vaga removida"}
                  </td>
                  <td className="py-3 px-4 text-sm">{c.vaga?.empresa || "-"}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      c.metodo === "linkedin" ? "bg-blue-600/20 text-blue-400" : "bg-green-600/20 text-green-400"
                    }`}>
                      {c.metodo === "linkedin" ? "LinkedIn" : "Email"}
                    </span>
                  </td>
                  <td className="py-3 px-4"><BadgeStatus status={c.status} /></td>
                  <td className="py-3 px-4 text-sm text-[var(--color-text-muted)]">
                    {c.enviada_em ? new Date(c.enviada_em).toLocaleDateString("pt-BR") : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={c.status}
                      onChange={(e) => handleUpdateStatus(c.id, e.target.value)}
                      className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-xs"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="enviada">Enviada</option>
                      <option value="respondida">Respondida</option>
                      <option value="falhou">Falhou</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] disabled:opacity-50 text-sm"
          >
            Anterior
          </button>
          <span className="text-sm text-[var(--color-text-muted)]">Pagina {page} de {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 rounded bg-[var(--color-bg-card)] border border-[var(--color-border)] disabled:opacity-50 text-sm"
          >
            Proxima
          </button>
        </div>
      )}
    </div>
  );
}
