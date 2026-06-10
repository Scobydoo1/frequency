/* FREQUENCY — UI layer (React). Owns screens; drives the canvas engine. */
import { useState, useRef, useEffect, useCallback } from "react";
import { FrequencyField } from "./engine/field-engine.js";
import { PROMPTS, PALETTE, STRANGER_COUNT, MOTION, fmtCount, seededInt, agoFor } from "./content.js";

export default function App() {
  const [screen, setScreen] = useState("intro"); // intro|tuning|locked|give|constellation
  const [prompt, setPrompt] = useState(PROMPTS[0]);
  const [assigned, setAssigned] = useState([]); // messages per stranger index
  const [seed, setSeed] = useState(1);
  const [revealMsg, setRevealMsg] = useState("");
  const [revealAgo, setRevealAgo] = useState("");
  const [myMsg, setMyMsg] = useState("");
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState("searching");

  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const freqRef = useRef(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  // refs to read latest inside engine callbacks
  const assignedRef = useRef(assigned); assignedRef.current = assigned;
  const seedRef = useRef(seed); seedRef.current = seed;
  const statusRef = useRef("searching");

  /* init engine once */
  useEffect(() => {
    const f = new FrequencyField(canvasRef.current);
    fieldRef.current = f;
    window.__fld = f; // debug handle
    f.setConfig({ ...PALETTE, strangerCount: STRANGER_COUNT, motion: MOTION });
    f.onFreq((mhz) => {
      if (freqRef.current) freqRef.current.textContent = mhz.toFixed(1);
    });
    f.onProgress((p, near) => {
      const s = near ? (p > 0.85 ? "locking" : "signal detected") : "searching";
      if (s !== statusRef.current) {
        statusRef.current = s;
        setStatus(s);
      }
    });
    f.onLock((stranger) => {
      if (screenRef.current !== "tuning") return;
      const msg = assignedRef.current[stranger.id] || "—";
      setRevealMsg(msg);
      setRevealAgo(agoFor(stranger.id, seedRef.current));
      setTimeout(() => {
        if (fieldRef.current) fieldRef.current.confirmLock();
        setScreen("locked");
      }, 750);
    });
    return () => f.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginTuning = useCallback(() => {
    const p = PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
    const newSeed = Math.floor(Math.random() * 1e6) + 1;
    // shuffle messages by seed for variety
    const pool = [...p.messages];
    const shuffled = [];
    let s = newSeed;
    while (pool.length) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      shuffled.push(pool.splice(s % pool.length, 1)[0]);
    }
    setPrompt(p);
    setAssigned(shuffled);
    setSeed(newSeed);
    setStatus("searching");
    statusRef.current = "searching";
    fieldRef.current.startTuning(newSeed);
    setScreen("tuning");
  }, []);

  const goConstellation = useCallback(() => {
    setMyMsg(draft.trim() || "…");
    fieldRef.current.enterConstellation();
    setScreen("constellation");
  }, [draft]);

  const playAgain = useCallback(() => {
    setDraft("");
    setMyMsg("");
    setRevealMsg("");
    fieldRef.current.reset();
    setScreen("intro");
  }, []);

  const tuneCount = fmtCount(900 + seededInt(prompt.id.length + seed, 120, 1800));

  return (
    <div className="stage">
      <canvas ref={canvasRef} className="field" />

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
          <button className="btn primary" onClick={beginTuning}>tune in</button>
          <div className="fineprint">headphones &amp; a quiet minute recommended</div>
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
          <blockquote className="msg">“{revealMsg}”</blockquote>
          <div className="attr">— a stranger, {revealAgo}</div>
          <button className="btn primary" onClick={() => setScreen("give")}>
            leave your signal
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
          <div className="count">{tuneCount}</div>
          <div className="count-sub">people have tuned to “{prompt.label}” tonight</div>
          <div className="pair">
            <div className="pair-row them">
              <span className="dot them-dot"></span>
              <span className="pair-msg">“{revealMsg}”</span>
            </div>
            <div className="pair-row you">
              <span className="dot you-dot"></span>
              <span className="pair-msg">“{myMsg}”</span>
            </div>
          </div>
          <div className="finale-actions">
            <button className="btn primary" onClick={beginTuning}>tune again</button>
            <button className="btn ghost" onClick={playAgain}>back to start</button>
          </div>
        </div>
      </Screen>
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
