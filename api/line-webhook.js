// api/line-webhook.js
// LINE Bot → sales_todos にタスク登録する窓口（Vercel Serverless Function）
const crypto = require("crypto");
const { initializeApp, getApps } = require("firebase/app");
const {
  getFirestore, collection, addDoc, getDocs, query, where, updateDoc, doc,
} = require("firebase/firestore");

// ── Firebase ───────────────────────────────────────────
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

// ── LINE設定（Vercelの環境変数） ──────────────────────
const SECRET  = process.env.LINE_CHANNEL_SECRET;
const TOKEN   = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const ALLOWED = process.env.LINE_ALLOWED_USER_ID; // 自分のuserIdだけ許可

// ── 日付ユーティリティ（日本時間） ─────────────────────
const WD_JP = ["日","月","火","水","木","金","土"];
function jstNow() { return new Date(Date.now() + 9 * 3600 * 1000); } // getUTC系で読む
function ymd(d)   { return d.toISOString().slice(0, 10); }
function jstAdd(n) { const d = jstNow(); d.setUTCDate(d.getUTCDate() + n); return ymd(d); }
function todayStr() { return jstAdd(0); }
function fmtMD(s) {
  const d = new Date(s + "T00:00:00Z");
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WD_JP[d.getUTCDay()]})`;
}

// ── 一言 → タスクに変換 ─────────────────────────────
function parseTask(text) {
  let t = text.trim();
  let priority = "low"; // 何も付けなければ通常
  let date = null;

  // 「!!」で緊急、「!」で重要（先頭 or 末尾）
  const bang = t.match(/^[!！]+|[!！]+$/g);
  if (bang) {
    const n = Math.max(...bang.map((b) => b.length));
    priority = n >= 2 ? "high" : "medium";
    t = t.replace(/^[!！]+|[!！]+$/g, "").trim();
  }
  // 「緊急」「重要」の単語でも指定可
  if (/緊急/.test(t)) { priority = "high";   t = t.replace(/緊急/g, " "); }
  else if (/重要/.test(t)) { priority = "medium"; t = t.replace(/重要/g, " "); }

  const take = (re, fn) => {
    if (date) return;
    const m = t.match(re);
    if (!m) return;
    const v = fn(m);
    if (!v) return;
    date = v;
    t = t.replace(m[0], " ");
  };

  take(/(今日|きょう)/, () => jstAdd(0));
  take(/(明後日|あさって)/, () => jstAdd(2));
  take(/(明日|あした|あす)/, () => jstAdd(1));

  // 曜日（来週○曜 / ○曜）
  take(/(来週)?([月火水木金土日])曜日?/, (m) => {
    const now = jstNow().getUTCDay();
    const wd  = WD_JP.indexOf(m[2]);
    if (m[1]) {
      const toNextMon = ((8 - now) % 7) || 7;
      return jstAdd(toNextMon + ((wd + 6) % 7));
    }
    return jstAdd((wd - now + 7) % 7);
  });

  // 11/10, 11月10日
  take(/(\d{1,2})[\/月](\d{1,2})日?/, (m) => {
    const n = jstNow();
    let y = n.getUTCFullYear();
    const mo = Number(m[1]), da = Number(m[2]);
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    let s = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
    if (s < todayStr()) s = `${y + 1}-${s.slice(5)}`;
    return s;
  });

  // 10日（今月 or 来月）
  take(/(\d{1,2})日/, (m) => {
    const n = jstNow();
    const da = Number(m[1]);
    if (da < 1 || da > 31) return null;
    let y = n.getUTCFullYear(), mo = n.getUTCMonth() + 1;
    if (da < n.getUTCDate()) { mo += 1; if (mo > 12) { mo = 1; y += 1; } }
    return `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  });

  const title = t.replace(/[\s、,]+/g, " ").trim();
  if (!title) return null;
  return { title, date: date || todayStr(), priority };
}

// ── Firestore操作 ────────────────────────────────────
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

function listText(todos) {
  if (todos.length === 0) return `🎉 今日やることはないよ（${fmtMD(todayStr())}）`;
  const mark = { high: "🔴", medium: "🟠", low: "🟢" };
  const lines = todos.map((t, i) => {
    const late = t.date < todayStr() ? ` ⚠️${fmtMD(t.date)}〆` : "";
    const prog = t.status === "progress" ? " ◑着手中" : "";
    return `${i + 1}. ${mark[t.priority] || "🟠"} ${t.title}${prog}${late}`;
  });
  return `📋 今日のタスク ${fmtMD(todayStr())}\n\n${lines.join("\n")}\n\n完了は「1 済」、着手は「1 着手」と送ってね`;
}

// ── LINE返信 ─────────────────────────────────────────
async function reply(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

const HELP = [
  "📝 使い方",
  "",
  "▶ タスク登録：そのまま一言送るだけ",
  "  例）明日 山田商事 折り返し",
  "  例）金曜 鈴木工業 見積送付",
  "  日付なし → 今日",
  "",
  "▶ 優先度（何も付けなければ🟢通常）",
  "  例）!山田商事 折り返し ← !で🟠重要",
  "  例）!!田中商店 至急電話 ← !!で🔴緊急",
  "  「重要」「緊急」と書いてもOK",
  "",
  "▶ 一覧：「一覧」or「今日」",
  "▶ 完了：「1 済」（複数なら「1 3 済」）",
  "▶ 着手中：「2 着手」",
].join("\n");

// ── イベント処理 ─────────────────────────────────────
async function handleEvent(ev) {
  const userId = ev.source && ev.source.userId;

  // 初回セットアップ：自分のuserIdを教える
  if (!ALLOWED) {
    if (ev.replyToken) {
      await reply(ev.replyToken,
        `🔧 初期設定\nあなたのユーザーID：\n${userId}\n\nこれをVercelの環境変数「LINE_ALLOWED_USER_ID」に登録して、再デプロイしてね`);
    }
    return;
  }
  if (userId !== ALLOWED) return; // 他人は無視

  if (ev.type === "follow") { await reply(ev.replyToken, HELP); return; }
  if (ev.type !== "message" || ev.message.type !== "text") return;

  const text = ev.message.text.trim();

  // ヘルプ
  if (/^(ヘルプ|使い方|help|\?|？)$/i.test(text)) { await reply(ev.replyToken, HELP); return; }

  // 一覧
  if (/^(一覧|今日|きょう|リスト|タスク)$/.test(text)) {
    await reply(ev.replyToken, listText(await getActiveTodos()));
    return;
  }

  // 完了 / 着手（「1 済」「1 3 済」「済 2」「2 着手」）
  const cmd =
    text.match(/^([\d\s,、]+)\s*(済|完了|おわり|終わり|ok|OK|着手|着手中)$/) ||
    (() => { const m = text.match(/^(済|完了|着手|着手中)\s*([\d\s,、]+)$/); return m ? [m[0], m[2], m[1]] : null; })();
  if (cmd) {
    const nums   = cmd[1].split(/[\s,、]+/).filter(Boolean).map(Number);
    const toProg = /着手/.test(cmd[2]);
    const todos  = await getActiveTodos();
    const hit = [];
    for (const n of nums) {
      const t = todos[n - 1];
      if (!t) continue;
      await updateDoc(doc(db, "sales_todos", t.id),
        toProg ? { status: "progress", done: false } : { status: "done", done: true });
      hit.push(t.title);
    }
    if (hit.length === 0) { await reply(ev.replyToken, "⚠️ その番号のタスクが見つからないよ。「一覧」で番号を確認してね"); return; }
    const head = toProg ? "◑ 着手中にしたよ" : "✅ 完了にしたよ";
    const rest = await getActiveTodos();
    await reply(ev.replyToken, `${head}\n${hit.map((h) => "・" + h).join("\n")}\n\n残り ${rest.length}件`);
    return;
  }

  // それ以外 → タスク登録
  const task = parseTask(text);
  if (!task) { await reply(ev.replyToken, HELP); return; }
  await addDoc(collection(db, "sales_todos"), {
    title: task.title,
    date: task.date,
    priority: task.priority,
    categories: [],
    status: "undone",
    done: false,
    note: "",
    source: "line",
    createdAt: new Date().toISOString(),
  });
  const pLabel = { high: "🔴緊急", medium: "🟠重要", low: "🟢通常" }[task.priority];
  await reply(ev.replyToken, `✅ 登録したよ\n${task.title}\n📅 ${fmtMD(task.date)}　${pLabel}`);
}

// ── 生のリクエストボディ取得（署名検証用） ─────────────
async function getRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  if (chunks.length) return Buffer.concat(chunks);
  if (req.body) return Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body));
  return Buffer.from("");
}

// ── エントリーポイント ───────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== "POST") { res.status(200).send("LINE webhook is alive"); return; }
  if (!SECRET || !TOKEN) { res.status(500).send("LINE env vars missing"); return; }

  const raw  = await getRawBody(req);
  const sig  = req.headers["x-line-signature"];
  const hash = crypto.createHmac("sha256", SECRET).update(raw).digest("base64");
  if (sig !== hash) { res.status(401).send("invalid signature"); return; }

  const body = JSON.parse(raw.toString("utf8") || "{}");
  for (const ev of body.events || []) {
    try { await handleEvent(ev); }
    catch (e) {
      console.error(e);
      try { if (ev.replyToken) await reply(ev.replyToken, "⚠️ エラー：" + e.message); } catch {}
    }
  }
  res.status(200).send("ok");
};

module.exports.config = { api: { bodyParser: false } };
