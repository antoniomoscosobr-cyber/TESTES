import { useState, useEffect } from "react";
import { Briefcase, Send, Mail, MessageCircle, Play, Square } from "lucide-react";
import CardEstatistica from "../components/CardEstatistica";
import TabelaVagas from "../components/TabelaVagas";
import { GraficoBarras, GraficoPizza } from "../components/GraficoCandidaturas";
import { dashboardAPI, scraperAPI } from "../services/api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);

  const fetchStats = async () => {
    try {
      const { data } = await dashboardAPI.getStats();
      setStats(data);
    } catch (err) {
      console.error("Erro ao carregar estatisticas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleScrape = async () => {
    setScraping(true);
    try {
      await scraperAPI.run();
      await fetchStats();
    } catch (err) {
      console.error("Erro no scraping:", err);
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-[var(--color-text-muted)] text-sm">Visao geral das suas candidaturas</p>
        </div>
        <button
          onClick={handleScrape}
          disabled={scraping}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 rounded-lg transition-colors text-sm font-medium"
        >
          {scraping ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Buscando...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Buscar Vagas Agora
            </>
          )}
        </button>
      </div>

      {/* Cards de Estatisticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardEstatistica titulo="Total de Vagas" valor={stats?.total_vagas || 0} icone={Briefcase} cor="primary" />
        <CardEstatistica titulo="Candidaturas Enviadas" valor={stats?.candidaturas_enviadas || 0} icone={Send} cor="success" />
        <CardEstatistica titulo="Via Email" valor={stats?.candidaturas_email || 0} icone={Mail} cor="info" />
        <CardEstatistica titulo="Via LinkedIn" valor={stats?.candidaturas_linkedin || 0} icone={MessageCircle} cor="warning" />
      </div>

      {/* Graficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4">Candidaturas por Dia</h3>
          <GraficoBarras data={stats?.candidaturas_por_dia || []} />
        </div>
        <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)]">
          <h3 className="text-lg font-semibold mb-4">Vagas por Fonte</h3>
          <GraficoPizza data={stats?.vagas_por_fonte || []} />
        </div>
      </div>

      {/* Vagas Recentes */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)]">
        <h3 className="text-lg font-semibold mb-4">Vagas Recentes</h3>
        <TabelaVagas vagas={stats?.vagas_recentes || []} compact />
      </div>
    </div>
  );
}
