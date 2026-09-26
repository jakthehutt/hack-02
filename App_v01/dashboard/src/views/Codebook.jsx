import React from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';
import { Card, Badge, Button, Dialog, Input, Tag } from '../ds/index.js';
import { CardHead, Highlighted, compilePattern } from '../components/shared.jsx';
import { fmtNum } from '../data/derive.js';

const SAMPLES = [
  'Deutschland ist der größte Geldgeber des Kiewer Regimes.',
  'Die Russophobie in Berlin führt direkt in die Deindustrialisierung.',
  'Tanker meiden die Straße von Hormus, Nord Stream bleibt zerstört.',
  'Причина этого – русофобский курс киевского режима.',
];

function Guidelines({ text }) {
  const [pro, con] = text.split(/\nAbgelehnt:/);
  const clean = s => s.replace(/^Befürwortet:\s*/, '').replace(/\*\*/g, '').trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', font: 'var(--font-body-md)' }}>
      <div><Badge tone="danger">Matches the narrative</Badge><p style={{ margin: 'var(--space-2) 0 0' }}>{clean(pro)}</p></div>
      {con && <div><Badge tone="success">Counter-position</Badge><p style={{ margin: 'var(--space-2) 0 0' }}>{clean(con)}</p></div>}
    </div>
  );
}

export function Codebook({ data }) {
  const [text, setText] = React.useState(SAMPLES[0]);
  const [open, setOpen] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = e => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const totals = Object.fromEntries(data.series.map(se => [se.id, data.sources.reduce((a, s) => a + (s.series.find(x => x.id === se.id)?.article_count || 0), 0)]));
  const hits = new Set(data.series.filter(se => {
    const re = se.pattern && compilePattern(se.pattern, 'iu');
    return re && re.test(text);
  }).map(se => se.id));
  const matched = data.series.filter(se => hits.has(se.id));

  return (
    <>
      <Card padding={28} style={{ background: 'var(--surface-sunken)' }}>
        <CardHead title="Pattern tester" sub="Paste a sentence in German or Russian. It runs against the live codebook patterns, like the scanner does.">
          <FlaskConical size={22} />
        </CardHead>
        <Input label="Sentence" value={text} onChange={setText} placeholder="Paste a sentence to test" />
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
          {SAMPLES.map(s => <button key={s} className="chip" aria-pressed={s === text} onClick={() => setText(s)}>{s.slice(0, 34)}…</button>)}
        </div>
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>{matched.length ? `${matched.length} frame${matched.length > 1 ? 's' : ''} matched` : 'No frame matched'}</div>
          <div className="tester-out">
            {matched.map(se => <Badge key={se.id} tone="primary">{se.label}</Badge>)}
          </div>
          {matched.length > 0 && (
            <p style={{ font: 'var(--font-body-lg)', margin: 'var(--space-3) 0 0' }}>
              <Highlighted text={text} pattern={matched.map(m => `(?:${m.pattern})`).join('|')} />
            </p>
          )}
        </div>
      </Card>

      <div>
        <h3 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Frames and subjects</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-5)' }}>
          {data.series.map(se => {
            const hit = hits.has(se.id);
            return (
              <div key={se.id} className={`frame-card${hit ? ' is-hit' : ''}`}>
                <Card padding={20} style={{ height: '100%', borderColor: hit ? 'var(--accent-primary)' : undefined, boxShadow: hit ? 'var(--shadow-hard-accent-md)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-2)' }}>
                    <span className="row-title">{se.label}</span>
                    <Badge tone={se.kind === 'frame' ? 'neutral' : 'primary'}>{se.kind}</Badge>
                  </div>
                  <div className="row-sub" style={{ margin: 'var(--space-2) 0 var(--space-3)' }}>Target: {se.target} · <span className="mono">{fmtNum(totals[se.id])}</span> matches</div>
                  <div className="pattern">{se.pattern}</div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="card-title">Reference narratives</h3>
        <p className="card-sub" style={{ marginBottom: 'var(--space-4)' }}>{data.dsn_meta.publisher}, {data.dsn_meta.source}. The frames above are the scanner’s evidence for these.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
          {data.dsn_narratives.map(n => (
            <Card key={n.id} interactive padding={24}>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
                <span className="hm-rank">N{n.id}</span>
                <Tag>{n.category_topic.replace(/_/g, ' ')}</Tag>
              </div>
              <p style={{ font: '600 var(--text-md)/var(--leading-snug) var(--font-display)', margin: '0 0 var(--space-5)' }}>{n.narrative_statement}</p>
              <Button variant="secondary" size="sm" icon={<BookOpen size={14} />} onClick={() => setOpen(n)}>Read guidelines</Button>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!open} title={open?.narrative_statement} onClose={() => setOpen(null)} style={{ width: 'min(640px, 92vw)', maxHeight: '86vh', overflow: 'auto' }}
        actions={<Button variant="primary" onClick={() => setOpen(null)}>Done</Button>}>
        {open && (
          <>
            <p style={{ marginTop: 0 }}>{open.category_description}</p>
            <Guidelines text={open.narrative_guidelines} />
          </>
        )}
      </Dialog>
    </>
  );
}
