'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowDownToLine, ArrowUp, ArrowUpFromLine, Camera, ChartCandlestick, Check, ClipboardCheck,
  FileJson, Image as ImageIcon, Pencil, Plus, Search, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Bias = 'Bullish' | 'Bearish' | 'Ranging';
type Verdict = 'Ready' | 'Caution' | 'No trade';
type SetupGrade = 'A' | 'B' | 'C';
type CandleDirection = 'Bullish' | 'Bearish';
type RangeBreak = 'Above' | 'Below';
type GapDirection = 'Above' | 'Below';
type TimeframeCheck = { timeframe: string; structure: Bias; fvg: boolean; wickless: boolean };
type Session = {
  id: string; createdAt: string; date: string; market: string; session: string; orbMinutes: string;
  timeframeChecks: TimeframeCheck[]; keyLevels: boolean; newsClear: boolean; gapIdentified?: boolean; gapDirection?: GapDirection; rangeValue: string;
  openingCandle: CandleDirection; rangeBreak?: RangeBreak; riskDefined: boolean;
  verdict: Verdict; setupGrade?: SetupGrade; notes: string; screenshots: string[];
};

const STORE_KEY = 'orb-journal-sessions-v1';
const timeframes = ['4H', '1H', '15M', '5M'];
const newChecks = (): TimeframeCheck[] => timeframes.map((timeframe) => ({
  timeframe, structure: 'Ranging', fvg: false, wickless: false,
}));
const today = () => new Date().toISOString().slice(0, 10);

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" onClick={onChange} className={`check-tile ${checked ? 'is-checked' : ''}`} aria-pressed={checked}>
      <span className="check-box">{checked && <Check size={13} strokeWidth={3} />}</span><span>{label}</span>
    </button>
  );
}

function BiasPicker({ value, onChange }: { value: Bias; onChange: (value: Bias) => void }) {
  return (
    <div className="bias-picker" aria-label="Market structure">
      {(['Bullish', 'Ranging', 'Bearish'] as Bias[]).map((bias) => (
        <button type="button" key={bias} onClick={() => onChange(bias)}
          className={value === bias ? `active ${bias.toLowerCase()}` : ''}>{bias}</button>
      ))}
    </div>
  );
}

export default function Home() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [date, setDate] = useState(today());
  const [market, setMarket] = useState('Nas');
  const [session, setSession] = useState('New York');
  const [orbMinutes, setOrbMinutes] = useState('15');
  const [checks, setChecks] = useState<TimeframeCheck[]>(newChecks);
  const [keyLevels, setKeyLevels] = useState(false);
  const [newsClear, setNewsClear] = useState(false);
  const [gapIdentified, setGapIdentified] = useState(false);
  const [gapDirection, setGapDirection] = useState<GapDirection | ''>('');
  const [rangeValue, setRangeValue] = useState('');
  const [openingCandle, setOpeningCandle] = useState<CandleDirection>('Bullish');
  const [rangeBreak, setRangeBreak] = useState<RangeBreak | ''>('');
  const [riskDefined, setRiskDefined] = useState(false);
  const [verdict, setVerdict] = useState<Verdict>('Ready');
  const [setupGrade, setSetupGrade] = useState<SetupGrade | ''>('');
  const [notes, setNotes] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) setSessions(JSON.parse(stored));
    } catch { setMessage('Saved data could not be read. Import a backup to restore it.'); }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(sessions)); }
    catch { setMessage('Browser storage is full. Export your journal, then remove older screenshots.'); }
  }, [sessions, hydrated]);

  const completed = useMemo(() => {
    const tf = checks.reduce((sum, check) => sum + Number(check.fvg) + Number(check.wickless), 0);
    return tf + [keyLevels, newsClear, gapIdentified, riskDefined].filter(Boolean).length;
  }, [checks, keyLevels, newsClear, gapIdentified, riskDefined]);
  const alignment = useMemo(() => {
    const structures = checks.map((check) => check.structure);
    if (structures.every((structure) => structure === 'Bullish')) {
      return { label: 'Fully bullish', detail: 'All four timeframes are aligned bullish.', tone: 'bullish' };
    }
    if (structures.every((structure) => structure === 'Bearish')) {
      return { label: 'Fully bearish', detail: 'All four timeframes are aligned bearish.', tone: 'bearish' };
    }
    if (structures.every((structure) => structure === 'Ranging')) {
      return { label: 'Ranging environment', detail: 'No directional structure is present across the timeframes.', tone: 'ranging' };
    }
    if (structures[0] === structures[1] && structures[0] !== 'Ranging') {
      return { label: `${structures[0]} higher-timeframe alignment`, detail: 'The 4H and 1H agree; the lower timeframes are mixed.', tone: structures[0].toLowerCase() };
    }
    return { label: 'Mixed structure', detail: 'The higher timeframes are not directionally aligned.', tone: 'mixed' };
  }, [checks]);
  const filtered = sessions.filter((item) =>
    `${item.market} ${item.session} ${item.date} ${item.verdict} ${item.setupGrade ?? ''}`.toLowerCase().includes(query.toLowerCase()));
  const updateCheck = (index: number, patch: Partial<TimeframeCheck>) =>
    setChecks((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));

  const addScreenshots = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, 4 - screenshots.length);
    const encoded = await Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject;
      reader.readAsDataURL(file);
    })));
    setScreenshots((current) => [...current, ...encoded].slice(0, 4));
    event.target.value = '';
  };

  const resetForm = () => {
    setDate(today()); setChecks(newChecks()); setKeyLevels(false);
    setNewsClear(false); setGapIdentified(false); setGapDirection(''); setRangeValue(''); setOpeningCandle('Bullish'); setRangeBreak(''); setRiskDefined(false);
    setVerdict('Ready'); setSetupGrade(''); setNotes(''); setScreenshots([]);
  };

  const editSession = (item: Session) => {
    setEditingId(item.id); setDate(item.date); setMarket(item.market); setSession(item.session);
    setOrbMinutes(item.orbMinutes); setChecks(item.timeframeChecks.map((check) => ({ ...check })));
    setKeyLevels(item.keyLevels); setNewsClear(item.newsClear); setGapIdentified(Boolean(item.gapIdentified));
    setGapDirection(item.gapDirection ?? ''); setRangeValue(item.rangeValue ?? '');
    setOpeningCandle(item.openingCandle ?? 'Bullish'); setRangeBreak(item.rangeBreak ?? '');
    setRiskDefined(item.riskDefined); setVerdict(item.verdict); setSetupGrade(item.setupGrade ?? ''); setNotes(item.notes ?? '');
    setScreenshots([...(item.screenshots ?? [])]); setMessage('Editing saved session.');
    document.getElementById('new-session')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const cancelEdit = () => {
    setEditingId(null); resetForm(); setMessage('Editing cancelled.');
  };

  const saveSession = (event: FormEvent) => {
    event.preventDefault();
    const original = editingId ? sessions.find((item) => item.id === editingId) : undefined;
    const record: Session = {
      id: original?.id ?? crypto.randomUUID(), createdAt: original?.createdAt ?? new Date().toISOString(), date, market,
      session, orbMinutes, timeframeChecks: checks, keyLevels, newsClear, gapIdentified,
      gapDirection: gapIdentified && gapDirection ? gapDirection : undefined, rangeValue, openingCandle,
      rangeBreak: rangeBreak || undefined,
      riskDefined, verdict, setupGrade: setupGrade || undefined, notes, screenshots,
    };
    setSessions((current) => editingId ? current.map((item) => item.id === editingId ? record : item) : [record, ...current]);
    setEditingId(null); resetForm(); setMessage(original ? 'Session updated.' : 'Session saved locally.');
  };

  const exportJson = () => {
    const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessions }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `session-prep-${today()}.json`;
    anchor.click(); URL.revokeObjectURL(url);
    setMessage(`${sessions.length} session${sessions.length === 1 ? '' : 's'} exported.`);
  };

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()); const imported = Array.isArray(parsed) ? parsed : parsed.sessions;
      if (!Array.isArray(imported)) throw new Error('Invalid journal');
      setSessions(imported); setMessage(`${imported.length} sessions imported. This replaced the current journal.`);
    } catch { setMessage('That file is not a valid Session Prep export.'); }
    event.target.value = '';
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true"><ChartCandlestick /></div>
        <div><p className="eyebrow">TRADING WORKSPACE</p><h1>Session Prep</h1></div>
        <div className="topbar-actions">
          <div className="topbar-progress" role="progressbar" aria-label="Checklist progress" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={12}>
            <div><span>Progress</span><strong>{completed}/12</strong></div>
            <div className="topbar-progress-track"><i style={{ width: `${Math.min(100, (completed / 12) * 100)}%` }} /></div>
          </div>
          <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importJson} />
          <Button type="button" variant="outline" onClick={() => importRef.current?.click()}><ArrowUpFromLine /> Import</Button>
          <Button type="button" variant="outline" onClick={exportJson} disabled={!sessions.length}><ArrowDownToLine /> Export JSON</Button>
        </div>
      </header>
      <div className="workspace">
        <aside className="side-rail">
          <div className="rail-status"><span className="status-dot" /><div><strong>Local only</strong><small>Saved on this device</small></div></div>
          <nav><a className="active" href="#new-session"><ClipboardCheck /> New checklist</a><a href="#journal"><FileJson /> Session journal</a></nav>
          <div className="rail-tip"><ShieldCheck /><strong>Your data stays with you.</strong><p>Export a JSON backup regularly, especially when screenshots are attached.</p></div>
        </aside>
        <div className="content">
          {message && <div className="notice" role="status"><Check size={16} /> {message}<button onClick={() => setMessage('')} aria-label="Dismiss"><X size={15} /></button></div>}
          <section id="new-session" className="page-heading">
            <div><p className="eyebrow">PRE-MARKET ROUTINE</p><h2>Build the case before the bell.</h2><p>Work top-down, record what you see, then decide if the opening range is worth trading.</p></div>
          </section>
          {editingId && <div className="editing-banner" role="status"><Pencil /><span><strong>Editing saved session</strong> Update the checklist below, then save your changes.</span><Button type="button" variant="outline" onClick={cancelEdit}>Cancel edit</Button></div>}
          <form onSubmit={saveSession} className="journal-form">
            <section className="panel session-strip">
              <label>Date<Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label>Market<select value={market} onChange={(e) => setMarket(e.target.value)}><option>Nas</option><option>Gold</option></select></label>
              <label>Session<select value={session} onChange={(e) => setSession(e.target.value)}><option>Asia</option><option>Frankfurt</option><option>London</option><option>New York</option></select></label>
              <label>Opening range<select value={orbMinutes} onChange={(e) => setOrbMinutes(e.target.value)}><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option></select></label>
            </section>
            <div className="section-title"><span>01</span><div><h3>Opening context</h3><p>Confirm the essentials before analysing structure.</p></div></div>
            <section className="panel context-checks simple-context">
              <Toggle checked={newsClear} onChange={() => setNewsClear(!newsClear)} label="High-impact news checked" />
              <Toggle checked={keyLevels} onChange={() => setKeyLevels(!keyLevels)} label="Key levels marked" />
              <div className={`gap-control ${gapIdentified ? 'is-active' : ''}`}>
                <Toggle checked={gapIdentified} onChange={() => { const next = !gapIdentified; setGapIdentified(next); if (!next) setGapDirection(''); }} label="Gap identified" />
                {gapIdentified && <div className="break-picker compact" aria-label="Gap location">
                  <button type="button" onClick={() => setGapDirection('Above')} className={gapDirection === 'Above' ? 'active above' : ''} aria-pressed={gapDirection === 'Above'}><ArrowUp />Above</button>
                  <button type="button" onClick={() => setGapDirection('Below')} className={gapDirection === 'Below' ? 'active below' : ''} aria-pressed={gapDirection === 'Below'}><ArrowDown />Below</button>
                </div>}
              </div>
            </section>
            <div className="section-title"><span>02</span><div><h3>Top-down structure</h3><p>Set the directional context on every timeframe.</p></div></div>
            <section className="timeframe-grid">
              {checks.map((check, index) => (
                <article className="panel tf-card" key={check.timeframe}>
                  <header><span>{check.timeframe}</span><small>STRUCTURE</small></header>
                  <BiasPicker value={check.structure} onChange={(structure) => updateCheck(index, { structure })} />
                  <div className="tf-checks">
                    <Toggle checked={check.fvg} onChange={() => updateCheck(index, { fvg: !check.fvg })} label="FVG identified" />
                    <Toggle checked={check.wickless} onChange={() => updateCheck(index, { wickless: !check.wickless })} label="Wickless candle" />
                  </div>
                </article>
              ))}
            </section>
            <aside className={`alignment-summary panel ${alignment.tone}`} aria-live="polite">
              <div className="alignment-icon"><span /></div>
              <div><small>TIMEFRAME ALIGNMENT</small><strong>{alignment.label}</strong><p>{alignment.detail}</p></div>
              <div className="alignment-map">{checks.map((check) => <span key={check.timeframe} className={check.structure.toLowerCase()} title={`${check.timeframe}: ${check.structure}`}>{check.timeframe}</span>)}</div>
            </aside>
            <div className="section-title"><span>03</span><div><h3>Opening range</h3><p>Record the range once it has formed.</p></div></div>
            <section className="panel range-panel">
              <label>Range value<Input type="number" min="0" step="any" value={rangeValue} onChange={(e) => setRangeValue(e.target.value)} placeholder="e.g. 42.5" /></label>
              <div className="candle-field">
                <label>Opening candle</label>
                <div className="candle-picker">
                  {(['Bullish', 'Bearish'] as CandleDirection[]).map((direction) => (
                    <button type="button" key={direction} onClick={() => setOpeningCandle(direction)} className={openingCandle === direction ? `active ${direction.toLowerCase()}` : ''}>
                      <i />{direction}
                    </button>
                  ))}
                </div>
              </div>
              <div className="candle-field">
                <label>Range break</label>
                <div className="break-picker" aria-label="Opening range break direction">
                  <button type="button" onClick={() => setRangeBreak('Above')} className={rangeBreak === 'Above' ? 'active above' : ''} aria-pressed={rangeBreak === 'Above'}><ArrowUp />Above</button>
                  <button type="button" onClick={() => setRangeBreak('Below')} className={rangeBreak === 'Below' ? 'active below' : ''} aria-pressed={rangeBreak === 'Below'}><ArrowDown />Below</button>
                </div>
              </div>
              <Toggle checked={riskDefined} onChange={() => setRiskDefined(!riskDefined)} label="Risk and invalidation defined" />
            </section>
            <div className="section-title"><span>04</span><div><h3>Evidence & verdict</h3><p>Attach chart context and make the decision explicit.</p></div></div>
            <section className="panel evidence-panel">
              <div>
                <label className="upload-zone"><Camera /><strong>Add chart screenshots</strong><span>Up to 4 images · included in your JSON export</span><input type="file" accept="image/*" multiple onChange={addScreenshots} /></label>
                {!!screenshots.length && <div className="image-row">{screenshots.map((src, index) => <div key={index}><img src={src} alt={`Chart ${index + 1}`} /><button type="button" onClick={() => setScreenshots((items) => items.filter((_, i) => i !== index))} aria-label="Remove screenshot"><X /></button></div>)}</div>}
              </div>
              <div className="verdict-block">
                <label>Pre-trade verdict</label>
                <div className="verdict-picker">{(['Ready', 'Caution', 'No trade'] as Verdict[]).map((item) => <button type="button" key={item} className={verdict === item ? 'active' : ''} onClick={() => setVerdict(item)}>{item}</button>)}</div>
                <label className="grade-label">Setup grade</label>
                <div className="grade-picker" aria-label="Setup grade">{(['A', 'B', 'C'] as SetupGrade[]).map((grade) => <button type="button" key={grade} className={setupGrade === grade ? `active grade-${grade.toLowerCase()}` : ''} onClick={() => setSetupGrade(grade)} aria-pressed={setupGrade === grade}><strong>{grade}</strong><span>setup</span></button>)}</div>
                <label className="notes-label">Notes<Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add observations, reasoning or reminders…" /></label>
                <Button type="submit" size="lg">{editingId ? <><Check /> Update session</> : <><Plus /> Save session</>}</Button><p>{editingId ? 'Your changes will replace this saved session.' : 'No backend. This record will be stored in this browser.'}</p>
              </div>
            </section>
          </form>
          <section id="journal" className="journal-section">
            <div className="section-title journal-title"><span>05</span><div><h3>Session journal</h3><p>{sessions.length} saved session{sessions.length === 1 ? '' : 's'} on this device.</p></div></div>
            <div className="panel table-panel">
              <div className="table-toolbar">
                <div className="search-box"><Search /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search market, date or verdict…" /></div>
                <Button type="button" variant="outline" onClick={exportJson} disabled={!sessions.length}><ArrowDownToLine /> Backup journal</Button>
              </div>
              {filtered.length ? (
                <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Market</TableHead><TableHead>Session</TableHead><TableHead>Gap</TableHead><TableHead>ORB</TableHead><TableHead>Range formed</TableHead><TableHead>Break</TableHead><TableHead>Structure</TableHead><TableHead>Evidence</TableHead><TableHead>Verdict</TableHead><TableHead>Grade</TableHead><TableHead>Notes</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>{filtered.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{new Date(`${item.date}T12:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                      <TableCell><strong>{item.market}</strong></TableCell><TableCell>{item.session}</TableCell>
                      <TableCell>{item.gapIdentified ? (item.gapDirection ? <span className={`break-badge ${item.gapDirection.toLowerCase()}`}>{item.gapDirection === 'Above' ? <ArrowUp /> : <ArrowDown />}{item.gapDirection}</span> : 'Yes') : '—'}</TableCell>
                      <TableCell>{item.orbMinutes}m</TableCell>
                      <TableCell><span className={`candle-summary ${(item.openingCandle || 'Bullish').toLowerCase()}`}><i />{item.rangeValue || '—'}</span></TableCell>
                      <TableCell>{item.rangeBreak ? <span className={`break-badge ${item.rangeBreak.toLowerCase()}`}>{item.rangeBreak === 'Above' ? <ArrowUp /> : <ArrowDown />}{item.rangeBreak}</span> : '—'}</TableCell>
                      <TableCell><div className="bias-dots">{item.timeframeChecks.map((tf) => <span key={tf.timeframe} className={tf.structure.toLowerCase()} title={`${tf.timeframe}: ${tf.structure}`}>{tf.timeframe.split(' ')[0]}</span>)}</div></TableCell>
                      <TableCell>{item.screenshots.length ? <span className="image-count"><ImageIcon /> {item.screenshots.length}</span> : '—'}</TableCell>
                      <TableCell><span className={`verdict-badge ${item.verdict.toLowerCase().replace(' ', '-')}`}>{item.verdict}</span></TableCell>
                      <TableCell>{item.setupGrade ? <span className={`grade-badge grade-${item.setupGrade.toLowerCase()}`}>{item.setupGrade}</span> : '—'}</TableCell>
                      <TableCell className="notes-cell">{item.notes ? <button type="button" className={`note-preview ${expandedNoteId === item.id ? 'expanded' : ''}`} onClick={() => setExpandedNoteId(expandedNoteId === item.id ? null : item.id)} aria-expanded={expandedNoteId === item.id}>{item.notes}</button> : '—'}</TableCell>
                      <TableCell className="row-actions"><button type="button" onClick={() => editSession(item)} aria-label="Edit session" title="Edit session"><Pencil /></button><button type="button" onClick={() => { setSessions((rows) => rows.filter((row) => row.id !== item.id)); if (editingId === item.id) cancelEdit(); }} aria-label="Delete session" title="Delete session"><Trash2 /></button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              ) : <div className="empty-state"><ClipboardCheck /><h4>{sessions.length ? 'No matching sessions' : 'Your journal starts here'}</h4><p>{sessions.length ? 'Try a different search.' : 'Complete the checklist above and your first session will appear in this table.'}</p></div>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
