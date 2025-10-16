// src/pages/ImportarOnboardings.jsx atualizado com ViaCEP
import { useState } from "react";
import * as XLSX from "xlsx";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function ImportarOnboardings() {
  const [fileName, setFileName] = useState("");
  const [mensagem, setMensagem] = useState(null);

  const buscarDadosViaCep = async (cep) => {
    try {
      const cepLimpo = cep.replace(/[^0-9]/g, "");
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      if (!response.ok) throw new Error("Erro ao consultar ViaCEP");
      const data = await response.json();
      if (data.erro) throw new Error("CEP não encontrado");
      return data;
    } catch (error) {
      console.error("Erro ViaCEP:", error);
      return null;
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);

    for (const sheetName of workbook.SheetNames) {
      const q = query(collection(db, "onboardings"), where("data", "==", sheetName));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        setMensagem({ tipo: "erro", texto: `Já existem dados para a data ${sheetName}` });
        return;
      }

      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      for (const row of jsonData) {
        const enderecoCompleto = row["ENDEREÇO"] || "";

        // Extrair CEP do texto
        const cepMatch = enderecoCompleto.match(/CEP[:\s-]*(\d{5}-?\d{3})/i);
        const cepExtraido = cepMatch ? cepMatch[1].replace(/[^0-9]/g, "") : "";

        let viaCepData = null;
        if (cepExtraido.length === 8) {
          viaCepData = await buscarDadosViaCep(cepExtraido);
        }

        // Separar rua e número manualmente
        const [parteRuaNumero] = enderecoCompleto.split("- CEP");
        const ruaNumeroSeparado = parteRuaNumero.split(/,\s*(.+)/);
        const rua = ruaNumeroSeparado[0] || "";
        const numero = ruaNumeroSeparado[1] || "";

        await addDoc(collection(db, "onboardings"), {
          data: sheetName,
          nome: row["NOME"] || "",
          cpf: row["CPF"] || "",
          cargo: row["CARGO"] || "",
          gestor: row["GESTOR"] || "",
          email: row["EMAIL"] || "",
          telefone: row["TELEFONE"] || "",
          rua: rua.trim(),
          numero: numero.trim(),
          complemento: "",
          bairro: viaCepData?.bairro || "",
          cidade: viaCepData?.localidade || "",
          estado: viaCepData?.uf || "",
          cep: viaCepData?.cep || cepExtraido,
          equipamento: row["EQUIPAMENTO"] || "",
          status: row["ENTREGA"] || "",
          serial: row["Serial "] || "",
          createdAt: new Date(),
        });
      }

      setMensagem({ tipo: "sucesso", texto: "✅ Dados importados com sucesso!" });
    }
  };

  return (
    <div className="bg-white rounded-xl shadow p-6 max-w-xl mx-auto mt-10">
      <h2 className="text-2xl font-bold text-pink-700 mb-4">📥 Importar Onboardings</h2>
      <input type="file" accept=".xlsx" onChange={handleFile} />
      {fileName && <p className="mt-2">{fileName}</p>}
      {mensagem && (
        <p
          className={`mt-4 font-semibold ${
            mensagem.tipo === "sucesso" ? "text-green-600" : "text-red-600"
          }`}
        >
          {mensagem.texto}
        </p>
      )}
    </div>
  );
}
