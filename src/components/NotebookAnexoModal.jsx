import { useEffect, useRef, useState } from "react";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import { storage } from "../firebase";

export default function NotebookAnexoModal({ notebookId, onClose }) {
  const [imagens, setImagens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const inputRef = useRef(null);

  const carregarImagens = async () => {
    if (!notebookId) return;
    setCarregando(true);
    try {
      const pastaRef = ref(storage, `notebooks/${notebookId}`);
      const lista = await listAll(pastaRef);
      const urls = await Promise.all(
        lista.items.map((item) => getDownloadURL(item))
      );
      setImagens(urls);
    } catch (error) {
      console.error("Erro ao carregar imagens:", error);
      setErro("Falha ao enviar uma ou mais imagens.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarImagens();
  }, [notebookId]);

  const handleUpload = async (e) => {
    const arquivos = e.target.files;
    if (!arquivos.length || !notebookId) return;

    setCarregando(true);
    try {
      await Promise.all(
        Array.from(arquivos).map((file) => {
          const imgRef = ref(
            storage,
            `notebooks/${notebookId}/${Date.now()}_${file.name}`
          );
          return uploadBytes(imgRef, file);
        })
      );
      carregarImagens();
    } catch (error) {
      console.error("Erro ao enviar imagem:", error);
    } finally {
      setCarregando(false);
    }
  };
  const visualizarImagem = (url) => {
    window.open(url, "_blank");
  };
  const excluirImagem = async (url) => {
    if (!window.confirm("Deseja remover esta imagem?")) return;
    try {
      const refImg = ref(
        storage,
        url.split("/o/")[1].split("?")[0].replace(/%2F/g, "/")
      );
      await deleteObject(refImg);
      carregarImagens();
    } catch (error) {
      console.error("Erro ao excluir imagem:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-xl max-w-2xl w-full shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-pink-700">📎 Anexar</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <input
          type="file"
          accept="image/*"
          multiple
          ref={inputRef}
          onChange={handleUpload}
          className="mb-4"
        />

        {carregando ? (
          <p className="text-sm text-gray-500">Carregando imagens...</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {imagens.map((url, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={url}
                  alt="anexo"
                  className="w-24 h-24 object-cover rounded cursor-pointer border"
                  onClick={() => visualizarImagem(url)}
                />
                <button
                  onClick={() => excluirImagem(url)}
                  className="absolute top-1 right-1 bg-white rounded-full text-red-500 text-xs px-1.5 hidden group-hover:block"
                  title="Excluir"
                >
                  ✕
                </button>
              </div>
            ))}
            {imagens.length === 0 && (
              <p className="text-sm text-gray-500">
                Nenhuma imagem anexada ainda.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
