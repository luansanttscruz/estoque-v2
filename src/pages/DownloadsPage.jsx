import { Download, HardDrive, FileText } from "lucide-react";

const DOWNLOAD_ITEMS = [
  {
    title: "Guia de configuração",
    description: "Documento base de configuração inicial das máquinas.",
    icon: FileText,
    href: "#",
  },
  {
    title: "Pacote de drivers",
    description: "Drivers essenciais. Substitua por links reais futuramente.",
    icon: HardDrive,
    href: "#",
  },
];

export default function DownloadsPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
            <Download className="w-4 h-4 text-[var(--accent)]" />
            Downloads
          </div>
          <h1 className="text-3xl font-semibold text-[var(--text)]">
            Central de Downloads
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Página inicial para organizar arquivos e utilitários. Substitua os
            blocos abaixo pelos downloads reais quando estiverem disponíveis.
          </p>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {DOWNLOAD_ITEMS.map(({ title, description, icon: Icon, href }) => (
          <a
            key={title}
            href={href}
            className="group rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] p-5 transition hover:border-[var(--accent)]/50 hover:bg-[var(--bg-soft)]"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-[var(--accent)]/15 p-3 text-[var(--accent)]">
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-xl font-semibold text-[var(--text)]">
                {title}
              </h2>
            </div>
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {description}
            </p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)] transition group-hover:gap-3">
              Baixar
              <Download className="w-4 h-4" />
            </span>
          </a>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-[var(--line)] bg-[var(--bg-soft)] p-6 text-sm text-[var(--text-muted)]">
        Personalize esta sessão com instruções, versões e changelog dos
        arquivos futuramente. Inclua também checklist de pré-requisitos ou
        observações importantes para a equipe.
      </section>
    </div>
  );
}
