// src/components/SidebarOnboarding.jsx
import { useState } from "react";
import { ChevronDown, ChevronRight, Calendar } from "lucide-react";

export default function SidebarOnboarding({
  estrutura = {},
  onSelect,
  diaSelecionado,
}) {
  const [anosAbertos, setAnosAbertos] = useState({});
  const [mesesAbertos, setMesesAbertos] = useState({});

  const toggleAno = (ano) => {
    setAnosAbertos((prev) => ({ ...prev, [ano]: !prev[ano] }));
  };

  const toggleMes = (ano, mes) => {
    const chave = `${ano}-${mes}`;
    setMesesAbertos((prev) => ({ ...prev, [chave]: !prev[chave] }));
  };

  // Mapeamento dos meses (sem acentos)
  const mesParaNumero = {
    janeiro: 1,
    fevereiro: 2,
    marco: 3,
    abril: 4,
    maio: 5,
    junho: 6,
    julho: 7,
    agosto: 8,
    setembro: 9,
    outubro: 10,
    novembro: 11,
    dezembro: 12,
  };

  const normalizar = (str) =>
    str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  return (
    <aside className="w-48 sm:w-56 border-r border-gray-200 p-3 bg-white shadow rounded-lg text-sm">
      <h3 className="text-base font-semibold text-pink-700 mb-4 flex items-center gap-2">
        <Calendar className="w-5 h-5" /> Onboardings
      </h3>

      <div className="space-y-2">
        {Object.entries(estrutura)
          .sort((a, b) => b[0] - a[0]) // anos em ordem decrescente
          .map(([ano, meses]) => (
            <div key={ano}>
              <button
                onClick={() => toggleAno(ano)}
                className="flex items-center w-full text-left font-medium text-gray-700 hover:text-pink-700"
              >
                {anosAbertos[ano] ? (
                  <ChevronDown className="w-4 h-4 mr-2" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-2" />
                )}
                {ano}
              </button>

              {anosAbertos[ano] && (
                <div className="ml-4 mt-1 space-y-1">
                  {Object.entries(meses)
                    .sort((a, b) => {
                      const m1 = mesParaNumero[normalizar(a[0])] || 0;
                      const m2 = mesParaNumero[normalizar(b[0])] || 0;
                      return m1 - m2; // ordem crescente
                    })
                    .map(([mes, dias]) => (
                      <div key={mes}>
                        <button
                          onClick={() => toggleMes(ano, mes)}
                          className="flex items-center text-left w-full text-gray-600 hover:text-pink-600"
                        >
                          {mesesAbertos[`${ano}-${mes}`] ? (
                            <ChevronDown className="w-4 h-4 mr-1" />
                          ) : (
                            <ChevronRight className="w-4 h-4 mr-1" />
                          )}
                          {mes}
                        </button>

                        {mesesAbertos[`${ano}-${mes}`] && (
                          <ul className="ml-4 mt-1 space-y-1">
                            {[...dias]
                              .sort((a, b) => {
                                const [da, ma, aa] = a.split(".");
                                const [db, mb, ab] = b.split(".");
                                return (
                                  new Date(`${aa}-${ma}-${da}`) -
                                  new Date(`${ab}-${mb}-${db}`)
                                );
                              })
                              .map((dia) => {
                                const [d, m, a] = dia.split(".");
                                const anoCompleto =
                                  a.length === 2 ? "20" + a : a;
                                const diaFormatado = `${d}/${m}/${anoCompleto}`;
                                return (
                                  <li key={dia}>
                                    <button
                                      onClick={() => onSelect(ano, mes, dia)}
                                      className={`text-xs ${
                                        diaSelecionado === dia
                                          ? "text-pink-600 font-semibold"
                                          : "text-gray-500"
                                      } hover:text-pink-500`}
                                    >
                                      {diaFormatado}
                                    </button>
                                  </li>
                                );
                              })}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>
          ))}
      </div>
    </aside>
  );
}
