import React, { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { ArrowLeft, ListChecks } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FinalizadasPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, "weekly-tasks"),
      where("status", "==", "concluida")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-pink-700 text-3xl font-bold">
          <span>Atividades Finalizadas</span>
          <ListChecks className="w-8 h-8" />
        </div>
        <button
          onClick={() => navigate("/weekly-tasks")}
          className="px-4 py-2 rounded-lg bg-pink-100 text-pink-700 font-semibold hover:bg-pink-200 flex items-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" /> Voltar
        </button>
      </div>
      <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
        <div className="grid grid-cols-12 gap-4 font-semibold text-gray-700 mb-2">
          <div className="col-span-4">Atividade</div>
          <div className="col-span-2">Responsável</div>
          <div className="col-span-2">Prioridade</div>
          <div className="col-span-2">Data</div>
          <div className="col-span-2 text-center">Status</div>
        </div>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Nenhuma atividade finalizada.
          </div>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="grid grid-cols-12 gap-4 items-center border-b py-3 last:border-b-0 group hover:bg-pink-50 transition"
            >
              <div className="col-span-4 text-base whitespace-pre-line">
                {task.atividade}
              </div>
              <div className="col-span-2">{task.responsavel}</div>
              <div className="col-span-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-bold ${
                    task.prioridade === "Alta"
                      ? "bg-red-100 text-red-700"
                      : task.prioridade === "Média"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {task.prioridade}
                </span>
              </div>
              <div className="col-span-2">{task.data}</div>
              <div className="col-span-2 text-center">
                <span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">
                  Concluída
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
