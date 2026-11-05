import { useEffect, useRef, useState } from "react";
import { C } from "../constants";
import { todayJST } from "../utils";

const WORK = 25 * 60, BREAK = 5 * 60;
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
    });
  } catch (e) {}
}
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// ── ヘッダーの小さなポモドーロ(1秒ごとの再描画をここだけに閉じ込める) ──
export default function Pomodoro() {
  const [mode, setMode] = useState("work");
  const [endAt, setEndAt] = useState(null);   // 動作中: 終了予定時刻(ms)
  const [left, setLeft] = useState(WORK);     // 停止中の残り秒
  const [, tick] = useState(0);
  const [count, setCount] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem("pomo-count") || "{}"); return s.date === todayJST() ? s.count || 0 : 0; } catch { return 0; }
  });
  const modeRef = useRef(mode); modeRef.current = mode;

  useEffect(() => {
    if (!endAt) return;
    const iv = setInterval(() => {
      if (Date.now() >= endAt) {
        beep();
        setEndAt(null);
        if (modeRef.current === "work") {
          setCount((c) => {
            const n = c + 1;
            try { localStorage.setItem("pomo-count", JSON.stringify({ date: todayJST(), count: n })); } catch {}
            return n;
          });
          setMode("break"); setLeft(BREAK);
        } else { setMode("work"); setLeft(WORK); }
      } else tick((x) => x + 1);
    }, 500);
    return () => clearInterval(iv);
  }, [endAt]);

  const remain = endAt ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : left;
  const running = !!endAt;
  const color = mode === "work" ? C.red : C.green;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button onClick={() => { if (running) { setLeft(remain); setEndAt(null); } else setEndAt(Date.now() + remain * 1000); }}
        title={running ? "一時停止" : "ポモドーロ開始"} style={{
          display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 16, cursor: "pointer",
          border: `1px solid ${running ? color : C.line}`, background: running ? color + "18" : C.chip,
          color: running ? color : C.sub, fontSize: 12, fontWeight: 700, fontVariantNumeric: "tabular-nums",
        }}>
        {mode === "work" ? "🍅" : "☕"} {fmt(remain)} {running ? "⏸" : "▶"}
        {count > 0 && <span style={{ color: C.dim, fontWeight: 600 }}>×{count}</span>}
      </button>
      {(running || remain !== (mode === "work" ? WORK : BREAK)) && (
        <button onClick={() => { setEndAt(null); setMode("work"); setLeft(WORK); }} title="リセット"
          style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 14 }}>↺</button>
      )}
    </div>
  );
}
