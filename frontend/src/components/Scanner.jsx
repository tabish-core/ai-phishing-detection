import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, AlertCircle, RotateCcw } from 'lucide-react';
import ResultsView from './ResultsView';
import InvestigationScene from './InvestigationScene';
import VerdictMoment from './VerdictMoment';

const STAGE_ORDER = ['url', 'engine', 'webpage', 'nlp', 'vision', 'risk'];
const STAGE_INDEX = Object.fromEntries(STAGE_ORDER.map((id, i) => [id, i]));

const STAGES = [
  { id: 'url', label: 'URL', numeral: '01', hint: 'address', note: 'check the address' },
  { id: 'engine', label: 'Engine', numeral: '02', hint: 'dispatch', note: 'fan out' },
  { id: 'webpage', label: 'Webpage', numeral: '03', hint: 'fetch', note: 'open it' },
  { id: 'nlp', label: 'NLP', numeral: '04', hint: 'language', note: 'read between the lines' },
  { id: 'vision', label: 'Vision', numeral: '05', hint: 'render', note: 'eye the layout' },
  { id: 'risk', label: 'Risk', numeral: '06', hint: 'verdict', note: 'seal the case' },
];

const isLikelyUrl = (value) => {
  const v = value.trim();
  if (!v) return false;
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const u = new URL(v);
    return !!u.hostname && u.hostname.includes('.');
  } catch {
    return false;
  }
};

const HandArrow = ({ className = '' }) => (
  <svg
    className={className}
    viewBox="0 0 100 40"
    fill="none"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d="M 4 20 C 18 6, 38 6, 52 20 C 64 32, 80 30, 92 18"
      stroke="#2d2d2d"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeDasharray="4 4"
      fill="none"
    />
    <path d="M 86 14 L 94 18 L 88 24" stroke="#2d2d2d" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/* ---------- stage card (pinned-note look) ---------- */

const HandCheck = ({ className = '' }) => (
  <svg className={className} width="14" height="14" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path
      d="M 3 9 L 7 13 L 15 4"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const StageCard = ({ stage, state, rotate }) => {
  const isDone = state === 'done';
  const isActive = state === 'active';

  return (
    <li
      className={`relative bg-white border-[2.5px] wob-sm shadow-cut-sm px-4 py-5 ${rotate} transition-colors duration-300 ${isActive
        ? 'border-marker-red'
        : isDone
          ? 'border-pencil/70'
          : 'border-pencil/30'
        } ${isActive ? 'bg-marker-yellow/30' : isDone ? 'bg-paper-warm/50' : 'bg-white/70'}`}
    >
      <span className="tack" />
      <div className="flex items-baseline justify-between">
        <span
          className={`font-hand text-sm ${isActive ? 'text-marker-red' : isDone ? 'text-pencil/70' : 'text-pencil/35'
            }`}
        >
          № {stage.numeral}
        </span>
        {isDone && (
          <span className="inline-flex items-center gap-1 font-hand text-xs text-pencil/65">
            <HandCheck className="text-pencil/65" />
            done
          </span>
        )}
        {isActive && (
          <motion.span
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            className="inline-flex items-center gap-1 font-hand text-xs text-marker-red"
          >
            <motion.span
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-1.5 h-1.5 wob-circle bg-marker-red"
            />
            live
          </motion.span>
        )}
        {!isActive && !isDone && (
          <span className="font-hand text-xs text-pencil/30 italic">…</span>
        )}
      </div>
      <div
        className={`mt-2 font-marker text-2xl leading-none ${isActive ? 'text-pencil' : isDone ? 'text-pencil/80' : 'text-pencil/35'
          }`}
      >
        {stage.label}
      </div>
      <div
        className={`font-hand text-sm mt-1 italic ${isActive ? 'text-pencil/70' : isDone ? 'text-pencil/55' : 'text-pencil/30'
          }`}
      >
        {stage.hint}
      </div>
      {isActive && stage.note && (
        <div className="font-hand text-[11px] mt-2 text-marker-red -rotate-1">
          → {stage.note}
        </div>
      )}
    </li>
  );
};

const Scanner = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeStages, setActiveStages] = useState([]);
  const [analysisData, setAnalysisData] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const sceneRef = useRef(null);
  const scrollIntentRef = useRef(false);

  // After the Investigation Scene mounts, smooth-scroll to it so the user
  // is immediately watching the investigation rather than a fixed input.
  useEffect(() => {
    if (status !== 'scanning' && status !== 'verdict') return;
    if (!scrollIntentRef.current) return;
    scrollIntentRef.current = false;
    const handle = sceneRef.current;
    if (!handle) return;
    const node = handle?.getStageNode?.() || handle?.stageRef?.current;
    if (!node || typeof node.scrollIntoView !== 'function') return;
    // Two RAFs: first lets the scene mount, second lets layout settle.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch {
          node.scrollIntoView();
        }
      });
    });
  }, [status]);

  // When the backend finishes, accelerate the scene to its verdict beat so
  // the "CAUGHT" stamp aligns with the natural conclusion of the animation.
  // If the scene is already at or near the verdict, let it finish naturally.
  useEffect(() => {
    if (status !== 'verdict') return;
    const handle = sceneRef.current;
    if (!handle?.snapToVerdict) return;
    // Defer one frame so the scene is definitely mounted.
    const raf = requestAnimationFrame(() => {
      try {
        handle.snapToVerdict();
      } catch {
        /* no-op */
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [status]);

  const reset = () => {
    setStatus('idle');
    setErrorMsg(null);
    setValidationError(null);
    setActiveStages([]);
    setAnalysisData(null);
  };

  const handleInvestigate = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!isLikelyUrl(trimmed)) {
      setValidationError('Enter a valid HTTP or HTTPS URL.');
      return;
    }

    setValidationError(null);
    setStatus('scanning');
    setErrorMsg(null);
    setAnalysisData(null);
    setActiveStages(['url']);
    scrollIntentRef.current = true;

    const animPromise = (async () => {
      await new Promise((r) => setTimeout(r, 400));
      setActiveStages(['url', 'engine']);
      await new Promise((r) => setTimeout(r, 600));
      setActiveStages(['url', 'engine', 'webpage', 'nlp']);
      await new Promise((r) => setTimeout(r, 500));
      setActiveStages(['url', 'engine', 'webpage', 'nlp', 'vision']);
    })();

    try {
      // Same-origin in production (single Vercel project). In local dev the
      // Vite dev server proxies /api -> http://localhost:8000 (see
      // frontend/vite.config.js) so this same relative URL works.
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      await animPromise;
      setActiveStages(['url', 'engine', 'webpage', 'nlp', 'vision', 'risk']);

      setAnalysisData(data);
      setStatus('verdict');
    } catch (err) {
      setErrorMsg(
        err.message ||
        'Unable to analyze this website. Reason: the backend could not be reached.'
      );
      setStatus('error');
      setActiveStages(['url']);
    }
  };

  const isScanning = status === 'scanning' || status === 'verdict';
  const isStageActive = (id) => activeStages.includes(id);

  // Resolve a stage into one of three hand-drawn states:
  //   - 'done'    : all earlier stages are also active (completed)
  //   - 'active'  : it is the most-recently-added active stage
  //   - 'waiting' : it hasn't been reached yet
  const stageState = (stageId) => {
    const idx = STAGE_INDEX[stageId];
    const activeIdx = activeStages.length
      ? Math.max(...activeStages.map((id) => STAGE_INDEX[id] ?? -1))
      : -1;
    if (status === 'complete') return 'done';
    if (idx < activeIdx) return 'done';
    if (idx === activeIdx) return 'active';
    return 'waiting';
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col">
      {/* LENS / INPUT */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
        className="w-full mt-2"
      >
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-block bg-marker-yellow border-2 border-pencil px-3 py-1 font-hand text-sm wob-tag rotate-2 shadow-cut-sm">
            Case № 02 — place under lens
          </span>
          <span className="hidden sm:block flex-1 border-t-2 border-dashed border-pencil/40" />

        </div>

        <form
          onSubmit={handleInvestigate}
          className="relative bg-white border-[3px] border-pencil shadow-cut wob-md p-2"
        >
          {/* hand-drawn arrow */}
          <HandArrow className="hidden md:block absolute -top-12 right-12 w-24 h-12 -rotate-3" />

          {/* corner crop marks */}
          <span className="absolute -top-1.5 -left-1.5 w-3 h-3 border-l-2 border-t-2 border-pencil pointer-events-none" />
          <span className="absolute -top-1.5 -right-1.5 w-3 h-3 border-r-2 border-t-2 border-pencil pointer-events-none" />
          <span className="absolute -bottom-1.5 -left-1.5 w-3 h-3 border-l-2 border-b-2 border-pencil pointer-events-none" />
          <span className="absolute -bottom-1.5 -right-1.5 w-3 h-3 border-r-2 border-b-2 border-pencil pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-stretch">
            <div className="relative flex-1 flex items-center px-5 md:px-6 py-5">
              <div className="flex flex-col items-start mr-3 shrink-0">

                <span className="font-marker text-base uppercase tracking-wider text-pencil leading-tight mt-0.5 border-b-2 border-dashed border-pencil/40 pb-0.5">
                  URL
                </span>
              </div>
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="https://example.com"
                disabled={isScanning}
                autoComplete="off"
                spellCheck="false"
                className="flex-1 bg-transparent font-marker text-2xl md:text-3xl text-pencil placeholder:text-pencil/40 focus:outline-none disabled:opacity-50 min-h-[48px]"
              />
            </div>

            <button
              type="submit"
              disabled={isScanning || !url.trim()}
              className="press group md:rounded-none wob md:wob-tag md:[border-radius:0_18px_18px_0] bg-white text-pencil border-[3px] border-pencil border-l-0 md:border-l-[3px] px-6 py-5 md:py-0 md:min-w-[180px] min-h-[56px] flex items-center justify-center gap-3 font-hand text-xl shadow-cut hover:bg-marker-red hover:text-white hover:shadow-[2px_2px_0px_0px_#2d2d2d] active:shadow-cut-press active:translate-x-[4px] active:translate-y-[4px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isScanning ? (
                <span className="font-hand text-base uppercase tracking-wider">
                  working…
                </span>
              ) : (
                <>
                  <span className="uppercase tracking-[0.18em]">Investigate</span>
                  <ArrowUpRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={2.5} />
                </>
              )}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 inline-flex items-center gap-2 font-hand text-base text-marker-red border-2 border-marker-red/50 px-3 py-1 wob-sm"
            >
              <AlertCircle className="w-4 h-4" strokeWidth={2.5} />
              {validationError}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ERROR — investigation interrupted */}
      <AnimatePresence>
        {status === 'error' && errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mt-10 relative bg-white border-[3px] border-marker-red shadow-cut-red wob-md px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <span className="absolute -top-3 left-6 inline-block bg-marker-red text-white font-hand text-sm px-2 py-0.5 wob-tag -rotate-2 border-2 border-pencil">
              Investigation interrupted
            </span>
            <div className="flex items-start gap-3 mt-2 sm:mt-0">
              <AlertCircle className="w-5 h-5 text-marker-red shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="font-hand text-base text-pencil">{errorMsg}</p>
            </div>
            <button
              onClick={reset}
              className="press self-start sm:self-auto inline-flex items-center gap-2 wob-tag border-[2.5px] border-pencil bg-white px-4 py-1.5 font-hand hover:bg-marker-yellow shadow-cut-sm hover:shadow-[2px_2px_0px_0px_#2d2d2d]"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} /> Try again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SCANNING — animated investigation scene + verdict bridge */}
      <div className="relative">
        <AnimatePresence>
          {(status === 'scanning' || status === 'verdict') && (
            <motion.div
              key="scene"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scaleY: 0.04, y: -10 }}
              transition={
                status === 'verdict'
                  ? { duration: 0.55, ease: [0.4, 0, 0.2, 1] }
                  : { duration: 0.5, ease: 'easeOut' }
              }
              style={{ transformOrigin: 'top center' }}
              className="relative"
            >
              <InvestigationScene
                ref={sceneRef}
                url={url.trim()}
                screenshotB64={analysisData?.visual?.screenshot_b64}
                screenshotMime={analysisData?.visual?.screenshot_mime}
                visualUnavailable={
                  !!analysisData &&
                  !analysisData?.visual?.screenshot_b64 &&
                  (analysisData?.visual?.available === false ||
                    !!analysisData?.visual?.error)
                }
              />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {status === 'verdict' && analysisData && (
            <VerdictMoment
              key="verdict"
              risk={analysisData?.risk_level}
              onDone={() => setStatus('complete')}
            />
          )}
        </AnimatePresence>
      </div>


      {/* INVESTIGATION PATH */}
      <section className="w-full mt-14">
        <div className="flex items-center gap-3 mb-5">
          <span className="inline-block bg-marker-yellow border-2 border-pencil px-3 py-1 font-hand text-sm wob-tag -rotate-1 shadow-cut-sm">
            Case № 03 — investigation path
          </span>
          <span className="hidden sm:block flex-1 border-t-2 border-dashed border-pencil/40" />
          <span className="font-hand text-sm text-pencil/70">
            {isScanning ? 'in motion' : status === 'complete' ? 'sealed' : 'idle'}
          </span>
        </div>

        {/* desktop path with hand-drawn connectors and irregular offsets */}
        <div className="hidden md:block relative">
          {/* dashed connector line behind the cards */}
          <svg
            className="absolute left-0 right-0 pointer-events-none"
            style={{ top: '40%', height: '40px' }}
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 10 28 C 120 8, 220 32, 330 16 S 540 30, 660 14 S 880 32, 1000 18 S 1160 28, 1190 22"
              stroke="#2d2d2d"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="3 5"
              fill="none"
              opacity="0.4"
            />
          </svg>

          <ol className="relative grid grid-cols-6 gap-3">
            {STAGES.map((stage, i) => {
              const rotations = ['-rotate-2', 'rotate-1', '-rotate-1', 'rotate-2', '-rotate-2', 'rotate-1'];
              const offsets = ['mt-0', 'lg:mt-6', 'mt-0', 'lg:mt-4', 'mt-0', 'lg:mt-2'];
              return (
                <li
                  key={stage.id}
                  className={`${offsets[i]} ${i === 2 ? 'lg:col-span-1' : ''}`}
                >
                  <StageCard
                    stage={stage}
                    state={stageState(stage.id)}
                    rotate={rotations[i]}
                  />
                </li>
              );
            })}
          </ol>
        </div>

        {/* mobile */}
        <ol className="md:hidden flex flex-col gap-3">
          {STAGES.map((stage, i) => {
            const rotations = ['-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1', '-rotate-1', 'rotate-1'];
            return (
              <StageCard
                key={stage.id}
                stage={stage}
                state={stageState(stage.id)}
                rotate={rotations[i % rotations.length]}
              />
            );
          })}
        </ol>
      </section>

      <AnimatePresence>
        {status === 'complete' && analysisData && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1], delay: 0.05 }}
            className="w-full mt-16"
          >
            <ResultsView data={analysisData} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Scanner;