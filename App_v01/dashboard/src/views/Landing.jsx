import React from 'react';
import { Radar, FileText, Library, Share2, Timer } from 'lucide-react';
import { Card } from '../ds/index.js';
import { AnimatedNumber } from '../components/shared.jsx';
import { kpis, rangeBounds, fmtWeek } from '../data/derive.js';

const OWNER_URL = 'https://www.dacora.eu';
const IMPRESSUM_URL = 'https://www.dacora.eu';

function Stat({ icon: Icon, label, value, decimals, suffix, foot }) {
  return (
    <Card padding={24}>
      <div className="kpi-label"><Icon size={14} strokeWidth={2.5} />{label}</div>
      <div className="kpi-value">
        {value == null ? '–' : <AnimatedNumber value={value} decimals={decimals} />}
        {suffix && value != null && <small>{suffix}</small>}
      </div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </Card>
  );
}

const STEPS = [
  ['Collect', 'We crawl the outlets that carry Kremlin narratives, safely. Every record keeps its source and fetch time, and fetched text is treated as data, never as instructions.'],
  ['Match', 'Each article is checked against a codebook of known narratives. A person reviews the hits before anything counts as a match.'],
  ['Time', 'First-seen per outlet turns a story into a timeline. The gap between the first mention and the mainstream is the lead time, in days.'],
];

/**
 * Start page: the gist in plain words, the live numbers as proof, one call to action.
 * Shown once per session; the sidebar's "Start" item brings it back.
 */
export function Landing({ data, onEnter }) {
  const [lo, hi] = rangeBounds(data.weeks, 'all');
  const k = kpis(data, 'all', lo, hi);
  const lagH = k.medianLag;
  const first = fmtWeek(data.weeks[0]);
  const last = fmtWeek(data.weeks[data.weeks.length - 1]);
  const year = data.weeks[data.weeks.length - 1].end.slice(0, 4);

  return (
    <div className="landing">
      <header className="landing-top">
        <div className="wordmark landing-wordmark"><Radar size={22} strokeWidth={2.5} />Foreshock</div>
        <button type="button" className="btn-primary" onClick={() => onEnter()}>Open the monitor</button>
      </header>

      <section className="landing-hero">
        <div className="eyebrow">A DACORA project · with AIES</div>
        <h1 className="landing-title">We track when a narrative is created, and how fast it spreads.</h1>
        <p className="landing-lede">
          Russian disinformation in German-language media, before and after it happens: where a story first shows up,
          who repeats it, and how many days later it reaches the mainstream and parliament.
        </p>
        <div className="landing-cta">
          <button type="button" className="btn-primary" onClick={() => onEnter()}>Open the monitor</button>
          <button type="button" className="btn-ghost" onClick={() => onEnter('origin')}>See who influences whom</button>
        </div>
      </section>

      <section className="grid grid-kpi landing-kpis" aria-label="Live numbers">
        <Stat icon={Library} label="Outlets scanned" value={k.sources} foot={<>{first} – {last} {year}</>} />
        <Stat icon={FileText} label="Matching articles" value={k.hits} foot={<>{k.hitsPer100.toFixed(1)} per 100 scanned</>} />
        <Stat icon={Share2} label="Pickups between outlets" value={k.observedEdges} foot={<>seen in the crawl</>} />
        <Stat icon={Timer} label="Typical delay" value={lagH == null ? null : (lagH >= 48 ? lagH / 24 : lagH)} decimals={1}
          suffix={lagH == null ? null : (lagH >= 48 ? 'days' : 'hours')} foot={<>first publish to first repeat</>} />
      </section>

      <section className="landing-how" aria-label="How it works">
        {STEPS.map(([title, copy], i) => (
          <div className="how-step" key={title}>
            <span className="how-num">{i + 1}</span>
            <h2 className="how-title">{title}</h2>
            <p className="how-copy">{copy}</p>
          </div>
        ))}
      </section>

      <footer className="landing-foot">
        <span>Foreshock is built and operated by <a href={OWNER_URL}>DACORA</a>, with AIES.</span>
        <span><a href={IMPRESSUM_URL}>Impressum</a> · <a href={OWNER_URL}>www.dacora.eu</a></span>
      </footer>
    </div>
  );
}
