import { useState } from "react";

export default function DhlQuickQuoteModal({ onboarding, onClose }) {
  const [valorDeclarado, setValorDeclarado] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [cidadeDestino, setCidadeDestino] = useState(onboarding.cidade || "");
  const [cepDestino, setCepDestino] = useState(onboarding.cep?.replace("-", "") || "");
  const [peso] = useState(2);
  const [altura] = useState(10);
  const [largura] = useState(33);
  const [comprimento] = useState(34);
  const [valorFrete, setValorFrete] = useState(null);
  const [dataEntrega, setDataEntrega] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const handleCotar = async () => {
    if (!valorDeclarado || !dataEnvio || !cidadeDestino || !cepDestino) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setCarregando(true);
    try {
      const payload = {
        origem: {
          cidade: "Rio de Janeiro",
          cep: "22251040"
        },
        destino: {
          cidade: cidadeDestino,
          cep: cepDestino
        },
        peso,
        altura,
        largura,
        comprimento,
        valorDeclarado,
        dataEnvio
      };

      const response = await fetch("http://localhost:3001/api/cotacao-dhl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.preco && data.entrega) {
        setValorFrete(parseFloat(data.preco).toFixed(2));
        setDataEntrega(data.entrega);
      } else {
        throw new Error(data.erro || "Não foi possível extrair preço ou prazo da DHL.");
      }
    } catch (error) {
      console.error("Erro ao cotar DHL:", error);
      alert("Erro ao calcular cotação. Tente novamente mais tarde.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-2xl font-bold text-pink-700 mb-6">Cotação Rápida DHL</h2>

        <div className="space-y-4 text-gray-700 text-sm">
          <div>
            <label>Destinatário:</label>
            <p className="font-medium">{onboarding.nome || "—"}</p>
          </div>

          <div>
            <label>Valor declarado (BRL):</label>
            <input
              type="number"
              value={valorDeclarado}
              onChange={(e) => setValorDeclarado(e.target.value)}
              placeholder="Ex: 1500"
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>

          <div>
            <label>Data de envio:</label>
            <input
              type="date"
              value={dataEnvio}
              onChange={(e) => setDataEnvio(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>

          <div>
            <label>Cidade destino:</label>
            <input
              type="text"
              value={cidadeDestino}
              onChange={(e) => setCidadeDestino(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>

          <div>
            <label>CEP destino:</label>
            <input
              type="text"
              value={cepDestino}
              onChange={(e) => setCepDestino(e.target.value.replace("-", ""))}
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </div>

          <div className="text-xs text-gray-500 mt-4">
            Peso: {peso} kg | Altura: {altura} cm | Largura: {largura} cm | Comprimento: {comprimento} cm
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleCotar}
            disabled={carregando}
            className={`px-4 py-2 rounded-lg text-white flex items-center justify-center gap-2 transition ${carregando ? "bg-gray-400 cursor-not-allowed" : "bg-pink-600 hover:bg-pink-700"}`}
          >
            {carregando ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Calculando...</span>
              </>
            ) : (
              "Cotar Envio"
            )}
          </button>
        </div>

        {valorFrete && dataEntrega && (
          <div className="mt-6 p-4 border rounded-lg bg-gray-50 text-sm text-center">
            <h3 className="text-xl font-semibold text-pink-700 mb-2">Entrega Estimada</h3>
            <p className="text-lg font-bold">{new Date(dataEntrega).toLocaleDateString()}</p>
            <p className="text-sm text-gray-700 mt-2">Valor do Frete: R$ {valorFrete}</p>
            <p className="text-xs text-gray-500 mt-2">Os valores podem sofrer alterações.</p>
          </div>
        )}
      </div>
    </div>
  );
}
