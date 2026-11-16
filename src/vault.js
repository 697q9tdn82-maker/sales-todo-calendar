// ============================================================
// 合言葉（データの鍵）
//
// このアプリのデータは Firestore の「vault/<合言葉>/…」の下に置きます。
// 合言葉を知っている端末だけがデータに届き、知らない人は読むことも消すこともできません。
//
// ・合言葉は「登録用URL」（…/#k=合言葉）を1回開くと、その端末に保存されます
// ・合言葉そのものはコードにもGitHubにも入れません（各端末のブラウザの中だけ）
// ============================================================
import { collection, doc, getDocs, writeBatch } from "firebase/firestore";
import { db } from "./firebase";

const STORAGE_KEY = "salesVaultKeyV1";
const KEY_RE = /^[A-Za-z0-9_-]{32,64}$/;
// 以前の置き場所（合言葉なしで誰でも届いた場所）。最初の設定のときに中身を引っ越す
export const OLD_COLLECTIONS = ["sales_todos", "sales_deals", "sales_reports", "sales_board", "sales_stats"];

let key = null;

function store(k) {
  key = k;
  try { localStorage.setItem(STORAGE_KEY, k); } catch { /* 保存できない端末では、開いている間だけ有効 */ }
}

// URLやテキストから合言葉を取り出す（「…/#k=xxxx」でも「xxxx」だけでもOK）
export function parseKey(text) {
  const t = String(text || "").trim();
  const m = t.match(/[#&?]k=([A-Za-z0-9_-]+)/);
  const k = m ? m[1] : t;
  return KEY_RE.test(k) ? k : null;
}

// 起動時：登録用URLで開かれていたら合言葉を保存し、アドレスバーからは消す（画面共有などで映らないように）
export function loadKey() {
  if (key) return key;
  const fromUrl = parseKey(window.location.hash);
  if (fromUrl) {
    store(fromUrl);
    try { window.history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* 消せなくても動作に影響なし */ }
    return key;
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && KEY_RE.test(saved)) key = saved;
  } catch { /* 読めなければ未設定扱い */ }
  return key;
}

export function setKey(k) { store(k); }
export function forgetKey() {
  key = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 何もしない */ }
}

// ほかの端末で開くための登録用URL
export function registrationUrl() {
  return `${window.location.origin}${window.location.pathname}#k=${key}`;
}

// 推測できない合言葉を作る（43文字）
export function generateKey() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// データの置き場所（合言葉の下）
export const col = (name) => collection(db, "vault", key, name);
export const ref = (name, id) => doc(db, "vault", key, name, id);

// 以前の置き場所にあるデータを、合言葉の下へそのままコピーする（同じIDで上書きなので、何回やっても同じ結果）
// 戻り値: { sales_todos: 件数, … }。以前の場所がもう閉じられている場合は例外（code: "permission-denied"）
export async function migrateOldData() {
  const counts = {};
  for (const name of OLD_COLLECTIONS) {
    const snap = await getDocs(collection(db, name));
    counts[name] = snap.size;
    const docs = snap.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = writeBatch(db);
      for (const d of docs.slice(i, i + 400)) batch.set(ref(name, d.id), d.data());
      await batch.commit();
    }
  }
  const batch = writeBatch(db);
  batch.set(ref("meta", "migrated"), { at: new Date().toISOString(), counts });
  await batch.commit();
  return counts;
}
