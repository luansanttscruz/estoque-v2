export const PERMISSION_OPTIONS = [
  { value: "edit", label: "Editar" },
  { value: "view", label: "Somente visualizar" },
];

export const PERMISSION_AREAS = [
  { key: "inventory", label: "Notebook Stock" },
  { key: "movement", label: "Equipment Movement" },
  { key: "peripherals", label: "Peripherals" },
  { key: "onboarding", label: "Onboarding" },
  { key: "terms", label: "Termos" },
  { key: "weeklyTasks", label: "Weekly Tasks" },
  { key: "licenses", label: "Licencas" },
  { key: "downloads", label: "Downloads" },
  { key: "docs", label: "Documentation" },
  { key: "settings", label: "Configuracoes" },
  { key: "users", label: "Usuarios" },
];

export const buildPermissions = (value = "edit") =>
  PERMISSION_AREAS.reduce((acc, area) => {
    acc[area.key] = value;
    return acc;
  }, {});

export const DEFAULT_PERMISSIONS = buildPermissions("edit");

export const mergePermissions = (
  permissions,
  fallback = DEFAULT_PERMISSIONS
) => ({
  ...fallback,
  ...(permissions || {}),
});
