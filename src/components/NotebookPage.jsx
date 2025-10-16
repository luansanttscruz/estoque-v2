import { useState, useEffect } from "react";
import { collection, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { db, auth } from "../firebase";
import NotebookDetailModal from "../components/NotebookDetailModal";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";

export default function NotebookPage({
  title = "Rio de Janeiro",
  collectionName = "notebooks",
}) {
  const [notebooks, setNotebooks] = useState([]);
  const [selectedNotebook, setSelectedNotebook] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busca, setBusca] = useState("");
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [mostrarMenuStatus, setMostrarMenuStatus] = useState(false);
  const notebooksFiltrados = notebooks.filter((n) => {
    const buscaMatch =
      n.serial.toLowerCase().includes(busca.toLowerCase()) ||
      n.modelo.toLowerCase().includes(busca.toLowerCase()) ||
      n.email.toLowerCase().includes(busca.toLowerCase());

    const statusMatch = filtroStatus === "todos" || n.status === filtroStatus;

    return buscaMatch && statusMatch;
  });

  // Escuta em tempo real com onSnapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, collectionName),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setNotebooks(data);
      }
    );

    return () => unsubscribe(); // Limpa o listener ao sair da página
  }, [collectionName]);

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, collectionName, id));
    setModalOpen(false);
    // Com onSnapshot, a lista será atualizada automaticamente
  };

  const handleExport = () => {
    const csvContent = [
      // Cabeçalho
      ["Serial", "Modelo", "Status", "E-mail", "Observação", "Criado em"].join(
        ","
      ),
      // Dados filtrados
      ...notebooksFiltrados.map((notebook) =>
        [
          notebook.serial,
          notebook.modelo,
          notebook.status,
          notebook.email,
          notebook.observacao || "",
          notebook.createdAt
            ? new Date(notebook.createdAt.seconds * 1000).toLocaleDateString(
                "pt-BR"
              )
            : "—",
        ]
          .map((field) => `"${field}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `notebooks_${title}_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-full mx-auto px-4 lg:px-20 xl:px-32">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <h2
          onClick={() => navigate("/inventory")}
          className="text-2xl font-semibold text-pink-700 cursor-pointer"
          title="Voltar para Inventário"
        >
          {title} <span className="text-gray-800">- Notebooks</span>
        </h2>

        <div className="flex items-center flex-wrap gap-3">
          <p className="text-sm text-pink-600 font-medium whitespace-nowrap">
            {notebooksFiltrados.length} encontrado
            {notebooksFiltrados.length !== 1 ? "s" : ""}
          </p>

          <input
            type="text"
            placeholder="Buscar..."
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm shadow-sm focus:ring-2 focus:ring-pink-400"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button
            onClick={() => {
              setSelectedNotebook(null);
              setModalOpen(true);
            }}
            className="text-sm text-pink-600 hover:text-pink-800 px-3 py-1 border border-pink-600 rounded-lg transition"
          >
            <span className="text-lg font-bold">+</span> Novo
          </button>
          <button
            onClick={handleExport}
            className="text-sm text-green-600 hover:text-green-800 px-3 py-1 border border-green-600 rounded-lg transition flex items-center gap-1"
            title={`Exportar ${notebooksFiltrados.length} notebook${
              notebooksFiltrados.length !== 1 ? "s" : ""
            }`}
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      <table className="min-w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
        <thead className="bg-pink-100 text-pink-700">
          <tr>
            <th className="p-2 text-center">Serial</th>
            <th className="p-2 text-center">Modelo</th>
            <th className="relative p-2 text-center">
              <button
                onClick={() => setMostrarMenuStatus(!mostrarMenuStatus)}
                className="flex items-center justify-center w-full text-pink-700 hover:underline text-sm font-medium"
              >
                Status ▼
              </button>

              {mostrarMenuStatus && (
                <div className="absolute z-50 top-full mt-1 left-1/2 -translate-x-1/2 bg-white border border-gray-200 rounded-md shadow-lg text-sm w-36">
                  <button
                    onClick={() => {
                      setFiltroStatus("todos");
                      setMostrarMenuStatus(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-pink-50 font-normal" // Filtro status
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => {
                      setFiltroStatus("Disponivel");
                      setMostrarMenuStatus(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-pink-50 font-normal"
                  >
                    Disponível
                  </button>
                  <button
                    onClick={() => {
                      setFiltroStatus("Indisponivel");
                      setMostrarMenuStatus(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-pink-50 font-normal"
                  >
                    Indisponível
                  </button>
                </div>
              )}
            </th>

            <th className="p-2 text-center">E-mail</th>
            <th className="p-2 text-center">Observação</th>
            <th className="p-2 text-center">Criado em</th>
          </tr>
        </thead>
        <tbody>
          {notebooks
            .filter((n) => {
              const buscaMatch =
                n.serial.toLowerCase().includes(busca.toLowerCase()) ||
                n.modelo.toLowerCase().includes(busca.toLowerCase()) ||
                n.email.toLowerCase().includes(busca.toLowerCase());

              const statusMatch =
                filtroStatus === "todos" || n.status === filtroStatus;

              return buscaMatch && statusMatch;
            })

            .map((notebook) => (
              <tr
                key={notebook.id}
                onClick={() => {
                  setSelectedNotebook(notebook);
                  setModalOpen(true);
                }}
                className="cursor-pointer hover:bg-pink-50 transition border-t"
              >
                <td className="p-2 text-center">{notebook.serial}</td>
                <td className="p-2 text-center">{notebook.modelo}</td>
                <td className="p-2 text-center flex items-center justify-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      notebook.status === "Disponivel"
                        ? "bg-green-500"
                        : "bg-red-500"
                    }`}
                  />
                  <span>{notebook.status}</span>
                </td>

                <td className="-2 text-center max-w-[200px] truncate whitespace-nowrap overflow-hidden">
                  {notebook.email}
                </td>
                <td className="p-2 text-center max-w-xs truncate">
                  {notebook.observacao}
                </td>
                <td className="p-2 text-center">
                  {notebook.createdAt
                    ? new Date(
                        notebook.createdAt.seconds * 1000
                      ).toLocaleDateString("pt-BR")
                    : "—"}
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {modalOpen && (
        <NotebookDetailModal
          notebook={selectedNotebook}
          onClose={() => setModalOpen(false)}
          onDelete={handleDelete}
          collectionName={collectionName}
          onSave={() => {}}
        />
      )}
    </div>
  );
}
