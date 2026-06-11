/* FREQUENCY — UI layer (React). Owns screens; drives the canvas engine, the
 * radio sound, the signal backend, and the local journal. */
import { useState, useRef, useEffect, useCallback } from "react";
import { FrequencyField } from "./engine/field-engine.js";
import { PALETTE, STRANGER_COUNT, MOTION, nightlyPrompt, nightlyTrack, paletteFor } from "./content.js";
import { fetchSignals, submitSignal, reportSignal, fetchHealth, fmtCount } from "./api.js";
import { Radio } from "./sound.js";
import { loadJournal, addEncounter, formatWhen, starPosition } from "./journal.js";

/* the page chrome follows the field's palette */
function applyCssPalette(pal) {
  const r = document.documentElement;
  r.style.setProperty("--you", pal.you);
  r.style.setProperty("--them", pal.them);
  r.style.setProperty("--thread", pal.thread);
  r.style.setProperty("--bg", pal.bg);
}

export default function App() {
  const tonight = nightlyPrompt();
  const [screen, setScreen] = useState("intro"); // intro|tuning|locked|give|constellation
  const [prompt, setPrompt] = useState(tonight);
  const [assigned, setAssigned] = useState([]); // signal object per stranger index
  const [count, setCount] = useState(0);
  const [reveal, setReveal] = useState({ text: "", ago: "", id: "", real: false });
  const [reported, setReported] = useState(false);
  const [myMsg, setMyMsg] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("searching");
  const [muted, setMuted] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journal, setJournal] = useState([]);
  const [journalSel, setJournalSel] = useState(0);
  const [tone, setTone] = useState(40);
  const [sent, setSent] = useState({ persisted: false, done: false, note: "" });
  const [shareNote, setShareNote] = useState("");
  const [sigName, setSigName] = useState(() => {
    try { return localStorage.getItem("frequency.name.v1") || ""; } catch { return ""; }
  });
  const [broadcast, setBroadcast] = useState(null); // null | "live" | "echo"

  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const radioRef = useRef(null);
  const freqRef = useRef(null);
  const screenRef = useRef(screen); screenRef.current = screen;
  const assignedRef = useRef(assigned); assignedRef.current = assigned;
  const statusRef = useRef("searching");
  const countRef = useRef(0); // last seen tuned-tonight count, for echo pulses

  /* init engine + radio once */
  useEffect(() => {
    const f = new FrequencyField(canvasRef.current);
    fieldRef.current = f;
    window.__fld = f; // debug handle
    f.setConfig({ ...PALETTE, strangerCount: STRANGER_COUNT, motion: MOTION });

    const radio = new Radio();
    radioRef.current = radio;
    window.__radio = radio; // debug handle
    setMuted(radio.isMuted());
    setTone(Math.round(radio.getTone() * 100));
    f.setAudioLevel(() => radio.level()); // stars breathe with the music

    f.onFreq((mhz) => { if (freqRef.current) freqRef.current.textContent = mhz.toFixed(1); });
    f.onProgress((p, near) => {
      radio.tune(p, near);
      const s = near ? (p > 0.85 ? "locking" : "signal detected") : "searching";
      if (s !== statusRef.current) { statusRef.current = s; setStatus(s); }
    });
    f.onLock((stranger) => {
      if (screenRef.current !== "tuning") return;
      const sig = assignedRef.current[stranger.id] || { text: "—", ago: "", id: "", real: false };
      setReveal({ ...sig, freq: f.currentFreq().toFixed(1) });
      setReported(false);
      radio.chime();
      radio.silenceStatic();
      setTimeout(() => {
        if (fieldRef.current) fieldRef.current.confirmLock();
        setScreen("locked");
      }, 750);
    });
    fetchHealth().then((h) => setBroadcast(h.ok && h.persisted ? "live" : "echo"));

    return () => f.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginTuning = useCallback(async () => {
    radioRef.current?.start();
    const p = nightlyPrompt();
    setPrompt(p);
    setStatus("searching"); statusRef.current = "searching";
    // tonight's prompt colors the whole field
    const pal = paletteFor(p.id);
    applyCssPalette(pal);
    fieldRef.current.setConfig({ ...pal, strangerCount: STRANGER_COUNT, motion: MOTION });
    // fetch tonight's real (or curated) signals
    const data = await fetchSignals(p, STRANGER_COUNT);
    setAssigned(data.messages);
    setCount(data.count);
    countRef.current = data.count;
    // signal decay: older messages spawn fainter, harder-to-hold strangers
    const meta = data.messages.map((m) => ({
      fade: 1 - Math.min(0.7, ((m.ageDays || 0) / 7) * 0.7),
    }));
    const newSeed = Math.floor(Math.random() * 1e6) + 1;
    fieldRef.current.startTuning(newSeed, meta);
    setScreen("tuning");
  }, []);

  /* echo pulses while tuning: a ring when the real count ticks up, plus a
   * soft ambient heartbeat so the dark never feels empty */
  useEffect(() => {
    if (screen !== "tuning") return;
    let alive = true;
    let ambientTimer;
    const ambient = () => {
      if (!alive) return;
      fieldRef.current?.addPulse();
      ambientTimer = setTimeout(ambient, 12000 + Math.random() * 23000);
    };
    ambientTimer = setTimeout(ambient, 7000 + Math.random() * 9000);
    const poll = setInterval(async () => {
      const d = await fetchSignals(prompt, 3);
      if (alive && d.count > countRef.current) {
        countRef.current = d.count;
        fieldRef.current?.addPulse(); // someone, somewhere, actually tuned in
      }
    }, 45000);
    return () => { alive = false; clearTimeout(ambientTimer); clearInterval(poll); };
  }, [screen, prompt]);

  const goConstellation = useCallback(async () => {
    const mine = draft.trim();
    const signed = sigName.trim().slice(0, 24) || null;
    const finalMsg = mine || "…";
    setMyMsg(finalMsg);
    setSent({ persisted: false, done: false, note: "" });
    fieldRef.current.enterConstellation();
    setScreen("constellation");
    try { localStorage.setItem("frequency.name.v1", signed || ""); } catch { /* ignore */ }
    // record locally always; submit to the world only if the player wrote something
    setJournal(addEncounter({
      promptLabel: prompt.label,
      received: reveal.text, receivedName: reveal.name || null,
      given: mine, givenName: signed,
      freq: reveal.freq || null,
    }));
    if (mine) {
      const res = await submitSignal(prompt, mine, signed);
      setSent({
        persisted: !!res.persisted,
        done: true,
        note: res.ok === false ? res.reason || "" : "",
      });
    } else {
      setSent({ persisted: false, done: true, note: "" });
    }
  }, [draft, sigName, prompt, reveal.text, reveal.name]);

  const onReport = useCallback(async () => {
    setReported(true);
    if (reveal.id) await reportSignal(prompt, reveal.id);
  }, [prompt, reveal.id]);

  const playAgain = useCallback(() => {
    setDraft(""); setMyMsg(""); setReveal({ text: "", ago: "", id: "", real: false });
    setShareNote("");
    applyCssPalette(PALETTE); // the intro always wears Cosmic Indigo
    fieldRef.current.setConfig({ ...PALETTE });
    fieldRef.current.reset();
    radioRef.current?.silenceStatic();
    setScreen("intro");
  }, []);

  const openJournal = useCallback(() => {
    setJournal(loadJournal());
    setJournalSel(0);
    setJournalOpen(true);
  }, []);

  const onTone = useCallback((v) => {
    setTone(v);
    radioRef.current?.setTone(v / 100);
  }, []);

  const toggleMute = useCallback(() => {
    radioRef.current?.start();
    setMuted(radioRef.current?.toggleMute() ?? false);
  }, []);

  const share = useCallback(async () => {
    const text = `Tonight on FREQUENCY, a stranger said: "${reveal.text}"`;
    const url = location.origin;
    try {
      if (navigator.share) { await navigator.share({ title: "FREQUENCY", text, url }); return; }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareNote("copied to clipboard");
      setTimeout(() => setShareNote(""), 2200);
    } catch { /* dismissed */ }
  }, [reveal.text]);

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="field" />

      {/* mute toggle — always available */}
      <button className="mute" onClick={toggleMute} aria-label={muted ? "unmute" : "mute"}>
        {muted ? "♪̸ sound off" : "♪ sound on"}
      </button>

      {/* tone knob: sweep the music's lowpass like a radio's tone dial */}
      <div className={"tone " + (screen !== "intro" ? "on" : "")}>
        <span className="tone-label">tone</span>
        <input
          type="range" min="0" max="100" value={tone}
          onChange={(e) => onTone(+e.target.value)}
          aria-label="music tone"
        />
      </div>

      {/* persistent frequency HUD during tuning */}
      <div className={"hud " + (screen === "tuning" ? "on" : "")}>
        <div className="hud-freq">
          <span ref={freqRef}>97.3</span><span className="hud-unit">FM</span>
        </div>
        <div className="hud-status" data-status={status}>
          {status === "searching" && "· scanning the dark ·"}
          {status === "signal detected" && "· a signal ·"}
          {status === "locking" && "· hold steady ·"}
        </div>
      </div>

      {/* INTRO */}
      <Screen show={screen === "intro"}>
        <div className="intro">
          <div className="kicker">A GAME ABOUT BEING FOUND</div>
          <h1 className="title">FREQUENCY</h1>
          <p className="lede">
            Somewhere out there, a stranger is tuned to the same thing you are.
            Drift through the dark until your signals meet — then leave a trace
            for whoever comes next.
          </p>
          <div className="tonight">tonight everyone is tuned to <em>{prompt.label}</em></div>
          <button className="btn primary" onClick={beginTuning}>tune in</button>
          <div className="intro-foot">
            <button className="linklike" onClick={openJournal}>your constellation</button>
            <span className="fineprint">headphones &amp; a quiet minute recommended</span>
            <span className="fineprint credits">
              tonight's record: "{nightlyTrack().title}" · {nightlyTrack().artist} · cc0
            </span>
            {broadcast && (
              <span className="fineprint broadcast" data-live={broadcast === "live"}>
                broadcast: {broadcast}
              </span>
            )}
          </div>
        </div>
      </Screen>

      {/* TUNING prompt banner */}
      <div className={"prompt-banner " + (screen === "tuning" ? "on" : "")}>
        <div className="kicker">TONIGHT, EVERYONE IS TUNED TO ONE THING</div>
        <div className="prompt-line">{prompt.label}.</div>
        <div className="hint">move your light · find another · hold close to lock on</div>
      </div>

      {/* LOCKED reveal */}
      <Screen show={screen === "locked"}>
        <div className="reveal">
          <div className="kicker">YOU FOUND SOMEONE · {prompt.label}</div>
          <blockquote className="msg">“{reveal.text}”</blockquote>
          <div className="attr">
            — {reveal.name || "a stranger"}{reveal.ago ? `, ${reveal.ago}` : ""}
            {reveal.freq ? ` · ${reveal.freq} FM` : ""}
          </div>
          <button className="btn primary" onClick={() => setScreen("give")}>
            leave your signal
          </button>
          <button className="report" onClick={onReport} disabled={reported}>
            {reported ? "thank you — signal flagged" : "report this signal"}
          </button>
        </div>
      </Screen>

      {/* GIVE */}
      <Screen show={screen === "give"}>
        <div className="give">
          <div className="kicker">{prompt.label.toUpperCase()}</div>
          <p className="give-prompt">Now you. One line, into the dark —<br/>for a stranger who hasn't arrived yet.</p>
          <textarea
            className="give-input"
            value={draft}
            maxLength={90}
            placeholder="say the true thing…"
            onChange={(e) => setDraft(e.target.value.replace(/\n/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goConstellation(); } }}
            autoFocus
          />
          <div className="counter">{draft.length}/90</div>
          <input
            className="name-input"
            type="text"
            value={sigName}
            maxLength={24}
            placeholder="sign it (optional) — or stay a stranger"
            onChange={(e) => setSigName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goConstellation(); } }}
          />
          <button className="btn primary" disabled={!draft.trim()} onClick={goConstellation}>
            send it out
          </button>
          <button className="btn ghost" onClick={goConstellation}>skip — just listen</button>
        </div>
      </Screen>

      {/* CONSTELLATION */}
      <Screen show={screen === "constellation"}>
        <div className="finale">
          <div className="kicker">YOU'RE PART OF IT NOW</div>
          <div className="count">{fmtCount(count)}</div>
          <div className="count-sub">people have tuned to “{prompt.label}” tonight</div>
          <div className="pair">
            <div className="pair-row them">
              <span className="dot them-dot"></span>
              <span className="pair-msg">
                “{reveal.text}”
                <span className="pair-name">— {reveal.name || "a stranger"}</span>
              </span>
            </div>
            <div className="pair-row you">
              <span className="dot you-dot"></span>
              <span className="pair-msg">
                “{myMsg}”
                <span className="pair-name">— {sigName.trim() || "a stranger"} (you)</span>
              </span>
            </div>
          </div>
          {sent.done && myMsg !== "…" && (
            <div className="sent-note">
              {sent.note
                ? `the dark didn't take it — ${sent.note}`
                : sent.persisted
                  ? "your signal is out there now — someone will find it"
                  : "your signal echoed into the dark"}
            </div>
          )}
          <div className="finale-actions">
            <button className="btn primary" onClick={beginTuning}>tune again</button>
            <button className="btn ghost" onClick={share}>share</button>
            <button className="btn ghost" onClick={playAgain}>back to start</button>
          </div>
          {shareNote && <div className="share-note">{shareNote}</div>}
        </div>
      </Screen>

      {/* JOURNAL — sky map of strangers + radio operator's logbook */}
      {journalOpen && (
        <div className="journal-overlay" onClick={(e) => { if (e.target.classList.contains("journal-overlay")) setJournalOpen(false); }}>
          <div className="journal">
            <div className="kicker">YOUR CONSTELLATION</div>
            <p className="journal-sub">every stranger you've found is a star. tap one to reread.</p>
            {journal.length === 0 ? (
              <p className="journal-empty">No encounters yet. Tune in to begin.</p>
            ) : (
              <>
                <svg className="skymap" viewBox="0 0 400 240" role="list" aria-label="your constellation">
                  {journal.map((e, i) => {
                    const p = starPosition(e, i);
                    const sel = i === journalSel;
                    return (
                      <g
                        key={i} role="listitem" tabIndex={0}
                        className={"skystar" + (sel ? " sel" : "")}
                        transform={`translate(${p.x * 400} ${p.y * 240})`}
                        onClick={() => setJournalSel(i)}
                        onKeyDown={(ev) => { if (ev.key === "Enter") setJournalSel(i); }}
                      >
                        <circle className="skystar-halo" r={sel ? 11 : 8} />
                        <circle className="skystar-core" r={sel ? 3.4 : 2.4} />
                        {e.given && <circle className="skystar-ring" r={sel ? 6.4 : 5} />}
                      </g>
                    );
                  })}
                </svg>
                {journal[journalSel] && (
                  <div className="logbook">
                    <div className="logbook-stamp">
                      ENTRY {String(journal.length - journalSel).padStart(2, "0")}
                      {" · "}{journal[journalSel].freq ? `${journal[journalSel].freq} FM` : "——.— FM"}
                      {" · "}{formatWhen(journal[journalSel].ts)}
                      {" · "}{journal[journalSel].promptLabel}
                    </div>
                    {journal[journalSel].received && (
                      <div className="journal-recv">
                        “{journal[journalSel].received}”
                        {journal[journalSel].receivedName ? ` — ${journal[journalSel].receivedName}` : " — a stranger"}
                      </div>
                    )}
                    {journal[journalSel].given && (
                      <div className="journal-given">
                        you{journal[journalSel].givenName ? ` (${journal[journalSel].givenName})` : ""}: “{journal[journalSel].given}”
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
            <button className="btn ghost" onClick={() => setJournalOpen(false)}>close</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Screen({ show, children }) {
  return (
    <div className={"screen " + (show ? "show" : "")} aria-hidden={!show}>
      <div className="screen-inner">{children}</div>
    </div>
  );
}
