import { useState, useEffect } from "react";
import { Search, Filter } from "lucide-react";
import TabelaVagas from "../components/TabelaVagas";
import { jobsAPI } from "../services/api";

export default function Vagas() {
  const [vagas, setVagas] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busca, setBusca] = useState("");
  const [fonte, setFonte] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchVagas = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (busca) params.busca = busca;
      if (fonte) params.fonte = fonte;
      if (status) params.status = status;
      const { data } = await jobsAPI.list(params);
      setVagas(data.vagas);
      setTotal(data.total);
    } catch (err) {
      console.error("Erro ao carregar vagas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVagas();
  }, [page, fonte, status]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchVagas();
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      await jobsAPI.updateStatus(jobId, newStatus);
      setVagas((prev) => prev.map((v) => (v.id === jobId ? { ...v, status: newStatus } : v)));
    } catch (err) {
      console.error("Erro ao atualizar status:", err);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vagas</h1>
        <p className="text-[var(--color-text-muted)] text-sm">{total} vagas encontradas</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por titulo, empresa..."
              className="w-full pl-10 pr-4 py-2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </form>
        <select
          value={fonte}
          onChange={(e) => { setFonte(e.target.value); setPage(1); }}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm"
        >
          <option value="">Todas as fontes</option>
          <option value="linkedin">LinkedIn</option>
          <option value="indeed">Indeed</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg px-4 py-2 text-sm"
        >
          <option value="">Todos os status</option>
          <option value="nova">Nova</option>
          <option value="interessante">Interessante</option>
          <option value="descartada">Descartada</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-[var(--color-bg-card)] rounded-xl border border-[var(--color-border)]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
          </div>
        ) : (
          <TabelaVagas vagas={vagas} onStatusChange={handleStatusChange} />
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
          <span className="text-sm text-[var(--color-text-muted)]">
            Pagina {page} de {totalPages}
          </span>
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
