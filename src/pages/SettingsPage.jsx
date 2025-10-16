import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Shield,
  ClipboardList,
  Building2,
  Workflow,
  ShieldCheck,
  Save,
  Tag,
  Check,
  X,
  Cpu,
  Sun,
  Moon,
} from "lucide-react";
import { motion } from "framer-motion";
import { useSidebar } from "../context/SidebarContext";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const DEFAULT_CONFIG = {
  offices: [
    {
      id: "sao-paulo",
      nome: "São Paulo",
      slug: "sao-paulo",
      collection: "sao-paulo",
      system: true,
    },
    {
      id: "rio-de-janeiro",
      nome: "Rio de Janeiro",
      slug: "rio-de-janeiro",
      collection: "rio-de-janeiro",
      system: true,
    },
    {
      id: "joao-pessoa",
      nome: "João Pessoa",
      slug: "joao-pessoa",
      collection: "joao-pessoa",
      system: true,
    },
    {
      id: "outros",
      nome: "Outros",
      slug: "outros",
      collection: "outros",
      system: true,
    },
  ],
  roles: [
    {
      id: "admin",
      nome: "Admin",
      descricao: "Acesso total às funcionalidades e configurações do sistema.",
      system: true,
    },
    {
      id: "operador",
      nome: "Operador",
      descricao:
        "Pode cadastrar movimentações, atualizar estoques e exportar relatórios.",
      system: true,
    },
    {
      id: "leitor",
      nome: "Leitor",
      descricao: "Visualiza dados de inventário e relatórios, sem alterações.",
      system: true,
    },
    {
      id: "seguranca",
      nome: "Segurança",
      descricao:
        "Consulta registros relevantes a compliance e histórico de movimentações.",
      system: true,
    },
  ],
  inventory: {
    fields: [
      { key: "serial", label: "Serial", visible: true, required: true },
      { key: "modelo", label: "Modelo", visible: true, required: true },
      { key: "status", label: "Status", visible: true, required: true },
      { key: "email", label: "E-mail", visible: true, required: false },
      { key: "observacao", label: "Observação", visible: true, required: false },
    ],
    statuses: [
      { id: "disponivel", label: "Disponível", system: true },
      { id: "indisponivel", label: "Indisponível", system: true },
    ],
    models: [
      { id: "macbook-air-m1", nome: "MacBook Air M1", system: true },
      { id: "dell-latitude-5420", nome: "Dell Latitude 5420", system: true },
      { id: "lenovo-thinkpad-l14", nome: "Lenovo ThinkPad L14", system: true },
    ],
  },
  movements: {
    defaults: {
      tipo: "Saída",
      disponibilidade: "Indisponível",
      local: "São Paulo",
    },
    options: {
      tipos: ["Entrada", "Saída"],
      disponibilidades: ["Disponível", "Indisponível"],
    },
    validations: [
      {
        id: "entrada-modelo",
        label: 'Impedir "Entrada" sem modelo definido',
        descricao: "Exige que movimentações de Entrada informem o modelo.",
        enabled: true,
      },
      {
        id: "serie-obrigatoria",
        label: "Número de série obrigatório",
        descricao: "Nenhuma movimentação pode ser salva sem número de série.",
        enabled: true,
      },
      {
        id: "saida-email",
        label: 'Alertar "Saída" sem e-mail',
        descricao:
          "Exibe alerta quando uma saída não possui e-mail do responsável.",
        enabled: false,
      },
    ],
  },
};

const THEME_OPTIONS = [
  {
    id: "dark",
    label: "Neon Dark",
    description: "Visual original com fundo escuro",
    Icon: Moon,
  },
  {
    id: "light",
    label: "Clear",
    description: "Tema claro com detalhes rosa",
    Icon: Sun,
  },
];

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <motion.section
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.25 }}
    className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg"
  >
    <header className="flex items-center gap-3 px-6 py-5 border-b border-[var(--line)]">
      <div className="p-3 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)]">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {description && (
          <p className="text-sm text-[var(--text-muted)]">{description}</p>
        )}
      </div>
    </header>
    <div className="px-6 py-5 space-y-4">{children}</div>
  </motion.section>
);

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const randomId = () => Math.random().toString(36).slice(2, 10);

const APP_SETTINGS_COLLECTION = "appSettings";
const APP_SETTINGS_DOC_ID = "global";

const ensureArray = (value, fallback = []) =>
  Array.isArray(value) ? value : Array.isArray(fallback) ? fallback : [];

const normalizeStatuses = (list) =>
  ensureArray(list, DEFAULT_CONFIG.inventory.statuses)
    .map((status) => {
      if (typeof status === "string") {
        const label = status.trim();
        if (!label) return null;
        return {
          id: slugify(label) || randomId(),
          label,
          system: false,
        };
      }
      const label = (status?.label || status?.nome || "").trim();
      if (!label) return null;
      return {
        id: status?.id || slugify(label) || randomId(),
        label,
        system: Boolean(status?.system),
      };
    })
    .filter(Boolean);

const normalizeModels = (list) =>
  ensureArray(list, DEFAULT_CONFIG.inventory.models)
    .map((model) => {
      if (typeof model === "string") {
        const nome = model.trim();
        if (!nome) return null;
        return {
          id: slugify(nome) || randomId(),
          nome,
          system: false,
        };
      }
      const nome = (model?.nome || model?.label || "").trim();
      if (!nome) return null;
      return {
        id: model?.id || slugify(nome) || randomId(),
        nome,
        system: Boolean(model?.system),
      };
    })
    .filter(Boolean);

const buildConfigFromData = (data) => {
  const source = data && typeof data === "object" ? data : {};
  const inventorySource = source.inventory || {};
  const movementsSource = source.movements || {};

  return {
    offices: ensureArray(source.offices, DEFAULT_CONFIG.offices).map(
      (office) => ({ ...office })
    ),
    roles: ensureArray(source.roles, DEFAULT_CONFIG.roles).map((role) => ({
      ...role,
    })),
    inventory: {
      fields: ensureArray(
        inventorySource.fields,
        DEFAULT_CONFIG.inventory.fields
      ).map((field) => ({ ...field })),
      statuses: normalizeStatuses(inventorySource.statuses),
      models: normalizeModels(inventorySource.models),
    },
    movements: {
      defaults: {
        ...DEFAULT_CONFIG.movements.defaults,
        ...(movementsSource.defaults || {}),
      },
      options: {
        tipos: ensureArray(
          movementsSource.options?.tipos,
          DEFAULT_CONFIG.movements.options.tipos
        ).map((item) => String(item)),
        disponibilidades: ensureArray(
          movementsSource.options?.disponibilidades,
          DEFAULT_CONFIG.movements.options.disponibilidades
        ).map((item) => String(item)),
      },
      validations: ensureArray(
        movementsSource.validations,
        DEFAULT_CONFIG.movements.validations
      ).map((rule) => ({ ...rule })),
    },
  };
};

const serializeConfig = (config) =>
  JSON.parse(
    JSON.stringify({
      offices: config.offices,
      roles: config.roles,
      inventory: config.inventory,
      movements: config.movements,
    })
  );

export default function SettingsPage() {
  const { theme: appTheme = "dark", setTheme: setAppTheme = () => {} } =
    useSidebar();
  const settingsDocRef = useMemo(
    () => doc(db, APP_SETTINGS_COLLECTION, APP_SETTINGS_DOC_ID),
    []
  );
  const [config, setConfig] = useState(() => buildConfigFromData());
  const [configLoaded, setConfigLoaded] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      settingsDocRef,
      (snap) => {
        const nextConfig = buildConfigFromData(snap.data());
        skipNextSave.current = true;
        setConfig(nextConfig);
        setConfigLoaded(true);

        if (!snap.exists()) {
          setDoc(settingsDocRef, serializeConfig(nextConfig)).catch((error) =>
            console.error("Não foi possível inicializar configurações:", error)
          );
        }
      },
      (error) => {
        console.error("Não foi possível carregar configurações:", error);
        skipNextSave.current = true;
        setConfig(buildConfigFromData());
        setConfigLoaded(true);
      }
    );

    return () => unsubscribe();
  }, [settingsDocRef]);

  useEffect(() => {
    if (!configLoaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    const timeout = setTimeout(() => {
      setDoc(settingsDocRef, serializeConfig(config)).catch((error) =>
        console.error("Não foi possível salvar configurações:", error)
      );
    }, 350);

    return () => clearTimeout(timeout);
  }, [config, configLoaded, settingsDocRef]);

  const [newOffice, setNewOffice] = useState({
    nome: "",
    slug: "",
    collection: "",
  });

  const [newRole, setNewRole] = useState({ nome: "", descricao: "" });
  const [newStatus, setNewStatus] = useState("");
  const [newModel, setNewModel] = useState("");

  const defaultOfficeLocal = useMemo(() => {
    const primary = config.offices[0]?.nome ?? DEFAULT_CONFIG.movements.defaults.local;
    return config.movements.defaults.local || primary;
  }, [config.offices, config.movements.defaults.local]);

  const handleThemeChange = (value) => {
    setAppTheme(value);
  };

  const handleAddOffice = (event) => {
    event.preventDefault();
    const trimmed = {
      nome: newOffice.nome.trim(),
      slug: (newOffice.slug || slugify(newOffice.nome)).trim(),
      collection: newOffice.collection.trim(),
    };
    if (!trimmed.nome || !trimmed.slug || !trimmed.collection) return;

    setConfig((prev) => ({
      ...prev,
      offices: [
        ...prev.offices,
        {
          id: trimmed.slug,
          ...trimmed,
          system: false,
        },
      ],
    }));
    setNewOffice({ nome: "", slug: "", collection: "" });
  };

  const handleRemoveOffice = (id) => {
    setConfig((prev) => {
      const target = prev.offices.find((office) => office.id === id);
      if (target?.system) return prev;
      return {
        ...prev,
        offices: prev.offices.filter((office) => office.id !== id),
      };
    });
  };

  const handleFieldVisibility = (key, isVisible) => {
    setConfig((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        fields: prev.inventory.fields.map((field) =>
          field.key === key
            ? {
                ...field,
                visible: isVisible,
                required: isVisible ? field.required : false,
              }
            : field
        ),
      },
    }));
  };

  const handleToggleRequired = (key) => {
    setConfig((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        fields: prev.inventory.fields.map((field) =>
          field.key === key
            ? {
                ...field,
                required: field.visible ? !field.required : field.required,
              }
            : field
        ),
      },
    }));
  };

  const handleAddStatus = (event) => {
    event.preventDefault();
    const label = newStatus.trim();
    if (!label) return;

    const id = slugify(label) || randomId();
    const exists = config.inventory.statuses.some(
      (status) => status.id === id || status.label.toLowerCase() === label.toLowerCase()
    );
    if (exists) {
      setNewStatus("");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        statuses: [
          ...prev.inventory.statuses,
          { id, label, system: false },
        ],
      },
    }));
    setNewStatus("");
  };

  const handleRemoveStatus = (id) => {
    setConfig((prev) => {
      const target = prev.inventory.statuses.find((status) => status.id === id);
      if (target?.system) return prev;
      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          statuses: prev.inventory.statuses.filter(
            (status) => status.id !== id
          ),
        },
      };
    });
  };

  const handleAddModel = (event) => {
    event.preventDefault();
    const nome = newModel.trim();
    if (!nome) return;

    const id = slugify(nome) || randomId();
    const exists = config.inventory.models.some(
      (model) =>
        model.id === id || model.nome.toLowerCase() === nome.toLowerCase()
    );
    if (exists) {
      setNewModel("");
      return;
    }

    setConfig((prev) => ({
      ...prev,
      inventory: {
        ...prev.inventory,
        models: [
          ...prev.inventory.models,
          { id, nome, system: false },
        ],
      },
    }));
    setNewModel("");
  };

  const handleRemoveModel = (id) => {
    setConfig((prev) => {
      const target = prev.inventory.models.find((model) => model.id === id);
      if (target?.system) return prev;
      return {
        ...prev,
        inventory: {
          ...prev.inventory,
          models: prev.inventory.models.filter((model) => model.id !== id),
        },
      };
    });
  };

  const handleAddRole = (event) => {
    event.preventDefault();
    const nome = newRole.nome.trim();
    const descricao = newRole.descricao.trim();
    if (!nome) return;

    const id = slugify(nome) || randomId();
    const exists = config.roles.some(
      (role) => role.id === id || role.nome.toLowerCase() === nome.toLowerCase()
    );

    if (exists) {
      setNewRole({ nome: "", descricao: "" });
      return;
    }

    setConfig((prev) => ({
      ...prev,
      roles: [
        ...prev.roles,
        {
          id,
          nome,
          descricao: descricao || "Sem descrição",
          system: false,
        },
      ],
    }));
    setNewRole({ nome: "", descricao: "" });
  };

  const handleRemoveRole = (id) => {
    setConfig((prev) => {
      const target = prev.roles.find((role) => role.id === id);
      if (target?.system) return prev;
      return {
        ...prev,
        roles: prev.roles.filter((role) => role.id !== id),
      };
    });
  };

  const handleUpdateRoleDescription = (id, descricao) => {
    setConfig((prev) => ({
      ...prev,
      roles: prev.roles.map((role) =>
        role.id === id ? { ...role, descricao } : role
      ),
    }));
  };

  const handleDefaultsChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      movements: {
        ...prev.movements,
        defaults: {
          ...prev.movements.defaults,
          [field]: value,
        },
      },
    }));
  };

  const handleToggleValidation = (id) => {
    setConfig((prev) => ({
      ...prev,
      movements: {
        ...prev.movements,
        validations: prev.movements.validations.map((rule) =>
          rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
        ),
      },
    }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 space-y-6">
      <header className="flex flex-col gap-3 pt-2">
        <div className="inline-flex items-center gap-2 text-sm uppercase tracking-[0.2em] text-[var(--text-muted)]">
          <Shield className="w-4 h-4 text-[var(--accent)]" />
          Centro de Configurações
        </div>
        <h1 className="text-3xl font-semibold text-[var(--text)]">
          Configurações
        </h1>
        <p className="text-sm text-[var(--text-muted)] max-w-2xl">
          Ajuste cadastros básicos, regras de acesso e parâmetros que moldam o
          comportamento do Notebook Stock e das Movimentações de Equipamentos.
          Todas as alterações são salvas automaticamente no Firebase.
        </p>
      </header>

      <SectionCard
        icon={Sun}
        title="Aparência"
        description="Escolha entre o tema escuro neon ou a versão clara com detalhes rosa."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map(({ id, label, description, Icon }) => {
            const active = appTheme === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => handleThemeChange(id)}
                className={[
                  "w-full text-left rounded-2xl border px-4 py-4 transition flex items-start gap-3",
                  active
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)] shadow-[0_0_24px_rgba(225,29,116,0.35)]"
                    : "border-[var(--line)] hover:border-[var(--accent)]/50 text-[var(--text)]",
                ].join(" ")}
              >
                <div
                  className={[
                    "p-2 rounded-xl",
                    active
                      ? "bg-[var(--accent)]/25 text-[var(--accent)]"
                      : "bg-[var(--bg-soft)] text-[var(--text-muted)]",
                  ].join(" ")}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-semibold">{label}</div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {description}
                  </p>
                  {active && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-[10px] font-semibold uppercase tracking-[0.2em] px-2 py-0.5">
                      Ativo
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        icon={Building2}
        title="Cadastros de escritórios"
        description="Controle quais escritórios aparecem nas telas de inventário e movimentação."
      >
        <form
          onSubmit={handleAddOffice}
          className="grid gap-4 md:grid-cols-[repeat(4,minmax(0,1fr))] md:items-end"
        >
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Nome
            <input
              value={newOffice.nome}
              onChange={(e) =>
                setNewOffice((prev) => ({ ...prev, nome: e.target.value }))
              }
              className="input-neon"
              placeholder="Ex.: Recife"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Slug
            <input
              value={newOffice.slug}
              onChange={(e) =>
                setNewOffice((prev) => ({ ...prev, slug: e.target.value }))
              }
              className="input-neon"
              placeholder="recife"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Coleção do Firestore
            <input
              value={newOffice.collection}
              onChange={(e) =>
                setNewOffice((prev) => ({
                  ...prev,
                  collection: e.target.value,
                }))
              }
              className="input-neon"
              placeholder="recife"
              required
            />
          </label>
          <button
            type="submit"
            className="btn-neon flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </form>

        <div className="overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/60">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--bg-card)] text-[var(--text-muted)] uppercase tracking-wide text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Slug</th>
                <th className="px-4 py-3 text-left">Coleção</th>
                <th className="px-4 py-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {config.offices.map((office) => (
                <tr
                  key={office.id}
                  className="border-t border-[var(--line)] text-[var(--text)]"
                >
                  <td className="px-4 py-2">{office.nome}</td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">
                    {office.slug}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-[var(--text-muted)]">
                    {office.collection}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveOffice(office.id)}
                        disabled={office.system}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        icon={ShieldCheck}
        title="Usuários & Acesso (RBAC)"
        description="Administre papéis e descrições para controlar acesso às funcionalidades."
      >
        <form
          onSubmit={handleAddRole}
          className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]"
        >
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Papel
            <input
              value={newRole.nome}
              onChange={(e) =>
                setNewRole((prev) => ({ ...prev, nome: e.target.value }))
              }
              className="input-neon"
              placeholder="Ex.: Auditor"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-[var(--text-muted)]">
            Descrição
            <input
              value={newRole.descricao}
              onChange={(e) =>
                setNewRole((prev) => ({ ...prev, descricao: e.target.value }))
              }
              className="input-neon"
              placeholder="O que esse papel pode fazer?"
            />
          </label>
          <button
            type="submit"
            className="btn-neon flex items-center gap-2 justify-center"
          >
            <Plus className="w-4 h-4" />
            Adicionar papel
          </button>
        </form>

        <div className="grid gap-3">
          {config.roles.map((role) => (
            <div
              key={role.id}
              className="rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/60 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[var(--text)] font-medium">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                  {role.nome}
                  {role.system && (
                    <span className="rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-[11px] px-2 py-0.5 uppercase tracking-wide">
                      Padrão
                    </span>
                  )}
                </div>
                <textarea
                  value={role.descricao}
                  onChange={(e) =>
                    handleUpdateRoleDescription(role.id, e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-[var(--line)] bg-transparent px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/60"
                  rows={2}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveRole(role.id)}
                disabled={role.system}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--line)] px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed self-start md:self-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </button>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={ClipboardList}
        title="Inventário (Notebook Stock)"
        description="Personalize campos exibidos/obrigatórios e os status aceitos no estoque."
      >
        <div className="grid gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-2">
              Campos visíveis / obrigatórios
            </h3>
            <div className="overflow-hidden rounded-xl border border-[var(--line)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[var(--bg-card)] text-[var(--text-muted)] uppercase tracking-wide text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Campo</th>
                    <th className="px-4 py-3 text-center">Visível</th>
                    <th className="px-4 py-3 text-center">Obrigatório</th>
                  </tr>
                </thead>
                <tbody>
                  {config.inventory.fields.map((field) => (
                    <tr
                      key={field.key}
                      className="border-t border-[var(--line)] text-[var(--text)]"
                    >
                      <td className="px-4 py-2">{field.label}</td>
                      <td className="px-4 py-2 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.visible}
                            onChange={(e) =>
                              handleFieldVisibility(field.key, e.target.checked)
                            }
                          />
                        </label>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={field.required}
                            disabled={!field.visible}
                            onChange={() => handleToggleRequired(field.key)}
                          />
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-2">
              Lista de status permitidos
            </h3>
            <form
              onSubmit={handleAddStatus}
              className="flex flex-col sm:flex-row gap-3 mb-4"
            >
              <label className="flex flex-1 flex-col gap-1 text-sm text-[var(--text-muted)]">
                Novo status
                <input
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input-neon"
                  placeholder="Ex.: Em manutenção"
                />
              </label>
              <button
                type="submit"
                className="btn-neon flex items-center gap-2 justify-center"
              >
                <Tag className="w-4 h-4" />
                Adicionar status
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {config.inventory.statuses.map((status) => (
                <span
                  key={status.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-3 py-1 text-sm text-[var(--text)]"
                >
                  <span>{status.label}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStatus(status.id)}
                    disabled={status.system}
                    className="rounded-full bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[var(--text)] mb-2">
              Modelos disponíveis
            </h3>
            <form
              onSubmit={handleAddModel}
              className="flex flex-col sm:flex-row gap-3 mb-4"
            >
              <label className="flex flex-1 flex-col gap-1 text-sm text-[var(--text-muted)]">
                Novo modelo
                <input
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="input-neon"
                  placeholder="Ex.: HP EliteBook 840"
                />
              </label>
              <button
                type="submit"
                className="btn-neon flex items-center gap-2 justify-center"
              >
                <Cpu className="w-4 h-4" />
                Adicionar modelo
              </button>
            </form>

            <div className="flex flex-wrap gap-2">
              {config.inventory.models.map((model) => (
                <span
                  key={model.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--bg-card)] px-3 py-1 text-sm text-[var(--text)]"
                >
                  <span>{model.nome}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(model.id)}
                    disabled={model.system}
                    className="rounded-full bg-red-500/10 p-1 text-red-300 hover:bg-red-500/20 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        icon={Workflow}
        title="Movimentações (Equipment Movement)"
        description="Defina valores padrão do formulário e ative validações adicionais."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
            Tipo padrão
            <select
              value={config.movements.defaults.tipo}
              onChange={(e) => handleDefaultsChange("tipo", e.target.value)}
              className="input-neon"
            >
              {config.movements.options.tipos.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)]">
            Disponibilidade padrão
            <select
              value={config.movements.defaults.disponibilidade}
              onChange={(e) =>
                handleDefaultsChange("disponibilidade", e.target.value)
              }
              className="input-neon"
            >
              {config.movements.options.disponibilidades.map((disp) => (
                <option key={disp} value={disp}>
                  {disp}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-[var(--text-muted)] md:col-span-2">
            Local padrão
            <input
              value={config.movements.defaults.local}
              onChange={(e) => handleDefaultsChange("local", e.target.value)}
              placeholder={defaultOfficeLocal}
              className="input-neon"
            />
          </label>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-[var(--text)] mb-2">
            Validações ativas
          </h3>
          <div className="grid gap-3">
            {config.movements.validations.map((rule) => (
              <div
                key={rule.id}
                className="flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--bg-soft)]/60 p-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3 text-sm text-[var(--text)]">
                  <div
                    className={`rounded-full p-2 ${
                      rule.enabled ? "text-emerald-300" : "text-[var(--text-muted)]"
                    }`}
                  >
                    {rule.enabled ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{rule.label}</div>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {rule.descricao}
                    </p>
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)] uppercase tracking-wide">
                  <span>{rule.enabled ? "Ativa" : "Desativada"}</span>
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={() => handleToggleValidation(rule.id)}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <footer className="flex items-center justify-between rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] px-6 py-4 text-sm text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <Save className="w-4 h-4 text-[var(--accent)]" />
          Alterações salvas automaticamente em{" "}
          <code className="font-mono text-xs bg-[var(--bg-soft)] px-2 py-1 rounded">
            localStorage
          </code>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-300" />
          Exporte manualmente se desejar replicar em outros dispositivos.
        </div>
      </footer>
    </div>
  );
}
