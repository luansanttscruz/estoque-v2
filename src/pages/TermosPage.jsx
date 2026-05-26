import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  FileSignature,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import termos from "../data/termos.json";

const emptyOption = "Todos";

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const parseBrDate = (value) => {
  const [day, month, year] = String(value || "")
    .split("/")
    .map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day).getTime();
};

const statusClasses = {
  concluido: "bg-emerald-500/12 text-emerald-300 border-emerald-500/20",
  "em andamento": "bg-amber-500/12 text-amber-300 border-amber-500/20",
  cancelado: "bg-rose-500/12 text-rose-300 border-rose-500/20",
};

const resolveStatusClass = (status) =>
  statusClasses[normalize(status)] ||
  "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/20";

export default function TermosPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(emptyOption);
  const [monthFilter, setMonthFilter] = useState(emptyOption);

  const sortedTerms = useMemo(
    () =>
      [...termos].sort((a, b) => {
        const byDate = parseBrDate(b.dataEnvio) - parseBrDate(a.dataEnvio);
        if (byDate !== 0) return byDate;
        return a.nome.localeCompare(b.nome, "pt-BR");
      }),
    [],
  );

  const statusOptions = useMemo(
    () => [
      emptyOption,
      ...new Set(sortedTerms.map((item) => item.status).filter(Boolean)),
    ],
    [sortedTerms],
  );

  const monthOptions = useMemo(
    () => [
      emptyOption,
      ...new Set(sortedTerms.map((item) => item.mes).filter(Boolean)),
    ],
    [sortedTerms],
  );

  const filteredTerms = useMemo(() => {
    const query = normalize(search);
    return sortedTerms.filter((item) => {
      const matchesSearch = !query
        ? true
        : [
            item.nome,
            item.email,
            item.status,
            item.dataEnvio,
            item.dataAssinatura,
          ]
            .map(normalize)
            .join(" ")
            .includes(query);
      const matchesStatus =
        statusFilter === emptyOption || item.status === statusFilter;
      const matchesMonth =
        monthFilter === emptyOption || item.mes === monthFilter;
      return matchesSearch && matchesStatus && matchesMonth;
    });
  }, [monthFilter, search, sortedTerms, statusFilter]);

  const summary = useMemo(() => {
    const concluded = termos.filter(
      (item) => normalize(item.status) === "concluido",
    ).length;
    const pending = termos.filter(
      (item) => normalize(item.status) === "em andamento",
    ).length;
    const canceled = termos.filter(
      (item) => normalize(item.status) === "cancelado",
    ).length;
    const slaValues = termos
      .filter((item) => String(item.slaDias || "").trim() !== "")
      .map((item) => Number(item.slaDias))
      .filter((value) => Number.isFinite(value));
    const averageSla = slaValues.length
      ? Math.round(
          slaValues.reduce((acc, value) => acc + value, 0) / slaValues.length,
        )
      : 0;

    return {
      total: termos.length,
      concluded,
      pending,
      canceled,
      averageSla,
    };
  }, []);

  const cards = [
    {
      label: "Total de termos",
      value: summary.total,
      Icon: FileSignature,
      tone: "text-[var(--accent)]",
    },
    {
      label: "Concluídos",
      value: summary.concluded,
      Icon: CheckCircle2,
      tone: "text-emerald-300",
    },
    {
      label: "Em andamento",
      value: summary.pending,
      Icon: Clock3,
      tone: "text-amber-300",
    },
    {
      label: "Cancelados",
      value: summary.canceled,
      Icon: XCircle,
      tone: "text-rose-300",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <FileSignature className="h-4 w-4 text-[var(--accent)]" />
            Termos
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Controle de envio e assinatura
          </h1>C
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] px-4 py-3 text-sm">
          <span className="text-[var(--text-muted)]">SLA médio</span>
          <strong className="ml-2 text-lg text-[var(--text)]">
            {summary.averageSla} dias
          </strong>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, Icon, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--text-muted)]">{label}</span>
              <Icon className={`h-5 w-5 ${tone}`} />
            </div>
            <div className="mt-3 text-3xl font-semibold text-[var(--text)]">
              {value}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-[var(--bg-card)] p-4 lg:flex-row lg:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
          <Search className="h-4 w-4 text-[var(--accent)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Buscar por nome, e-mail, status ou data"
          />
        </label>

        <div className="flex flex-col gap-3 sm:flex-row lg:w-auto">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text-muted)]">
            <SlidersHorizontal className="h-4 w-4 text-[var(--accent)]" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="bg-transparent text-[var(--text)] outline-none"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm">
            <select
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
              className="bg-transparent text-[var(--text)] outline-none"
            >
              {monthOptions.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-card)]">
        <div className="border-b border-[var(--line)] px-4 py-3 text-sm text-[var(--text-muted)]">
          Exibindo {filteredTerms.length} de {termos.length} termos
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--accent-weak)]/35 text-left text-[var(--text)]">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Email VTEX</th>
                <th className="p-3">Envio</th>
                <th className="p-3">Assinatura</th>
                <th className="p-3">Status</th>
                <th className="p-3">SLA</th>
                <th className="p-3">Mês</th>
              </tr>
            </thead>
            <tbody>
              {filteredTerms.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-6 text-center text-[var(--text-muted)]"
                  >
                    Nenhum termo encontrado.
                  </td>
                </tr>
              ) : (
                filteredTerms.map((item) => (
                  <tr key={item.id} className="border-t border-[var(--line)]">
                    <td className="p-3 font-medium text-[var(--text)]">
                      {item.nome || "—"}
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {item.email || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.dataEnvio || "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.dataAssinatura || "—"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${resolveStatusClass(
                          item.status,
                        )}`}
                      >
                        {item.status || "Sem status"}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {item.slaDias ? `${item.slaDias} dias` : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-[var(--text-muted)]">
                      {item.mes || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
