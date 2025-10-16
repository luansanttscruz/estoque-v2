import { useState, useEffect, useRef } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login";
import InventoryPage from "./pages/InventoryPage";
import SaoPaulo from "./pages/SaoPaulo";
import RioDeJaneiro from "./pages/RioDeJaneiro";
import JoaoPessoa from "./pages/JoaoPessoa";
import Outros from "./pages/Outros";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import SideMenu from "./components/SideMenu";
import { SidebarContext } from "./context/SidebarContext";

import Menu from "./pages/Menu";
import OnboardingPage from "./pages/OnboardingPage";
import DocsPage from "./pages/DocsPage";
import ImportarOnboardings from "./pages/ImportarOnboardings";
import WeeklyTasks from "./pages/WeeklyTasks";
import EquipmentMovement from "./pages/EquipmentMovement";
import FinalizadasPage from "./pages/FinalizadasPage";
import MovementListPage from "./pages/MovementListPage";
import SettingsPage from "./pages/SettingsPage";
import LicensesPage from "./pages/LicensesPage";
import DownloadsPage from "./pages/DownloadsPage";
import PeripheralsPage from "./pages/PeripheralsPage";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Toaster } from "react-hot-toast";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "./firebase";

// Layout com Navbar (dark) + SideMenu (lateral) + botão de colapsar
function Layout({ children }) {
  const { usuario } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar:collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState("dark");
  const [themeReady, setThemeReady] = useState(false);
  const lastSyncedTheme = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem("sidebar:collapsed", collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);

  useEffect(() => {
    if (!usuario?.uid) {
      lastSyncedTheme.current = "dark";
      setTheme("dark");
      setThemeReady(true);
      const root = document.documentElement;
      root.classList.remove("theme-dark", "theme-light");
      root.classList.add("theme-dark");
      return undefined;
    }

    setThemeReady(false);
    const prefRef = doc(db, "userPreferences", usuario.uid);

    const unsubscribe = onSnapshot(
      prefRef,
      (snap) => {
        const savedTheme = snap.exists()
          ? snap.data()?.theme === "light"
            ? "light"
            : "dark"
          : "dark";
        lastSyncedTheme.current = savedTheme;
        setTheme(savedTheme);
        setThemeReady(true);
      },
      (error) => {
        console.error("Não foi possível carregar tema do usuário:", error);
        lastSyncedTheme.current = "dark";
        setTheme("dark");
        setThemeReady(true);
      }
    );

    return () => unsubscribe();
  }, [usuario?.uid]);

  useEffect(() => {
    if (!usuario?.uid) return;
    if (!themeReady) return;
    if (lastSyncedTheme.current === theme) return;

    const prefRef = doc(db, "userPreferences", usuario.uid);
    setDoc(prefRef, { theme }, { merge: true })
      .then(() => {
        lastSyncedTheme.current = theme;
      })
      .catch((error) => {
        console.error("Erro ao salvar tema do usuário:", error);
      });
  }, [theme, usuario?.uid, themeReady]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("theme-dark", "theme-light");
    root.classList.add(theme === "light" ? "theme-light" : "theme-dark");
  }, [theme]);

  const toggleSidebar = () => setCollapsed((v) => !v);

  const toasterStyle =
    theme === "light"
      ? {
          background: "rgba(255,255,255,0.96)",
          color: "#331728",
          border: "1px solid rgba(225,29,116,0.18)",
        }
      : {
          background: "rgba(15,15,23,0.95)",
          color: "#fff",
          border: "1px solid rgba(255,255,255,0.08)",
        };

  return (
    <SidebarContext.Provider
      value={{ collapsed, setCollapsed, toggle: toggleSidebar, theme, setTheme }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: toasterStyle,
        }}
      />
      <div className="min-h-screen flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <Navbar />
        <div className="flex flex-1">
          {/* Sidebar fixa */}
          <aside
            className={`relative border-r border-[var(--line)] bg-[var(--bg-soft)] transition-[width] duration-200 ${
              collapsed ? "w-16" : "w-[260px]"
            }`}
          >
            {/* Botão flutuante para colapsar/expandir */}
            <button
              onClick={toggleSidebar}
              aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
              className="absolute -right-3 top-16 z-20 rounded-full bg-[var(--bg-card)] border border-[var(--line)] p-1.5 shadow hover:brightness-110"
              title={collapsed ? "Mostrar menu" : "Esconder menu"}
            >
              {collapsed ? (
                <ChevronRight className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-[var(--accent)]" />
              )}
            </button>

            <SideMenu collapsed={collapsed} />
          </aside>

          {/* Conteúdo */}
          <main className="flex-1 p-4 transition-[max-width] duration-200 ease-in-out">
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}

// Rota protegida
function RotaPrivada({ children }) {
  const { usuario } = useAuth();
  return usuario ? <Layout>{children}</Layout> : <Navigate to="/login" />;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Home (página de cards) */}
          <Route
            path="/"
            element={
              <RotaPrivada>
                <Menu />
              </RotaPrivada>
            }
          />

          {/* Rotas existentes (mantidas) */}
          <Route
            path="/inventory"
            element={
              <RotaPrivada>
                <InventoryPage />
              </RotaPrivada>
            }
          />
          <Route
            path="/peripherals"
            element={
              <RotaPrivada>
                <PeripheralsPage />
              </RotaPrivada>
            }
          />
          <Route
            path="/sp"
            element={
              <RotaPrivada>
                <SaoPaulo />
              </RotaPrivada>
            }
          />
          <Route
            path="/rio"
            element={
              <RotaPrivada>
                <RioDeJaneiro />
              </RotaPrivada>
            }
          />
          <Route
            path="/jp"
            element={
              <RotaPrivada>
                <JoaoPessoa />
              </RotaPrivada>
            }
          />
          <Route
            path="/onboarding"
            element={
              <RotaPrivada>
                <OnboardingPage />
              </RotaPrivada>
            }
          />
          <Route
            path="/ou"
            element={
              <RotaPrivada>
                <Outros />
              </RotaPrivada>
            }
          />
          <Route
            path="/docs"
            element={
              <RotaPrivada>
                <DocsPage />
              </RotaPrivada>
            }
          />
          <Route
            path="/importar-onboardings"
            element={
              <RotaPrivada>
                <ImportarOnboardings />
              </RotaPrivada>
            }
          />
          <Route
            path="/weekly-tasks"
            element={
              <RotaPrivada>
                <WeeklyTasks />
              </RotaPrivada>
            }
          />
          <Route
            path="/weekly-tasks/finalizadas"
            element={
              <RotaPrivada>
                <FinalizadasPage />
              </RotaPrivada>
            }
          />

          <Route
            path="/equipment-movement"
            element={
              <RotaPrivada>
                <EquipmentMovement />
              </RotaPrivada>
            }
          />
          <Route
            path="/equipment-movement/sp"
            element={
              <RotaPrivada>
                <MovementListPage office="São Paulo" />
              </RotaPrivada>
            }
          />
          <Route
            path="/equipment-movement/rio"
            element={
              <RotaPrivada>
                <MovementListPage office="Rio de Janeiro" />
              </RotaPrivada>
            }
          />
          <Route
            path="/equipment-movement/jp"
            element={
              <RotaPrivada>
                <MovementListPage office="João Pessoa" />
              </RotaPrivada>
            }
          />
          <Route
            path="/licenses"
            element={
              <RotaPrivada>
                <LicensesPage />
              </RotaPrivada>
            }
          />
          <Route path="/licencas" element={<Navigate to="/licenses" replace />} />
          <Route
            path="/downloads"
            element={
              <RotaPrivada>
                <DownloadsPage />
              </RotaPrivada>
            }
          />
          <Route
            path="/settings"
            element={
              <RotaPrivada>
                <SettingsPage />
              </RotaPrivada>
            }
          />
          <Route path="/config" element={<Navigate to="/settings" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
