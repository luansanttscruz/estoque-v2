// server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { gerarXmlCotacao } = require("./api/cotacao-dhl/dhlProxy");

// Carregar variáveis do .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json()); // Agora aceita JSON direto!

// 📋 Rota de teste para confirmar que o servidor está funcionando
app.post("/api/teste", (req, res) => {
  res.json({ mensagem: "Teste funcionando!" });
});

// 📦 Cotação Rápida DHL
app.post("/api/cotacao-dhl", async (req, res) => {
  const { cidade, cep, valorDeclarado, peso } = req.body;

  if (!cidade || !cep || !valorDeclarado || !peso) {
    return res.status(400).json({ erro: "Dados obrigatórios ausentes." });
  }

  try {
    // Gerar XML para DHL
    const xmlCotacao = gerarXmlCotacao({ cidade, cep, valorDeclarado, peso });

    // Enviar para DHL
    const response = await fetch(process.env.DHL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xmlCotacao,
    });

    const respostaTexto = await response.text();
    console.log("Resposta da DHL:", respostaTexto);

    // Extrair preço e prazo da resposta
    const matchPreco = respostaTexto.match(
      /<ShippingCharge>(.*?)<\/ShippingCharge>/
    );
    const matchEntrega = respostaTexto.match(
      /<EstimatedDeliveryDate>(.*?)<\/EstimatedDeliveryDate>/
    );

    const preco = matchPreco ? matchPreco[1] : null;
    const entrega = matchEntrega ? matchEntrega[1] : null;

    if (!preco || !entrega) {
      return res
        .status(400)
        .json({ erro: "Não foi possível extrair preço ou prazo da DHL." });
    }

    res.status(200).json({ preco, entrega });
  } catch (error) {
    console.error("Erro na cotação DHL:", error);
    res.status(500).send("Erro interno ao cotar.");
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando em http://localhost:${PORT}`);
});
