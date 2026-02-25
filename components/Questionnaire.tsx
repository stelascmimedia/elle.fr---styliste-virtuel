import React, { useState } from 'react';
import { UserProfile, Usage, Style, Temperature, Rain, Fit } from '../types';

interface Props {
  onSubmit: (profile: UserProfile) => void;
}

const DEFAULT_AGE = 28;

export const Questionnaire: React.FC<Props> = ({ onSubmit }) => {
  const [formData, setFormData] = useState<UserProfile>({
    sex: 'femme',
    age: DEFAULT_AGE,
    usage: 'quotidien',
    style: 'casual',
    temperature: 'tempere',
    rain: 'non',
    budget: 500,
    fitPreference: 'droit',
  });

  const handleChange = (field: keyof UserProfile, value: UserProfile[keyof UserProfile]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit({
      ...formData,
      sex: 'femme',
      age: DEFAULT_AGE,
    });
  };

  return (
    <div className="p-6 space-y-8 animate-fadeIn">
      <div className="space-y-1">
        <h2 className="text-3xl font-bold">Votre Profil</h2>
        <p className="text-gray-500 text-sm">Definissez vos envies pour un look sur-mesure.</p>
      </div>

      <div className="space-y-6">
        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Usage</label>
          <div className="grid grid-cols-2 gap-2">
            {(['quotidien', 'travail', 'soiree', 'week-end'] as Usage[]).map((usage) => (
              <button
                key={usage}
                onClick={() => handleChange('usage', usage)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.usage === usage ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {usage.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Style souhaite</label>
          <div className="grid grid-cols-2 gap-2">
            {(['minimal', 'chic', 'sporty', 'boheme', 'casual', 'rock'] as Style[]).map((style) => (
              <button
                key={style}
                onClick={() => handleChange('style', style)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.style === style ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {style.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Meteo - Temperature</label>
          <div className="grid grid-cols-3 gap-2">
            {(['froid', 'tempere', 'chaud'] as Temperature[]).map((temperature) => (
              <button
                key={temperature}
                onClick={() => handleChange('temperature', temperature)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.temperature === temperature ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {temperature.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Meteo - Pluie</label>
          <div className="grid grid-cols-2 gap-2">
            {(['oui', 'non'] as Rain[]).map((rain) => (
              <button
                key={rain}
                onClick={() => handleChange('rain', rain)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.rain === rain ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {rain.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Coupe</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ajuste', 'droit', 'oversize'] as Fit[]).map((fit) => (
              <button
                key={fit}
                onClick={() => handleChange('fitPreference', fit)}
                className={`py-3 px-2 rounded-lg border text-xs font-medium transition-all ${
                  formData.fitPreference === fit ? 'bg-gray-100 border-black ring-1 ring-black' : 'bg-white border-gray-200'
                }`}
              >
                {fit.toUpperCase()}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Budget Max</label>
            <span className="text-lg font-bold">{formData.budget} EUR</span>
          </div>
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={formData.budget}
            onChange={(e) => handleChange('budget', parseInt(e.target.value, 10))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
          />
        </section>
      </div>

      <button
        onClick={handleSubmit}
        className="w-full py-5 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-2 group sticky bottom-4"
      >
        VOIR MON LOOK
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="group-hover:translate-x-1 transition-transform"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};
