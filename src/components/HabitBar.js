import { DAYS_JP } from "../constants";
import { addDays, isDoneTodo } from "../utils";

// ── 習慣化バー: 今日の達成率リング + ストリーク + 週間完了グラフ ──
export default function HabitBar({ todos, todayStr, dailyDone }) {
  // 今日の達成率
  const todayTodos = todos.filter(t=>t.date===todayStr);
  const doneCount  = todayTodos.filter(isDoneTodo).length;
  const total      = todayTodos.length;
  const pct        = total>0 ? Math.round(doneCount/total*100) : 0;

  // ストリーク: 「1件以上完了した日」の連続日数(今日未完了なら昨日まで)
  let streak = 0;
  let d = todayStr;
  if (!(dailyDone[d]>0)) d = addDays(d,-1);
  while (dailyDone[d]>0) { streak++; d = addDays(d,-1); }

  // 週間グラフ(直近7日)
  const week = [];
  let max = 1;
  for (let i=6;i>=0;i--) {
    const ds = addDays(todayStr,-i);
    const v  = dailyDone[ds]||0;
    week.push({ ds, v, dow: new Date(ds).getUTCDay() });
    if (v>max) max=v;
  }

  const R = 24, C = 2*Math.PI*R;

  return (
    <div style={{background:"#1A1D26", borderRadius:14, border:"1px solid #2A2D3A", padding:"12px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:14}}>
      {/* 達成率リング */}
      <div style={{position:"relative", width:60, height:60, flexShrink:0}}>
        <svg width="60" height="60" viewBox="0 0 60 60" style={{transform:"rotate(-90deg)"}}>
          <circle cx="30" cy="30" r={R} fill="none" stroke="#12151E" strokeWidth="6"/>
          <circle cx="30" cy="30" r={R} fill="none" stroke={pct>=100?"#FFD700":"#4FC3F7"} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C*(1-pct/100)}
            style={{transition:"stroke-dashoffset 0.5s"}}/>
        </svg>
        <div style={{position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, color:pct>=100?"#FFD700":"#E8EAF0"}}>
          {pct}%
        </div>
      </div>
      {/* 今日の実績 + ストリーク */}
      <div style={{flexShrink:0}}>
        <div style={{fontSize:10, color:"#7A7D8A"}}>今日の達成</div>
        <div style={{fontSize:15, fontWeight:800, color:"#E8EAF0"}}>{doneCount}<span style={{fontSize:11, color:"#7A7D8A"}}> / {total}件</span></div>
        <div style={{fontSize:11, color:streak>0?"#FF9500":"#5A5D6A", fontWeight:700, marginTop:2}}>🔥 {streak}日連続</div>
      </div>
      {/* 週間グラフ */}
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:10, color:"#7A7D8A", marginBottom:4, textAlign:"right"}}>過去7日の完了数</div>
        <div style={{display:"flex", gap:4, alignItems:"flex-end", height:34}}>
          {week.map(w=>(
            <div key={w.ds} style={{flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2, minWidth:0}}>
              <div title={`${w.ds}: ${w.v}件`} style={{
                width:"100%", maxWidth:20, borderRadius:"3px 3px 0 0",
                height: Math.round((w.v/max)*24)+2,
                background: w.ds===todayStr ? "#FFD700" : "#4FC3F7",
                opacity: w.v>0 ? 0.9 : 0.2,
              }}/>
              <span style={{fontSize:8, color:w.ds===todayStr?"#FFD700":"#5A5D6A"}}>{DAYS_JP[w.dow]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
