/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, CheckCircle2, Info, X, Users, QrCode } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from 'recharts';
import { QRCodeSVG } from 'qrcode.react';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';

const situations = [
  { text: "Un élève utilise ChatGPT pour corriger l'orthographe de sa rédaction avant de la rendre.", analysis: "Cette situation interroge la limite entre l'utilisation d'un outil d'aide (comme un correcteur orthographique) et la réécriture. Le débat porte sur l'évaluation : note-t-on le fond, ou la maîtrise fine de la langue et de l'orthographe par l'élève ?" },
  { text: "Un élève demande à l'IA de lui expliquer un concept qu'il n'a pas compris puis rédige lui-même.", analysis: "C'est l'équivalent numérique d'un tuteur ou d'un parent qui aide aux devoirs. Le débat se penche sur l'équité (tout le monde n'y a pas accès de la même façon) mais cet usage est généralement perçu comme un levier positif pour l'apprentissage." },
  { text: "Un élève fait générer son introduction par l'IA et rédige le reste lui-même.", analysis: "Cela soulève la question de l'originalité et de la structuration de la pensée. L'introduction est une partie clé de l'argumentation. Si l'IA la rédige, l'élève a-t-il vraiment saisi et problématisé les enjeux du sujet ?" },
  { text: "Un élève soumet un devoir entièrement généré par l'IA.", analysis: "C'est le cas le plus classique de substitution complète. Le débat porte sur l'assimilation au plagiat, l'absence d'effort cognitif et l'impossibilité d'évaluer les réelles compétences de l'élève." },
  { text: "Un élève utilise l'IA pour vérifier ses calculs après avoir résolu un problème de maths.", analysis: "Une utilisation similaire à celle d'une calculatrice au moment de son introduction. L'enjeu est de savoir si l'élève sait identifier ses propres erreurs et comprendre sa démarche, ou s'il se repose aveuglément sur le résultat final." },
  { text: "Un élève demande à l'IA de lui faire un plan détaillé avant de rédiger sa dissertation.", analysis: "Construire un plan permet de développer l'esprit de synthèse et l'organisation autonome de la pensée. Déléguer cette tâche à l'IA empêche l'évaluation de cette compétence structurante fondamentale." },
  { text: "Un élève utilise l'IA pour traduire un texte en langue étrangère en cours de traduction.", analysis: "Les traducteurs automatiques et IA sont très performants en entreprise. S'il s'agit d'un exercice de langue en classe, cela fausse l'évaluation de la syntaxe et du vocabulaire de l'élève, posant le problème de la pertinence de l'exercice." },
  { text: "Un professeur utilise l'IA pour générer les sujets d'un contrôle sans relecture.", analysis: "Cette situation inverse le problème en interrogeant l'usage par l'enseignant. Le débat porte sur la responsabilité pédagogique, la pertinence par rapport au cours dispensé, et le risque d'erreurs (hallucinations) dans l'évaluation." },
  { text: "Un élève utilise l'IA pour reformuler ses idées dans un oral de DNB.", analysis: "Le style, l'appropriation et l'élocution font partie intégrante de l'évaluation à l'oral. Si le texte de base est réécrit par l'IA, s'agit-il vraiment du discours de l'élève ou d'un simple exercice de lecture ?" },
  { text: "Un élève en difficulté utilise l'IA comme tuteur pour s'entraîner, hors devoir.", analysis: "L'IA agissant comme une remédiation scolaire personnelle. C'est un usage très prometteur mais qui interroge sur la fiabilité des réponses de l'IA (qui peut se tromper) et sur la fracture numérique entre les élèves." }
];

type Screen = 'home' | 'quiz' | 'result' | 'host';

interface Answer {
  text: string;
  choice: number;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [sliderValue, setSliderValue] = useState(5);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [hostView, setHostView] = useState<number>(0);
  
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [groupResponses, setGroupResponses] = useState<number[][]>([]);

  // Checking for session ID in URL parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
      setSessionId(sessionParam);
    }
  }, []);

  // Scroll to top on screen change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen]);

  // Host: Listen for incoming answers
  useEffect(() => {
    if (screen === 'host' && sessionId) {
      const unsubscribe = onSnapshot(collection(db, 'sessions', sessionId, 'responses'), (snapshot) => {
        const responses = snapshot.docs.map(doc => doc.data().answers as number[]);
        setGroupResponses(responses);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `sessions/${sessionId}/responses`);
      });
      return () => unsubscribe();
    }
  }, [screen, sessionId]);

  const startGroupSession = async () => {
    try {
      const id = Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, 'sessions', id), {
        createdAt: serverTimestamp()
      });
      setSessionId(id);
      setScreen('host');
    } catch (err) {
      alert("Erreur de connexion : Impossible de créer la session collective. Vérifiez la console.");
      handleFirestoreError(err, OperationType.CREATE, 'sessions');
    }
  };

  const submitToFirebase = async (finalAnswers: Answer[]) => {
    if (!sessionId) return;
    try {
      const responseId = Math.random().toString(36).substring(2, 12);
      const data = {
        answers: finalAnswers.map(a => a.choice),
        createdAt: serverTimestamp()
      };
      await setDoc(doc(db, 'sessions', sessionId, 'responses', responseId), data);
    } catch(err) {
      alert("Erreur de connexion : Impossible d'envoyer vos réponses.");
      console.error(err);
    }
  };

  const startTest = () => {
    setCurrentIndex(0);
    setAnswers([]);
    setSliderValue(5);
    setShowAnalysis(false);
    setScreen('quiz');
  };

  const handleAnswer = () => {
    const updatedAnswers = [...answers, { text: situations[currentIndex].text, choice: sliderValue }];
    setAnswers(updatedAnswers);
    if (currentIndex < situations.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSliderValue(5);
      setShowAnalysis(false);
    } else {
      if (sessionId) {
        submitToFirebase(updatedAnswers);
      }
      setScreen('result');
    }
  };

  const getThemeColor = (val: number) => {
    if (val <= 3) return 'text-green-600';
    if (val >= 7) return 'text-red-500';
    return 'text-amber-500';
  };

  const currentSituation = situations[currentIndex];
  const progress = (currentIndex / situations.length) * 100;

  const renderHome = () => (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col items-center flex-1 justify-center p-6 text-center"
    >
      <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-200">
        <CheckCircle2 className="w-8 h-8 text-slate-800" />
      </div>
      <h2 className="text-2xl font-semibold text-slate-900 mb-4">
        Triche ou pas triche ?
      </h2>
      <p className="text-lg text-slate-600 mb-6 max-w-md">
        Enseignants : comment percevez-vous l'usage de l'IA par les élèves ?
      </p>

      {sessionId ? (
        <div className="flex flex-col items-center max-w-sm w-full gap-5">
           <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-blue-800 flex items-start text-left gap-3 w-full shadow-sm">
             <Info className="w-5 h-5 shrink-0 mt-0.5" />
             <p className="text-sm font-medium">Vous avez rejoint une session de groupe. Vos résultats anonymes s'afficheront sur l'écran principal de l'animateur.</p>
           </div>
           <button
            onClick={startTest}
            className="w-full py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition shadow-md active:scale-[0.98]"
          >
            Démarrer ma participation
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            onClick={startGroupSession}
            className="w-full flex items-center justify-center gap-2 py-4 px-6 bg-slate-900 text-white rounded-xl font-semibold text-lg hover:bg-slate-800 transition shadow-md active:scale-[0.98]"
          >
            <Users className="w-5 h-5" />
            Créer une session collective
          </button>
          
          <div className="relative flex py-2 items-center">
             <div className="flex-grow border-t border-slate-200"></div>
             <span className="flex-shrink-0 mx-4 text-slate-400 text-sm font-medium">OU</span>
             <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <button
            onClick={startTest}
            className="w-full py-3 px-6 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition active:scale-[0.98]"
          >
            Faire le test en solo
          </button>
        </div>
      )}
    </motion.div>
  );

  const renderHost = () => {
    const targetChoices = groupResponses.map(res => res[hostView]).filter(v => v !== undefined);

    const chartData = [
      { name: 'Pas triche', count: targetChoices.filter(v => v <= 3).length, color: '#22c55e' },
      { name: 'Ça dépend', count: targetChoices.filter(v => v > 3 && v < 7).length, color: '#f59e0b' },
      { name: 'Triche', count: targetChoices.filter(v => v >= 7).length, color: '#ef4444' },
    ];

    const joinUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}`;

    return (
      <motion.div
        key="host"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="flex flex-col flex-1 w-full max-w-6xl mx-auto p-6"
      >
        <div className="flex flex-col md:flex-row gap-8 items-start justify-center h-full pt-8">
          
          {/* LECTURE ET QR CODE */}
          <div className="w-full md:w-1/3 flex flex-col items-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 flex flex-col items-center gap-2">
              <QrCode className="w-12 h-12 text-slate-400" />
              Rejoignez la session
            </h2>
            <p className="text-slate-500 text-center text-xl mb-6">
              Scannez ce QR Code avec votre téléphone pour envoyer vos réponses.
            </p>
            
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8 flex justify-center">
              <QRCodeSVG value={joinUrl} size={250} />
            </div>

            <div className="bg-slate-100 px-6 py-5 rounded-lg w-full text-center">
              <span className="text-6xl font-bold text-slate-800">{groupResponses.length}</span>
              <p className="text-lg font-semibold uppercase tracking-wider text-slate-500 mt-2">Participants</p>
            </div>
            
            <button 
               onClick={() => { setSessionId(null); setScreen('home'); }}
               className="mt-8 text-lg font-medium text-slate-400 hover:text-slate-600 transition"
            >
              Fermer la session
            </button>
          </div>

          {/* GLOBAL RESULTS */}
          <div className="w-full md:w-2/3 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm min-h-[500px] flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 border-b border-slate-100 pb-6">
              <h3 className="text-3xl font-bold text-slate-800">
                Question {hostView + 1} <span className="text-2xl text-slate-500 font-medium tracking-tight">({targetChoices.length} réponses)</span>
              </h3>
              <select
                value={hostView}
                onChange={(e) => setHostView(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 text-slate-700 text-xl font-medium rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none cursor-pointer"
              >
                {situations.map((_, idx) => (
                  <option key={idx} value={idx}>Question {idx + 1}</option>
                ))}
              </select>
            </div>
            
            <p className="text-slate-600 text-2xl leading-relaxed mb-8 text-center italic bg-slate-50 p-6 rounded-xl border border-slate-100">
              « {situations[hostView].text} »
            </p>

            {targetChoices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Users className="w-20 h-20 mb-6 text-slate-200" />
                <p className="text-2xl">En attente des réponses...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 18, fontWeight: 600 }} width={120} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '1.25rem' }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const renderQuiz = () => (
    <motion.div
      key="quiz"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col flex-1 w-full max-w-lg mx-auto p-6"
    >
      <div className="mb-8">
        <div className="flex justify-between text-sm text-slate-500 font-medium mb-3">
          <span>Question {currentIndex + 1} sur {situations.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] mb-4">
        <h3 className="text-xl md:text-2xl text-center font-medium leading-relaxed text-slate-800 mb-6">
          « {currentSituation.text} »
        </h3>
        
        <button
          onClick={() => setShowAnalysis(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700 rounded-full transition-colors active:scale-95"
        >
          <Info className="w-4 h-4" />
          Pourquoi ce cas fait débat ?
        </button>
      </div>

      <div className="flex flex-col gap-6 mt-auto">
        <div className="flex justify-between text-sm font-semibold uppercase tracking-wider px-1">
          <span className="text-green-600">0 - Pas triche</span>
          <span className="text-red-500">Triche - 10</span>
        </div>
        
        <div className="px-2 py-2">
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            className={`custom-slider w-full bg-gradient-to-r from-green-400 via-amber-300 to-red-500 ${getThemeColor(sliderValue)}`}
          />
          <div className="flex justify-between mt-4 text-xs font-medium text-slate-400">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
              <span 
                key={n} 
                className={`w-6 text-center transition-all ${
                  sliderValue === n ? 'text-slate-900 justify-center font-bold scale-125' : ''
                }`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        <button
          onClick={handleAnswer}
          className="w-full mt-2 py-4 px-6 bg-slate-900 text-white rounded-xl font-medium text-lg hover:bg-slate-800 shadow-md transition active:scale-[0.98]"
        >
          Valider ({sliderValue}/10)
        </button>
      </div>
    </motion.div>
  );

  const renderResult = () => {
    const chartData = [
      { name: 'Pas triche', count: answers.filter(a => a.choice <= 3).length, color: '#22c55e' },
      { name: 'Ça dépend', count: answers.filter(a => a.choice > 3 && a.choice < 7).length, color: '#f59e0b' },
      { name: 'Triche', count: answers.filter(a => a.choice >= 7).length, color: '#ef4444' },
    ];

    if (sessionId) {
      return (
        <motion.div
           key="result"
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           className="flex flex-col flex-1 w-full max-w-lg mx-auto p-6 justify-center items-center text-center"
        >
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm border border-green-200">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Merci pour votre participation !</h2>
            <p className="text-slate-500 mb-8">Vos réponses ont bien été envoyées de manière anonyme à l'animateur.</p>
            <p className="font-medium text-slate-700 bg-white border border-slate-200 shadow-sm p-4 rounded-xl w-full">Veuillez regarder l'écran principal pour découvrir la perception globale du groupe.</p>
        </motion.div>
      )
    }

    return (
      <motion.div
        key="result"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col flex-1 w-full max-w-2xl mx-auto p-6"
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Vos réponses :</h2>
          <p className="text-slate-500">Un aperçu de votre perception de l'usage de l'IA.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8 h-64">
          <h3 className="text-lg font-semibold text-slate-800 mb-4 text-center">Répartition des réponses</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 13, fontWeight: 500 }} width={80} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={32}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex flex-col gap-4 mb-8">
        {answers.map((ans, idx) => {
          let tagClasses = "bg-amber-100 text-amber-800 border-amber-300";
          let label = "Ça dépend";
          
          if (ans.choice <= 3) {
            tagClasses = "bg-green-100 text-green-800 border-green-300";
            label = "Pas triche";
          } else if (ans.choice >= 7) {
            tagClasses = "bg-red-100 text-red-800 border-red-300";
            label = "Triche";
          }

          return (
            <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col gap-3 transition-colors hover:border-slate-300">
              <span className="font-medium text-slate-400 text-xs tracking-wider uppercase">
                Situation {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
              </span>
              <p className="text-slate-800 leading-relaxed font-medium">{ans.text}</p>
              <div className="mt-1 flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 border rounded-full text-sm font-semibold tracking-wide ${tagClasses}`}>
                  {ans.choice} / 10
                </span>
                <span className="text-sm font-medium text-slate-500">{label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 text-center mb-8 md:p-8">
        <p className="text-slate-700 font-medium md:text-lg">
          Vos réponses reflètent votre vision de la triche. <br className="hidden md:block"/>
          Il n'y a pas de réponse universelle.
        </p>
      </div>

        <div className="flex justify-center pb-8">
          <button
            onClick={startTest}
            className="flex items-center justify-center gap-2 py-3 px-6 bg-white border border-slate-300 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition active:scale-[0.98] shadow-sm"
          >
            <RefreshCcw className="w-5 h-5" />
            Recommencer
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col text-slate-900 font-sans selection:bg-slate-200">
      <header className="py-4 px-6 border-b border-slate-200/60 flex items-center justify-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-lg font-semibold tracking-tight text-slate-800 flex items-center gap-2">
           <CheckCircle2 className="w-5 h-5 text-slate-400" />
           Triche ou pas triche ?
        </h1>
      </header>

      <main className="flex-1 flex flex-col pt-4 relative">
        <AnimatePresence mode="wait">
          {screen === 'home' && renderHome()}
          {screen === 'quiz' && renderQuiz()}
          {screen === 'result' && renderResult()}
          {screen === 'host' && renderHost()}
        </AnimatePresence>

        <AnimatePresence>
          {showAnalysis && screen === 'quiz' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowAnalysis(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 overflow-hidden relative"
              >
                <button
                  onClick={() => setShowAnalysis(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition bg-slate-100/50 hover:bg-slate-100 rounded-full p-1.5"
                >
                  <X className="w-5 h-5"/>
                </button>
                <div className="flex items-center gap-3 mb-4 text-blue-600">
                  <div className="p-2 bg-blue-50 rounded-xl">
                    <Info className="w-6 h-6"/>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">Analyse pédagogique</h3>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  {currentSituation.analysis}
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowAnalysis(false)}
                    className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-xl transition-colors active:scale-[0.98]"
                  >
                    Fermer
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="py-6 px-6 text-center text-sm font-medium text-slate-400">
        <p>Application anonyme • Aucune donnée collectée</p>
      </footer>
    </div>
  );
}
