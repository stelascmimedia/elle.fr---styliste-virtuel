
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Questionnaire } from './components/Questionnaire';
import { ResultView } from './components/ResultView';
import { UserProfile, GeneratedLook } from './types';
import { BackendService } from './services/backend';

// Removed local aistudio declaration to resolve conflict with pre-defined AIStudio global type.
const LOADING_AD_VIDEO_SRC = '/ads/mock-loading-9x16.mp4';

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
    } catch (_err) {
      // no-op
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
      // Handle key issues by redirecting to auth view for re-selection.
      if (err.message?.includes("PERMISSION_DENIED") || err.message?.includes("Requested entity was not found")) {
        setError("AccÃ¨s refusÃ©. Veuillez sÃ©lectionner une clÃ© API valide issue d'un projet avec facturation activÃ©e.");
        setView('auth');
      } else if (err.message?.includes('Catalogue TradeDoubler indisponible')) {
        setError(`Source catalogue indisponible. ${err.message}`);
        setView('form');
      } else {
        const detail = err?.message ? ` Detail: ${err.message}` : '';
        setError(`Desole, une erreur est survenue lors de la generation de votre look. Veuillez reessayer.${detail}`);
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
              Pour accÃ©der au Styliste Virtuel haute fidÃ©litÃ©, une clÃ© API Google AI Studio (projet avec facturation) est requise.
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
            SÃ©lectionner ma clÃ© API
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
        <div className="w-full min-h-[78vh] flex flex-col justify-start bg-white">
          <div className="relative w-full">
            <div className="absolute top-3 left-3 z-20 bg-black/65 text-white text-[10px] tracking-wider uppercase px-2 py-1 rounded">
              Publicite
            </div>
            <div className="relative w-full aspect-[9/16] overflow-hidden bg-black">
              <video
                className="w-full h-full object-cover"
                src={LOADING_AD_VIDEO_SRC}
                autoPlay
                loop
                muted
                playsInline
              />
            </div>
          </div>

          <div className="px-5 py-4 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-black/80 animate-pulse"></span>
              <span className="text-[10px] text-gray-700 uppercase tracking-[0.2em]">Chargement</span>
            </div>

            <div className="space-y-1.5 text-[11px] text-gray-500 uppercase tracking-[0.15em]">
              <p>Analyse silhouette...</p>
              <p>Matching catalogue...</p>
              <p>Generation look final...</p>
            </div>
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

