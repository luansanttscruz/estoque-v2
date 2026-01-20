// src/components/Navbar.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { Laptop, LogOut, User, Menu as MenuIcon } from "lucide-react";

const DRIVE_TOKEN_KEY = "googleDriveAccessToken";

export default function Navbar({ onOpenMenu }) {
  const { usuario } = useAuth();
  const [erroImg, setErroImg] = useState(false);

  const handleLogout = async () => {
    try {
      localStorage.removeItem(DRIVE_TOKEN_KEY);
      await signOut(auth);
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  return (
    <header className="h-14 w-full border-b border-[var(--line)] bg-[var(--bg-soft)] text-[var(--text)]">
      <div className="h-full max-w-7xl mx-auto px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onOpenMenu && (
            <button
              type="button"
              onClick={onOpenMenu}
              className="md:hidden inline-flex items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--bg-card)] p-2 text-[var(--text)] hover:bg-white/5 transition"
              aria-label="Abrir menu"
            >
              <MenuIcon className="w-4 h-4" />
            </button>
          )}

        {/* Marca */}
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold tracking-wide hover:opacity-90"
        >
          <Laptop className="w-5 h-5 text-[var(--accent)]" />
          <span>IT Operations</span>
        </Link>
        </div>

        {/* Usuário / Ações */}
        {usuario ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm bg-[var(--bg-card)] border border-[var(--line)] px-3 py-1.5 rounded-full">
              {!erroImg && usuario.photoURL ? (
                <img
                  src={usuario.photoURL}
                  alt="Foto de perfil"
                  onError={() => setErroImg(true)}
                  className="w-6 h-6 rounded-full object-cover"
                  loading="lazy"
                />
              ) : (
                <User className="w-4 h-4 text-[var(--accent)]" />
              )}
              <span className="text-[var(--text)]">{usuario.email}</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 text-sm px-2.5 py-1.5 rounded-lg
                         border border-[var(--accent)] text-[var(--accent)]
                         hover:bg-[var(--accent)]/10 transition"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>
        ) : (
          <span className="text-[var(--text-muted)] text-sm">
            Não autenticado
          </span>
        )}
      </div>
    </header>
  );
}
