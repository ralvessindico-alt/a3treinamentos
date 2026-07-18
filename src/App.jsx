import React, { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Eye, EyeOff, LogOut, Plus, Trash2, Trophy, ChevronRight, ChevronLeft, Check, X } from "lucide-react";
import modules from "./modules.json";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Variáveis de ambiente Supabase não configuradas");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const MODULOS_LISTA = Object.values(modules).sort((a, b) => a.id.localeCompare(b.id));

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [users, setUsers] = useState([]);
  const [userProgress, setUserProgress] = useState({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [userRole, setUserRole] = useState(null);

  const [newUserForm, setNewUserForm] = useState({ nome: "", email: "", cpf: "" });
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const [currentModule, setCurrentModule] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [quizMode, setQuizMode] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [quizScore, setQuizScore] = useState(0);

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session);

      if (data.session) {
        await fetchUserData(data.session);
      }
      setLoading(false);
    };

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session) {
        fetchUserData(session);
      }
    });

    return () => authListener?.subscription.unsubscribe();
  }, []);

  const fetchUserData = async (sess) => {
    if (!sess) return;

    try {
      // FIX: Buscar o role diretamente do banco
      const { data: userProfile, error: userError } = await supabase
        .from("users")
        .select("role, id")
        .eq("id", sess.user.id)
        .single();

      if (userError) {
        console.error("Erro ao buscar perfil:", userError);
        setScreen("colaborador");
        await fetchUserProgress(sess.user.id);
        return;
      }

      // FIX: Salvar role no estado
      setUserRole(userProfile.role);

      // FIX: Verificar role e decidir tela
      if (userProfile.role === "admin") {
        setScreen("admin");
        await fetchAllUsers();
      } else {
        setScreen("colaborador");
        await fetchUserProgress(sess.user.id);
      }
    } catch (err) {
      console.error("Erro:", err);
      setError("Erro ao carregar dados");
    }
  };

  const fetchAllUsers = async () => {
    const { data } = await supabase.from("users").select("*").order("created_at", { ascending: false });
    setUsers(data || []);
  };

  const fetchUserProgress = async (userId) => {
    const { data } = await supabase.from("progress").select("*").eq("user_id", userId);
    const progressMap = {};
    (data || []).forEach((p) => {
      progressMap[p.module_id] = p;
    });
    setUserProgress(progressMap);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginForm.email,
        password: loginForm.password,
      });

      if (error) throw error;
      setLoginForm({ email: "", password: "" });
    } catch (err) {
      setError(err.message || "Credenciais inválidas");
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");

    if (!newUserForm.nome || !newUserForm.email || !newUserForm.cpf) {
      setError("Preencha todos os campos");
      return;
    }

    try {
      const password = Math.random().toString(36).slice(-8);

      const { data: authData, error: authError } = await supabase.auth.signUpWithPassword({
        email: newUserForm.email,
        password: password,
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase.from("users").insert({
        id: authData.user.id,
        email: newUserForm.email,
        nome: newUserForm.nome,
        cpf: newUserForm.cpf,
        role: "colaborador",
      });

      if (profileError) throw profileError;

      setSuccess(`✅ ${newUserForm.nome} criado com senha: ${password}`);
      setNewUserForm({ nome: "", email: "", cpf: "" });
      await fetchAllUsers();
    } catch (err) {
      setError(err.message || "Erro ao criar");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserRole(null);
    setScreen("login");
    setCurrentModule(null);
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Deletar colaborador?")) return;

    try {
      await supabase.from("users").delete().eq("id", userId);
      setSuccess("✅ Colaborador deletado");
      await fetchAllUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const startModule = async (moduleId) => {
    const mod = modules[moduleId];
    setCurrentModule(mod);
    setCurrentSlide(0);
    setQuizMode(false);
    setAnswers({});
    setQuizScore(0);

    const progress = userProgress[moduleId];
    if (!progress) {
      await supabase.from("progress").insert({
        user_id: session.user.id,
        module_id: moduleId,
        status: "em_progresso",
        percentage: 0,
      });
      await fetchUserProgress(session.user.id);
    }
  };

  const nextSlide = () => {
    if (currentSlide < (currentModule?.slides?.length || 0) - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setQuizMode(true);
      setCurrentQuestion(0);
      setAnswers({});
      setShowFeedback(false);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const submitAnswer = async (optionIndex) => {
    const q = currentModule.questions[currentQuestion];
    const isCorrect = optionIndex === q.correct;

    if (isCorrect) {
      setAnswers({ ...answers, [currentQuestion]: true });
    } else {
      setAnswers({ ...answers, [currentQuestion]: false });
    }

    setFeedbackText(isCorrect ? q.ok : q.err);
    setShowFeedback(true);
  };

  const nextQuestion = () => {
    setShowFeedback(false);
    if (currentQuestion < (currentModule?.questions?.length || 0) - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    const correct = Object.values(answers).filter((a) => a === true).length;
    const score = Math.round((correct / (currentModule?.questions?.length || 10)) * 100);
    setQuizScore(score);

    const moduleProgress = userProgress[currentModule.id] || {};
    const status = score >= 80 ? "concluido" : "em_progresso";

    await supabase.from("progress").upsert(
      {
        user_id: session.user.id,
        module_id: currentModule.id,
        status: status,
        percentage: score,
        score: score,
        completions: (moduleProgress.completions || 0) + (status === "concluido" ? 1 : 0),
        completed_at: status === "concluido" ? new Date().toISOString() : null,
      },
      { onConflict: "user_id,module_id" }
    );

    await fetchUserProgress(session.user.id);
  };

  const goBackToModules = () => {
    setCurrentModule(null);
    setCurrentSlide(0);
    setQuizMode(false);
    setQuizScore(0);
    setAnswers({});
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-400 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold text-blue-900">
            A3
          </div>
          <p className="text-gray-600 font-semibold">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-blue-50 to-blue-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md border-t-4 border-amber-400">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center text-3xl font-bold text-blue-900 shadow-lg">
              A3
            </div>
          </div>

          <h1 className="text-4xl font-black text-center text-blue-900 mb-1">A3 Treinamentos</h1>
          <p className="text-center text-gray-600 mb-8 font-medium">Plataforma de Aprendizado</p>

          {error && <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
          {success && <div className="bg-green-50 border-2 border-green-300 text-green-800 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">Email</label>
              <input
                type="email"
                placeholder="seu@email.com"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3.5 text-gray-500"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white py-3 rounded-lg font-bold transition shadow-lg"
            >
              ACESSAR
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (currentModule) {
    if (!quizMode) {
      const slide = currentModule.slides?.[currentSlide] || { type: "cover", title: currentModule.title };

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white sticky top-0 z-40 shadow-lg">
            <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
              <h1 className="font-bold text-xl">{currentModule.title}</h1>
              <button onClick={goBackToModules} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto px-6 py-12">
            <div className="bg-white rounded-2xl shadow-lg p-12 min-h-96">
              <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-800 mb-4">{slide.title}</h2>
                {slide.subtitle && <p className="text-lg text-gray-600 mb-8">{slide.subtitle}</p>}
                {slide.heading && <h3 className="text-2xl font-bold text-blue-600 mb-6">{slide.heading}</h3>}

                {slide.blocks && (
                  <div className="space-y-4 text-left mt-8">
                    {slide.blocks.map((block, idx) => (
                      <div key={idx} className={`p-4 rounded-lg ${block.variant === "danger" ? "bg-red-50 border-l-4 border-red-500" : "bg-blue-50 border-l-4 border-blue-500"}`}>
                        {block.label && <p className="font-bold text-gray-800">{block.label}</p>}
                        <p className="text-gray-700 mt-2">{block.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between mt-8">
              <button
                onClick={prevSlide}
                disabled={currentSlide === 0}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white rounded-lg font-semibold"
              >
                <ChevronLeft size={20} />
                Anterior
              </button>

              <div className="text-center">
                <p className="text-gray-600 font-semibold">
                  Slide {currentSlide + 1} de {currentModule.slides?.length || 1}
                </p>
              </div>

              <button
                onClick={nextSlide}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
              >
                {currentSlide === (currentModule.slides?.length || 0) - 1 ? "Iniciar Quiz" : "Próximo"}
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      );
    } else {
      const q = currentModule.questions[currentQuestion];
      const answered = answers[currentQuestion] !== undefined;

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white sticky top-0 z-40 shadow-lg">
            <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
              <h1 className="font-bold text-xl">{currentModule.title} - Quiz</h1>
              <button onClick={goBackToModules} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
                <LogOut size={16} />
                Sair
              </button>
            </div>
          </div>

          <div className="max-w-2xl mx-auto px-6 py-12">
            {quizScore > 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <Trophy className={`w-24 h-24 mx-auto mb-6 ${quizScore >= 80 ? "text-green-500" : "text-red-500"}`} />
                <h2 className="text-4xl font-bold text-gray-800 mb-4">
                  {quizScore >= 80 ? "Parabéns!" : "Continue Estudando"}
                </h2>
                <p className="text-6xl font-bold text-blue-600 mb-4">{quizScore}%</p>
                <p className="text-xl text-gray-600 mb-8">
                  {quizScore >= 80
                    ? `Você acertou ${Object.values(answers).filter((a) => a).length} de ${currentModule.questions.length} questões!`
                    : `Você precisa de 80%. Tente novamente!`}
                </p>

                {quizScore >= 80 && (
                  <div className="mb-6 p-4 bg-green-50 border-2 border-green-500 rounded-lg">
                    <p className="text-green-800 font-bold">✅ Módulo concluído com sucesso!</p>
                  </div>
                )}

                <button
                  onClick={goBackToModules}
                  className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg"
                >
                  Voltar aos Módulos
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="mb-8">
                  <p className="text-gray-600 font-semibold">
                    Questão {currentQuestion + 1} de {currentModule.questions.length}
                  </p>
                  <div className="w-full bg-gray-300 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-full rounded-full transition"
                      style={{ width: `${((currentQuestion + 1) / currentModule.questions.length) * 100}%` }}
                    ></div>
                  </div>
                </div>

                <h3 className="text-2xl font-bold text-gray-800 mb-8">{q.q}</h3>

                <div className="space-y-3 mb-8">
                  {q.opts.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => submitAnswer(idx)}
                      disabled={answered}
                      className={`w-full p-4 rounded-lg text-left font-semibold transition ${
                        answered
                          ? idx === q.correct
                            ? "bg-green-100 border-2 border-green-500 text-green-800"
                            : answers[currentQuestion] === idx && idx !== q.correct
                            ? "bg-red-100 border-2 border-red-500 text-red-800"
                            : "bg-gray-100 text-gray-700"
                          : "bg-blue-50 border-2 border-blue-300 hover:bg-blue-100 text-gray-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded border-2 flex items-center justify-center">
                          {answered && idx === q.correct && <Check size={16} className="text-green-600" />}
                          {answered && answers[currentQuestion] === idx && idx !== q.correct && <X size={16} className="text-red-600" />}
                        </div>
                        <span>{opt}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {showFeedback && (
                  <div className={`p-4 rounded-lg mb-8 ${answers[currentQuestion] ? "bg-green-50 border-l-4 border-green-500 text-green-800" : "bg-red-50 border-l-4 border-red-500 text-red-800"}`}>
                    <p className="font-bold">{answers[currentQuestion] ? "✅ Correto!" : "❌ Incorreto!"}</p>
                    <p className="mt-2">{feedbackText}</p>
                  </div>
                )}

                {answered && (
                  <button
                    onClick={nextQuestion}
                    className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition"
                  >
                    {currentQuestion === (currentModule.questions.length || 10) - 1 ? "Ver Resultado" : "Próxima Questão"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
  }

  if (screen === "admin") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white sticky top-0 z-40 shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center font-bold text-blue-800">A3</div>
              <h1 className="font-bold">A3 Treinamentos - Admin</h1>
            </div>
            <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-blue-500">
              <p className="text-gray-600 text-sm font-semibold">Colaboradores</p>
              <p className="text-4xl font-bold text-blue-600 mt-2">{users.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-amber-500">
              <p className="text-gray-600 text-sm font-semibold">Módulos</p>
              <p className="text-4xl font-bold text-amber-600 mt-2">{MODULOS_LISTA.length}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-green-500">
              <p className="text-gray-600 text-sm font-semibold">Total Questões</p>
              <p className="text-4xl font-bold text-green-600 mt-2">{MODULOS_LISTA.reduce((a, m) => a + (m.questions?.length || 10), 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-6 shadow-md border-l-4 border-purple-500">
              <p className="text-gray-600 text-sm font-semibold">Horas de Conteúdo</p>
              <p className="text-4xl font-bold text-purple-600 mt-2">{(MODULOS_LISTA.length * 25) / 60 | 0}h</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Plus size={24} className="text-blue-600" />
              Criar Novo Colaborador
            </h2>

            {error && <div className="bg-red-50 border-2 border-red-300 text-red-800 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
            {success && <div className="bg-green-50 border-2 border-green-300 text-green-800 px-4 py-3 rounded-lg mb-4 text-sm">{success}</div>}

            <form onSubmit={handleSignUp} className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Nome"
                value={newUserForm.nome}
                onChange={(e) => setNewUserForm({ ...newUserForm, nome: e.target.value })}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <input
                type="email"
                placeholder="Email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="CPF"
                value={newUserForm.cpf}
                onChange={(e) => setNewUserForm({ ...newUserForm, cpf: e.target.value })}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
              />
              <button type="submit" className="bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold">
                Criar
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 overflow-x-auto">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Colaboradores ({users.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-100 border-b-2">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Nome</th>
                  <th className="px-4 py-2 text-left font-semibold">Email</th>
                  <th className="px-4 py-2 text-left font-semibold">CPF</th>
                  <th className="px-4 py-2 text-left font-semibold">Criado</th>
                  <th className="px-4 py-2 text-center font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold">{u.nome}</td>
                    <td className="px-4 py-2 text-xs font-mono">{u.email}</td>
                    <td className="px-4 py-2 font-mono">{u.cpf}</td>
                    <td className="px-4 py-2 text-xs">{new Date(u.created_at).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => handleDeleteUser(u.id)} className="text-red-600 hover:text-red-800 p-1">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="bg-gradient-to-r from-blue-700 to-blue-800 text-white sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center font-bold text-blue-800">A3</div>
            <h1 className="font-bold">A3 Treinamentos</h1>
          </div>
          <button onClick={handleLogout} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
            <LogOut size={16} />
            Sair
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Bem-vindo!</h2>
        <p className="text-gray-600 mb-8">Você tem {MODULOS_LISTA.length} módulos de treinamento para completar ({MODULOS_LISTA.length * 10} questões).</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {MODULOS_LISTA.map((mod) => {
            const progress = userProgress[mod.id];
            const isCompleted = progress?.status === "concluido";

            return (
              <div key={mod.id} className={`rounded-xl shadow-md overflow-hidden border-l-4 ${isCompleted ? "border-green-500 bg-green-50" : "border-blue-500 bg-white"}`}>
                <div className="p-6">
                  <div className="flex justify-between mb-3">
                    <span className="text-4xl">{mod.icon}</span>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">{mod.id}</span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{mod.title}</h3>
                  <p className="text-sm text-gray-600 mb-3">{mod.description}</p>
                  <p className="text-xs text-gray-500 mb-4">⏱ {mod.time}</p>

                  {isCompleted ? (
                    <div className="bg-green-100 border-2 border-green-500 rounded-lg p-3 text-center mb-4">
                      <p className="text-green-800 font-bold flex items-center justify-center gap-2">
                        <Trophy size={18} />
                        Concluído!
                      </p>
                      <p className="text-sm text-green-700 mt-1">{progress?.completions || 1}x realizado</p>
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-700 font-semibold mb-2">Progresso: {progress?.percentage || 0}%</p>
                      <div className="w-full bg-gray-300 rounded-full h-2">
                        <div className="bg-blue-600 h-full rounded-full transition" style={{ width: `${progress?.percentage || 0}%` }} />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => startModule(mod.id)}
                    className={`w-full py-2 rounded-lg font-semibold transition ${
                      isCompleted
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white"
                    }`}
                  >
                    {isCompleted ? "Refazer" : "Começar"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
