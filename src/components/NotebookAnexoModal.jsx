import { useEffect, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
} from "firebase/auth";
import { Paperclip, X } from "lucide-react";
import { auth } from "../firebase";
import showToast from "../utils/showToast";

const DRIVE_TOKEN_KEY = "googleDriveAccessToken";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
const DRIVE_BASE_FOLDER_ID =
  process.env.REACT_APP_DRIVE_BASE_FOLDER_ID ||
  "1cTYLAyW4_MElse2WCJuesP1UWE3OhPrY";
const DRIVE_WEBAPP_URL = process.env.REACT_APP_DRIVE_WEBAPP_URL || "";
const USING_WEBAPP = Boolean(DRIVE_WEBAPP_URL);
const API_BASE = process.env.REACT_APP_API_BASE_URL || "http://localhost:3001";
const DRIVE_WEBAPP_PROXY_URL = `${API_BASE}/api/drive-webapp`;

const buildFolderName = (serial, email) => {
  const baseSerial = String(serial || "").trim();
  if (!baseSerial) return "";
  const baseEmail = String(email || "").trim();
  const rawName = baseEmail ? `${baseSerial} - ${baseEmail}` : baseSerial;
  return rawName.replace(/[\\/]/g, "-").replace(/\s+/g, " ").trim();
};

const escapeQuery = (value) => String(value || "").replace(/'/g, "\\'");

const buildPreviewUrl = (file) =>
  file?.thumbnailLink ||
  file?.thumbnailUrl ||
  (file?.id
    ? `https://drive.google.com/thumbnail?id=${file.id}&sz=w200-h200`
    : "");

export const buildPreviewCandidates = (file) => {
  const candidates = [];
  const mimeType = file?.mimeType || "image/png";

  if (file?.thumbnailData) {
    candidates.push(`data:${mimeType};base64,${file.thumbnailData}`);
  }
  if (file?.data) {
    candidates.push(`data:${mimeType};base64,${file.data}`);
  }
  if (file?.thumbnailLink) candidates.push(file.thumbnailLink);
  if (file?.thumbnailUrl) candidates.push(file.thumbnailUrl);
  if (file?.webContentLink) candidates.push(file.webContentLink);
  if (file?.id) {
    candidates.push(`https://drive.google.com/thumbnail?id=${file.id}&sz=w400`);
    candidates.push(`https://lh3.googleusercontent.com/d/${file.id}=w400-h400`);
    candidates.push(`https://drive.google.com/uc?export=view&id=${file.id}`);
  }

  return Array.from(new Set(candidates.filter(Boolean)));
};

export const buildViewUrl = (file) =>
  file?.webViewLink ||
  (file?.id ? `https://drive.google.com/file/d/${file.id}/view` : "");

const buildPreviewSrc = (file) => {
  if (file?.thumbnailData) {
    return `data:image/png;base64,${file.thumbnailData}`;
  }
  return buildPreviewUrl(file);
};

export function ImagePreview({ file, onOpen, className = "h-24 w-24" }) {
  const candidates = buildPreviewCandidates(file);
  const [index, setIndex] = useState(0);
  const src = candidates[index] || "";

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`relative overflow-hidden rounded border border-[var(--line)] bg-[var(--bg-card)] text-left ${className}`}
      title={file.name || "Abrir imagem"}
    >
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setIndex((current) => current + 1)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[11px] text-[var(--text-muted)]">
          Prévia indisponível
        </div>
      )}
    </button>
  );
}

const createMultipartBody = (metadata, file, boundary) =>
  new Blob([
    `--${boundary}\r\n`,
    "Content-Type: application/json; charset=UTF-8\r\n\r\n",
    JSON.stringify(metadata),
    "\r\n",
    `--${boundary}\r\n`,
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    "\r\n",
    `--${boundary}--`,
  ]);

const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      const base64 = String(result).split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const Spinner = ({ className = "" }) => (
  <span
    className={`inline-flex items-center justify-center w-4 h-4 ${className}`}
    aria-hidden
  >
    <span className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
  </span>
);

export default function NotebookAnexoModal({
  serial,
  email,
  onClose,
  onChanged,
}) {
  const normalizedSerial = (serial || "").trim();
  const normalizedEmail = (email || "").trim();
  const [imagens, setImagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [conectando, setConectando] = useState(false);
  const [erro, setErro] = useState(null);
  const [driveToken, setDriveToken] = useState(
    () => localStorage.getItem(DRIVE_TOKEN_KEY) || ""
  );
  const inputRef = useRef(null);
  const retryingRef = useRef(false);

  const fetchDrive = async (url, options = {}, allowRetry = true) => {
    const token = driveToken || localStorage.getItem(DRIVE_TOKEN_KEY) || "";
    if (!token) {
      throw new Error("Conecte sua conta Google para acessar o Drive.");
    }

    const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem(DRIVE_TOKEN_KEY);
      setDriveToken("");

      if (allowRetry && !retryingRef.current) {
        retryingRef.current = true;
        try {
          const newToken = await requestDriveAccess();
          if (newToken) {
            return fetchDrive(url, options, false);
          }
        } finally {
          retryingRef.current = false;
        }
      }

      throw new Error("Sessão do Drive expirada. Conecte novamente.");
    }

    return response;
  };

  const requestDriveAccess = async () => {
    if (USING_WEBAPP) return "";
    const user = auth.currentUser;
    if (!user) {
      throw new Error("Você precisa estar logado.");
    }

    const provider = new GoogleAuthProvider();
    provider.addScope(DRIVE_SCOPE);

    const hasGoogleProvider = user.providerData.some(
      (item) => item.providerId === "google.com"
    );
    const result = hasGoogleProvider
      ? await reauthenticateWithPopup(user, provider)
      : await linkWithPopup(user, provider);

    const credential = GoogleAuthProvider.credentialFromResult(result);
    const accessToken = credential?.accessToken;

    if (!accessToken) {
      throw new Error("Não foi possível obter o token do Google Drive.");
    }

    localStorage.setItem(DRIVE_TOKEN_KEY, accessToken);
    setDriveToken(accessToken);
    return accessToken;
  };

  const findFolderId = async (folderName) => {
    const q = [
      `'${DRIVE_BASE_FOLDER_ID}' in parents`,
      "trashed = false",
      "mimeType = 'application/vnd.google-apps.folder'",
      `name = '${escapeQuery(folderName)}'`,
    ].join(" and ");
    const params = new URLSearchParams({
      q,
      fields: "files(id,name)",
      corpora: "allDrives",
      includeItemsFromAllDrives: "true",
      supportsAllDrives: "true",
    });

    const response = await fetchDrive(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`
    );
    if (!response.ok) {
      throw new Error("Falha ao localizar pasta no Drive.");
    }
    const data = await response.json();
    return data.files?.[0]?.id || null;
  };

  const ensureFolderId = async (folderName) => {
    const existingId = await findFolderId(folderName);
    if (existingId) return existingId;

    const response = await fetchDrive(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: folderName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [DRIVE_BASE_FOLDER_ID],
        }),
      }
    );

    if (!response.ok) {
      throw new Error("Falha ao criar pasta no Drive.");
    }

    const data = await response.json();
    return data.id;
  };

  const carregarImagens = async () => {
    const folderName = buildFolderName(normalizedSerial, normalizedEmail);
    if (!folderName) return;
    if (!USING_WEBAPP) {
      const token = driveToken || localStorage.getItem(DRIVE_TOKEN_KEY) || "";
      if (!token) {
        setImagens([]);
        setErro("Conecte sua conta Google para ver os anexos.");
        return;
      }
    }

    setCarregando(true);
    setErro(null);
    try {
      if (USING_WEBAPP) {
        const params = new URLSearchParams();
        params.set("serial", normalizedSerial);
        if (normalizedEmail) params.set("email", normalizedEmail);

        const response = await fetch(
          `${DRIVE_WEBAPP_PROXY_URL}?${params.toString()}`
        );
        if (!response.ok) {
          throw new Error("Falha ao carregar imagens do Drive.");
        }
        const data = await response.json();
        setImagens(Array.isArray(data.files) ? data.files : []);
        return;
      }

      const folderId = await findFolderId(folderName);
      if (!folderId) {
        setImagens([]);
        return;
      }

      const params = new URLSearchParams({
        q: [
          `'${folderId}' in parents`,
          "trashed = false",
          "mimeType contains 'image/'",
        ].join(" and "),
        fields: "files(id,name,webViewLink,thumbnailLink,createdTime)",
        corpora: "allDrives",
        includeItemsFromAllDrives: "true",
        supportsAllDrives: "true",
        orderBy: "createdTime desc",
      });

      const response = await fetchDrive(
        `https://www.googleapis.com/drive/v3/files?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error("Falha ao carregar imagens do Drive.");
      }
      const data = await response.json();
      setImagens(Array.isArray(data.files) ? data.files : []);
    } catch (error) {
      console.error("Erro ao carregar imagens:", error);
      setErro(error?.message || "Falha ao carregar imagens.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!normalizedSerial) return;
    if (USING_WEBAPP || driveToken) {
      carregarImagens();
    }
  }, [normalizedSerial, normalizedEmail, driveToken]);

  const handleConnectDrive = async () => {
    if (USING_WEBAPP) return;
    setConectando(true);
    setErro(null);
    try {
      await requestDriveAccess();
      await carregarImagens();
      showToast({
        type: "success",
        message: "Google Drive conectado.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Erro ao conectar Drive:", error);
      if (error?.code === "auth/popup-closed-by-user") {
        setErro("Conexão cancelada.");
        return;
      }
      setErro(error?.message || "Não foi possível conectar ao Drive.");
    } finally {
      setConectando(false);
    }
  };

  const handleUpload = async (e) => {
    const arquivos = e.target.files;
    if (!arquivos.length || !normalizedSerial) return;
    if (!USING_WEBAPP) {
      const token = driveToken || localStorage.getItem(DRIVE_TOKEN_KEY) || "";
      if (!token) {
        setErro("Conecte sua conta Google para enviar imagens.");
        return;
      }
    }

    setCarregando(true);
    setErro(null);
    try {
      if (USING_WEBAPP) {
        const filesPayload = await Promise.all(
          Array.from(arquivos).map(async (file) => ({
            name: file.name,
            mimeType: file.type || "application/octet-stream",
            data: await fileToBase64(file),
          }))
        );

        const response = await fetch(DRIVE_WEBAPP_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "upload",
            serial: normalizedSerial,
            email: normalizedEmail,
            files: filesPayload,
          }),
        });

        if (!response.ok) {
          throw new Error("Falha ao enviar imagem para o Drive.");
        }
      } else {
        const folderName = buildFolderName(normalizedSerial, normalizedEmail);
        const folderId = await ensureFolderId(folderName);

        await Promise.all(
          Array.from(arquivos).map((file) => {
            const boundary = `-------driveBoundary${Date.now()}${Math.random()
              .toString(16)
              .slice(2)}`;
            const safeName = String(file.name || "imagem").replace(/[\\/]/g, "-");
            const metadata = {
              name: `${Date.now()}_${safeName}`,
              parents: [folderId],
            };
            const body = createMultipartBody(metadata, file, boundary);

            return fetchDrive(
              "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true",
              {
                method: "POST",
                headers: {
                  "Content-Type": `multipart/related; boundary=${boundary}`,
                },
                body,
              }
            ).then((response) => {
              if (!response.ok) {
                throw new Error("Falha ao enviar imagem para o Drive.");
              }
              return response.json();
            });
          })
        );
      }

      await carregarImagens();
      onChanged?.();
      if (inputRef.current) inputRef.current.value = "";
      showToast({
        type: "success",
        message: "Imagem enviada para o Drive.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
      showToast({
        type: "error",
        message: "Erro ao enviar imagem.",
        description: error?.message || "Tente novamente.",
      });
      setErro(error?.message || "Falha ao enviar imagens.");
    } finally {
      setCarregando(false);
    }
  };

  const visualizarImagem = (file) => {
    const targetUrl = buildViewUrl(file);
    if (!targetUrl) return;
    window.open(targetUrl, "_blank");
  };

  const excluirImagem = async (file) => {
    if (!window.confirm("Deseja remover esta imagem?")) return;
    try {
      if (USING_WEBAPP) {
        const response = await fetch(DRIVE_WEBAPP_PROXY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", fileId: file?.id }),
        });
        if (!response.ok) {
          throw new Error("Falha ao remover imagem.");
        }
      } else {
        const response = await fetchDrive(
          `https://www.googleapis.com/drive/v3/files/${file?.id}?supportsAllDrives=true`,
          { method: "DELETE" }
        );
        if (!response.ok) {
          throw new Error("Falha ao remover imagem.");
        }
      }
      await carregarImagens();
      onChanged?.();
    } catch (error) {
      console.error("Erro ao excluir imagem:", error);
      showToast({
        type: "error",
        message: "Erro ao excluir imagem.",
        description: error?.message || "Tente novamente.",
      });
    }
  };

  const driveConectado = USING_WEBAPP
    ? true
    : Boolean(driveToken || localStorage.getItem(DRIVE_TOKEN_KEY));

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4">
      <div className="modal-card w-full max-w-2xl overflow-hidden">
        <div className="modal-head px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--text)] flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-[var(--accent)]" />
            Anexar
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg border border-transparent text-[var(--text-muted)]
                       hover:text-[var(--text)] hover:bg-white/5 hover:border-[var(--line)] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
        {!driveConectado && !USING_WEBAPP && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2">
            <p className="text-sm text-[var(--text-muted)]">
              Conecte sua conta Google para acessar o Drive compartilhado.
            </p>
            <button
              type="button"
              onClick={handleConnectDrive}
              disabled={conectando}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm
                         hover:brightness-110 transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {conectando ? (
                <>
                  <Spinner />
                  Conectando...
                </>
              ) : (
                "Conectar Google"
              )}
            </button>
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          multiple
          ref={inputRef}
          onChange={handleUpload}
          disabled={!driveConectado || carregando || conectando}
          className="w-full text-sm text-[var(--text)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border
                     file:border-[var(--line)] file:bg-[var(--bg-card)] file:text-[var(--text)]
                     file:hover:bg-white/5 file:cursor-pointer bg-[var(--bg-card)] border border-[var(--line)]
                     rounded-lg px-3 py-2 disabled:opacity-60 disabled:cursor-not-allowed"
        />

        {erro && <p className="text-sm text-rose-500">{erro}</p>}

        {carregando ? (
          <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Spinner />
            Carregando imagens...
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {imagens.map((file) => (
              <div key={file.id} className="relative group">
                <ImagePreview
                  file={file}
                  onOpen={() => visualizarImagem(file)}
                />
                <button
                  onClick={() => excluirImagem(file)}
                  className="absolute top-1 right-1 rounded-full bg-[var(--bg-card)]/90 border border-[var(--line)]
                             text-rose-400 text-xs px-1.5 hidden group-hover:block"
                  title="Excluir"
                >
                  ✕
                </button>
              </div>
            ))}
            {imagens.length === 0 && driveConectado && (
              <p className="text-sm text-[var(--text-muted)]">
                Nenhuma imagem anexada ainda.
              </p>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
