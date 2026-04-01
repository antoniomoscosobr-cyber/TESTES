import { useState, useEffect } from "react";
import { Save, Upload, Plus, X } from "lucide-react";
import { settingsAPI } from "../services/api";

export default function Configuracoes() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newKeyword, setNewKeyword] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await settingsAPI.get();
      setSettings(data);
    } catch (err) {
      console.error("Erro ao carregar configuracoes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await settingsAPI.update(settings);
      setMessage("Configuracoes salvas com sucesso!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Erro ao salvar configuracoes");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUploadResume = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await settingsAPI.uploadResume(file);
      setMessage("Curriculo enviado com sucesso!");
      fetchSettings();
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setMessage("Erro ao enviar curriculo");
      console.error(err);
    }
  };

  const addKeyword = () => {
    if (newKeyword.trim() && !settings.palavras_chave.includes(newKeyword.trim())) {
      setSettings({
        ...settings,
        palavras_chave: [...settings.palavras_chave, newKeyword.trim()],
      });
      setNewKeyword("");
    }
  };

  const removeKeyword = (kw) => {
    setSettings({
      ...settings,
      palavras_chave: settings.palavras_chave.filter((k) => k !== kw),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configuracoes</h1>
        <p className="text-[var(--color-text-muted)] text-sm">Configure suas preferencias de busca e credenciais</p>
      </div>

      {message && (
        <div className={`p-3 rounded-lg text-sm ${
          message.includes("sucesso") ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
        }`}>
          {message}
        </div>
      )}

      {/* Palavras-chave */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">Palavras-chave</h2>
        <div className="flex flex-wrap gap-2">
          {settings?.palavras_chave?.map((kw) => (
            <span key={kw} className="flex items-center gap-1 bg-[var(--color-primary)]/20 text-[var(--color-primary-light)] px-3 py-1 rounded-full text-sm">
              {kw}
              <button onClick={() => removeKeyword(kw)} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
            placeholder="Nova palavra-chave..."
            className="flex-1 px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
          <button onClick={addKeyword} className="px-4 py-2 bg-[var(--color-primary)] rounded-lg text-sm">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Localizacao */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">Localizacao e Modalidade</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Localizacao</label>
            <input
              type="text"
              value={settings?.localizacao || ""}
              onChange={(e) => setSettings({ ...settings, localizacao: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Modalidade</label>
            <select
              value={settings?.modalidade || "Remoto"}
              onChange={(e) => setSettings({ ...settings, modalidade: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm"
            >
              <option value="Remoto">Remoto</option>
              <option value="Hibrido">Hibrido</option>
              <option value="Presencial">Presencial</option>
              <option value="Qualquer">Qualquer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Email SMTP */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">Email (SMTP)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Servidor SMTP</label>
            <input
              type="text"
              value={settings?.email_smtp_host || ""}
              onChange={(e) => setSettings({ ...settings, email_smtp_host: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Porta</label>
            <input
              type="number"
              value={settings?.email_smtp_port || 587}
              onChange={(e) => setSettings({ ...settings, email_smtp_port: parseInt(e.target.value) })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Email</label>
            <input
              type="email"
              value={settings?.email_smtp_user || ""}
              onChange={(e) => setSettings({ ...settings, email_smtp_user: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Senha / App Password</label>
            <input
              type="password"
              value={settings?.email_smtp_pass || ""}
              onChange={(e) => setSettings({ ...settings, email_smtp_pass: e.target.value })}
              placeholder={settings?.email_smtp_pass === "***" ? "Ja configurada" : ""}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>

      {/* LinkedIn */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">LinkedIn</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Email</label>
            <input
              type="email"
              value={settings?.linkedin_email || ""}
              onChange={(e) => setSettings({ ...settings, linkedin_email: e.target.value })}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1">Senha</label>
            <input
              type="password"
              value={settings?.linkedin_pass || ""}
              onChange={(e) => setSettings({ ...settings, linkedin_pass: e.target.value })}
              placeholder={settings?.linkedin_pass === "***" ? "Ja configurada" : ""}
              className="w-full px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      </div>

      {/* Curriculo */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">Curriculo</h2>
        {settings?.curriculo_path && (
          <p className="text-sm text-[var(--color-text-muted)]">Arquivo atual: {settings.curriculo_path}</p>
        )}
        <label className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-hover)] rounded-lg cursor-pointer hover:bg-[var(--color-border)] transition-colors w-fit">
          <Upload className="w-4 h-4" />
          <span className="text-sm">Enviar PDF</span>
          <input type="file" accept=".pdf" onChange={handleUploadResume} className="hidden" />
        </label>
      </div>

      {/* Intervalo */}
      <div className="bg-[var(--color-bg-card)] rounded-xl p-6 border border-[var(--color-border)] space-y-4">
        <h2 className="text-lg font-semibold">Automacao</h2>
        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1">Intervalo de busca (minutos)</label>
          <input
            type="number"
            min="15"
            value={settings?.intervalo_busca || 60}
            onChange={(e) => setSettings({ ...settings, intervalo_busca: parseInt(e.target.value) })}
            className="w-32 px-4 py-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>
      </div>

      {/* Salvar */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 rounded-lg transition-colors font-medium"
      >
        <Save className="w-5 h-5" />
        {saving ? "Salvando..." : "Salvar Configuracoes"}
      </button>
    </div>
  );
}
