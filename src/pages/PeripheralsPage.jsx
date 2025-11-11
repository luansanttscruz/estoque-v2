import { useEffect, useMemo, useState } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  Building2,
  Headphones,
  Keyboard,
  Monitor,
  Mouse,
  Printer,
  HardDrive,
  Plug,
  Router,
  Server,
  Tablet,
  PlusCircle,
  PenSquare,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Download,
} from "lucide-react";
import showToast from "../utils/showToast";

const OFFICES = [
  { id: "sao-paulo", name: "São Paulo" },
  { id: "rio-de-janeiro", name: "Rio de Janeiro" },
  { id: "joao-pessoa", name: "João Pessoa" },
  { id: "outros", name: "Outros" },
];

const APP_SETTINGS_DOC = doc(db, "appSettings", "global");

const DEFAULT_CATEGORIES = [
  { id: "headset", label: "Fones", icon: "headphones" },
  { id: "keyboard-mouse", label: "Teclados / Mouses", icon: "keyboard" },
  { id: "monitor", label: "Monitores", icon: "monitor" },
];

const CATEGORY_ICON_MAP = {
  headphones: Headphones,
  headset: Headphones,
  earphones: Headphones,
  keyboard: Keyboard,
  "keyboard-mouse": Keyboard,
  mouse: Mouse,
  peripherals: Keyboard,
  monitor: Monitor,
  screen: Monitor,
  display: Monitor,
  printer: Printer,
  "hard-drive": HardDrive,
  storage: HardDrive,
  dock: HardDrive,
  plug: Plug,
  cable: Plug,
  router: Router,
  modem: Router,
  server: Server,
  rack: Server,
  tablet: Tablet,
  mobile: Tablet,
};

const resolveIcon = (icon) =>
  CATEGORY_ICON_MAP[icon?.toLowerCase?.() || ""] || Headphones;

const sanitizeCategories = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_CATEGORIES;
  return raw
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        if (!label) return null;
        const lower = label.toLowerCase();
        const icon = lower.includes("monitor")
          ? "monitor"
          : lower.includes("teclado") || lower.includes("keyboard")
          ? "keyboard"
          : lower.includes("mouse")
          ? "mouse"
          : lower.includes("printer") || lower.includes("impress")
          ? "printer"
          : lower.includes("router") ||
            lower.includes("modem") ||
            lower.includes("wifi")
          ? "router"
          : lower.includes("cabo") ||
            lower.includes("energia") ||
            lower.includes("plug")
          ? "plug"
          : lower.includes("storage") ||
            lower.includes("dock") ||
            lower.includes("hd")
          ? "hard-drive"
          : lower.includes("server") || lower.includes("rack")
          ? "server"
          : lower.includes("tablet") ||
            lower.includes("mobile") ||
            lower.includes("phone")
          ? "tablet"
          : "headphones";
        return {
          id: label.toLowerCase().replace(/\s+/g, "-"),
          label,
          icon,
        };
      }
      const label = (item?.label || item?.name || "").trim();
      if (!label) return null;
      const id =
        item?.id ||
        label
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/\s+/g, "-");
      return {
        id,
        label,
        icon: item?.icon || "headphones",
        system: Boolean(item?.system),
      };
    })
    .filter(Boolean);
};

const createEmptyStats = (categories) =>
  OFFICES.reduce((acc, office) => {
    acc[office.id] = {
      office,
      totals: categories.reduce((totals, category) => {
        totals[category.id] = 0;
        return totals;
      }, {}),
    };
    return acc;
  }, {});

export default function PeripheralsPage() {
  const [categories, setCategories] = useState(() => DEFAULT_CATEGORIES);
  const [stats, setStats] = useState(() =>
    createEmptyStats(DEFAULT_CATEGORIES)
  );
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [manageModal, setManageModal] = useState({
    open: false,
    office: null,
    category: null,
  });
  const [editModal, setEditModal] = useState({
    open: false,
    entry: null,
  });
  const [selectedOffice, setSelectedOffice] = useState(OFFICES[0]);
  const [expandedOffices, setExpandedOffices] = useState(() =>
    OFFICES.reduce((acc, office) => {
      acc[office.id] = false;
      return acc;
    }, {})
  );
  const [form, setForm] = useState({
    category: DEFAULT_CATEGORIES[0].id,
    model: "",
    email: "",
    quantity: 1,
  });
  const [editForm, setEditForm] = useState({
    model: "",
    email: "",
    quantity: 1,
  });

  useEffect(() => {
    const unsubSettings = onSnapshot(
      APP_SETTINGS_DOC,
      (snapshot) => {
        const data = snapshot.data();
        const stored = sanitizeCategories(data?.peripherals?.categories);
        setCategories(stored);
      },
      () => {}
    );

    const unsubEntries = onSnapshot(
      collection(db, "peripherals"),
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setEntries(docs);
        setLoading(false);
      },
      (error) => {
        console.error("Erro ao carregar periféricos:", error);
        showToast({
          type: "error",
          message: "Não foi possível carregar os periféricos.",
        });
        setLoading(false);
      }
    );

    return () => {
      unsubSettings();
      unsubEntries();
    };
  }, []);

  useEffect(() => {
    const nextStats = createEmptyStats(categories);
    entries.forEach((data) => {
      const officeId =
        data.officeId ||
        OFFICES.find(
          (office) =>
            office.name.toLowerCase() ===
            String(data.office || "").toLowerCase()
        )?.id;
      const categoryId = data.category;
      const quantity = Number(data.quantity) || 0;
      if (!officeId || !nextStats[officeId]) return;
      if (!categories.some((cat) => cat.id === categoryId)) return;
      nextStats[officeId].totals[categoryId] += quantity;
    });
    setStats(nextStats);
  }, [categories, entries]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      category: categories[0]?.id || "",
    }));

    setManageModal((prev) => {
      if (!prev.open) return prev;
      const nextCategory = categories.find(
        (category) => category.id === prev.category?.id
      );
      if (!nextCategory) {
        return { open: false, office: null, category: null };
      }
      return { ...prev, category: nextCategory };
    });

    if (categories.length <= 4) {
      setExpandedOffices((prev) => {
        const reset = { ...prev };
        OFFICES.forEach((office) => {
          reset[office.id] = false;
        });
        return reset;
      });
    }
  }, [categories]);

  const handleOpenModal = (office) => {
    setSelectedOffice(office);
    setForm({
      category: categories[0]?.id || "",
      model: "",
      email: "",
      quantity: 1,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.category) {
      showToast({
        type: "error",
        message: "Selecione uma categoria.",
      });
      return;
    }
    const model = form.model.trim();
    const email = form.email.trim();
    const quantity = Number(form.quantity);
    if (!model || !Number.isFinite(quantity) || quantity <= 0) {
      showToast({
        type: "error",
        message: "Informe um modelo e uma quantidade válida.",
      });
      return;
    }

    try {
      await addDoc(collection(db, "peripherals"), {
        office: selectedOffice.name,
        officeId: selectedOffice.id,
        category: form.category,
        model,
        ...(email ? { email } : {}),
        quantity,
        createdAt: serverTimestamp(),
      });
      showToast({
        type: "success",
        message: "Periférico cadastrado.",
      });
      setModalOpen(false);
    } catch (error) {
      console.error("Erro ao cadastrar periférico:", error);
      showToast({
        type: "error",
        message: "Não foi possível cadastrar o periférico.",
        description: error?.message,
      });
    }
  };

  const statsArray = useMemo(
    () => OFFICES.map((office) => stats[office.id] || { office, totals: {} }),
    [stats]
  );

  const manageEntries = useMemo(() => {
    if (!manageModal.open || !manageModal.office || !manageModal.category) {
      return [];
    }
    return entries
      .filter(
        (entry) =>
          entry.officeId === manageModal.office.id &&
          entry.category === manageModal.category.id
      )
      .sort((a, b) => (a.model || "").localeCompare(b.model || ""));
  }, [entries, manageModal]);

  const handleOpenManage = (office, category) => {
    setManageModal({
      open: true,
      office,
      category,
    });
  };

  const handleCloseManage = () => {
    setManageModal({
      open: false,
      office: null,
      category: null,
    });
  };

  const handleEditEntry = (entry) => {
    setEditForm({
      model: entry.model || "",
      email: entry.email || "",
      quantity: entry.quantity || 1,
    });
    setEditModal({
      open: true,
      entry,
    });
  };

  const handleUpdateEntry = async (event) => {
    event.preventDefault();
    if (!editModal.entry?.id) return;

    const model = editForm.model.trim();
    const email = editForm.email.trim();
    const quantity = Number(editForm.quantity);

    if (!model || !Number.isFinite(quantity) || quantity <= 0) {
      showToast({
        type: "error",
        message: "Informe modelo e quantidade válida.",
      });
      return;
    }

    try {
      await updateDoc(doc(db, "peripherals", editModal.entry.id), {
        model,
        ...(email ? { email } : { email: "" }),
        quantity,
        updatedAt: serverTimestamp(),
      });
      showToast({
        type: "success",
        message: "Registro atualizado.",
      });
      setEditModal({ open: false, entry: null });
    } catch (error) {
      console.error("Erro ao atualizar periférico:", error);
      showToast({
        type: "error",
        message: "Não foi possível atualizar o registro.",
        description: error?.message,
      });
    }
  };

  const handleDeleteEntry = async (entry) => {
    if (!entry?.id) return;
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(
            `Deseja remover o registro "${entry.model || "Periférico"}"?`
          )
        : true;
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, "peripherals", entry.id));
      showToast({
        type: "success",
        message: "Registro removido.",
      });
      if (editModal.open) {
        setEditModal({ open: false, entry: null });
      }
    } catch (error) {
      console.error("Erro ao remover periférico:", error);
      showToast({
        type: "error",
        message: "Não foi possível remover o registro.",
        description: error?.message,
      });
    }
  };

  const handleExportAll = () => {
    if (!entries.length) return;
    const mapCategoryLabel = (id) =>
      categories.find((category) => category.id === id)?.label || id;

    const head = ["Escritório", "Categoria", "Modelo", "E-mail", "Quantidade"];
    const rows = entries.map((entry) => [
      entry.office || entry.officeId || "",
      mapCategoryLabel(entry.category),
      entry.model || "",
      entry.email || "",
      entry.quantity ?? "",
    ]);
    const csv = [head, ...rows]
      .map((cols) =>
        cols
          .map(
            (value) =>
              `"${String(value ?? "")
                .replace(/"/g, '""')
                .replace(/\r?\n/g, " ")}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `peripherals_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <Building2 className="w-4 h-4 text-[var(--accent)]" />
            Peripherals
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Controle de Periféricos
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Monitore fones, teclados/mouses, monitores e demais categorias
            configuradas por escritório.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={!entries.length}
          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/60 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Exportar tudo
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {statsArray.map(({ office, totals }) => (
          <div
            key={office.id}
            className="flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  {office.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Distribuição de periféricos cadastrados
                </p>
              </div>
              <button
                onClick={() => handleOpenModal(office)}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-3 py-1.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
              >
                <PlusCircle className="w-4 h-4" />
                Cadastrar
              </button>
            </div>

            <ul className="space-y-2 text-sm">
              {(expandedOffices[office.id]
                ? categories
                : categories.slice(0, 4)
              ).map((category) => {
                const Icon = resolveIcon(category.icon);
                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => handleOpenManage(office, category)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-left transition hover:border-[var(--accent)]/60 hover:bg-[var(--bg-card)]"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-[var(--text)]">
                          {category.label}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text)]">
                        {loading ? "—" : totals[category.id] ?? 0}
                      </span>
                    </button>
                  </li>
                );
              })}
              {categories.length > 4 && (
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedOffices((prev) => ({
                        ...prev,
                        [office.id]: !prev[office.id],
                      }))
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-sm text-[var(--accent)] transition hover:border-[var(--accent)]/40 hover:bg-[var(--bg-card)]"
                  >
                    {expandedOffices[office.id] ? (
                      <>
                        <ChevronLeft className="w-4 h-4" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-4 h-4" />
                        Ver mais
                      </>
                    )}
                  </button>
                </li>
              )}
            </ul>
          </div>
        ))}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  Cadastrar periférico
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {selectedOffice?.name}
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-transparent p-2 text-[var(--text-muted)] transition hover:border-[var(--line)] hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                Categoria
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      category: event.target.value,
                    }))
                  }
                  className="input-neon"
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                Modelo
                <input
                  value={form.model}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      model: event.target.value,
                    }))
                  }
                  className="input-neon"
                  placeholder="Ex.: Logitech MX Keys"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                E-mail (opcional)
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className="input-neon"
                  placeholder="nome@empresa.com"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                Quantidade
                <input
                  type="number"
                  min={1}
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                  className="input-neon"
                  required
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--text)] transition hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-4 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manageModal.open && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  {manageModal.category?.label} — {manageModal.office?.name}
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Consulte ou atualize os registros cadastrados.
                </p>
              </div>
              <button
                onClick={handleCloseManage}
                className="rounded-lg border border-transparent p-2 text-[var(--text-muted)] transition hover:border-[var(--line)] hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </header>

            <section className="max-h-[65vh] overflow-y-auto px-6 py-5">
              {manageEntries.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)] p-6 text-sm text-[var(--text-muted)]">
                  Nenhum periférico cadastrado para esta categoria neste
                  escritório.
                </div>
              ) : (
                <table className="min-w-full divide-y divide-[var(--line)] text-sm">
                  <thead className="bg-[var(--bg-soft)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <tr>
                      <th className="px-3 py-3">Modelo</th>
                      <th className="px-3 py-3">E-mail</th>
                      <th className="px-3 py-3">Quantidade</th>
                      <th className="px-3 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line)]">
                    {manageEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-3 py-2 text-[var(--text)]">
                          {entry.model || "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text)]">
                          {entry.email || "—"}
                        </td>
                        <td className="px-3 py-2 text-[var(--text)]">
                          {entry.quantity ?? 0}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleEditEntry(entry)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--text)] transition hover:bg-white/5"
                            >
                              <PenSquare className="w-4 h-4" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <footer className="border-t border-[var(--line)] px-6 py-4 text-right">
              <button
                onClick={handleCloseManage}
                className="rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--text)] transition hover:bg-white/5"
              >
                Fechar
              </button>
            </footer>
          </div>
        </div>
      )}

      {editModal.open && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-xl">
            <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-[var(--text)]">
                  Editar periférico
                </h2>
                <p className="text-sm text-[var(--text-muted)]">
                  Ajuste o modelo, e-mail ou quantidade.
                </p>
              </div>
              <button
                onClick={() => setEditModal({ open: false, entry: null })}
                className="rounded-lg border border-transparent p-2 text-[var(--text-muted)] transition hover:border-[var(--line)] hover:bg-white/5 hover:text-white"
              >
                ×
              </button>
            </header>

            <form onSubmit={handleUpdateEntry} className="space-y-4 px-6 py-5">
              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                Modelo
                <input
                  value={editForm.model}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      model: event.target.value,
                    }))
                  }
                  className="input-neon"
                  required
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                E-mail (opcional)
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      email: event.target.value,
                    }))
                  }
                  className="input-neon"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
                Quantidade
                <input
                  type="number"
                  min={1}
                  value={editForm.quantity}
                  onChange={(event) =>
                    setEditForm((prev) => ({
                      ...prev,
                      quantity: event.target.value,
                    }))
                  }
                  className="input-neon"
                  required
                />
              </label>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setEditModal({ open: false, entry: null })}
                  className="rounded-lg border border-[var(--line)] px-4 py-2 text-[var(--text)] transition hover:bg-white/5"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)]/60 bg-[var(--accent)]/10 px-4 py-2 font-semibold text-[var(--accent)] transition hover:bg-[var(--accent)]/20"
                >
                  Salvar alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
