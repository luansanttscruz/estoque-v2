
import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import {
  DEFAULT_PERMISSIONS,
  buildPermissions,
  mergePermissions,
} from "../utils/permissions";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoPerfil, setCarregandoPerfil] = useState(true);
  const navigate = useNavigate();
  const adminEmail = "luan.cruz@vtex.com";

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCarregando(false);
      
      // Redireciona para login se não estiver autenticado
      if (!user && window.location.pathname !== '/login') {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let unsubscribePerfil;

    if (!usuario?.uid) {
      setPerfil(null);
      setCarregandoPerfil(false);
      return () => {};
    }

    const userRef = doc(db, "users", usuario.uid);
    const payload = {
      uid: usuario.uid,
      email: usuario.email || "",
      nome: usuario.displayName || "",
      photoURL: usuario.photoURL || "",
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const shouldBeAdmin =
      (usuario.email || "").toLowerCase() === adminEmail.toLowerCase();

    const ensureUserProfile = async () => {
      try {
        const snapshot = await getDoc(userRef);
        if (!snapshot.exists()) {
          await setDoc(userRef, {
            ...payload,
            role: shouldBeAdmin ? "admin" : "padrao",
            access: "edit",
            permissions: DEFAULT_PERMISSIONS,
            createdAt: serverTimestamp(),
          });
        } else {
          const data = snapshot.data() || {};
          const nextRole = shouldBeAdmin
            ? "admin"
            : data.role || "padrao";
          const nextAccess = shouldBeAdmin ? "edit" : data.access || "edit";
          const fallbackPermissions = buildPermissions(nextAccess);
          const mergedPermissions = mergePermissions(
            data.permissions,
            fallbackPermissions
          );
          await setDoc(
            userRef,
            {
              ...payload,
              role: nextRole,
              access: nextAccess,
              permissions: shouldBeAdmin ? DEFAULT_PERMISSIONS : mergedPermissions,
            },
            { merge: true }
          );
        }
      } catch (error) {
        console.error("Erro ao criar perfil do usuário:", error);
      }
    };

    ensureUserProfile();
    setCarregandoPerfil(true);
    unsubscribePerfil = onSnapshot(
      userRef,
      (snapshot) => {
        setPerfil(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setCarregandoPerfil(false);
      },
      (error) => {
        console.error("Erro ao carregar perfil do usuário:", error);
        setPerfil(null);
        setCarregandoPerfil(false);
      }
    );

    return () => {
      if (unsubscribePerfil) unsubscribePerfil();
    };
  }, [usuario?.uid, usuario?.email, usuario?.displayName, usuario?.photoURL]);

  return (
    <AuthContext.Provider
      value={{
        usuario,
        perfil,
        carregandoPerfil,
        isAdmin: perfil?.role === "admin",
        access: perfil?.access || "edit",
        permissions: mergePermissions(
          perfil?.permissions,
          buildPermissions(perfil?.access || "edit")
        ),
        canEdit:
          perfil?.role === "admin" || (perfil?.access || "edit") === "edit",
        canEditModule: (moduleKey) => {
          if (perfil?.role === "admin") return true;
          const fallbackPermissions = buildPermissions(
            perfil?.access || "edit"
          );
          const mergedPermissions = mergePermissions(
            perfil?.permissions,
            fallbackPermissions
          );
          return (mergedPermissions?.[moduleKey] || "edit") === "edit";
        },
      }}
    >
      {!carregando && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
