import { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";


const provider = new GoogleAuthProvider();

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setCarregando(true);
    setErro("");

    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, senha);
      navigate("/");
    } catch (err) {
      console.error("Erro ao logar com e-mail:", err.message);
      setErro("E-mail ou senha inválidos.");
    } finally {
      setCarregando(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErro(""); // limpa erros anteriores
    try {
      await setPersistence(auth, browserLocalPersistence); // Manter Login
      const result = await signInWithPopup(auth, provider);
      const email = result.user.email;
  
      // Verifica se é um e-mail da VTEX
      if (!email.endsWith("@vtex.com")) {
        setErro("Apenas e-mails @vtex.com são permitidos.");
        await auth.signOut(); // força logout
        return;
      }
  
      navigate("/");
    } catch (err) {
      console.error("Erro ao logar com Google:", err.message);
      setErro("Erro ao fazer login com o Google.");
    }
  };
  

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="bg-white p-10 rounded-xl shadow-xl w-full max-w-md space-y-6">
      <div className="flex justify-center mb-4">
  <img src="/logo-vtex.png" alt="VTEX Logo" className="h-20" />
</div>

        <h1 className="text-2xl font-bold text-center text-pink-600">Login</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm text-gray-700">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-400"
            />
          </div>
          <div>
            <label className="text-sm text-gray-700">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              className="w-full mt-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-pink-400"
            />
          </div>
          {erro && <p className="text-red-500 text-sm">{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-pink-600 text-white py-2 rounded-lg hover:bg-pink-700 transition"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <div className="relative my-4 text-center">
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="bg-white px-2 text-sm text-gray-500">ou</span>
          </div>
          <hr className="border-gray-300" />
        </div>

        <button
          onClick={handleGoogleLogin}
          className="w-full border border-gray-300 rounded-lg flex items-center justify-center gap-3 py-2 hover:shadow transition"
        >
          <img src="/google-icon.svg" alt="Google" className="w-5 h-5" />
          <span className="text-gray-700 font-medium">Entrar com Google</span>
        </button>

      </div>
    </div>
  );
}
