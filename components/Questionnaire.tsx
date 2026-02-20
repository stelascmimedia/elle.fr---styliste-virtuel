
import React, { useState } from 'react';
import { UserProfile, Gender, Style, Weather, Audacity, Fit } from '../types';

interface Props {
  onSubmit: (profile: UserProfile) => void;
}

export const Questionnaire: React.FC<Props> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<UserProfile>({
    sex: 'femme',
    age: 28,
    style: 'smart chic',
    season_meteo: 'normal',
    budget: 500,
    audace: 'moyen',
    colorPreference: '#000000',
    fitPreference: 'ajustée'
  });

  const handleChange = (field: keyof UserProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="p-6 space-y-8 animate-fadeIn">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold">Votre Profil</h2>
        <p className="text-gray-500 text-sm">Définissez vos envies pour un look sur-mesure.</p>
      </div>

      <div className="space-y-6">
        {/* Sexe */}
        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Genre</label>
          <div className="flex gap-2">
            {(['femme', 'homme'] as Gender[]).map(s => (
              <button
                key={s}
                onClick={() => handleChange('sex', s)}
                className={`flex-1 py-3 px-4 rounded-full border transition-all text-sm font-medium ${
                  formData.sex === s ? 'bg-black text-white border-black' : 'bg-white text-black border-gray-200 hover:border-black'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </section>

        {/* Style */}
        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Style souhaité</label>
          <div className="grid grid-cols-2 gap-2">
            {(['décontracté', 'smart chic', 'business', 'habillé'] as Style[]).map(s => (
              <button
                key={s}
                onClick={() => handleChange('style', s)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.style === s ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        {/* Budget */}
        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Budget Max</label>
            <span className="text-lg font-bold">{formData.budget}€</span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={formData.budget}
            onChange={(e) => handleChange('budget', parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
          />
        </section>

        <div className="grid grid-cols-2 gap-4">
          {/* Météo */}
          <section className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Météo</label>
            <select
              value={formData.season_meteo}
              onChange={(e) => handleChange('season_meteo', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm"
            >
              {(['froid', 'normal', 'pluvieux', 'chaud'] as Weather[]).map(w => (
                <option key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</option>
              ))}
            </select>
          </section>

          {/* Audace */}
          <section className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Audace</label>
            <select
              value={formData.audace}
              onChange={(e) => handleChange('audace', e.target.value)}
              className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm"
            >
              {(['faible', 'moyen', 'élevé'] as Audacity[]).map(a => (
                <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
              ))}
            </select>
          </section>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Couleur */}
          <section className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Couleur phare</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={formData.colorPreference}
                onChange={(e) => handleChange('colorPreference', e.target.value)}
                className="w-10 h-10 border-none rounded cursor-pointer"
              />
              <span className="text-xs font-mono">{formData.colorPreference.toUpperCase()}</span>
            </div>
          </section>

          {/* Coupe */}
          <section className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Coupe</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              {(['ajustée', 'ample'] as Fit[]).map(f => (
                <button
                  key={f}
                  onClick={() => handleChange('fitPreference', f)}
                  className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${
                    formData.fitPreference === f ? 'bg-white shadow-sm' : 'text-gray-400'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>

      <button
        onClick={() => onSubmit(formData)}
        className="w-full py-5 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group sticky bottom-4"
      >
        VOIR MON LOOK
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:translate-x-1 transition-transform">
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      </button>
    </div>
  );
};
