import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import {
  AlertCircle,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileSignature,
  Laptop,
  PackageCheck,
  PieChart,
  Table2,
  Timer,
} from "lucide-react";
import { db } from "../firebase";
import { parseAvailability } from "../utils/availability";
import termosBase from "../data/termos.json";

const OFFICES = [
  { id: "sao-paulo", name: "São Paulo", collectionName: "sao-paulo" },
  {
    id: "rio-de-janeiro",
    name: "Rio de Janeiro",
    collectionName: "rio-de-janeiro",
  },
  { id: "joao-pessoa", name: "João Pessoa", collectionName: "joao-pessoa" },
  { id: "outros", name: "Outros", collectionName: "outros" },
];

const DEFAULT_CATEGORIES = [
  { id: "headset", label: "Fones" },
  { id: "keyboard-mouse", label: "Teclados / Mouses" },
  { id: "monitor", label: "Monitores" },
];

const APP_SETTINGS_DOC = doc(db, "appSettings", "global");
const DISPLAY_LIMIT = 10;
const LOW_STOCK_LIMIT = 5;
const CHART_COLORS = [
  "#e11d74",
  "#10b981",
  "#f59e0b",
  "#38bdf8",
  "#a855f7",
  "#f97316",
  "#14b8a6",
  "#ef4444",
];

const VIEW_OPTIONS = [
  { id: "current", label: "Tabela", Icon: Table2 },
  { id: "pie", label: "Distribuição", Icon: PieChart },
  { id: "bars", label: "Comparativo", Icon: BarChart3 },
];

const TERM_MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const TERM_STATUS_COLORS = {
  signed: "#10b981",
  inProgress: "#3b82f6",
  pending: "#f59e0b",
  canceled: "#ef4444",
};

const normalizeModel = (value) => {
  const model = String(value || "").trim();
  return model || "Sem modelo";
};

const normalizeOfficeId = (entry) => {
  if (entry.officeId) return entry.officeId;

  const officeName = String(entry.office || "").toLowerCase();
  return OFFICES.find((office) => office.name.toLowerCase() === officeName)
    ?.id;
};

const sanitizeCategories = (raw) => {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_CATEGORIES;

  return raw
    .map((item) => {
      if (typeof item === "string") {
        const label = item.trim();
        if (!label) return null;
        return {
          id: label
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, "-"),
          label,
        };
      }

      const label = String(item?.label || item?.name || "").trim();
      if (!label) return null;

      return {
        id:
          item?.id ||
          label
            .toLowerCase()
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/\s+/g, "-"),
        label,
      };
    })
    .filter(Boolean);
};

const formatNumber = (value) =>
  new Intl.NumberFormat("pt-BR").format(value || 0);

const isLowStock = (quantity) => {
  const value = Number(quantity) || 0;
  return value > 0 && value <= LOW_STOCK_LIMIT;
};

const getTopRows = (rows, limit = Number.POSITIVE_INFINITY) =>
  rows
    .filter((row) => row.value > 0)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return a.label.localeCompare(b.label);
    })
    .slice(0, limit);

const mergeStockModels = (offices, metric = "total") => {
  const totals = {};
  offices.forEach((office) => {
    office.models.forEach((model) => {
      totals[model.model] = (totals[model.model] || 0) + (model[metric] || 0);
    });
  });

  return getTopRows(
    Object.entries(totals).map(([label, value]) => ({ label, value }))
  );
};

const mergePeripheralModels = (offices) => {
  const totals = {};
  offices.forEach((office) => {
    office.models.forEach((model) => {
      totals[model.model] = (totals[model.model] || 0) + model.quantity;
    });
  });

  return getTopRows(
    Object.entries(totals).map(([label, value]) => ({ label, value }))
  );
};

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const parseTermMonthIndex = (value) => {
  const [, month] = String(value || "").split("/").map(Number);
  return month >= 1 && month <= 12 ? month - 1 : -1;
};

const sanitizeTerm = (item = {}) => ({
  nome: String(item.nome || "").trim(),
  email: String(item.email || "").trim().toLowerCase(),
  dataEnvio: String(item.dataEnvio || "").trim(),
  dataAssinatura: String(item.dataAssinatura || "").trim(),
  status: String(item.status || "Em andamento").trim(),
  slaDias: String(item.slaDias || "").trim(),
  mes: String(item.mes || "").trim(),
});

export default function DashboardPage() {
  const [stockByOffice, setStockByOffice] = useState(() =>
    OFFICES.reduce((acc, office) => {
      acc[office.id] = [];
      return acc;
    }, {})
  );
  const [peripherals, setPeripherals] = useState([]);
  const [firestoreTerms, setFirestoreTerms] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("current");

  useEffect(() => {
    const loadedSnapshots = new Set();
    const expectedSnapshots = OFFICES.length + 2;

    const markLoaded = (key) => {
      loadedSnapshots.add(key);
      if (loadedSnapshots.size >= expectedSnapshots) setLoading(false);
    };

    const unsubStock = OFFICES.map((office) =>
      onSnapshot(
        collection(db, office.collectionName),
        (snapshot) => {
          setStockByOffice((prev) => ({
            ...prev,
            [office.id]: snapshot.docs.map((docSnap) => ({
              id: docSnap.id,
              ...docSnap.data(),
            })),
          }));
          markLoaded(office.id);
        },
        (error) => {
          console.error(`Erro ao carregar estoque de ${office.name}:`, error);
          markLoaded(office.id);
        }
      )
    );

    const unsubPeripherals = onSnapshot(
      collection(db, "peripherals"),
      (snapshot) => {
        setPeripherals(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        markLoaded("peripherals");
      },
      (error) => {
        console.error("Erro ao carregar periféricos:", error);
        markLoaded("peripherals");
      }
    );

    const unsubTerms = onSnapshot(
      collection(db, "terms"),
      (snapshot) => {
        setFirestoreTerms(
          snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
        );
        markLoaded("terms");
      },
      (error) => {
        console.error("Erro ao carregar termos:", error);
        markLoaded("terms");
      }
    );

    const unsubSettings = onSnapshot(
      APP_SETTINGS_DOC,
      (snapshot) => {
        setCategories(
          sanitizeCategories(snapshot.data()?.peripherals?.categories)
        );
      },
      () => {}
    );

    return () => {
      unsubStock.forEach((unsubscribe) => unsubscribe());
      unsubPeripherals();
      unsubTerms();
      unsubSettings();
    };
  }, []);

  const categoryLabelById = useMemo(
    () =>
      categories.reduce((acc, category) => {
        acc[category.id] = category.label;
        return acc;
      }, {}),
    [categories]
  );

  const dashboardData = useMemo(() => {
    const stockOffices = OFFICES.map((office) => {
      const items = stockByOffice[office.id] || [];
      const models = {};

      items.forEach((item) => {
        const model = normalizeModel(item.modelo || item.model);
        const availability = parseAvailability(item.status);

        if (!models[model]) {
          models[model] = {
            model,
            total: 0,
            available: 0,
            unavailable: 0,
            noStatus: 0,
          };
        }

        models[model].total += 1;

        if (availability?.ok === true) {
          models[model].available += 1;
        } else if (availability?.ok === false) {
          models[model].unavailable += 1;
        } else {
          models[model].noStatus += 1;
        }
      });

      const modelRows = Object.values(models).sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        return a.model.localeCompare(b.model);
      });

      return {
        ...office,
        total: items.length,
        available: modelRows.reduce((sum, row) => sum + row.available, 0),
        unavailable: modelRows.reduce((sum, row) => sum + row.unavailable, 0),
        noStatus: modelRows.reduce((sum, row) => sum + row.noStatus, 0),
        models: modelRows,
      };
    });

    const peripheralOffices = OFFICES.map((office) => {
      const models = {};

      peripherals
        .filter((entry) => normalizeOfficeId(entry) === office.id)
        .forEach((entry) => {
          const model = normalizeModel(entry.model || entry.modelo);
          const categoryId = entry.category || "sem-categoria";
          const quantity = Number(entry.quantity) || 0;
          const key = `${categoryId}__${model}`;

          if (!models[key]) {
            models[key] = {
              key,
              model,
              category:
                categoryLabelById[categoryId] || categoryId || "Sem categoria",
              quantity: 0,
            };
          }

          models[key].quantity += quantity;
        });

      const modelRows = Object.values(models).sort((a, b) => {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
        return a.model.localeCompare(b.model);
      });

      return {
        ...office,
        total: modelRows.reduce((sum, row) => sum + row.quantity, 0),
        models: modelRows,
      };
    });

    const stockTotal = stockOffices.reduce((sum, office) => sum + office.total, 0);
    const stockAvailable = stockOffices.reduce(
      (sum, office) => sum + office.available,
      0
    );
    const stockUnavailable = stockOffices.reduce(
      (sum, office) => sum + office.unavailable,
      0
    );
    const peripheralsTotal = peripheralOffices.reduce(
      (sum, office) => sum + office.total,
      0
    );

    return {
      stockOffices,
      peripheralOffices,
      summary: {
        stockTotal,
        stockAvailable,
        stockUnavailable,
        peripheralsTotal,
      },
    };
  }, [categoryLabelById, peripherals, stockByOffice]);

  const terms = useMemo(() => {
    const map = new Map(
      termosBase.map((item) => [item.id, { ...item, source: "base" }])
    );
    firestoreTerms.forEach((item) => {
      map.set(item.id, {
        ...map.get(item.id),
        ...item,
        source: "firestore",
      });
    });
    return Array.from(map.values()).map((item) => ({
      ...item,
      ...sanitizeTerm(item),
    }));
  }, [firestoreTerms]);

  const termsDashboardData = useMemo(() => {
    const signed = terms.filter(
      (item) => normalizeText(item.status) === "concluido"
    ).length;
    const inProgress = terms.filter(
      (item) => normalizeText(item.status) === "em andamento"
    ).length;
    const pending = terms.filter(
      (item) => normalizeText(item.status) === "pendente"
    ).length;
    const canceled = terms.filter(
      (item) => normalizeText(item.status) === "cancelado"
    ).length;
    const slaValues = terms
      .filter((item) => String(item.slaDias || "").trim() !== "")
      .map((item) => Number(item.slaDias))
      .filter((value) => Number.isFinite(value));
    const averageSla = slaValues.length
      ? Math.round(
          slaValues.reduce((sum, value) => sum + value, 0) / slaValues.length
        )
      : 0;
    const monthlyRows = Array.from({ length: 12 }, (_, index) => ({
      label: TERM_MONTH_LABELS[index],
      value: 0,
    }));

    terms.forEach((item) => {
      const monthIndex = parseTermMonthIndex(item.dataEnvio);
      if (monthIndex >= 0) monthlyRows[monthIndex].value += 1;
    });

    return {
      summary: {
        total: terms.length,
        signed,
        inProgress,
        pending,
        canceled,
        averageSla,
      },
      monthlyRows,
    };
  }, [terms]);

  const stockTotalDetails = dashboardData.stockOffices
    .map((office) => ({ label: office.name, value: office.total }))
    .filter((item) => item.value > 0);
  const stockAvailableDetails = dashboardData.stockOffices
    .map((office) => ({ label: office.name, value: office.available }))
    .filter((item) => item.value > 0);
  const stockUnavailableDetails = dashboardData.stockOffices
    .map((office) => ({ label: office.name, value: office.unavailable }))
    .filter((item) => item.value > 0);
  const peripheralDetails = dashboardData.peripheralOffices
    .map((office) => ({ label: office.name, value: office.total }))
    .filter((item) => item.value > 0);
  const stockModelDetails = mergeStockModels(dashboardData.stockOffices);
  const stockAvailableModelDetails = mergeStockModels(
    dashboardData.stockOffices,
    "available"
  );
  const peripheralModelDetails = mergePeripheralModels(
    dashboardData.peripheralOffices
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <BarChart3 className="h-4 w-4 text-[var(--accent)]" />
            Dashboard
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Dados de estoque e periféricos
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Visão consolidada por escritório e por modelo.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-muted)]">
          {loading ? "Carregando dados..." : "Dados em tempo real"}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Laptop}
          label="Notebooks em estoque"
          value={dashboardData.summary.stockTotal}
          detailsTitle="Estoque por escritório"
          details={stockTotalDetails}
        />
        <SummaryCard
          icon={PackageCheck}
          label="Notebooks disponíveis"
          value={dashboardData.summary.stockAvailable}
          tone="emerald"
          detailsTitle="Disponíveis por escritório"
          details={stockAvailableDetails}
        />
        <SummaryCard
          icon={AlertCircle}
          label="Notebooks indisponíveis"
          value={dashboardData.summary.stockUnavailable}
          tone="amber"
          detailsTitle="Indisponíveis por escritório"
          details={stockUnavailableDetails}
        />
        <SummaryCard
          icon={Boxes}
          label="Periféricos cadastrados"
          value={dashboardData.summary.peripheralsTotal}
          detailsTitle="Periféricos por escritório"
          details={peripheralDetails}
        />
      </section>

      <TermsDashboard data={termsDashboardData} />

      <ViewSwitcher value={viewMode} onChange={setViewMode} />

      {viewMode === "current" && (
        <section className="grid gap-6 xl:grid-cols-2">
          <DashboardPanel
            title="Estoque por escritório"
            description="Notebooks agrupados por modelo e status."
            icon={Laptop}
          >
            <div className="space-y-4">
              {dashboardData.stockOffices.map((office) => (
                <OfficeStockCard key={office.id} office={office} />
              ))}
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Periféricos por escritório"
            description="Quantidades agrupadas por categoria e modelo."
            icon={Boxes}
          >
            <div className="space-y-4">
              {dashboardData.peripheralOffices.map((office) => (
                <OfficePeripheralCard key={office.id} office={office} />
              ))}
            </div>
          </DashboardPanel>
        </section>
      )}

      {viewMode === "pie" && (
        <PieDashboard
          stockOffices={dashboardData.stockOffices}
          peripheralOffices={dashboardData.peripheralOffices}
          stockModelDetails={stockModelDetails}
          stockAvailableModelDetails={stockAvailableModelDetails}
          peripheralModelDetails={peripheralModelDetails}
        />
      )}

      {viewMode === "bars" && (
        <BarDashboard
          stockOffices={dashboardData.stockOffices}
          peripheralOffices={dashboardData.peripheralOffices}
          stockModelDetails={stockModelDetails}
          stockAvailableModelDetails={stockAvailableModelDetails}
          peripheralModelDetails={peripheralModelDetails}
        />
      )}
    </div>
  );
}

function TermsDashboard({ data }) {
  const { summary, monthlyRows } = data;
  const cards = [
    {
      label: "Total enviados",
      value: summary.total,
      hint: "termos",
      Icon: FileSignature,
      accentClass: "text-[var(--accent)]",
      barClass: "bg-[var(--accent)]",
    },
    {
      label: "Assinados",
      value: summary.signed,
      hint: "concluídos",
      Icon: CheckCircle2,
      accentClass: "text-emerald-300",
      barClass: "bg-emerald-500",
    },
    {
      label: "Pendentes",
      value: summary.pending,
      hint: "aguardando",
      Icon: Clock3,
      accentClass: "text-amber-300",
      barClass: "bg-amber-500",
    },
    {
      label: "Em andamento",
      value: summary.inProgress,
      hint: "em processo",
      Icon: Clock3,
      accentClass: "text-blue-300",
      barClass: "bg-blue-500",
    },
    {
      label: "SLA médio",
      value: `${summary.averageSla}d`,
      hint: "envio-assinatura",
      Icon: Timer,
      accentClass: "text-violet-300",
      barClass: "bg-violet-500",
    },
  ];

  return (
    <section className="space-y-4">
      <header className="flex items-center gap-3">
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
          <FileSignature className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text)]">Termos</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Controle de envio, assinatura e SLA dos termos.
          </p>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <TermsMetricCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)]">
        <TermsMonthlyChart rows={monthlyRows} />
        <TermsStatusDonut summary={summary} />
      </div>
    </section>
  );
}

function TermsMetricCard({
  label,
  value,
  hint,
  Icon,
  accentClass = "text-[var(--accent)]",
  barClass = "bg-[var(--accent)]",
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-lg">
      <div className={`absolute inset-y-0 left-0 w-1 ${barClass}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
            <Icon className={`h-4 w-4 ${accentClass}`} />
            {label}
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--text)]">
            {value}
          </div>
          <div className="mt-1 text-sm text-[var(--text-muted)]">{hint}</div>
        </div>
      </div>
    </article>
  );
}

function TermsMonthlyChart({ rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <ChartCard
      title="Termos por mês"
      description="Quantidade enviada por mês."
      icon={FileSignature}
    >
      <div className="h-56">
        <div className="flex h-full items-end gap-2 border-b border-l border-[var(--line)] px-2 pb-2">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex h-full flex-1 flex-col justify-end gap-2"
            >
              <div className="flex flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-[var(--accent)]/85 transition hover:bg-[var(--accent)]"
                  style={{
                    height: `${Math.max(4, (row.value / max) * 100)}%`,
                  }}
                  title={`${row.label}: ${formatNumber(row.value)}`}
                />
              </div>
              <div className="text-center text-xs text-[var(--text-muted)]">
                {row.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
  );
}

function TermsStatusDonut({ summary }) {
  const total = Math.max(1, summary.total);
  const rows = [
    { label: "Assinado", value: summary.signed, color: TERM_STATUS_COLORS.signed },
    {
      label: "Em andamento",
      value: summary.inProgress,
      color: TERM_STATUS_COLORS.inProgress,
    },
    { label: "Pendente", value: summary.pending, color: TERM_STATUS_COLORS.pending },
    { label: "Cancelado", value: summary.canceled, color: TERM_STATUS_COLORS.canceled },
  ].filter((row) => row.value > 0);

  let offset = 0;
  const gradient = rows.length
    ? rows
        .map((row) => {
          const start = offset;
          const end = offset + (row.value / total) * 100;
          offset = end;
          return `${row.color} ${start}% ${end}%`;
        })
        .join(", ")
    : "rgba(148, 163, 184, 0.35) 0% 100%";

  return (
    <ChartCard
      title="Status dos termos"
      description="Distribuição por situação."
      icon={PieChart}
    >
      <div className="flex flex-col items-center gap-5">
        <div
          className="relative h-56 w-56 rounded-full border border-[var(--line)] shadow-inner"
          style={{ background: `conic-gradient(from -90deg, ${gradient})` }}
        >
          <div className="absolute inset-12 rounded-full border border-[var(--line)] bg-[var(--bg-card)]" />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Total
            </span>
            <strong className="text-2xl text-[var(--text)]">
              {formatNumber(summary.total)}
            </strong>
          </div>
        </div>

        <div className="grid w-full gap-2 text-sm sm:grid-cols-2">
          {rows.length ? (
            rows.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-2 text-[var(--text-muted)]">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="truncate">{row.label}</span>
                </span>
                <strong className="text-[var(--text)]">
                  {formatNumber(row.value)}
                </strong>
              </div>
            ))
          ) : (
            <div className="col-span-full">
              <EmptyChartMessage />
            </div>
          )}
        </div>
      </div>
    </ChartCard>
  );
}

function ViewSwitcher({ value, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-2 shadow-lg">
      {VIEW_OPTIONS.map(({ id, label, Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              active
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

function PieDashboard({
  stockOffices,
  peripheralOffices,
  stockModelDetails,
  stockAvailableModelDetails,
  peripheralModelDetails,
}) {
  const stockOfficeRows = stockOffices.map((office) => ({
    label: office.name,
    value: office.total,
  }));
  const availableOfficeRows = stockOffices.map((office) => ({
    label: office.name,
    value: office.available,
  }));
  const peripheralOfficeRows = peripheralOffices.map((office) => ({
    label: office.name,
    value: office.total,
  }));

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Notebooks por escritório"
        description="Distribuição total do estoque."
        icon={Laptop}
      >
        <PieChartBlock rows={stockOfficeRows} />
      </ChartCard>

      <ChartCard
        title="Disponíveis por escritório"
        description="Distribuição dos notebooks disponíveis."
        icon={PackageCheck}
      >
        <PieChartBlock rows={availableOfficeRows} />
      </ChartCard>

      <ChartCard
        title="Periféricos por escritório"
        description="Distribuição total dos periféricos."
        icon={Boxes}
      >
        <PieChartBlock rows={peripheralOfficeRows} />
      </ChartCard>

      <ChartCard
        title="Modelos de notebooks"
        description="Top modelos por quantidade no estoque."
        icon={Laptop}
      >
        <PieChartBlock rows={stockModelDetails} />
      </ChartCard>

      <ChartCard
        title="Modelos disponíveis"
        description="Top modelos com notebooks disponíveis."
        icon={PackageCheck}
      >
        <PieChartBlock rows={stockAvailableModelDetails} />
      </ChartCard>

      <ChartCard
        title="Modelos de periféricos"
        description="Top modelos por quantidade cadastrada."
        icon={Boxes}
      >
        <PieChartBlock rows={peripheralModelDetails} />
      </ChartCard>
    </section>
  );
}

function BarDashboard({
  stockOffices,
  peripheralOffices,
  stockModelDetails,
  stockAvailableModelDetails,
  peripheralModelDetails,
}) {
  const stockOfficeRows = stockOffices.map((office) => ({
    label: office.name,
    value: office.total,
  }));
  const availableOfficeRows = stockOffices.map((office) => ({
    label: office.name,
    value: office.available,
  }));
  const peripheralOfficeRows = peripheralOffices.map((office) => ({
    label: office.name,
    value: office.total,
  }));

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <ChartCard
        title="Notebooks por escritório"
        description="Comparativo total do estoque."
        icon={Laptop}
      >
        <BarChartBlock rows={stockOfficeRows} />
      </ChartCard>

      <ChartCard
        title="Disponíveis por escritório"
        description="Comparativo de notebooks disponíveis."
        icon={PackageCheck}
      >
        <BarChartBlock rows={availableOfficeRows} tone="emerald" />
      </ChartCard>

      <ChartCard
        title="Periféricos por escritório"
        description="Comparativo total de periféricos."
        icon={Boxes}
      >
        <BarChartBlock rows={peripheralOfficeRows} />
      </ChartCard>

      <ChartCard
        title="Modelos de notebooks"
        description="Top modelos por quantidade no estoque."
        icon={Laptop}
      >
        <BarChartBlock rows={stockModelDetails} />
      </ChartCard>

      <ChartCard
        title="Modelos disponíveis"
        description="Top modelos com notebooks disponíveis."
        icon={PackageCheck}
      >
        <BarChartBlock rows={stockAvailableModelDetails} tone="emerald" />
      </ChartCard>

      <ChartCard
        title="Modelos de periféricos"
        description="Top modelos por quantidade cadastrada."
        icon={Boxes}
      >
        <BarChartBlock rows={peripheralModelDetails} />
      </ChartCard>
    </section>
  );
}

function ChartCard({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-lg">
      <header className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text)]">{title}</h2>
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function PieChartBlock({ rows }) {
  const visibleRows = rows.filter((row) => row.value > 0);
  const total = visibleRows.reduce((sum, row) => sum + row.value, 0);
  let current = 0;
  const gradient = visibleRows
    .map((row, index) => {
      const start = current;
      const size = (row.value / total) * 360;
      current += size;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}deg ${current}deg`;
    })
    .join(", ");

  if (!total) {
    return <EmptyChartMessage />;
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[220px_1fr] sm:items-center">
      <div className="flex justify-center">
        <div
          className="relative h-52 w-52 rounded-full border border-[var(--line)] shadow-inner"
          style={{ background: `conic-gradient(${gradient})` }}
        >
          <div className="absolute inset-10 flex flex-col items-center justify-center rounded-full border border-[var(--line)] bg-[var(--bg-card)] text-center">
            <span className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
              Total
            </span>
            <strong className="text-2xl text-[var(--text)]">
              {formatNumber(total)}
            </strong>
          </div>
        </div>
      </div>

      <ChartLegend rows={visibleRows} total={total} />
    </div>
  );
}

function ChartLegend({ rows, total }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = rows.length > DISPLAY_LIMIT;
  const visibleRows = expanded ? rows : rows.slice(0, DISPLAY_LIMIT);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {visibleRows.map((row, index) => {
          const percentage = total ? Math.round((row.value / total) * 100) : 0;
          return (
            <li
              key={row.label}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{
                    backgroundColor:
                      CHART_COLORS[index % CHART_COLORS.length],
                  }}
                />
                <span className="truncate text-[var(--text-muted)]">
                  {row.label}
                </span>
              </div>
              <strong className="shrink-0 text-[var(--text)]">
                {formatNumber(row.value)} · {percentage}%
              </strong>
            </li>
          );
        })}
      </ul>

      {hasOverflow && (
        <ExpandToggle
          expanded={expanded}
          hiddenCount={rows.length - DISPLAY_LIMIT}
          onClick={() => setExpanded((current) => !current)}
        />
      )}
    </div>
  );
}

function BarChartBlock({ rows, tone = "accent" }) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = rows.filter((row) => row.value > 0);
  const hasOverflow = visibleRows.length > DISPLAY_LIMIT;
  const displayedRows = expanded
    ? visibleRows
    : visibleRows.slice(0, DISPLAY_LIMIT);
  const max = Math.max(...visibleRows.map((row) => row.value), 0);
  const barClass =
    tone === "emerald" ? "bg-emerald-400" : "bg-[var(--accent)]";

  if (!max) {
    return <EmptyChartMessage />;
  }

  return (
    <div className="space-y-3">
      {displayedRows.map((row) => {
        const width = Math.max((row.value / max) * 100, 5);
        return (
          <div key={row.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-[var(--text-muted)]">
                {row.label}
              </span>
              <strong className="shrink-0 text-[var(--text)]">
                {formatNumber(row.value)}
              </strong>
            </div>
            <div className="h-3 overflow-hidden rounded-full border border-[var(--line)] bg-[var(--bg-soft)]">
              <div
                className={`h-full rounded-full ${barClass}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}

      {hasOverflow && (
        <ExpandToggle
          expanded={expanded}
          hiddenCount={visibleRows.length - DISPLAY_LIMIT}
          onClick={() => setExpanded((current) => !current)}
        />
      )}
    </div>
  );
}

function ExpandToggle({ expanded, hiddenCount, onClick }) {
  const Icon = expanded ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--line)] bg-[var(--bg-card)] px-3 py-2 text-sm font-semibold text-[var(--accent)] transition hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/10"
    >
      <Icon className="h-4 w-4" />
      {expanded ? "Ocultar" : `Expandir mais ${formatNumber(hiddenCount)}`}
    </button>
  );
}

function EmptyChartMessage() {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
      Nenhum dado para exibir.
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = "accent",
  detailsTitle,
  details = [],
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300"
      : tone === "amber"
      ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
      : "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]";
  const hasDetails = details.length > 0;

  return (
    <article
      className="group relative rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-lg outline-none transition hover:border-[var(--accent)]/50 focus-visible:border-[var(--accent)]/70"
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--text-muted)]">{label}</p>
          <strong className="mt-1 block text-3xl font-semibold text-[var(--text)]">
            {formatNumber(value)}
          </strong>
        </div>
        <div className={`rounded-xl border p-3 ${toneClass}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>

      <div className="pointer-events-none absolute left-0 right-0 top-full z-40 pt-2 opacity-0 transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text)]">
              {detailsTitle}
            </p>
            <span className="rounded-full border border-[var(--line)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
              {formatNumber(value)}
            </span>
          </div>

          {hasDetails ? (
            <ul className="space-y-2">
              {details.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-sm"
                >
                  <span className="truncate text-[var(--text-muted)]">
                    {item.label}
                  </span>
                  <strong className="shrink-0 text-[var(--text)]">
                    {formatNumber(item.value)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-[var(--line)] bg-[var(--bg-soft)] px-3 py-2 text-sm text-[var(--text-muted)]">
              Nenhum escritório com quantidade para exibir.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function DashboardPanel({ title, description, icon: Icon, children }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 shadow-lg">
      <header className="mb-5 flex items-start gap-3">
        <div className="rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/10 p-2 text-[var(--accent)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--text)]">{title}</h2>
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        </div>
      </header>
      {children}
    </section>
  );
}

function OfficeStockCard({ office }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = office.models.length > DISPLAY_LIMIT;
  const visibleModels = expanded
    ? office.models
    : office.models.slice(0, DISPLAY_LIMIT);

  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] p-4">
      <OfficeHeader office={office} totalLabel="notebooks" total={office.total} />

      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
        <MetricPill label="Disponíveis" value={office.available} tone="emerald" />
        <MetricPill label="Indisponíveis" value={office.unavailable} tone="amber" />
        <MetricPill label="Sem status" value={office.noStatus} />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">Modelo</th>
              <th className="px-3 py-2 text-right font-medium">Total</th>
              <th className="px-3 py-2 text-right font-medium">Disp.</th>
              <th className="pl-3 py-2 text-right font-medium">Indisp.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {office.models.length ? (
              visibleModels.map((row) => (
                <tr key={row.model}>
                  <td className="max-w-[220px] truncate py-2 pr-3 text-[var(--text)]">
                    {row.model}
                  </td>
                  <td className="px-3 py-2 text-right text-[var(--text)]">
                    {formatNumber(row.total)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-300">
                    {formatNumber(row.available)}
                  </td>
                  <td className="pl-3 py-2 text-right text-amber-300">
                    {formatNumber(row.unavailable)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-3 text-sm text-[var(--text-muted)]" colSpan={4}>
                  Nenhum notebook cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasOverflow && (
        <ExpandToggle
          expanded={expanded}
          hiddenCount={office.models.length - DISPLAY_LIMIT}
          onClick={() => setExpanded((current) => !current)}
        />
      )}
    </article>
  );
}

function OfficePeripheralCard({ office }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverflow = office.models.length > DISPLAY_LIMIT;
  const visibleModels = expanded
    ? office.models
    : office.models.slice(0, DISPLAY_LIMIT);

  return (
    <article className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)] p-4">
      <OfficeHeader office={office} totalLabel="periféricos" total={office.total} />

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="py-2 pr-3 font-medium">Modelo</th>
              <th className="px-3 py-2 font-medium">Categoria</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="pl-3 py-2 text-right font-medium">Qtd.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--line)]">
            {office.models.length ? (
              visibleModels.map((row) => (
                <tr key={row.key}>
                  <td className="max-w-[220px] truncate py-2 pr-3 text-[var(--text)]">
                    {row.model}
                  </td>
                  <td className="px-3 py-2 text-[var(--text-muted)]">
                    {row.category}
                  </td>
                  <td className="px-3 py-2">
                    {isLowStock(row.quantity) ? (
                      <span className="text-xs font-semibold text-rose-400">
                        Estoque baixo
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                  <td className="pl-3 py-2 text-right text-[var(--text)]">
                    {formatNumber(row.quantity)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="py-3 text-sm text-[var(--text-muted)]" colSpan={4}>
                  Nenhum periférico cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasOverflow && (
        <ExpandToggle
          expanded={expanded}
          hiddenCount={office.models.length - DISPLAY_LIMIT}
          onClick={() => setExpanded((current) => !current)}
        />
      )}
    </article>
  );
}

function OfficeHeader({ office, totalLabel, total }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Building2 className="h-5 w-5 shrink-0 text-[var(--accent)]" />
        <h3 className="truncate text-lg font-semibold text-[var(--text)]">
          {office.name}
        </h3>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--line)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
        {formatNumber(total)} {totalLabel}
      </span>
    </div>
  );
}

function MetricPill({ label, value, tone = "muted" }) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
      ? "text-amber-300"
      : "text-[var(--text)]";

  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2">
      <span className="block text-[var(--text-muted)]">{label}</span>
      <strong className={`text-base ${toneClass}`}>{formatNumber(value)}</strong>
    </div>
  );
}
