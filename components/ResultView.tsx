import React, { useEffect, useMemo, useState } from 'react';
import { GeneratedLook, LookVariant } from '../types';

interface Props {
  look: GeneratedLook;
  onRegenerate: () => void;
  onEdit: () => void;
}

export const ResultView: React.FC<Props> = ({ look, onRegenerate, onEdit }) => {
  const allLooks = useMemo<LookVariant[]>(
    () => [{ imageUrl: look.imageUrl, outfit: look.outfit, totalPrice: look.totalPrice }, ...(look.alternatives || [])],
    [look],
  );
  const [activeLookIndex, setActiveLookIndex] = useState(0);

  useEffect(() => {
    setActiveLookIndex(0);
  }, [look]);

  const activeLook = allLooks[activeLookIndex] || allLooks[0];

  return (
    <div className="animate-fadeIn">
      {/* Generated Image Hero */}
      <div className="relative aspect-[9/16] bg-gray-200">
        <img
          src={activeLook.imageUrl}
          alt="Votre look genere"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Total du look</p>
              <h3 className="text-white text-3xl font-bold">{activeLook.totalPrice} EUR</h3>
            </div>
            <button
              onClick={onRegenerate}
              className="bg-white/20 backdrop-blur-md text-white p-3 rounded-full hover:bg-white/30 transition-colors"
              title="Regenerer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Product List */}
      <div className="p-6 space-y-6">
        {allLooks.length > 1 && (
          <div className="space-y-3">
            <h4 className="text-lg font-bold">Autres silhouettes</h4>
            <div className="grid grid-cols-5 gap-2">
              {allLooks.map((variant, index) => (
                <button
                  key={`${variant.imageUrl}-${index}`}
                  onClick={() => setActiveLookIndex(index)}
                  className={`relative aspect-[9/16] overflow-hidden rounded-lg border transition-all ${index === activeLookIndex ? 'border-black ring-2 ring-black/20' : 'border-gray-200 hover:border-gray-400'}`}
                  title={`Silhouette ${index + 1}`}
                >
                  <img src={variant.imageUrl} alt={`Silhouette ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h4 className="text-lg font-bold">Pieces selectionnees</h4>
          <span className="text-xs text-gray-400">{activeLook.outfit.length} articles</span>
        </div>

        <div className="space-y-4">
          {activeLook.outfit.map((product) => (
            <div key={product.id} className="flex gap-4 p-3 border border-gray-100 rounded-xl hover:shadow-md transition-shadow">
              <div className="w-20 h-28 bg-gray-50 rounded-lg overflow-hidden flex-shrink-0">
                <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col justify-between flex-1">
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{product.brand}</div>
                  <h5 className="text-sm font-semibold line-clamp-2 leading-tight">{product.title}</h5>
                </div>
                <div className="flex justify-between items-end">
                  <span className="font-bold text-lg">{product.price} EUR</span>
                  <a
                    href={product.affiliateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-600 border-b border-blue-600 pb-0.5"
                  >
                    Acheter
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-8 pb-12 flex flex-col gap-3">
          <button
            onClick={onEdit}
            className="w-full py-4 border-2 border-black text-black font-bold rounded-xl hover:bg-black hover:text-white transition-all uppercase tracking-widest text-xs"
          >
            Modifier mon profil
          </button>
          <p className="text-[10px] text-gray-400 text-center italic">
            * Les images sont generees par IA et peuvent varier legerement des produits reels.
          </p>
        </div>
      </div>
    </div>
  );
};
