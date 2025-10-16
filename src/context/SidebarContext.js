import { createContext, useContext } from "react";

export const SidebarContext = createContext({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
  theme: "dark",
  setTheme: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}
