
import React from 'react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen max-w-md mx-auto bg-white shadow-xl relative overflow-hidden flex flex-col">
      <header className="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <h1 className="text-2xl font-bold tracking-tighter uppercase italic">ELLE</h1>
        <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400">Styliste Virtuel</div>
      </header>
      <main className="flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </main>
    </div>
  );
};
