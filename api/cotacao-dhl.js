const {
  gerarXmlCotacao,
  normalizeCep,
  parseDhlQuoteResponse,
} = require("./cotacao-dhl/dhlProxy");

const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const DHL_UNAVAILABLE_MESSAGE =
  "Indisponível para essa região. Consulte através do site da DHL.";
const DHL_UNAVAILABLE_CEPS = new Set(
  (process.env.DHL_UNAVAILABLE_CEPS || "22451630")
    .split(",")
    .map(normalizeCep)
    .filter(Boolean)
);

const parseBody = (body) => {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido." });
  }

  const body = parseBody(req.body);
  const { origem, destino, valorDeclarado, peso } = body;
  const cidade = destino?.cidade || body.cidade;
  const cep = normalizeCep(destino?.cep || body.cep);
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
    return res.status(400).json({ erro: "CEP de origem inválido." });
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
    const xmlCotacao = gerarXmlCotacao({
      cidade,
      cep,
      valorDeclarado,
      peso,
      origem: origemNormalizada,
      dataEnvio: body.dataEnvio,
      altura: body.altura,
      largura: body.largura,
      comprimento: body.comprimento,
    });

    const response = await fetch(process.env.DHL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlCotacao,
    });

    const respostaTexto = await response.text();

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

    return res.status(200).json(parsedQuote);
  } catch (error) {
    console.error("Erro na cotação DHL:", error);
    return res.status(500).json({
      erro: "Erro interno ao cotar.",
      detalhe: error?.message,
    });
  }
};
