import { useState } from "react";
import { C, STAGES, PRODUCTS } from "../constants";

const label = { fontSize: 11, color: C.sub, display: "block", marginBottom: 5, fontWeight: 700 };
const input = {
  width: "100%", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10,
  padding: "10px 14px", color: C.text, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};

// ── 案件の追加・編集 ─────────────────────────────────
export default function DealModal({ deal, defaultStage, onClose, onSave, onDelete }) {
  const [f, setF] = useState(() => ({
    company: deal?.company || "", products: deal?.products || [], amount: deal?.amount || "",
    person: deal?.person || "", note: deal?.note || "", stage: deal?.stage || defaultStage || "contact",
    nextAction: deal?.nextAction || "",
  }));
  const set = (p) => setF((x) => ({ ...x, ...p }));
  async function save() {
    if (!f.company.trim()) return;
    await onSave({ ...f, company: f.company.trim() }, deal);
    onClose();
  }

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{
      position: "fixed", inset: 0, background: "#000000BB", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div style={{
        background: C.panel, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", borderRadius: "20px 20px 0 0",
        border: `1px solid ${C.line}`, padding: "18px 18px calc(18px + env(safe-area-inset-bottom))", display: "flex", flexDirection: "column", gap: 13,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{deal ? "案件編集" : "案件追加"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.sub, fontSize: 22, cursor: "pointer" }}>×</button>
        </div>
        <input autoFocus={!deal} value={f.company} onChange={(e) => set({ company: e.target.value })} placeholder="会社名" style={input} />
        <div>
          <span style={label}>ステージ</span>
          <div style={{ display: "flex", gap: 6 }}>
            {STAGES.map((s) => (
              <button key={s.key} onClick={() => set({ stage: s.key })} style={{
                flex: 1, padding: "8px 2px", borderRadius: 8, cursor: "pointer", fontSize: 11, fontWeight: 700,
                border: `1px solid ${f.stage === s.key ? s.color : "transparent"}`,
                background: f.stage === s.key ? s.color + "26" : C.panel2, color: f.stage === s.key ? s.color : C.dim,
              }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div>
          <span style={label}>商品</span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {PRODUCTS.map((p) => {
              const on = f.products.includes(p.key);
              return (
                <button key={p.key} onClick={() => set({ products: on ? f.products.filter((k) => k !== p.key) : [...f.products, p.key] })} style={{
                  padding: "6px 12px", borderRadius: 16, cursor: "pointer", fontSize: 12, fontWeight: 600,
                  border: `1px solid ${on ? p.color : "transparent"}`, background: on ? p.color + "1c" : C.panel2, color: on ? p.color : C.dim,
                }}>{p.label}</button>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}><span style={label}>金額（円）</span>
            <input type="number" inputMode="numeric" value={f.amount} onChange={(e) => set({ amount: e.target.value })} placeholder="500000" style={input} /></div>
          <div style={{ flex: 1 }}><span style={label}>担当者</span>
            <input value={f.person} onChange={(e) => set({ person: e.target.value })} placeholder="田中部長" style={input} /></div>
        </div>
        <div>
          <span style={label}>次回アクション日 <span style={{ color: C.dim, fontWeight: 400 }}>（設定するとフォロータスクを自動作成）</span></span>
          <input type="date" value={f.nextAction} onChange={(e) => set({ nextAction: e.target.value })} style={{ ...input, colorScheme: "dark" }} />
        </div>
        <textarea value={f.note} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder="備考" style={{ ...input, resize: "vertical" }} />
        <div style={{ display: "flex", gap: 10 }}>
          {deal && (
            <button onClick={() => { if (window.confirm("この案件を削除しますか？")) { onDelete(deal); onClose(); } }} style={{
              padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.red}55`, background: C.red + "14", color: C.red, cursor: "pointer", fontSize: 13, fontWeight: 700,
            }}>削除</button>
          )}
          <button onClick={save} disabled={!f.company.trim()} style={{
            flex: 1, padding: 12, borderRadius: 12, border: "none", fontSize: 14, fontWeight: 800, cursor: "pointer",
            background: f.company.trim() ? C.grad : C.line, color: f.company.trim() ? C.bg : C.sub,
          }}>保存</button>
        </div>
      </div>
    </div>
  );
}
