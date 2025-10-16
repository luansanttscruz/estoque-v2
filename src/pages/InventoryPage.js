// src/pages/InventoryPage.js
import { useEffect, useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, deleteDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import NotebookDetailModal from "../components/NotebookDetailModal";
import NotebookEditModal from "../components/NotebookEditModal";
import MovementModal from "../components/MovementModal";
import { Download, Building2, Plus, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";
import showToast from "../utils/showToast";

// Mapeamento fixo -> coleção do Firestore
const MAP_OFFICE_TO_COLLECTION = {
  "Rio de Janeiro": "rio-de-janeiro",
  "São Paulo": "sao-paulo",
  "João Pessoa": "joao-pessoa",
  Outros: "outros",
};

// Suporte para acessar via path direto (/rio, /sp, /jp, /ou)
const MAP_PATH_TO_OFFICE = {
  "/rio": "Rio de Janeiro",
  "/sp": "São Paulo",
  "/jp": "João Pessoa",
  "/ou": "Outros",
};

// Lista para cards (nome, path, colecao)
const OFFICES = [
  { nome: "São Paulo", path: "/sp", colecao: "sao-paulo" },
  { nome: "Rio de Janeiro", path: "/rio", colecao: "rio-de-janeiro" },
  { nome: "João Pessoa", path: "/jp", colecao: "joao-pessoa" },
  { nome: "Outros", path: "/ou", colecao: "outros" },
];

function useOfficeAndCollection(officeProp, collectionProp) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  let office = officeProp || null;
  let collectionName = collectionProp || null;

  // 1) query string ?office=São Paulo
  if (!office) {
    const qOffice = params.get("office");
    if (qOffice && MAP_OFFICE_TO_COLLECTION[qOffice]) office = qOffice;
  }
  // 2) path /rio | /sp | /jp | /ou
  if (!office) {
    const firstSeg = "/" + location.pathname.split("/")[1];
    if (MAP_PATH_TO_OFFICE[firstSeg]) office = MAP_PATH_TO_OFFICE[firstSeg];
  }
  // 3) coleção pelo escritório
  if (!collectionName && office && MAP_OFFICE_TO_COLLECTION[office]) {
    collectionName = MAP_OFFICE_TO_COLLECTION[office];
  }
  return { office, collectionName };
}

export default function InventoryPage({
  office: officeProp,
  collectionName: collectionProp,
}) {
  const { office, collectionName } = useOfficeAndCollection(
    officeProp,
    collectionProp
  );

  const [items, setItems] = useState([]);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [editNotebook, setEditNotebook] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const { usuario } = useAuth();
  const sidebar = useSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const tableWidthClass = collapsed
    ? "max-w-[calc(100vw-8rem)]"
    : "max-w-[calc(100vw-22rem)]";
  const cardsWidthClass = "max-w-6xl";

  // ---- CARDS: contadores em tempo real quando NÃO há office/coleção ----
  const [counts, setCounts] = useState(() =>
    Object.fromEntries(
      OFFICES.map((o) => [o.nome, { total: 0, disponiveis: 0 }])
    )
  );

  useEffect(() => {
    // Se NÃO tiver collectionName, estamos na visão de CARDS (/inventory)
    if (collectionName) return;
    const unsubs = OFFICES.map(({ nome, colecao }) =>
      onSnapshot(collection(db, colecao), (snap) => {
        const total = snap.size;
        const disponiveis = snap.docs.reduce((acc, d) => {
          const st = String(d.data()?.status || "").toLowerCase();
          return acc + (st === "disponivel" ? 1 : 0);
        }, 0);
        setCounts((prev) => ({ ...prev, [nome]: { total, disponiveis } }));
      })
    );
    return () => unsubs.forEach((u) => u && u());
  }, [collectionName]);

  // ---- TABELA: carrega dados do Firestore quando há collectionName ----
  useEffect(() => {
    if (!collectionName) return; // evita "empty path"
    const q = query(
      collection(db, collectionName),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [collectionName]);

  // Filtro local
  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) =>
      `${it.serial} ${it.modelo} ${it.email}`.toLowerCase().includes(q)
    );
  }, [items, busca]);

  // Export CSV
  const handleExport = () => {
    const head = [
      "Serial",
      "Modelo",
      "Status",
      "E-mail",
      "Observação",
      "Criado em",
    ].join(",");
    const rows = filtered.map((it) =>
      [
        it.serial,
        it.modelo,
        it.status || "",
        it.email || "",
        it.observacao || "",
        it.createdAt?.toDate?.()?.toLocaleDateString?.("pt-BR") || "",
      ]
        .map((v) => `"${String(v ?? "")}"`)
        .join(",")
    );
    const csv = [head, ...rows].join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory_${(office || "geral")
      .toLowerCase()
      .replace(/\s+/g, "-")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ======== VIEW 1: CARDS NEON (quando NÃO há office/collection) ========
  if (!collectionName) {
    return (
      <div className={`mx-auto w-full p-6 transition-all duration-200 ${cardsWidthClass}`}>
        {/* Título */}
        <div className="flex items-center justify-center gap-2 text-[var(--text)] text-3xl font-bold mb-8">
          <span className="text-[var(--accent)] drop-shadow">
            Notebook Stock
          </span>
          <Building2 className="w-8 h-8 text-pink-400" />
        </div>

        {/* Grid de Cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {OFFICES.map((o, i) => {
            const { total, disponiveis } = counts[o.nome] || {
              total: 0,
              disponiveis: 0,
            };
            return (
              <motion.div
                key={o.nome}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.02 }}
                className="group relative rounded-2xl border border-[var(--line)] bg-[var(--bg-card)]
                           hover:border-[var(--accent)] transition-all duration-200 shadow-xl"
              >
                {/* Glow neon suave */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition
                             shadow-[0_0_24px_0_rgba(225,29,116,0.25),0_0_60px_0_rgba(225,29,116,0.18)]"
                />

                <Link
                  to={o.path}
                  className="relative flex items-center gap-4 p-6"
                >
                  <div
                    className="bg-pink-100/10 ring-1 ring-pink-500/30 text-pink-300 p-3 rounded-full
                                  group-hover:ring-pink-500/60 transition"
                  >
                    <Building2 className="w-6 h-6" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xl font-semibold text-[var(--text)]">
                      {o.nome}
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                      {total} Registered Notebook{total !== 1 ? "s" : ""}
                    </p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {disponiveis} Available
                    </p>
                  </div>

                  {/* indicador sutil à direita */}
                  <div className="ml-auto w-2 h-2 rounded-full bg-pink-400/70 group-hover:bg-pink-400" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  }

  // ======== VIEW 2: TABELA (quando há office/collection) ========
  return (
    <div
      className={`mx-auto w-full px-4 transition-all duration-200 ${tableWidthClass}`}
    >
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2 className="text-2xl font-semibold text-[var(--text)]">
          <span className="text-[var(--accent)]">{office}</span>{" "}
          <span className="text-[var(--text-muted)]">- Notebooks</span>
        </h2>
        <div className="flex items-center flex-wrap gap-3">
          <span className="text-sm text-pink-300/90">
            {filtered.length} encontrado{filtered.length !== 1 ? "s" : ""}
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar…"
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
          <button
            onClick={() => setMovementModalOpen(true)}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg
                       bg-[var(--accent)]/10 text-[var(--accent)]
                       border border-[var(--accent)]/50 hover:bg-[var(--accent)]/20 transition"
          >
            <Plus className="w-4 h-4" />
            Cadastro
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-card)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--accent-weak)]/40 text-[var(--text)]">
            <tr className="text-left">
              <th className="p-3">Nº de Série</th>
              <th className="p-3">Modelo</th>
              <th className="p-3">Status</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Observação</th>
              <th className="p-3">Criado em</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-4 text-center text-[var(--text-muted)]"
                >
                  Nenhum notebook encontrado.
                </td>
              </tr>
            ) : (
              filtered.map((it) => (
                <tr
                  key={it.id || it.serial}
                  onClick={() => {
                    setSelected(it);
                    setModalOpen(true);
                  }}
                  className="border-t border-[var(--line)] hover:bg-[var(--rowHover)] transition cursor-pointer"
                >
                  <td className="p-3">{it.serial}</td>
                  <td className="p-3">{it.modelo}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          String(it.status || "").toLowerCase() === "disponivel"
                            ? "bg-emerald-400"
                            : "bg-rose-400"
                        }`}
                      />
                      {String(it.status || "").toLowerCase() === "disponivel"
                        ? "Disponível"
                        : "Indisponível"}
                    </span>
                  </td>
                  <td className="p-3">{it.email || "—"}</td>
                  <td className="p-3">{it.observacao || "—"}</td>
                  <td className="p-3">
                    {it.createdAt?.toDate?.()?.toLocaleDateString?.("pt-BR") ||
                      "—"}
                  </td>
                  {/* Ações não disparam a modal */}
                  <td
                    className="p-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setEditNotebook(it)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--line)]
                                 text-[var(--text)] hover:bg-white/5 transition"
                    >
                      <Pencil className="w-4 h-4 text-[var(--accent)]" />
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && selected && (
        <NotebookDetailModal
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          notebook={selected}
          onEdit={(nb) => {
            setEditNotebook(nb);
            setModalOpen(false);
          }}
        />
      )}

      <MovementModal
        open={movementModalOpen}
        onClose={() => setMovementModalOpen(false)}
        office={office}
        usuario={usuario}
        numeroSerie=""
        editMovement={null}
        variant="inventory"
      />

      {editNotebook && (
        <NotebookEditModal
          open={Boolean(editNotebook)}
          notebook={editNotebook}
          onClose={() => setEditNotebook(null)}
          collectionName={collectionName}
          onDelete={(nb) => {
            setEditNotebook(null);
            setConfirmDelete(nb);
          }}
          deleting={Boolean(deletingId)}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <div className="px-5 py-4 border-b border-[var(--line)] flex items-center gap-3">
              <div className="p-2 rounded-full bg-rose-500/15 text-rose-300">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Confirmar exclusão
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Esta ação remove o notebook do estoque de {office}.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <p className="text-[var(--text)]">
                Deseja remover{" "}
                <span className="font-semibold">
                  {confirmDelete.modelo || "Notebook"}
                </span>{" "}
                {confirmDelete.serial && (
                  <>
                    (serial{" "}
                    <span className="font-mono text-[var(--accent)]">
                      {confirmDelete.serial}
                    </span>
                    )
                  </>
                )}{" "}
                do estoque?
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                O histórico de movimentações permanece disponível.
              </p>
            </div>
            <div className="px-5 py-4 border-t border-[var(--line)] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                onClick={async () => {
                  if (!confirmDelete?.id || deletingId) return;
                  setDeletingId(confirmDelete.id);
                  try {
                    await deleteDoc(doc(db, collectionName, confirmDelete.id));
                    showToast({
                      type: "success",
                      message: "Notebook removido do estoque.",
                    });
                    setSelected((prev) =>
                      prev?.id === confirmDelete.id ? null : prev
                    );
                    setModalOpen(false);
                  } catch (err) {
                    console.error(err);
                    showToast({
                      type: "error",
                      message: "Não foi possível remover notebook.",
                      description: err?.message,
                    });
                  } finally {
                    setDeletingId(null);
                    setConfirmDelete(null);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-rose-500/40 text-white bg-rose-600
                           hover:bg-rose-500/80 transition disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={Boolean(deletingId)}
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
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => {
                    if (deletingId) return;
                    setConfirmDelete(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-[var(--line)] text-[var(--text)]
                             hover:bg-white/5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  disabled={Boolean(deletingId)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
