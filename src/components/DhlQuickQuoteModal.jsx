import { useEffect, useState } from "react";

const UF_TO_STATE = {
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  MG: "Minas Gerais",
  PA: "Pará",
  PB: "Paraíba",
  PR: "Paraná",
  PE: "Pernambuco",
  PI: "Piauí",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RO: "Rondônia",
  RR: "Roraima",
  SC: "Santa Catarina",
  SP: "São Paulo",
  SE: "Sergipe",
  TO: "Tocantins",
};

const ORIGIN_BY_OFFICE = {
  "Rio de Janeiro": {
    endereco: "Praia Botafogo",
    numero: "",
    endereco2: "",
    endereco3: "",
    cep: "22250-040",
    cidade: "Rio de Janeiro",
    estado: "Rio de Janeiro",
  },
  "São Paulo": {
    endereco: "Avenida Brigadeiro Faria Lima",
    numero: "4440",
    endereco2: "10 Andar - VTEX",
    endereco3: "",
    cep: "04538-132",
    cidade: "São Paulo",
    estado: "São Paulo",
  },
  "João Pessoa": {
    endereco: "Rua Antônio Rabelo Júnior",
    numero: "161",
    endereco2: "25° andar",
    endereco3: "Bairro Miramar",
    cep: "58032-090",
    cidade: "João Pessoa",
    estado: "Paraíba",
  },
};

const API_BASE =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? process.env.REACT_APP_API_BASE_URL || "http://localhost:3001"
    : "";

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

const formatCep = (value) => {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
};

const lookupCep = ({
  cep,
  setLoading,
  setError,
  onAddress,
  onCity,
  onState,
}) => {
  if (cep.length !== 8) {
    setError?.("");
    return undefined;
  }

  const controller = new AbortController();

  const run = async () => {
    setLoading?.(true);
    setError?.("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (data?.erro) {
        setError?.("CEP não encontrado.");
        return;
      }

      if (data?.localidade) onCity(data.localidade);
      if (data?.uf) onState(UF_TO_STATE[data.uf] || data.uf);
      if (data?.logradouro) onAddress(data.logradouro);
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Erro ao consultar CEP:", error);
        setError?.("Não foi possível consultar o CEP.");
      }
    } finally {
      setLoading?.(false);
    }
  };

  run();

  return () => controller.abort();
};

export default function DhlQuickQuoteModal({
  onboarding = {},
  onClose,
  embedded = false,
}) {
  const initialOffice = onboarding.origem || "Rio de Janeiro";
  const initialOrigin =
    ORIGIN_BY_OFFICE[initialOffice] || ORIGIN_BY_OFFICE["Rio de Janeiro"];
  const [valorDeclarado, setValorDeclarado] = useState("");
  const [dataEnvio, setDataEnvio] = useState("");
  const [origemEscritorio, setOrigemEscritorio] = useState(initialOffice);
  const [enderecoOrigem, setEnderecoOrigem] = useState(initialOrigin.endereco);
  const [numeroOrigem, setNumeroOrigem] = useState(initialOrigin.numero);
  const [endereco2Origem, setEndereco2Origem] = useState(
    initialOrigin.endereco2
  );
  const [endereco3Origem, setEndereco3Origem] = useState(
    initialOrigin.endereco3
  );
  const [cepOrigem, setCepOrigem] = useState(formatCep(initialOrigin.cep));
  const [cidadeOrigem, setCidadeOrigem] = useState(initialOrigin.cidade);
  const [estadoOrigem, setEstadoOrigem] = useState(initialOrigin.estado);
  const [cidadeDestino, setCidadeDestino] = useState(onboarding.cidade || "");
  const [estadoDestino, setEstadoDestino] = useState("");
  const [enderecoDestino, setEnderecoDestino] = useState("");
  const [residencial, setResidencial] = useState(false);
  const [cepDestino, setCepDestino] = useState(formatCep(onboarding.cep || ""));
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState("");
  const [peso] = useState(2);
  const [altura] = useState(10);
  const [largura] = useState(33);
  const [comprimento] = useState(34);
  const [valorFrete, setValorFrete] = useState(null);
  const [dataEntrega, setDataEntrega] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erroCotacao, setErroCotacao] = useState("");
  const [semOpcaoEnvio, setSemOpcaoEnvio] = useState("");

  const origemCepDigits = onlyDigits(cepOrigem);
  const cepDigits = onlyDigits(cepDestino);

  useEffect(() => {
    const officeOrigin = ORIGIN_BY_OFFICE[origemEscritorio];
    if (!officeOrigin) return;

    setEnderecoOrigem(officeOrigin.endereco);
    setNumeroOrigem(officeOrigin.numero);
    setEndereco2Origem(officeOrigin.endereco2);
    setEndereco3Origem(officeOrigin.endereco3);
    setCepOrigem(formatCep(officeOrigin.cep));
    setCidadeOrigem(officeOrigin.cidade);
    setEstadoOrigem(officeOrigin.estado);
  }, [origemEscritorio]);

  useEffect(() => {
    return lookupCep({
      cep: origemCepDigits,
      onAddress: setEnderecoOrigem,
      onCity: setCidadeOrigem,
      onState: setEstadoOrigem,
    });
  }, [origemCepDigits]);

  useEffect(() => {
    return lookupCep({
      cep: cepDigits,
      setLoading: setBuscandoCep,
      setError: setErroCep,
      onAddress: setEnderecoDestino,
      onCity: setCidadeDestino,
      onState: setEstadoDestino,
    });
  }, [cepDigits]);

  const handleOrigemCepChange = (event) => {
    setCepOrigem(formatCep(event.target.value));
  };

  const handleCepChange = (event) => {
    setCepDestino(formatCep(event.target.value));
  };

  const handleCotar = async () => {
    setErroCotacao("");
    setSemOpcaoEnvio("");
    setValorFrete(null);
    setDataEntrega(null);

    if (
      !valorDeclarado ||
      !dataEnvio ||
      !cidadeOrigem ||
      origemCepDigits.length !== 8 ||
      !cidadeDestino ||
      cepDigits.length !== 8
    ) {
      alert("Preencha todos os campos obrigatórios.");
      return;
    }

    setCarregando(true);
    try {
      const payload = {
        origem: {
          cidade: cidadeOrigem,
          cep: origemCepDigits,
          estado: estadoOrigem,
          endereco: enderecoOrigem,
          numero: numeroOrigem,
          endereco2: endereco2Origem,
          endereco3: endereco3Origem,
        },
        destino: {
          cidade: cidadeDestino,
          cep: cepDigits,
        },
        cidade: cidadeDestino,
        cep: cepDigits,
        peso,
        altura,
        largura,
        comprimento,
        valorDeclarado,
        dataEnvio,
      };

      const response = await fetch(`${API_BASE}/api/cotacao-dhl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();
      let data = {};
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = { erro: responseText };
      }

      if (response.ok && data.available === false) {
        setSemOpcaoEnvio(
          data.mensagem ||
            "Indisponível para essa região. Consulte através do site da DHL.",
        );
        return;
      }

      if (response.ok && data.preco && data.entrega) {
        setValorFrete(parseFloat(data.preco).toFixed(2));
        setDataEntrega(data.entrega);
      } else {
        throw new Error(
          data.erro || "Não foi possível extrair preço ou prazo da DHL.",
        );
      }
    } catch (error) {
      console.error("Erro ao cotar DHL:", error);
      const message =
        error?.message ||
        "Erro ao calcular cotação. Tente novamente mais tarde.";
      setErroCotacao(message);
      alert(message);
    } finally {
      setCarregando(false);
    }
  };

  const content = (
    <div
      className={[
        "bg-white rounded-xl shadow-2xl w-full max-w-5xl p-6",
        embedded ? "" : "max-h-[90vh] overflow-y-auto",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Cotação rápida</h2>
          <p className="mt-2 text-lg font-semibold text-gray-700">
            Visualizar as nossas opções de entrega e tarifas
          </p>
        </div>
        {!embedded && (
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-gray-700 text-white font-semibold hover:bg-gray-800"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="space-y-4 text-gray-700 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Valor declarado (BRL)">
            <input
              type="number"
              value={valorDeclarado}
              onChange={(e) => setValorDeclarado(e.target.value)}
              placeholder="Ex: 1500"
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </Field>

          <Field label="Data de envio">
            <input
              type="date"
              value={dataEnvio}
              onChange={(e) => setDataEnvio(e.target.value)}
              className="w-full border rounded px-3 py-2 mt-1"
            />
          </Field>
        </div>

        <div className="grid gap-6 border-t border-gray-300 pt-6 lg:grid-cols-2">
          <section className="space-y-4 lg:border-r lg:border-gray-300 lg:pr-6">
            <h3 className="text-2xl font-bold text-gray-800">De</h3>

            <Field label="País/Território">
              <input
                value="Brazil"
                readOnly
                className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
              />
            </Field>

            <Field label="Escritório de origem">
              <select
                value={origemEscritorio}
                onChange={(e) => setOrigemEscritorio(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              >
                <option value="Rio de Janeiro">Rio de Janeiro</option>
                <option value="São Paulo">São Paulo</option>
                <option value="João Pessoa">João Pessoa</option>
              </select>
            </Field>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
              <Field label="Código Postal">
                <input
                  value={cepOrigem}
                  onChange={handleOrigemCepChange}
                  maxLength={9}
                  placeholder="22250-040"
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
              <Field label="Cidade">
                <input
                  value={cidadeOrigem}
                  onChange={(e) => setCidadeOrigem(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
              <Field label="Estado">
                <input
                  value={estadoOrigem}
                  onChange={(e) => setEstadoOrigem(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <Field label="Endereço">
                <input
                  value={enderecoOrigem}
                  onChange={(e) => setEnderecoOrigem(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
              <Field label="Número">
                <input
                  value={numeroOrigem}
                  onChange={(e) => setNumeroOrigem(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
            </div>

            <Field label="Endereço 2">
              <input
                value={endereco2Origem}
                onChange={(e) => setEndereco2Origem(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </Field>

            <Field label="Endereço 3">
              <input
                value={endereco3Origem}
                onChange={(e) => setEndereco3Origem(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </Field>
          </section>

          <section className="space-y-4">
            <h3 className="text-2xl font-bold text-gray-800">Para</h3>

            <Field label="País/Território">
              <input
                value="Brazil"
                readOnly
                className="w-full border rounded px-3 py-2 mt-1 bg-gray-100"
              />
            </Field>

            <Field label="Endereço">
              <input
                value={enderecoDestino}
                onChange={(e) => setEnderecoDestino(e.target.value)}
                className="w-full border rounded px-3 py-2 mt-1"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-[150px_1fr_1fr]">
              <Field label="Código Postal">
                <input
                  type="text"
                  value={cepDestino}
                  onChange={handleCepChange}
                  maxLength={9}
                  placeholder="00000-000"
                  className="w-full border rounded px-3 py-2 mt-1"
                />
                {buscandoCep && (
                  <p className="text-xs text-gray-500 mt-1">
                    Consultando CEP...
                  </p>
                )}
                {erroCep && (
                  <p className="text-xs text-red-600 mt-1">{erroCep}</p>
                )}
              </Field>

              <Field label="Cidade">
                <input
                  type="text"
                  value={cidadeDestino}
                  onChange={(e) => setCidadeDestino(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>

              <Field label="Estado">
                <input
                  type="text"
                  value={estadoDestino}
                  onChange={(e) => setEstadoDestino(e.target.value)}
                  className="w-full border rounded px-3 py-2 mt-1"
                />
              </Field>
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={residencial}
                onChange={(e) => setResidencial(e.target.checked)}
                className="h-4 w-4"
              />
              Endereço residencial
            </label>
          </section>
        </div>

        <div className="text-xs text-gray-500 mt-4">
          Peso: {peso} kg | Altura: {altura} cm | Largura: {largura} cm |
          Comprimento: {comprimento} cm
        </div>

        {erroCotacao && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erroCotacao}
          </div>
        )}

        {semOpcaoEnvio && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <h3 className="font-semibold">Nenhuma opção de envio disponível</h3>
            <p className="mt-1">{semOpcaoEnvio}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        {!embedded && (
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded hover:bg-gray-100"
          >
            Cancelar
          </button>
        )}
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

      {dataEntrega && (
        <div className="mt-6 p-4 border rounded-lg bg-gray-50 text-sm text-center">
          <h3 className="text-xl font-semibold text-pink-700 mb-2">
            Entrega Estimada
          </h3>
          <p className="text-lg font-bold">
            {new Date(dataEntrega).toLocaleDateString()}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            O prazo pode sofrer alterações.
          </p>
        </div>
      )}
    </div>
  );

  if (embedded) {
    return (
      <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-5 sm:p-6">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      {content}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block font-semibold text-gray-700">
      {label}
      {children}
    </label>
  );
}
