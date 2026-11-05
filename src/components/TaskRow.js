import { C, PRIORITIES, PRODUCT_CATEGORIES, REPEATS } from "../constants";
import { getCats, isDoneTodo, fmtMD } from "../utils";

// ── タスク1行 ─────────────────────────────────────────
// 丸をタップ → 済/未 の切替。行をタップ → 編集
export default function TaskRow({ todo, onToggle, onOpen, showDate = false }) {
  const done = isDoneTodo(todo);
  const prog = todo.status === "progress";
  const pri  = PRIORITIES[todo.priority] || PRIORITIES.low;
  const products = getCats(todo).filter((k) => PRODUCT_CATEGORIES[k]);
  const ring = done ? C.green : prog ? "#FBBF24" : pri.color;

  return (
    <div onClick={() => onOpen(todo)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
      background: C.panel, borderRadius: 12, border: `1px solid ${C.line}`,
      borderLeft: `4px solid ${done ? C.line : pri.color}`,
      opacity: done ? 0.5 : 1, cursor: "pointer",
    }}>
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(todo); }}
        aria-label={done ? "未完了に戻す" : "完了にする"}
        style={{
          width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
          border: `2px solid ${ring}`, background: done ? C.green : prog ? "#FBBF2420" : "transparent",
          color: done ? C.bg : ring, fontSize: 13, fontWeight: 900, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}>{done ? "✓" : prog ? "◑" : ""}</button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, textDecoration: done ? "line-through" : "none", wordBreak: "break-all" }}>
          {todo.title}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 3, fontSize: 10.5, color: C.sub }}>
          {showDate && <span>{fmtMD(todo.date)}</span>}
          {prog && <span style={{ color: "#FBBF24", fontWeight: 700 }}>着手中</span>}
          {todo.carriedFrom && !done && <span style={{ color: C.red, fontWeight: 700 }}>⏰ {fmtMD(todo.carriedFrom)}から繰越</span>}
          {todo.repeat && REPEATS[todo.repeat] && <span style={{ color: "#4FC3F7" }}>🔁 {REPEATS[todo.repeat].label}</span>}
          {products.map((k) => (
            <span key={k} style={{ color: PRODUCT_CATEGORIES[k].color, fontWeight: 700 }}>{PRODUCT_CATEGORIES[k].label}</span>
          ))}
          {todo.source === "line" && <span title="LINEから登録">💬</span>}
          {todo.note && <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>📝 {todo.note}</span>}
        </div>
      </div>
    </div>
  );
}
