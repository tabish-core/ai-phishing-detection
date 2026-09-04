import React from 'react';
import Mark from './Mark';

const Header = () => {
  return (
    <header className="relative">
      <div className="mx-auto max-w-6xl px-6 lg:px-10 pt-6">
        <div className="relative bg-paper-warm border-[2.5px] border-pencil shadow-cut px-5 py-4 wob-md">
          <span className="tape" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* brand */}
            <div className="flex items-center gap-3">
              <Mark size={36} />
              <div className="flex flex-col leading-none">
                <span className="font-marker text-[28px] sm:text-[30px] text-pencil tracking-tight">
                  CaughtIn4K
                </span>
                <span className="font-hand text-[11px] sm:text-[12px] uppercase tracking-[0.22em] text-pencil/100 mt-0.5">
                  AI-powered phishing detection
                </span>
              </div>
            </div>

            {/* identity strip */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="hidden md:flex items-center gap-2">
                <span className="font-hand text-[12px] uppercase tracking-[0.18em] text-pencil/55">
                  by
                </span>
                <span className="font-marker text-[20px] text-pencil">
                  Tabish <span className="text-marker-red">×</span> Suhairah
                </span>

              </div>
              <div className="flex items-center gap-2 -rotate-1 ml-auto sm:ml-0">
                <span className="relative inline-block w-2.5 h-2.5 rounded-full wob-circle bg-marker-red border border-pencil animate-bounce2" />
                <span className="font-hand text-1xl text-pencil">
                  Iqra University
                </span>
              </div>
            </div>
          </div>

          {/* mobile author line */}
          <div className="md:hidden mt-3 pt-3 border-t-2 border-dashed border-pencil/25 flex items-center justify-center gap-2 flex-wrap font-hand text-[12px] text-pencil/70">
            <span>by</span>
            <span className="font-marker text-pencil">
              Tabish <span className="text-marker-red">×</span> Suhairah
            </span>

          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
