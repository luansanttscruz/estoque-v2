// src/pages/OnboardingPage.jsx
import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import SidebarOnboarding from "../components/SidebarOnboarding";
import { Paperclip, CalendarClock, Users2 } from "lucide-react";
import { Link } from "react-router-dom";
import OnboardingDetailModal from "../components/OnboardingDetailModal";

export default function OnboardingPage() {
  const [estrutura, setEstrutura] = useState({});
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [todosOnboardings, setTodosOnboardings] = useState([]);
  const [busca, setBusca] = useState("");
  const [onboardingSelecionado, setOnboardingSelecionado] = useState(null);
  const [modalAberta, setModalAberta] = useState(false);
  const [criandoNovo, setCriandoNovo] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "onboardings"), (snapshot) => {
      const dados = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      setTodosOnboardings(dados);
  
      const novaEstrutura = {};
      dados.forEach((item) => {
        const dataRaw = item.data || "";
  
        if (!dataRaw.includes(".")) return; //formato esperado: "dia.mes.ano"
  
        const [dia, mes, ano] = dataRaw.split(".");
        const anoCompleto = ano.length === 2 ? "20" + ano : ano;
        const mesCompleto = mes.padStart(2, "0");
        const diaCompleto = dia.padStart(2, "0");
  
        
        const dataFormatada = `${anoCompleto}-${mesCompleto}-${diaCompleto}`;
        const dataObj = new Date(dataFormatada);
  
        if (isNaN(dataObj.getTime())) {
          console.error("Data inválida encontrada:", dataRaw);
          return;
        }
  
        const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(dataObj);

  
        if (!novaEstrutura[anoCompleto]) novaEstrutura[anoCompleto] = {};
        if (!novaEstrutura[anoCompleto][nomeMes]) novaEstrutura[anoCompleto][nomeMes] = [];
  
        if (!novaEstrutura[anoCompleto][nomeMes].includes(dataRaw)) {
          novaEstrutura[anoCompleto][nomeMes].push(dataRaw);
        }
      });
  
      setEstrutura(novaEstrutura);
    });
  
    return () => unsubscribe();
  }, []);
  
  

  const handleAtualizarOnboarding = (onboardingAtualizado) => {
    if (onboardingAtualizado.deletado) {
      setTodosOnboardings((prev) =>
        prev.filter((item) => item.id !== onboardingAtualizado.id)
      );
    } else {
      setTodosOnboardings((prev) =>
        prev.map((item) =>
          item.id === onboardingAtualizado.id ? onboardingAtualizado : item
        )
      );
    }
  };
  

  const handleSelectDia = (ano, mes, dia) => {
    setDiaSelecionado(dia);
    setBusca("");
  };

  const filtered = todosOnboardings.filter((o) => {
    const matchDia = diaSelecionado ? o.data === diaSelecionado : true;
    const matchBusca = busca
      ? o.nome?.toLowerCase().includes(busca.toLowerCase())
      : false;
    return matchDia && (!busca.trim() || matchBusca);
  });

  const hasContext = Boolean(diaSelecionado || busca.trim());

  const handleCreate = () => {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, "0");
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ano = String(hoje.getFullYear()).slice(-2);
    const dataAtual = `${dia}.${mes}.${ano}`;

    setOnboardingSelecionado({
      nome: "",
      cpf: "",
      cargo: "",
      gestor: "",
      email: "",
      telefone: "",
      endereco: "",
      equipamento: "",
      status: "",
      serial: "",
      data: diaSelecionado || dataAtual,
    });
    setModoEdicao(true);
    setCriandoNovo(true);
    setModalAberta(true);
  };

  return (
    <div className="mx-auto max-w-7xl p-6 flex flex-col md:flex-row gap-6">
      <aside className="md:w-64 flex-shrink-0 space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg">
          <div className="px-5 py-4 border-b border-[var(--line)] flex items-center gap-2 text-sm uppercase tracking-[0.18em] text-[var(--text-muted)]">
            <CalendarClock className="w-4 h-4 text-[var(--accent)]" />
            Agenda
          </div>
          <div className="px-4 py-3">
            <SidebarOnboarding
              estrutura={estrutura}
              onSelect={handleSelectDia}
              diaSelecionado={diaSelecionado}
            />
          </div>
        </div>

        <Link
          to="/importar-onboardings"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--accent)]/50 bg-[var(--accent)]/10
                     text-[var(--accent)] px-4 py-2 text-sm font-medium hover:bg-[var(--accent)]/20 transition"
        >
          <Paperclip className="w-4 h-4" />
          Importar planilha
        </Link>
      </aside>

      <section className="flex-1 space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg">
          <div className="px-6 py-5 border-b border-[var(--line)] flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-[var(--text)] flex items-center gap-2">
                <Users2 className="w-6 h-6 text-[var(--accent)]" />
                {diaSelecionado ? (
                  <span>
                    Onboardings de{" "}
                    <span className="text-[var(--accent)] font-bold">
                      {diaSelecionado}
                    </span>
                  </span>
                ) : busca.trim() ? (
                  <span>Resultados da busca</span>
                ) : (
                  <span>Selecione uma data</span>
                )}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Mantenha o acompanhamento dos novos colaboradores em tempo real.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="input-neon w-48"
              />
              <button
                onClick={handleCreate}
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--accent)]/60 px-3 py-2 text-sm font-medium
                           bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition"
              >
                + Criar
              </button>
            </div>
          </div>

        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--bg-card)] shadow-lg">
          {hasContext ? (
            filtered.length === 0 ? (
              <div className="px-6 py-10 text-center text-[var(--text-muted)]">
                Nenhum onboarding encontrado para o filtro aplicado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[var(--accent-weak)]/40 text-[var(--text)]">
                    <tr>
                      <th className="p-3 text-left">Nome</th>
                      <th className="p-3 text-left">Cargo</th>
                      <th className="p-3 text-left">Equipamento</th>
                      <th className="p-3 text-left">Endereço</th>
                      <th className="p-3 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((o) => (
                      <tr
                        key={o.id}
                        className="border-t border-[var(--line)] hover:bg-[var(--rowHover)] transition cursor-pointer"
                        onClick={() => {
                          setOnboardingSelecionado(o);
                          setCriandoNovo(false);
                          setModoEdicao(false);
                          setModalAberta(true);
                        }}
                      >
                        <td className="p-3 text-[var(--accent)] font-medium">
                          {o.nome || "—"}
                        </td>
                        <td className="p-3">{o.cargo || "—"}</td>
                        <td className="p-3">{o.equipamento || "—"}</td>
                        <td
                          className="p-3 max-w-[28ch] text-ellipsis whitespace-nowrap overflow-hidden"
                          title={[
                            o.rua ? o.rua : "",
                            o.numero ? `, ${o.numero}` : "",
                            o.bairro ? ` - ${o.bairro}` : "",
                            o.cidade ? ` - ${o.cidade}` : "",
                            o.estado ? ` - ${o.estado}` : "",
                            o.cep ? ` - CEP: ${o.cep}` : "",
                          ]
                            .filter(Boolean)
                            .join("")}
                        >
                          {[
                            o.rua ? o.rua : "",
                            o.numero ? `, ${o.numero}` : "",
                            o.bairro ? ` - ${o.bairro}` : "",
                            o.cidade ? ` - ${o.cidade}` : "",
                            o.estado ? ` - ${o.estado}` : "",
                            o.cep ? ` - CEP: ${o.cep}` : "",
                          ]
                            .filter(Boolean)
                            .join("") || "—"}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
                            {o.status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="px-6 py-10 text-center text-[var(--text-muted)]">
              Escolha uma data na agenda ou utilize a busca para visualizar os
              onboardings.
            </div>
          )}
        </div>
      </section>

      {modalAberta && (
        <OnboardingDetailModal
          onboarding={onboardingSelecionado}
          onClose={() => {
            setModalAberta(false);
            setCriandoNovo(false);
          }}
          onAtualizar={handleAtualizarOnboarding}
          criandoNovo={criandoNovo}
          modoEdicaoInicial={modoEdicao}
        />
      )}
    </div>
  );
}
