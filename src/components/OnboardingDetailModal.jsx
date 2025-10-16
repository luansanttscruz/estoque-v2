import { useState, useEffect } from "react";
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Trash2, Pencil, Send } from "lucide-react";
import DhlQuickQuoteModal from "./DhlQuickQuoteModal";

export default function OnboardingDetailModal({
  onboarding,
  onClose,
  onAtualizar,
  modoEdicaoInicial = false,
}) {
  const [editando, setEditando] = useState(modoEdicaoInicial);
  const [form, setForm] = useState({ ...onboarding });
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [mostrarCotacaoDHL, setMostrarCotacaoDHL] = useState(false);
  const [xmlDHL, setXmlDHL] = useState("");
  const [mostrarModalDHL, setMostrarModalDHL] = useState(false);

  const criandoNovo = !form.id;

  useEffect(() => {
    setForm({ ...onboarding });
    setEditando(modoEdicaoInicial);
  }, [onboarding, modoEdicaoInicial]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const salvar = async () => {
    if (!form.nome?.trim() || !form.data?.trim()) {
      alert("Os campos 'Nome' e 'Data' são obrigatórios.");
      return;
    }
    try {
      if (criandoNovo) {
        const docRef = await addDoc(collection(db, "onboardings"), {
          ...form,
          createdAt: new Date(),
        });
        onAtualizar({ ...form, id: docRef.id });
      } else {
        const ref = doc(db, "onboardings", form.id);
        await updateDoc(ref, form);
        onAtualizar(form);
      }
      setEditando(false);
      onClose();
    } catch (error) {
      console.error("Erro ao salvar onboarding:", error);
    }
  };

  const excluir = async () => {
    const confirm = window.confirm(
      "Tem certeza que deseja excluir este onboarding?"
    );
    if (!confirm) return;

    try {
      const ref = doc(db, "onboardings", form.id);
      await deleteDoc(ref);
      onAtualizar({ id: form.id, deletado: true });
      onClose();
    } catch (error) {
      console.error("Erro ao excluir onboarding:", error);
      alert("Erro ao excluir o onboarding.");
    }
  };

  function gerarXMLParaDHL(dados) {
    const hoje = new Date().toISOString().split("T")[0];

    return `
    <req:ShipmentRequest xmlns:req="http://www.dhl.com">
      <Request>
        <ServiceHeader>
          <SiteID>vtexBR</SiteID>
          <Password>A@6vN#6yE#9tX^0p</Password>
        </ServiceHeader>
      </Request>
      <ShipmentDetails>
        <AccountNumber>654343674</AccountNumber>
        <ShipDate>${hoje}</ShipDate>
        <CurrencyCode>BRL</CurrencyCode>
        <Weight>2.0</Weight>
        <ProductCode>P</ProductCode>
        <PackagesCount>1</PackagesCount>
      </ShipmentDetails>
      <Shipper>
        <CompanyName>Silimed LTDA</CompanyName>
        <AddressLine>${dados.rua}, ${dados.numero}${
      dados.complemento ? ` - ${dados.complemento}` : ""
    }</AddressLine>
        <City>${dados.cidade}</City>
        <PostalCode>${dados.cep.replace("-", "")}</PostalCode>
        <StateProvinceCode>${dados.estado}</StateProvinceCode>
        <CountryCode>BR</CountryCode>
        <PhoneNumber>21999999999</PhoneNumber>
      </Shipper>
      <Recipient>
        <CompanyName>${dados.nome}</CompanyName>
        <AddressLine>${dados.rua}, ${dados.numero}${
      dados.complemento ? ` - ${dados.complemento}` : ""
    }</AddressLine>
        <City>${dados.cidade}</City>
        <PostalCode>${dados.cep.replace("-", "")}</PostalCode>
        <StateProvinceCode>${dados.estado}</StateProvinceCode>
        <CountryCode>BR</CountryCode>
        <PhoneNumber>${dados.telefone}</PhoneNumber>
      </Recipient>
    </req:ShipmentRequest>
    `.trim();
  }

  const campos = [
    ["Nome", "nome"],
    ["CPF", "cpf"],
    ["CNPJ", "cnpj"],
    ["Cargo", "cargo"],
    ["Gestor", "gestor"],
    ["Email", "email"],
    ["Telefone", "telefone"],
    ["Rua", "rua"],
    ["Número", "numero"],
    ["Complemento", "complemento"],
    ["Bairro", "bairro"],
    ["Cidade", "cidade"],
    ["Estado", "estado"],
    ["CEP", "cep"],
    ["Equipamento", "equipamento"],
    ["Status", "status"],
    ["Serial", "serial"],
    ["Data", "data"],
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        <h3 className="text-2xl font-bold text-pink-700 mb-6">
          {form.nome || "Detalhes do Onboarding"}
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
          {campos.map(([label, field]) => (
            <div key={field}>
              <p className="text-xs text-gray-500">{label}</p>
              {editando ? (
                <input
                  name={field}
                  value={form[field] || ""}
                  onChange={handleChange}
                  className="w-full p-1 border rounded text-sm"
                />
              ) : (
                <p className="font-medium break-words whitespace-pre-wrap">
                  {form[field] || "—"}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center border-t pt-6 mt-6">
          <div className="flex gap-3">
            {!editando ? (
              <button
                onClick={() => setEditando(true)}
                title="Editar"
                className="text-gray-500 hover:text-pink-600"
              >
                <Pencil className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={salvar}
                title="Salvar alterações"
                className="px-4 py-2 text-sm text-pink-600 border border-pink-600 rounded-lg hover:text-pink-700 hover:border-pink-700 transition"
              >
                Salvar
              </button>
            )}

            <button
              onClick={() => setMostrarCotacaoDHL(true)}
              title="Cotação Rápida DHL"
              className="px-4 py-2 text-sm text-pink-600 border border-pink-600 rounded-lg hover:text-pink-700 hover:border-pink-700 transition"
            >
              Cotação Rápida
            </button>

            <button
              onClick={excluir}
              title="Excluir"
              className="px-4 py-2 text-sm text-pink-600 border border-pink-600 rounded-lg hover:text-pink-700 hover:border-pink-700 transition"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-pink-600 border border-pink-600 rounded-lg hover:text-pink-700 hover:border-pink-700 transition"
          >
            Fechar
          </button>
        </div>

        {mostrarCotacaoDHL && (
          <DhlQuickQuoteModal
            onboarding={form}
            onClose={() => setMostrarCotacaoDHL(false)}
          />
        )}
      </div>
    </div>
  );
}
