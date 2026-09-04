import React from 'react';
import { motion } from 'framer-motion';
import { ImageOff, AlertCircle } from 'lucide-react';

const RISK_TONE = {
  LOW: {
    label: 'Low',
    tag: 'looks ordinary',
    numeral: 'I',
    color: '#4f8268',
    bg: 'bg-[#c6e3d4]',
    border: 'border-[#4f8268]',
  },
  MEDIUM: {
    label: 'Medium',
    tag: 'a few tells',
    numeral: 'II',
    color: '#c79a4d',
    bg: 'bg-[#f0d8a8]',
    border: 'border-[#c79a4d]',
  },
  HIGH: {
    label: 'High',
    tag: 'multiple tells',
    numeral: 'III',
    color: '#ff4d4d',
    border: 'border-marker-red',
  },
};

const CATEGORY_LABELS = {
  URGENCY: 'Urgency',
  ACCOUNT_VERIFICATION: 'Account · Verification',
  CREDENTIALS: 'Credentials',
  THREATS: 'Threats · Consequences',
  FINANCIAL: 'Financial',
  TRUST: 'Trust · Social Engineering',
};

const Stickynote = ({ children, color = 'bg-marker-yellow', rotate = '-rotate-1', className = '' }) => (
  <span
    className={`inline-block ${color} border-2 border-pencil px-3 py-1 font-hand text-sm wob-tag ${rotate} shadow-cut-sm ${className}`}
  >
    {children}
  </span>
);

const CaseTag = ({ numeral, label, rotate = '-rotate-1' }) => (
  <div className="flex items-center gap-3">
    <Stickynote rotate={rotate}>
      Case № {numeral} — {label}
    </Stickynote>
    <span className="hidden sm:block flex-1 border-t-2 border-dashed border-pencil/40" />
  </div>
);

const Field = ({ k, v }) => (
  <div className="flex items-baseline justify-between gap-3 py-2 border-b-2 border-dashed border-pencil/30 last:border-b-0">
    <span className="font-hand text-sm uppercase tracking-wider text-pencil/70">
      {k}
    </span>
    <span className="font-marker text-base text-pencil">{v}</span>
  </div>
);

const FindingsList = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <p className="font-hand text-xl text-pencil/70">
        nothing of note observed here.
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((finding, idx) => (
        <li key={idx} className="flex items-start gap-3 bg-white border-2 border-pencil wob-sm px-4 py-3 shadow-cut-sm hover:rotate-1 transition">
          <span className="font-marker text-sm text-marker-red mt-1 shrink-0">
            № {String(idx + 1).padStart(2, '0')}
          </span>
          <span className="font-hand text-lg text-pencil leading-snug">
            {finding}
          </span>
        </li>
      ))}
    </ul>
  );
};

const ResultsView = ({ data }) => {
  if (!data) return null;

  const { target_url, url, webpage, nlp, visual, overall } = data;
  const risk = overall?.risk || 'LOW';
  const score = overall?.score ?? 0;
  const tone = RISK_TONE[risk];

  const screenshotSrc = visual?.screenshot_b64
    ? `data:${visual.screenshot_mime || 'image/png'};base64,${visual.screenshot_b64}`
    : null;

  const urlFeats = url?.features || {};
  const wpFeats = webpage?.features || {};
  const visFeats = visual?.features || {};

  return (
    <div className="w-full space-y-16">
      {/* PRELIMINARY RISK ASSESSMENT */}
      <section>
        <CaseTag numeral="04" label="preliminary risk assessment" rotate="rotate-1" />

        <div className="mt-6 grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 lg:col-span-7 relative bg-white border-[3px] border-pencil shadow-cut wob-md p-7">
            <span className="tape" />
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-2 border-[2.5px] ${tone.border} px-3 py-1 font-hand text-sm wob-tag -rotate-1 bg-white shadow-cut-sm`}
              >
                <span
                  className="w-2.5 h-2.5 wob-circle"
                  style={{ background: tone.color, border: '1.5px solid #2d2d2d' }}
                />
                <span style={{ color: tone.color }}>{tone.label} risk</span>
              </span>
              <Stickynote rotate="-rotate-2">Verdict № {tone.numeral}</Stickynote>
            </div>

            <h2 className="mt-6 font-marker text-[80px] sm:text-[112px] leading-[0.9] text-pencil">
              {score}
              <span className="text-pencil/40 text-3xl align-top ml-2 font-hand">
                / 100
              </span>
            </h2>

            <p className="mt-5 font-hand text-2xl text-pencil max-w-xl leading-snug">
              {overall?.summary || tone.tag}.
            </p>

            <div className="mt-7 max-w-md">
              <p className="font-hand text-xs uppercase tracking-wider text-pencil/60">
                Subject under inspection
              </p>
              <p className="mt-2 font-marker text-base text-pencil break-all border-b-2 border-pencil pb-1">
                {target_url}
              </p>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5">
            <RiskDial score={score} risk={risk} />
            <p className="mt-3 font-hand text-sm text-pencil/60 italic border-t-2 border-dashed border-pencil/30 pt-3">
              0 — ordinary · 50 — suspicious · 100 — alarming
            </p>
          </div>
        </div>
      </section>

      {/* WHAT WE FOUND */}
      <section>
        <CaseTag numeral="05" label="what we found" rotate="-rotate-1" />
        <div className="mt-6">
          <FindingsList items={overall?.findings || []} />
        </div>
      </section>

      {/* SIGNAL BREAKDOWN */}
      <section>
        <CaseTag numeral="06" label="signal breakdown" rotate="rotate-2" />

        <div className="mt-8 grid grid-cols-12 gap-6">
          <SignalCard
            numeral="01"
            label="URL"
            score={url?.score ?? 0}
            available={!url?.blocked}
            rotation="-rotate-1"
          >
            {url?.blocked ? (
              <div className="flex items-start gap-2 text-marker-red">
                <AlertCircle className="w-4 h-4 mt-1 shrink-0" strokeWidth={2.5} />
                <span className="font-hand text-lg">{url.error}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 border-y-2 border-dashed border-pencil/40">
                  <Field k="https" v={urlFeats.is_https ? 'yes' : 'no'} />
                  <Field k="ip host" v={urlFeats.has_ip_hostname ? 'yes' : 'no'} />
                  <Field k="len" v={`${urlFeats.url_length ?? 0}`} />
                  <Field k="subs" v={`${urlFeats.subdomain_count ?? 0}`} />
                  <Field k="@" v={urlFeats.has_at_symbol ? 'yes' : 'no'} />
                  <Field k="shortener" v={urlFeats.is_shortener ? 'yes' : 'no'} />
                </div>
                <FindingsList items={url?.findings || []} />
              </>
            )}
          </SignalCard>

          <SignalCard
            numeral="02"
            label="Webpage"
            score={webpage?.score ?? 0}
            available={webpage?.available}
            rotation="rotate-1"
            className="lg:translate-y-6"
          >
            {!webpage?.available ? (
              <div>
                <p className="font-hand text-xl text-pencil">could not fetch the page.</p>
                <p className="font-hand text-sm text-pencil/60 mt-1">
                  {webpage?.error || 'reason unknown'}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 border-y-2 border-dashed border-pencil/40">
                  <Field k="forms" v={`${wpFeats.form_count ?? 0}`} />
                  <Field k="passwords" v={`${wpFeats.password_count ?? 0}`} />
                  <Field k="links" v={`${wpFeats.total_links ?? 0}`} />
                  <Field k="ext. links" v={`${wpFeats.external_links ?? 0}`} />
                  <Field k="scripts" v={`${wpFeats.script_count ?? 0}`} />
                  <Field k="redirects" v={`${wpFeats.redirect_count ?? 0}`} />
                </div>
                {wpFeats.page_title && (
                  <div className="border-l-4 border-pencil pl-3 mt-3">
                    <p className="font-hand text-xs uppercase tracking-wider text-pencil/60">
                      page title
                    </p>
                    <p className="font-marker text-lg text-pencil truncate">
                      {wpFeats.page_title}
                    </p>
                  </div>
                )}
                <FindingsList items={webpage?.findings || []} />
              </>
            )}
          </SignalCard>

          <SignalCard
            numeral="03"
            label="NLP"
            score={nlp?.score ?? 0}
            available={!!nlp && (nlp?.categories?.length > 0 || (nlp?.matched_phrases?.length ?? 0) > 0)}
            rotation="-rotate-2"
          >
            {nlp && nlp.categories && nlp.categories.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {nlp.categories.map((cat) => (
                    <Stickynote key={cat} color="bg-marker-yellow" rotate="-rotate-1">
                      {CATEGORY_LABELS[cat] || cat}
                    </Stickynote>
                  ))}
                </div>
                {nlp.matched_phrases && nlp.matched_phrases.length > 0 && (
                  <p className="font-hand text-base text-pencil leading-relaxed">
                    {nlp.matched_phrases.map((p, i) => (
                      <span key={i}>
                        <span className="bg-marker-yellow border-2 border-pencil px-1.5 py-0.5 wob-sm">
                          “{p}”
                        </span>
                        {i < nlp.matched_phrases.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </p>
                )}
              </>
            ) : (
              <p className="font-hand text-xl text-pencil/70">
                no linguistic pressure observed.
              </p>
            )}
            <FindingsList items={nlp?.findings || []} />
          </SignalCard>

          <SignalCard
            numeral="04"
            label="Vision"
            score={visual?.score ?? 0}
            available={!!(visual?.screenshot_b64 || visFeats.rendered)}
            rotation="rotate-2"
            className="lg:translate-y-6"
          >
            <div className="grid grid-cols-3 border-y-2 border-dashed border-pencil/40">
              <Field k="forms" v={`${visFeats.form_count ?? 0}`} />
              <Field k="pw" v={`${visFeats.password_field_count ?? 0}`} />
              <Field k="iframes" v={`${visFeats.iframe_count ?? 0}`} />
              <Field k="hidden" v={`${visFeats.hidden_element_count ?? 0}`} />
              <Field k="ext.res" v={`${visFeats.external_resource_count ?? 0}`} />
              <Field k="imgs" v={`${visFeats.image_count ?? 0}`} />
            </div>
            <FindingsList items={visual?.findings || []} />
            {!visual?.screenshot_b64 && visual?.available === false && (
              <p className="font-hand text-[11px] text-pencil/55 mt-2 italic">
                skipped because the deployment cannot launch a headless
                browser — not because the URL is safe.
              </p>
            )}
          </SignalCard>
        </div>
      </section>

      {/* RENDERED PAGE */}
      <section>
        <CaseTag numeral="07" label="rendered page" rotate="-rotate-2" />
        <div className="mt-6 relative bg-white border-[3px] border-pencil shadow-cut wob-md overflow-hidden">
          <span className="tape" />
          <div className="absolute top-3 left-4 right-4 z-10 flex items-center justify-between font-hand text-sm text-pencil/70">
            <span className="border-2 border-pencil border-dashed px-2 py-0.5 wob-sm">
              {visFeats.viewport_width || 1280} × {visFeats.viewport_height || 720}
            </span>
            {visFeats.http_status && (
              <span className="border-2 border-pencil border-dashed px-2 py-0.5 wob-sm">
                HTTP {visFeats.http_status}
              </span>
            )}
          </div>

          {screenshotSrc ? (
            <img
              src={screenshotSrc}
              alt="Rendered page screenshot"
              className="block w-full h-auto mt-12"
              loading="lazy"
            />
          ) : (
            <div
              data-testid="visual-unavailable-results"
              className="aspect-[16/9] flex flex-col items-center justify-center text-center p-10 mt-12"
            >
              <ImageOff className="w-10 h-10 text-pencil/50 mb-3" strokeWidth={2.5} />
              <p className="font-marker text-3xl text-pencil">Preview unavailable</p>
              <p className="font-hand text-sm text-pencil/70 mt-2 max-w-md">
                Live visual capture is not supported on this deployment.
              </p>
              <p className="font-hand text-xs text-pencil/55 mt-1 max-w-md italic">
                This is a platform limitation, not a verdict that the site
                is safe — URL, webpage, and NLP analysis still ran.
              </p>
              {visual?.error && (
                <p className="font-hand text-[11px] text-pencil/45 mt-3 max-w-sm border-t-2 border-dashed border-pencil/30 pt-2">
                  {visual.error}
                </p>
              )}
            </div>
          )}
        </div>
        <p className="mt-3 font-hand text-sm text-pencil/60 italic border-t-2 border-dashed border-pencil/30 pt-3">
          {screenshotSrc
            ? ''
            : '.'}
        </p>
      </section>

      {/* DISCLAIMER */}
      <section>
        <div className="bg-white border-2 border-pencil border-dashed wob-sm px-5 py-4">
          <p className="font-hand text-lg text-pencil/70 leading-relaxed">
            <strong className="font-marker">note — </strong>
            this is a preliminary heuristic assessment based on URL, webpage,
            language, and visual signals. It is <em className="not-italic text-marker-red">not</em> a phishing
            probability or certainty. Always verify before trusting a website
            with credentials.
          </p>
        </div>
      </section>
    </div>
  );
};

const RiskDial = ({ score, risk }) => {
  const stroke = risk === 'HIGH' ? '#ff4d4d' : risk === 'MEDIUM' ? '#c79a4d' : '#4f8268';
  const radius = 78;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-48 h-48 mx-auto lg:mx-0 -rotate-3">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} stroke="#e5e0d8" strokeWidth="8" fill="none" />
        <motion.circle
          cx="90"
          cy="90"
          r={radius}
          stroke={stroke}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-hand text-sm uppercase tracking-wider text-pencil/60">
          index
        </span>
        <span className="font-marker text-5xl text-pencil mt-1">{score}</span>
        <span className="font-hand text-xs text-pencil/60">/ 100</span>
      </div>
    </div>
  );
};

const SignalCard = ({ numeral, label, score, available, rotation, children, className = '' }) => (
  <div className={`col-span-12 md:col-span-6 lg:col-span-3 ${className}`}>
    <div className={`relative bg-white border-[3px] border-pencil shadow-cut wob-md p-5 ${rotation}`}>
      <span className="tack" />
      <div className="flex items-baseline gap-2">
        <span className="font-hand text-sm text-pencil/60">№ {numeral}</span>
        <span className="font-hand text-sm text-pencil/60">signal</span>
      </div>
      <h3 className="font-marker text-3xl text-pencil mt-1 leading-none">
        {label}
      </h3>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-marker text-4xl text-pencil leading-none">
          {available ? score : '—'}
        </span>
        <span className="font-hand text-sm text-pencil/60">
          {available ? '/ 100' : 'skipped'}
        </span>
      </div>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  </div>
);

export default ResultsView;