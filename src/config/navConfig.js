// src/config/navConfig.js
import {
  Home,
  Laptop,
  KeyRound,
  Download as DownloadIcon,
  Cog,
  FileText,
  ListChecks,
  Truck,
} from "lucide-react";

/** Ajuste a ordem como preferir */
export const primaryNav = [
  { title: "Início", to: "/", Icon: Home },
  { title: "Notebook Stock", to: "/inventory", Icon: Laptop }, // segue como principal (2º)
  { title: "Onboarding Nacional", to: "/onboarding", Icon: FileText },
  { title: "Documentation", to: "/docs", Icon: FileText },
  { title: "Weekly Tasks", to: "/weekly-tasks", Icon: ListChecks },
  { title: "Equipment Movement", to: "/equipment-movement", Icon: Truck },
  { title: "Licenças", to: "/licenses", Icon: KeyRound },
  { title: "Downloads", to: "/downloads", Icon: DownloadIcon },
  { title: "Configurações", to: "/settings", Icon: Cog },
];

/** Sem cartões no sidebar */
export const quickLinks = [];
