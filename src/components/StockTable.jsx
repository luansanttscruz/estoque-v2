import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { Download, Monitor, Mail, NotebookPen, Loader2, AlertTriangle } from "lucide-react";
import NotebookDetailModal from "./NotebookDetailModal";
import showToast from "../utils/showToast";

/** Badge de disponibilidade */
function AvailabilityBadge({ status }) {
  const ok =
    (status || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "") === "disponivel";

  return (
    <span
      className={[
        "inline-flex items-center gap-2 text-xs font-semibold px-2 py-0.5 rounded-full",
        ok ? "bg-green-500/15 text-green-400" : "bg-rose-500/15 text-rose-300",
      ].join(" ")}
    >
      <span
        className={[
          "w-2 h-2 rounded-full",
          ok ? "bg-green-400" : "bg-rose-300",
        ].join(" ")}
      />
      {ok ? "Disponível" : "Indisponível"}
    </span>
  );
}

export default function StockTable({ office, collectionName }) {
  const [rows, setRows] = useState([]);
  const [queryText, setQueryText] = useState("");
  const [activeRowId, setActiveRowId] = useState(null);

  // modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, collectionName), (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows(data);
    });
    return () => unsub();
  }, [collectionName]);

  const filtered = useMemo(() => {
    const t = queryText.toLowerCase();
    return rows.filter((r) => {
      const serial = (r.serial || "").toLowerCase();
      const modelo = (r.modelo || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const obs = (r.observacao || r.obs || "").toLowerCase();
      return (
        serial.includes(t) ||
        modelo.includes(t) ||
        email.includes(t) ||
        obs.includes(t)
      );
    });
  }, [rows, queryText]);

  const handleExport = () => {
    const csv = [
      ["Serial", "Modelo", "Status", "E-mail", "Observação", "Criado em"].join(
        ","
      ),
      ...filtered.map((r) =>
        [
          r.serial || "",
          r.modelo || "",
          r.status || "",
          r.email || "",
          r.observacao || r.obs || "",
          r.createdAt?.toDate?.()?.toLocaleDateString?.("pt-BR") || "",
        ]
          .map((v) => `"${String(v).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `inventory_${office}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const openDetail = (notebook) => {
    setActiveRowId(notebook.id);
    setDetailItem(notebook);
    setDetailOpen(true);
  };

  const requestDelete = (notebook) => {
    if (!notebook) return;
    setPendingDelete(notebook);
  };

  const cancelDelete = () => {
    if (deletingId) return;
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id) {
      setPendingDelete(null);
      return;
    }
    setDeletingId(pendingDelete.id);
    try {
      await deleteDoc(doc(db, collectionName, pendingDelete.id));
      showToast({
        type: "success",
        message: "Equipamento removido do estoque.",
      });
      setDetailOpen(false);
      setDetailItem(null);
      setActiveRowId(null);
    } catch (err) {
      console.error(err);
      showToast({
        type: "error",
        message: "Não foi possível remover o equipamento.",
        description: err?.message || "Tente novamente em instantes.",
      });
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  return (
    <div className="w-full max-w-full mx-auto px-4 lg:px-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-[var(--text)]">
          <span className="text-[var(--accent)]">{office}</span>{" "}
          <span className="text-[var(--text-muted)]">- Notebooks</span>
        </h2>

        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm text-[var(--text-muted)]">
            {filtered.length} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>

          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Buscar serial, modelo, e-mail, observação..."
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--line)]
                       text-[var(--text)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />

          <button
            onClick={handleExport}
            className="text-sm text-emerald-300/90 border border-emerald-400/40 px-3 py-1.5 rounded-lg
                     hover:bg-emerald-400/10 transition inline-flex items-center gap-1"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl overflow-hidden border border-[var(--line)] bg-[var(--bg-card)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--accent-weak)]/40 text-[var(--text)]">
            <tr className="text-left">
              <th className="p-3">Serial</th>
              <th className="p-3">Modelo</th>
              <th className="p-3">Status</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Observação</th>
              <th className="p-3">Criado em</th>
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-4 text-center text-[var(--text-muted)]"
                >
                  Nenhum notebook encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const isActive = activeRowId === r.id;
                return (
                  <tr
                    key={r.id}
                    onClick={() => openDetail(r)}
                    className={[
                      "border-t border-[var(--line)] cursor-pointer transition-colors",
                      "hover:bg-[var(--rowHover)]",
                      isActive
                        ? "bg-[var(--rowActive)] outline outline-1 outline-[var(--accent)]"
                        : "",
                    ].join(" ")}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-[var(--accent)]" />
                        <span>{r.serial || "—"}</span>
                      </div>
                    </td>
                    <td className="p-3">{r.modelo || "—"}</td>
                    <td className="p-3">
                      <AvailabilityBadge status={r.status} />
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 opacity-70" />
                        <span>{r.email || "—"}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <NotebookPen className="w-4 h-4 opacity-70" />
                        <span className="truncate max-w-[30ch]">
                          {r.observacao || r.obs || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="p-3">
                      {r.createdAt?.toDate?.()?.toLocaleDateString?.("pt-BR") ||
                        "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal de detalhes (abre ao clicar na linha) */}
      {detailOpen && (
        <NotebookDetailModal
          open={detailOpen}
          onClose={() => {
            setDetailOpen(false);
            setActiveRowId(null);
            setDetailItem(null);
          }}
          notebook={detailItem}
          office={office}
          onDelete={requestDelete}
          deleting={Boolean(deletingId)}
        />
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center gap-3">
              <div className="p-2 rounded-full bg-rose-500/10 text-rose-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Confirmar exclusão
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Esta ação remove o equipamento do estoque atual.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p className="text-[var(--text)]">
                Deseja remover{" "}
                <span className="font-semibold">
                  {pendingDelete.modelo || "Notebook"}
                </span>{" "}
                {pendingDelete.serial && (
                  <>
                    (serial{" "}
                    <span className="font-mono text-[var(--accent)]">
                      {pendingDelete.serial}
                    </span>
                    )
                  </>
                )}{" "}
                do estoque de {office}?
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                A movimentação histórica permanece registrada.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[var(--line)] flex justify-end gap-3">
              <button
                onClick={cancelDelete}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                           hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={Boolean(deletingId)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-500/40 text-white bg-rose-600
                           hover:bg-rose-500/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  "Excluir"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
