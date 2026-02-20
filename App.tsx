
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Questionnaire } from './components/Questionnaire';
import { ResultView } from './components/ResultView';
import { UserProfile, GeneratedLook } from './types';
import { BackendService } from './services/backend';

// Removed local aistudio declaration to resolve conflict with pre-defined AIStudio global type.

const App: React.FC = () => {
  const [view, setView] = useState<'auth' | 'form' | 'loading' | 'result'>('auth');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [look, setLook] = useState<GeneratedLook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      // Access aistudio via window casting to bypass potential type conflicts or missing global interface definitions.
      const aiStudio = (window as any).aistudio;
      if (typeof aiStudio !== 'undefined') {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (hasKey) {
          setView('form');
        }
      } else {
        // Fallback for environments without aistudio global
        setView('form');
      }
    };
    checkAuth();
  }, []);

  const handleAuth = async () => {
    try {
      const aiStudio = (window as any).aistudio;
      if (typeof aiStudio !== 'undefined') {
        await aiStudio.openSelectKey();
        // Proceeding directly after triggering openSelectKey to avoid race condition as per guidelines.
        setView('form');
      }
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  const handleGenerateLook = async (userProfile: UserProfile) => {
    setProfile(userProfile);
    setView('loading');
    setError(null);

    try {
      const result = await BackendService.generateLook(userProfile);
      setLook(result);
      setView('result');
    } catch (err: any) {
      console.error(err);
      // Handle key issues by redirecting to auth view for re-selection.
      if (err.message?.includes("PERMISSION_DENIED") || err.message?.includes("Requested entity was not found")) {
        setError("Accès refusé. Veuillez sélectionner une clé API valide issue d'un projet avec facturation activée.");
        setView('auth');
      } else {
        setError("Désolé, une erreur est survenue lors de la génération de votre look. Veuillez réessayer.");
        setView('form');
      }
    }
  };

  const handleRegenerate = () => {
    if (profile) handleGenerateLook(profile);
  };

  const handleEdit = () => {
    setView('form');
  };

  return (
    <Layout>
      {view === 'auth' && (
        <div className="p-8 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 animate-fadeIn">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">Bienvenue</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Pour accéder au Styliste Virtuel haute fidélité, une clé API Google AI Studio (projet avec facturation) est requise.
            </p>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-blue-600 underline"
            >
              En savoir plus sur la facturation
            </a>
          </div>

          {error && (
            <div className="w-full p-4 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <button
            onClick={handleAuth}
            className="w-full py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all uppercase tracking-widest text-xs"
          >
            Sélectionner ma clé API
          </button>
        </div>
      )}

      {view === 'form' && (
        <>
          {error && (
            <div className="m-4 p-4 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          <Questionnaire onSubmit={handleGenerateLook} />
        </>
      )}

      {view === 'loading' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-6 text-center animate-pulse">
          <div className="relative">
             <div className="w-24 h-24 border-4 border-gray-100 border-t-black rounded-full animate-spin"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold">AI</span>
             </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold">Création de votre look...</h3>
            <p className="text-sm text-gray-500 max-w-[240px]">
              Génération du rendu photoréaliste en cours. Cela peut prendre quelques secondes.
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl text-[11px] text-gray-400 uppercase tracking-widest space-y-1">
             <p>Analyse de la silhouette...</p>
             <p>Matching catalogue...</p>
             <p>Appel Gemini 3 Pro Image...</p>
          </div>
        </div>
      )}

      {view === 'result' && look && (
        <ResultView 
          look={look} 
          onRegenerate={handleRegenerate} 
          onEdit={handleEdit} 
        />
      )}
    </Layout>
  );
};

export default App;
