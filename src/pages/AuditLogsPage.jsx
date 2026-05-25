import { useEffect, useMemo, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { Activity, Search, ShieldAlert } from "lucide-react";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

const formatDateTime = (value) => {
  try {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString("pt-BR");
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? String(value ?? "—")
      : date.toLocaleString("pt-BR");
  } catch {
    return String(value ?? "—");
  }
};

const compactJson = (value) => {
  if (!value || typeof value !== "object") return "—";
  const entries = Object.entries(value).filter(([, item]) => item !== "");
  if (!entries.length) return "—";
  return entries
    .map(([key, item]) => `${key}: ${typeof item === "object" ? JSON.stringify(item) : item}`)
    .join(" | ");
};

export default function AuditLogsPage() {
  const { isAdmin, carregandoPerfil } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (carregandoPerfil) return undefined;
    if (!isAdmin) {
      setLogs([]);
      setLoading(false);
      return undefined;
    }

    const logsQuery = query(
      collection(db, "audit-logs"),
      orderBy("createdAt", "desc"),
      limit(300),
    );

    const unsubscribe = onSnapshot(
      logsQuery,
      (snapshot) => {
        setLogs(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar auditoria:", error);
        setLogs([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [carregandoPerfil, isAdmin]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((log) => {
      const haystack = [
        log.module,
        log.entityType,
        log.entityId,
        log.action,
        log.actor?.email,
        log.metadata && JSON.stringify(log.metadata),
        log.changedFields?.join(" "),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");
      return haystack.includes(q);
    });
  }, [logs, search]);

  if (!carregandoPerfil && !isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-200">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-5 w-5" />
            Acesso restrito
          </div>
          <p className="mt-2 text-sm">Somente administradores podem acessar os logs de auditoria.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <Activity className="w-4 h-4 text-[var(--accent)]" />
            Auditoria
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">Logs de mudanças</h1>
          <p className="text-sm text-[var(--text-muted)]">
            Registro imutável das alterações críticas realizadas no sistema.
          </p>
        </div>

        <label className="flex w-full items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-muted)] lg:max-w-sm">
          <Search className="h-4 w-4 text-[var(--accent)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Buscar por usuário, serial, módulo ou ação"
          />
        </label>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--accent-weak)]/40 text-left text-[var(--text)]">
            <tr>
              <th className="p-3">Data</th>
              <th className="p-3">Usuário</th>
              <th className="p-3">Módulo</th>
              <th className="p-3">Ação</th>
              <th className="p-3">Entidade</th>
              <th className="p-3">Campos</th>
              <th className="p-3">Antes</th>
              <th className="p-3">Depois</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[var(--text-muted)]">
                  Carregando logs...
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-[var(--text-muted)]">
                  Nenhum log encontrado.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="border-t border-[var(--line)] align-top">
                  <td className="p-3 whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="p-3">{log.actor?.email || "—"}</td>
                  <td className="p-3">{log.module || "—"}</td>
                  <td className="p-3">
                    <span className="rounded-full bg-[var(--accent)]/10 px-2 py-1 text-xs font-semibold text-[var(--accent)]">
                      {log.action || "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div>{log.entityType || "—"}</div>
                    <div className="font-mono text-xs text-[var(--text-muted)]">{log.entityId || "—"}</div>
                  </td>
                  <td className="p-3 text-xs text-[var(--text-muted)]">
                    {Array.isArray(log.changedFields) && log.changedFields.length
                      ? log.changedFields.join(", ")
                      : "—"}
                  </td>
                  <td className="max-w-xs p-3 text-xs text-[var(--text-muted)]">
                    {compactJson(log.before)}
                  </td>
                  <td className="max-w-xs p-3 text-xs text-[var(--text-muted)]">
                    {compactJson(log.after)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
