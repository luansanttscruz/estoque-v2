import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import MovementModal from "../components/MovementModal";
import MovementHistoryModal from "../components/MovementHistoryModal";
import { Download, History, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSidebar } from "../context/SidebarContext";

const OFFICE_OPTIONS = ["São Paulo", "Rio de Janeiro", "João Pessoa", "Outros"];
const PATH_TO_OFFICE = {
  sp: "São Paulo",
  rio: "Rio de Janeiro",
  jp: "João Pessoa",
  ou: "Outros",
};

function useResolvedOffice(officeProp) {
  const location = useLocation();
  if (officeProp) return officeProp;

  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("office");
  if (fromQuery && OFFICE_OPTIONS.includes(fromQuery)) return fromQuery;

  const [, firstSegment, secondSegment] = location.pathname.split("/");
  if (
    firstSegment === "equipment-movement" &&
    secondSegment &&
    PATH_TO_OFFICE[secondSegment]
  ) {
    return PATH_TO_OFFICE[secondSegment];
  }

  return null;
}

const formatDate = (value) => {
  try {
    if (!value) return "—";
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("pt-BR");
    }
    const asString = String(value);
    const date = asString.includes("T")
      ? new Date(asString)
      : new Date(`${asString}T00:00:00`);
    return Number.isNaN(date.getTime())
      ? asString
      : date.toLocaleDateString("pt-BR");
  } catch {
    return String(value ?? "—");
  }
};

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

const escapeCsv = (value) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function MovementListPage({ office: officeProp }) {
  const office = useResolvedOffice(officeProp);
  const { usuario } = useAuth();
  const sidebar = useSidebar();
  const collapsed = sidebar?.collapsed ?? false;
  const containerWidthClass = collapsed ? "max-w-[90rem]" : "max-w-7xl";
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editMovement, setEditMovement] = useState(null);
  const [historySerial, setHistorySerial] = useState(null);

  useEffect(() => {
    if (!office) {
      setMovements([]);
      setLoading(false);
      return;
    }

    const baseRef = collection(db, "equipment-movements");
    const movementQuery = query(baseRef, where("local", "==", office));

    setLoading(true);
    const unsub = onSnapshot(
      movementQuery,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const toMillis = (value) => {
              const raw =
                typeof value?.toMillis === "function"
                  ? value.toMillis()
                  : typeof value?.toDate === "function"
                  ? value.toDate().getTime()
                  : value instanceof Date
                  ? value.getTime()
                  : value
                  ? new Date(value).getTime()
                  : 0;
              return Number.isFinite(raw) ? raw : 0;
            };
            return toMillis(b.criadoEm) - toMillis(a.criadoEm);
          });
        setMovements(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Erro ao carregar movimentações:", err);
        setMovements([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [office]);

  const filteredMovements = useMemo(() => {
    const q = busca.trim().toLowerCase();

    return movements.filter((mov) => {
      if (!q) return true;

      const haystack = [
        mov.numeroSerie,
        mov.modelo,
        mov.tipo,
        mov.responsavel,
        mov.email,
        mov.status,
        mov.disponibilidade,
        mov.obs,
      ]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }, [movements, busca]);

  const handleExport = () => {
    if (!filteredMovements.length) return;

    const head = [
      "Data",
      "Tipo",
      "Modelo",
      "Numero de Serie",
      "Responsavel",
      "Email",
      "Status do Termo",
      "Disponibilidade",
      "Observacoes",
      "Local",
      "Criado em",
    ].join(",");

    const rows = filteredMovements.map((mov) =>
      [
        formatDate(mov.data),
        mov.tipo || "",
        mov.modelo || "",
        mov.numeroSerie || "",
        mov.responsavel || "",
        mov.email || "",
        mov.status || "",
        mov.disponibilidade || "",
        mov.obs || "",
        mov.local || "",
        formatDateTime(mov.criadoEm),
      ]
        .map(escapeCsv)
        .join(",")
    );

    const csv = [head, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `movements_${(office || "geral")
      .toLowerCase()
      .replace(/\s+/g, "-")}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleNew = () => {
    setEditMovement(null);
    setModalOpen(true);
  };

  const handleEdit = (movement) => {
    setEditMovement(movement);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditMovement(null);
  };

  if (!office) {
    return (
      <div
        className={`mx-auto px-4 mt-6 space-y-3 transition-all duration-200 ${containerWidthClass}`}
      >
        <div className="text-rose-300/90">
          <p>Selecione um escritório para visualizar as movimentações.</p>
          <p className="mt-2">
            Utilize os atalhos:
            <span className="ml-2 inline-flex flex-wrap gap-2 text-sm text-[var(--text)]">
              <code>/equipment-movement/sp</code>
              <code>/equipment-movement/rio</code>
              <code>/equipment-movement/jp</code>
            </span>
            {" "}
            ou informe via query string como
            <code className="ml-2">/equipment-movement?office=São Paulo</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mx-auto px-4 transition-all duration-200 ${containerWidthClass}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text)]">
            <span className="text-[var(--accent)]">{office}</span>{" "}
            <span className="text-[var(--text-muted)]">- Movimentações</span>
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Monitoramento das entradas e saídas de equipamentos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-pink-300/90">
            {loading
              ? "Carregando…"
              : `${filteredMovements.length} registro${
                  filteredMovements.length === 1 ? "" : "s"
                }`}
          </span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por serial, responsável, modelo…"
            className="px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--line)]
                       text-[var(--text)] placeholder:text-[var(--text-muted)]
                       focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            onClick={handleExport}
            disabled={!filteredMovements.length}
            className="inline-flex items-center gap-1 text-sm text-emerald-300/90 border border-emerald-400/40
                       px-3 py-1.5 rounded-lg hover:bg-emerald-400/10 transition disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button
            onClick={handleNew}
            className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg
                       bg-[var(--accent)]/10 text-[var(--accent)]
                       border border-[var(--accent)]/50 hover:bg-[var(--accent)]/20 transition"
          >
            <Plus className="w-4 h-4" />
            Nova movimentação
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-card)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--accent-weak)]/40 text-[var(--text)]">
            <tr className="text-left">
              <th className="p-3">Data</th>
              <th className="p-3">Tipo</th>
              <th className="p-3">Modelo</th>
              <th className="p-3">Nº de Série</th>
              <th className="p-3">Responsável</th>
              <th className="p-3">E-mail</th>
              <th className="p-3">Status do Termo</th>
              <th className="p-3">Disponibilidade</th>
              <th className="p-3">Observações</th>
              <th className="p-3">Criado em</th>
              <th className="p-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-[var(--text-muted)]"
                >
                  Carregando movimentações…
                </td>
              </tr>
            ) : filteredMovements.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="p-6 text-center text-[var(--text-muted)]"
                >
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            ) : (
              filteredMovements.map((mov) => (
                <tr
                  key={mov.id || mov.numeroSerie}
                  onClick={() => handleEdit(mov)}
                  className="border-t border-[var(--line)] hover:bg-[var(--rowHover)]
                             transition cursor-pointer"
                >
                  <td className="p-3">{formatDate(mov.data)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        mov.tipo === "Entrada"
                          ? "bg-green-500/15 text-green-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {mov.tipo || "—"}
                    </span>
                  </td>
                  <td className="p-3">{mov.modelo || "—"}</td>
                  <td className="p-3">{mov.numeroSerie || "—"}</td>
                  <td className="p-3">{mov.responsavel || "—"}</td>
                  <td className="p-3">{mov.email || "—"}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        mov.status === "Finalizado"
                          ? "bg-green-500/15 text-green-300"
                          : "bg-yellow-400/15 text-yellow-300"
                      }`}
                    >
                      {mov.status || "—"}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        mov.disponibilidade === "Disponível"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {mov.disponibilidade || "—"}
                    </span>
                  </td>
                  <td className="p-3">{mov.obs || "—"}</td>
                  <td className="p-3">{formatDateTime(mov.criadoEm)}</td>
                  <td
                    className="p-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(mov)}
                        className="px-3 py-1.5 text-xs rounded border border-[var(--line)]
                                   text-[var(--text)] hover:bg-white/5 transition"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() =>
                          mov.numeroSerie && setHistorySerial(mov.numeroSerie)
                        }
                        className="px-3 py-1.5 text-xs rounded border border-[var(--accent-weak)]
                                   text-[var(--accent)] hover:bg-[var(--accent)]/10 transition inline-flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" />
                        Histórico
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <MovementModal
        open={modalOpen}
        onClose={closeModal}
        office={office}
        usuario={usuario}
        numeroSerie={
          editMovement?.numeroSerie ? String(editMovement.numeroSerie) : ""
        }
        editMovement={editMovement}
      />

      <MovementHistoryModal
        open={Boolean(historySerial)}
        onClose={() => setHistorySerial(null)}
        numeroSerie={historySerial || ""}
      />
    </div>
  );
}
