// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require("multer");
const { google } = require("googleapis");
const { Readable } = require("stream");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const {
  gerarXmlCotacao,
  normalizeDhlEndpoint,
  normalizeCep,
  parseDhlQuoteResponse,
} = require("../api/cotacao-dhl/dhlProxy");

// Carregar variáveis do .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive"];
const DRIVE_BASE_FOLDER_ID =
  process.env.GOOGLE_DRIVE_BASE_FOLDER_ID ||
  "1cTYLAyW4_MElse2WCJuesP1UWE3OhPrY";
const DRIVE_WEBAPP_API_KEY = process.env.DRIVE_WEBAPP_API_KEY || "";
const DHL_UNAVAILABLE_MESSAGE =
  "Indisponível para essa região. Consulte através do site da DHL.";
const DHL_UNAVAILABLE_CEPS = new Set(
  (process.env.DHL_UNAVAILABLE_CEPS || "22451630")
    .split(",")
    .map(normalizeCep)
    .filter(Boolean)
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

let driveClient;

const getServiceAccount = () => {
  if (process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON inválido.");
    }
  }

  if (!process.env.GOOGLE_DRIVE_CLIENT_EMAIL) return null;

  return {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY,
  };
};

const getDriveClient = () => {
  if (driveClient) return driveClient;

  const serviceAccount = getServiceAccount();
  if (!serviceAccount?.client_email || !serviceAccount?.private_key) {
    throw new Error(
      "Credenciais do Drive ausentes. Configure GOOGLE_DRIVE_CLIENT_EMAIL e GOOGLE_DRIVE_PRIVATE_KEY."
    );
  }

  const privateKey = serviceAccount.private_key.includes("\\n")
    ? serviceAccount.private_key.replace(/\\n/g, "\n")
    : serviceAccount.private_key;

  const auth = new google.auth.JWT({
    email: serviceAccount.client_email,
    key: privateKey,
    scopes: DRIVE_SCOPES,
  });

  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
};

const escapeQuery = (value) => String(value || "").replace(/'/g, "\\'");

const buildFolderName = (serial, email) => {
  const baseSerial = String(serial || "").trim();
  if (!baseSerial) return "";
  const baseEmail = String(email || "").trim();
  const rawName = baseEmail ? `${baseSerial} - ${baseEmail}` : baseSerial;
  return rawName.replace(/[\\/]/g, "-").replace(/\s+/g, " ").trim();
};

const findFolderId = async (drive, folderName) => {
  const safeName = escapeQuery(folderName);
  const q = [
    `'${DRIVE_BASE_FOLDER_ID}' in parents`,
    "trashed = false",
    "mimeType = 'application/vnd.google-apps.folder'",
    `name = '${safeName}'`,
  ].join(" and ");

  const response = await drive.files.list({
    q,
    fields: "files(id,name)",
    corpora: "allDrives",
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
  });

  return response.data.files?.[0]?.id || null;
};

const ensureFolderId = async (drive, folderName) => {
  const existing = await findFolderId(drive, folderName);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [DRIVE_BASE_FOLDER_ID],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  return created.data.id;
};

// Middlewares
app.use(cors());
app.use(express.json({ limit: "20mb" })); // Agora aceita JSON direto!

// 📋 Rota de teste para confirmar que o servidor está funcionando
app.post("/api/teste", (req, res) => {
  res.json({ mensagem: "Teste funcionando!" });
});

// 📦 Cotação Rápida DHL
app.post("/api/cotacao-dhl", async (req, res) => {
  const { origem, destino, valorDeclarado, peso } = req.body;
  const cidade = destino?.cidade || req.body.cidade;
  const cep = normalizeCep(destino?.cep || req.body.cep);
  const origemNormalizada = origem
    ? { ...origem, cep: normalizeCep(origem.cep) }
    : null;

  if (!cidade || cep.length !== 8 || !valorDeclarado || !peso) {
    return res.status(400).json({
      erro:
        "Dados obrigatórios ausentes ou inválidos. Informe cidade, CEP, valor declarado e peso.",
    });
  }
  if (origemNormalizada?.cep && origemNormalizada.cep.length !== 8) {
    return res.status(400).json({
      erro: "CEP de origem inválido.",
    });
  }
  if (DHL_UNAVAILABLE_CEPS.has(cep)) {
    return res.status(200).json({
      available: false,
      mensagem: DHL_UNAVAILABLE_MESSAGE,
    });
  }
  if (
    !process.env.DHL_ENDPOINT ||
    !process.env.DHL_SITE_ID ||
    !process.env.DHL_PASSWORD
  ) {
    return res.status(500).json({
      erro:
        "Credenciais DHL ausentes. Configure DHL_ENDPOINT, DHL_SITE_ID e DHL_PASSWORD no backend.",
    });
  }

  try {
    // Gerar XML para DHL
    const xmlCotacao = gerarXmlCotacao({
      cidade,
      cep,
      valorDeclarado,
      peso,
      origem: origemNormalizada,
      dataEnvio: req.body.dataEnvio,
      altura: req.body.altura,
      largura: req.body.largura,
      comprimento: req.body.comprimento,
    });

    // Enviar para DHL
    const response = await fetch(normalizeDhlEndpoint(process.env.DHL_ENDPOINT), {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlCotacao,
    });

    const respostaTexto = await response.text();
    console.log("Resposta da DHL:", respostaTexto);

    if (!response.ok) {
      return res.status(response.status).json({
        erro: "A DHL recusou a cotação.",
        detalhe: respostaTexto.slice(0, 500),
      });
    }

    const parsedQuote = parseDhlQuoteResponse(respostaTexto);
    if (!parsedQuote.available) {
      return res.status(200).json({
        available: false,
        mensagem: parsedQuote.mensagem,
        detalhe: respostaTexto.slice(0, 500),
      });
    }

    res.status(200).json(parsedQuote);
  } catch (error) {
    console.error("Erro na cotação DHL:", error);
    res.status(500).json({
      erro: "Erro interno ao cotar.",
      detalhe: error?.message,
    });
  }
});

// 📎 Proxy para Apps Script (Drive Web App)
app.all("/api/drive-webapp", async (req, res) => {
  const webAppUrl =
    process.env.DRIVE_WEBAPP_URL || process.env.REACT_APP_DRIVE_WEBAPP_URL;
  if (!webAppUrl) {
    return res.status(500).json({ erro: "DRIVE_WEBAPP_URL não configurada." });
  }
  if (!DRIVE_WEBAPP_API_KEY) {
    return res
      .status(500)
      .json({ erro: "DRIVE_WEBAPP_API_KEY não configurada." });
  }

  try {
    const forward = async (url, options = {}) => {
      const response = await fetch(url, {
        ...options,
        headers: {
          Accept: "application/json",
          ...(options.headers || {}),
        },
      });
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      return { response, contentType, text };
    };

    if (req.method === "GET") {
      const paramsObj = new URLSearchParams(req.query);
      paramsObj.set("apiKey", DRIVE_WEBAPP_API_KEY);
      const params = paramsObj.toString();
      const { response, contentType, text } = await forward(
        params ? `${webAppUrl}?${params}` : webAppUrl
      );

      if (!contentType.includes("application/json")) {
        return res.status(502).json({
          erro: "Apps Script não retornou JSON.",
          detalhe:
            "Verifique se o Web App está publicado com acesso público (Anyone).",
        });
      }

      return res.status(response.status).type("application/json").send(text);
    }

    if (req.method === "POST") {
      const bodyPayload = {
        ...(req.body || {}),
        apiKey: DRIVE_WEBAPP_API_KEY,
      };
      const { response, contentType, text } = await forward(webAppUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!contentType.includes("application/json")) {
        return res.status(502).json({
          erro: "Apps Script não retornou JSON.",
          detalhe:
            "Verifique se o Web App está publicado com acesso público (Anyone).",
        });
      }

      return res.status(response.status).type("application/json").send(text);
    }

    return res.status(405).json({ erro: "Método não suportado." });
  } catch (error) {
    console.error("Erro ao chamar Apps Script:", error);
    return res.status(500).json({
      erro: "Falha ao acessar Apps Script.",
      detalhe: error.message,
    });
  }
});

// 📎 Upload de imagens para Drive (equipamentos)
app.get("/api/drive-equipamentos", async (req, res) => {
  const { serial, email } = req.query;
  const folderName = buildFolderName(serial, email);

  if (!folderName) {
    return res.status(400).json({ erro: "Serial é obrigatório." });
  }

  try {
    const drive = getDriveClient();
    const folderId = await findFolderId(drive, folderName);

    if (!folderId) {
      return res.json({ files: [] });
    }

    const response = await drive.files.list({
      q: [
        `'${folderId}' in parents`,
        "trashed = false",
        "mimeType contains 'image/'",
      ].join(" and "),
      fields: "files(id,name,webViewLink,mimeType,createdTime)",
      corpora: "allDrives",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      orderBy: "createdTime desc",
    });

    return res.json({ files: response.data.files || [] });
  } catch (error) {
    console.error("Erro ao listar imagens no Drive:", error);
    return res.status(500).json({
      erro: "Falha ao listar imagens no Drive.",
      detalhe: error.message,
    });
  }
});

app.post(
  "/api/drive-equipamentos",
  upload.array("files", 10),
  async (req, res) => {
    const { serial, email } = req.body;
    const folderName = buildFolderName(serial, email);

    if (!folderName) {
      return res.status(400).json({ erro: "Serial é obrigatório." });
    }

    const files = Array.isArray(req.files) ? req.files : [];
    const imageFiles = files.filter((file) =>
      String(file?.mimetype || "").startsWith("image/")
    );

    if (imageFiles.length === 0) {
      return res.status(400).json({ erro: "Nenhuma imagem válida enviada." });
    }

    try {
      const drive = getDriveClient();
      const folderId = await ensureFolderId(drive, folderName);

      const uploaded = await Promise.all(
        imageFiles.map((file) => {
          const safeName = String(file.originalname || "imagem").replace(
            /[\\/]/g,
            "-"
          );
          const fileName = `${Date.now()}_${safeName}`;

          return drive.files.create({
            requestBody: {
              name: fileName,
              parents: [folderId],
            },
            media: {
              mimeType: file.mimetype || "application/octet-stream",
              body: Readable.from(file.buffer),
            },
            fields: "id,name,webViewLink",
            supportsAllDrives: true,
          });
        })
      );

      return res.json({
        files: uploaded.map((entry) => entry.data),
        folderName,
      });
    } catch (error) {
      console.error("Erro ao enviar imagem para o Drive:", error);
      return res.status(500).json({
        erro: "Falha ao enviar imagens para o Drive.",
        detalhe: error.message,
      });
    }
  }
);

app.delete("/api/drive-equipamentos", async (req, res) => {
  const fileId = req.body?.fileId || req.query?.fileId;

  if (!fileId) {
    return res.status(400).json({ erro: "fileId é obrigatório." });
  }

  try {
    const drive = getDriveClient();
    await drive.files.delete({
      fileId,
      supportsAllDrives: true,
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao excluir imagem no Drive:", error);
    return res.status(500).json({
      erro: "Falha ao excluir imagem.",
      detalhe: error.message,
    });
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
