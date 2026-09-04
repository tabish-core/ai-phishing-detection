import React from 'react';
import Header from './components/Header';
import Hero from './components/Hero';
import Scanner from './components/Scanner';

function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 pt-4 pb-24">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 flex flex-col gap-2">
          <Hero />
          <Scanner />
        </div>
      </main>

      <footer className="relative border-t-2 border-dashed border-pencil/30 mt-12">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-8 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
            <div>
              <div className="font-marker text-2xl text-pencil leading-none">
                CaughtIn4K
              </div>
              <div className="font-hand text-[12px] uppercase tracking-[0.22em] text-pencil/65 mt-1.5">
                AI-powered phishing detection
              </div>
            </div>
            <div className="font-hand text-lg text-pencil/80 italic max-w-md sm:text-right">
              "Investigate before you trust."
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-4 border-t-2 border-dashed border-pencil/25">
            <div className="font-hand text-sm text-pencil/70 flex flex-wrap items-center gap-2">
              <span>A project by</span>
              <span className="font-marker text-pencil">
                Tabish <span className="text-marker-red">×</span> Suhairah
              </span>
              <span>·</span>
              <span>Iqra University</span>
              <span>·</span>
              <span>2026</span>
            </div>

          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
