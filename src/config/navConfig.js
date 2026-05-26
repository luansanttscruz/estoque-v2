// src/config/navConfig.js
import {
  Home,
  BarChart3,
  Laptop,
  Boxes,
  KeyRound,
  Download as DownloadIcon,
  Cog,
  FileText,
  FileSignature,
  ListChecks,
  Truck,
  Calculator,
  Activity,
} from "lucide-react";

/** Ajuste a ordem como preferir */
export const primaryNav = [
  { title: "Início", to: "/", Icon: Home },
  { title: "Dashboard", to: "/dashboard", Icon: BarChart3 },
  { title: "Notebook Stock", to: "/inventory", Icon: Laptop }, // segue como principal (2º)
  { title: "Peripherals", to: "/peripherals", Icon: Boxes },
  { title: "Onboarding Nacional", to: "/onboarding", Icon: FileText },
  { title: "Termos", to: "/termos", Icon: FileSignature },
  { title: "Documentation", to: "/docs", Icon: FileText },
  { title: "Weekly Tasks", to: "/weekly-tasks", Icon: ListChecks },
  { title: "Equipment Movement", to: "/equipment-movement", Icon: Truck },
  { title: "Cotação rápida", to: "/cotacao-rapida", Icon: Calculator },
  { title: "Licenças", to: "/licenses", Icon: KeyRound },
  { title: "Downloads", to: "/downloads", Icon: DownloadIcon },
  { title: "Auditoria", to: "/audit-logs", Icon: Activity },
  { title: "Configurações", to: "/settings", Icon: Cog },
];

/** Sem cartões no sidebar */
export const quickLinks = [];
