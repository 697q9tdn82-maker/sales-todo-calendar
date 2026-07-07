import { PRIORITIES, STATUSES, ALL_CATEGORIES, REPEATS, DAYS_JP } from "../constants";
import { catColor, getCats, fmtDate, todoStatus, isDoneTodo } from "../utils";

// ── タスクカード ──────────────────────────────────────
export default function TodoCard({ todo, showDate=false, onEdit, onDelete, onCycle }) {
  const done = isDoneTodo(todo);
  const st = STATUSES[todoStatus(todo)] || STATUSES.undone;
  const pri = PRIORITIES[todo.priority] || PRIORITIES.medium;
  const cats = getCats(todo);
  return (
    <div onDoubleClick={()=>onEdit(todo)} style={{
      background:"#1A1D26", borderRadius:14, padding:"13px 15px",
      border:`1px solid ${done?"#2A2D3A":pri.color+"50"}`,
      opacity:done?0.55:1,
      display:"flex", alignItems:"flex-start", gap:11,
      cursor:"pointer",
    }}>
      <button onClick={()=>onCycle(todo)} title="クリックでステータス切替" style={{
        width:22, height:22, borderRadius:"50%", flexShrink:0, marginTop:2,
        border:`2px solid ${st.color}`, background:st.bg,
        cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
        color:st.color, fontSize:11, fontWeight:700,
      }}>{st.icon}</button>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex", alignItems:"center", gap:6, flexWrap:"wrap"}}>
          <span style={{fontSize:14, fontWeight:600, textDecoration:done?"line-through":"none"}}>{todo.title}</span>
          <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:pri.bg, color:pri.color}}>
            {pri.label}
          </span>
          <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:st.bg, color:st.color}}>{st.icon} {st.label}</span>
          {todo.repeat && REPEATS[todo.repeat] && (
            <span style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:"#4FC3F718", color:"#4FC3F7"}}>🔁 {REPEATS[todo.repeat].label}</span>
          )}
          {todo.carriedFrom && !done && (
            <span title={`元の予定日: ${todo.carriedFrom}`} style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:"#FF525218", color:"#FF5252"}}>⏰ 繰越</span>
          )}
          {cats.map(ck=>{
            const c=ALL_CATEGORIES[ck]; if(!c) return null;
            const cc2=catColor(ck);
            return <span key={ck} style={{fontSize:10, padding:"2px 7px", borderRadius:20, fontWeight:700, background:cc2+"18", color:cc2}}>{c.icon} {c.label}</span>;
          })}
          {showDate&&<span style={{fontSize:11, color:"#7A7D8A"}}>{fmtDate(todo.date)} {DAYS_JP[new Date(todo.date).getDay()]}曜</span>}
        </div>
        {todo.note&&<div style={{fontSize:12, color:"#7A7D8A", marginTop:3}}>{todo.note}</div>}
      </div>
      <div style={{display:"flex", gap:5, flexShrink:0}}>
        <button onClick={()=>onEdit(todo)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#7A7D8A", fontSize:13}}>✏️</button>
        <button onClick={()=>onDelete(todo.id)} style={{background:"#1E2230", border:"none", borderRadius:6, width:28, height:28, cursor:"pointer", color:"#FF5252", fontSize:13}}>🗑</button>
      </div>
    </div>
  );
}
