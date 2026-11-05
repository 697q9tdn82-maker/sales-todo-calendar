// api/morning-push.js
// 毎朝、今日のタスクをLINEに通知する（cron-job.org から叩く）
const { initializeApp, getApps } = require("firebase/app");
const { getFirestore, collection, getDocs, query, where } = require("firebase/firestore");

const firebaseConfig = {
  apiKey: "AIzaSyB5eSZLCsrCCuUKXdmKwZyUxqlNbPBpZoI",
  authDomain: "eatin-map-ee417.firebaseapp.com",
  projectId: "eatin-map-ee417",
  storageBucket: "eatin-map-ee417.firebasestorage.app",
  messagingSenderId: "850029980093",
  appId: "1:850029980093:web:bd2ea9a6e942b342220ad4",
};
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const TOKEN    = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const USER_ID  = process.env.LINE_ALLOWED_USER_ID;
const CRON_KEY = process.env.CRON_KEY;

// ── 祝日（土日祝は通知しない） ──────────────────────────
const JP_HOLIDAYS = new Set([
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20",
  "2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23",
  "2026-10-12","2026-11-03","2026-11-23",
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-22",
  "2027-04-29","2027-05-03","2027-05-04","2027-05-05","2027-07-19",
  "2027-08-11","2027-09-20","2027-09-23","2027-10-11","2027-11-03",
  "2027-11-23",
]);

// ── 日付（日本時間） ───────────────────────────────────
const WD_JP = ["日","月","火","水","木","金","土"];
function jstNow()   { return new Date(Date.now() + 9 * 3600 * 1000); }
function todayStr() { return jstNow().toISOString().slice(0, 10); }
function fmtMD(s) {
  const d = new Date(s + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD_JP[d.getUTCDay()]})`;
}
function isBizDay(y, m, d) {
  const dt  = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  return dow !== 0 && dow !== 6 && !JP_HOLIDAYS.has(dt.toISOString().slice(0, 10));
}
function bizInfo() {
  const n = jstNow();
  const y = n.getUTCFullYear(), m = n.getUTCMonth() + 1, today = n.getUTCDate();
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  let total = 0, passed = 0;
  for (let d = 1; d <= last; d++) {
    if (!isBizDay(y, m, d)) continue;
    total++;
    if (d <= today) passed++;
  }
  return { isBiz: isBizDay(y, m, today), passed, total, remain: total - passed };
}

// ── タスク取得（LINEの「一覧」と同じ並び順＝同じ番号） ──
const RANK = { high: 0, medium: 1, low: 2 };
const isDone = (t) => t.status === "done" || t.done;
async function getActiveTodos() {
  const snap = await getDocs(query(collection(db, "sales_todos"), where("date", "<=", todayStr())));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((t) => !isDone(t))
    .sort((a, b) =>
      (RANK[a.priority] ?? 1) - (RANK[b.priority] ?? 1) ||
      a.date.localeCompare(b.date) ||
      (a.title || "").localeCompare(b.title || "")
    );
}

function buildMessage(todos, biz) {
  const head = `☀️ おはよう！${fmtMD(todayStr())}\n📆 ${biz.passed}営業日目（残り${biz.remain}日／月${biz.total}日）`;
  if (todos.length === 0) return `${head}\n\n今日のタスクはなし🎉\n思いついたら一言送ってね`;
  const mark = { high: "🔴", medium: "🟠", low: "🟢" };
  const lines = todos.map((t, i) => {
    const late = t.date < todayStr() ? ` ⚠️${fmtMD(t.date)}〆` : "";
    const prog = t.status === "progress" ? " ◑着手中" : "";
    return `${i + 1}. ${mark[t.priority] || "🟠"} ${t.title}${prog}${late}`;
  });
  const high = todos.filter((t) => t.priority === "high").length;
  const sub  = high > 0 ? `（うち緊急${high}件）` : "";
  return `${head}\n\n📋 今日のタスク ${todos.length}件${sub}\n${lines.join("\n")}\n\n終わったら「1 済」で消せるよ\n📝 報告書は「報告 会社名」で登録`;
}

async function push(text) {
  const r = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ to: USER_ID, messages: [{ type: "text", text }] }),
  });
  if (!r.ok) throw new Error(`LINE push failed: ${r.status} ${await r.text()}`);
}

module.exports = async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!CRON_KEY || url.searchParams.get("key") !== CRON_KEY) { res.status(401).send("unauthorized"); return; }
  if (!TOKEN || !USER_ID) { res.status(500).send("LINE env vars missing"); return; }

  const force = url.searchParams.get("test") === "1"; // 動作確認用：土日祝でも送る
  const biz = bizInfo();
  if (!biz.isBiz && !force) { res.status(200).send("skip (holiday)"); return; }

  try {
    const todos = await getActiveTodos();
    await push(buildMessage(todos, biz));
    res.status(200).send(`sent (${todos.length} tasks)`);
  } catch (e) {
    console.error(e);
    res.status(500).send(e.message);
  }
};
