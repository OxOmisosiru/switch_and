import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import type { Config, HistoryEntry } from './types';
import { ANSWERS } from './types';

const LOCK_SEC = 15;

const GENRES = [
  { btn: 1, key: "person", label: "", fixed: false, def: 2 },
  { btn: 2, key: "tablet", label: "", fixed: true, def: 1 },
  { btn: 3, key: "desk", label: "", fixed: true, def: 1 },
  { btn: 4, key: "chair", label: "", fixed: false, def: 2 },
  { btn: 5, key: "switchg", label: "", fixed: true, def: 1 },
  { btn: 6, key: "partition", label: "", fixed: false, def: 4 },
  { btn: 7, key: "stopmark", label: "", fixed: true, def: 8 },
  { btn: 8, key: "rubik", label: "", fixed: false, def: 1 },
  { btn: 9, key: "arubeki", label: "", fixed: false, def: 0 },
];

// ★ 右から「あかさたな...」になるように、行ごとに要素を定義 (11列 x 5行)
const KB_ROWS = [
  ["ん", "わ", "ら", "や", "ま", "は", "な", "た", "さ", "か", "あ"],
  [null, null, "り", null, "み", "ひ", "に", "ち", "し", "き", "い"],
  [null, null, "る", "ゆ", "む", "ふ", "ぬ", "つ", "す", "く", "う"],
  [null, null, "れ", null, "め", "へ", "ね", "て", "せ", "け", "え"],
  [null, "を", "ろ", "よ", "も", "ほ", "の", "と", "そ", "こ", "お"],
];

const DAKUTEN: Record<string, string> = { か: "が", き: "ぎ", く: "ぐ", け: "げ", こ: "ご", さ: "ざ", し: "じ", す: "ず", せ: "ぜ", そ: "ぞ", た: "だ", ち: "ぢ", つ: "づ", て: "で", と: "ど", は: "ば", ひ: "び", ふ: "ぶ", へ: "べ", ほ: "ぼ", う: "ゔ" };
const HANDAKUTEN: Record<string, string> = { は: "ぱ", ひ: "ぴ", ふ: "ぷ", へ: "ぺ", ほ: "ぽ" };
const SMALL: Record<string, string> = { あ: "ぁ", い: "ぃ", う: "ぅ", え: "ぇ", お: "ぉ", つ: "っ", や: "ゃ", ゆ: "ゅ", よ: "ょ", わ: "ゎ" };

export const Play: React.FC = () => {
  const [config, setConfig] = useState<Config>({ person: 2, tablet:1, desk: 1, chair: 2, switch:1, partition: 4, stop: 8, rubik: 1, arubeki: 0 });
  const [cumulative, setCumulative] = useState(0);
  const [achieved, setAchieved] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [answer, setAnswer] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockStart, setLockStart] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const valueOf = (g: any) => g.fixed ? g.def : config[g.key as keyof Config];
  const validAt = (g: any) => { 
    if (g.btn === 1 && config.person === 4) return false;
    if (g.btn === 4 && config.chair === 3) return false;
    const aArr = ANSWERS[g.key]?.[valueOf(g) as number]; return !!(aArr && aArr.length); 
  };
  
  const inputAllowed = !locked;
  const judgeAllowed = !locked && answer.length >= 1;

  const isGenreCleared = (genreKey: string) => {
    const genreAnswersObj = ANSWERS[genreKey];
    if (!genreAnswersObj) return false;
    const allPossibleAnswers = Object.values(genreAnswersObj).flat();
    if (allPossibleAnswers.length === 0) return false;
    return allPossibleAnswers.every(ans => achieved.includes(ans));
  };

  useEffect(() => {
    supabase.from("settings").select("*").eq("id", 1).single().then(({ data }) => {
      const row = data as { config?: Config } | null;
      if (row?.config) setConfig(row.config);
    });
    supabase.from("status").select("*").eq("id", 1).single().then(({ data }) => {
      const row = data as { cumulative?: number; achieved?: string[] } | null;
      if (row) {
        if (typeof row.cumulative === "number") setCumulative(row.cumulative);
        if (Array.isArray(row.achieved)) setAchieved(row.achieved);
      }
    });
    supabase.from("history").select("*").order("ts", { ascending: false }).limit(50).then(({ data }) => {
      if (data) setHistory(data as HistoryEntry[]);
    });

    const channel = supabase.channel("play-session")
    // ① 既存の status（点数）の監視
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "status", filter: "id=eq.1" }, (payload) => {
      const row = payload.new as { cumulative?: number; achieved?: string[] };
      if (row) {
        if (typeof row.cumulative === "number") setCumulative(row.cumulative);
        if (Array.isArray(row.achieved)) setAchieved(row.achieved);
      }
    })
    // ② ★新規追加：settings（設定）の監視
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "settings", filter: "id=eq.1" }, (payload) => {
      const row = payload.new as { config?: Config };
      if (row?.config) {
        console.log("🔄 新しい設定を受信しました:", row.config);
        setConfig(row.config); // ここで Play 画面の設定が瞬時に切り替わります
      }
    })
    .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timerId);
  }, []);

  const evaluateRef = useRef<() => void>(() => {});
  useEffect(() => {
    evaluateRef.current = async () => {
      const set = new Set<string>();
      GENRES.forEach(g => {
        const v = g.fixed ? g.def : config[g.key as keyof Config];
        (ANSWERS[g.key]?.[v as number] || []).forEach((s: string) => set.add(s));
      });
      
      let mark = "×";
      let newCumulative = cumulative;
      let newAchieved = [...achieved];

      if (set.has(answer)) {
        if (!achieved.includes(answer)) {
          mark = "○";
          newCumulative += 1;
          newAchieved.push(answer);
        } else {
          mark = "‐";
        }
      }

      // 1. まずDBに保存 (awaitで完了を待つ)
      const newEntry = { answer, mark, perf: 1, ts: Date.now() };
      await supabase.from("history").insert(newEntry);
      
      // ★ ここを追加！：送信した履歴を、画面右側のリスト（state）の先頭に即座に追加する
      setHistory(prev => [newEntry as HistoryEntry, ...prev]);

      if (mark === "○") {
        // 2. 成功した場合のみ状態を更新
        await supabase.from("status").update({ cumulative: newCumulative, achieved: newAchieved }).eq("id", 1);
        setCumulative(newCumulative);
        setAchieved(newAchieved);
      }

      setAnswer("");
      setSelected(null);
      setLocked(false);
      setLockStart(null);
    };
  }, [answer, achieved, cumulative, config]); // 依存関係に注意

  useEffect(() => {
    if (locked && lockStart && now - lockStart >= LOCK_SEC * 1000) {
      setLocked(false);
      setLockStart(null);
      evaluateRef.current();
    }
  }, [now, locked, lockStart]);

  const pressJudge = () => { if (!judgeAllowed) return; setLocked(true); setLockStart(Date.now()); };
  const pushChar = (c: string) => { if (inputAllowed && answer.length < 10) setAnswer(prev => prev + c); };
  const transformLast = (map: Record<string, string>) => {
    if (!inputAllowed || !answer) return;
    const l = answer.slice(-1);
    if (map[l]) setAnswer(prev => prev.slice(0, -1) + map[l]);
  };

  return (
    <div id="app">
      <header>
        <div className="brand"></div>
        <div className="stats">
          <div className="stat" id="score">
            <div className="lbl">正解数</div>
            <div className="val" style={{ color: cumulative >= 15 ? "#34d399" : "" }}>{cumulative} / 15 {cumulative >= 15 && "🎉"}</div>
          </div>
        </div>
      </header>

      <main>
        <div className="left">
          {!selected && (
            <div className="grid9" id="grid9">
              {GENRES.map(g => {
                const ok = validAt(g);
                const isCleared = isGenreCleared(g.key);
                return (
                  <button 
                    key={g.btn} 
                    className={`pbtn ${isCleared ? "cleared" : ""}`} 
                    disabled={!ok} 
                    onClick={() => setSelected(g.btn)}
                  >
                    <span className="n">{g.btn}</span>
                    {!ok && <span className="sub">非成立</span>}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <>
              {/* 問題テキスト類を排除し、画像だけを大きく表示 */}
              <div id="imgArea" style={{ marginBottom: 14 }}>
                {(() => {
                  const g = GENRES.find(x => x.btn === selected)!;
                  const v = valueOf(g);
                  const fn = `puzzle_${String(g.btn).padStart(2, "0")}_${v}`;
                  return (
                    <div className="imgcard">
                      <button className="close" onClick={() => setSelected(null)}>×</button>
                      <img key={fn} src={`/images/${fn}.png`} alt={g.label} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    </div>
                  );
                })()}
              </div>

              <div id="answerBox" className={locked ? "locked" : ""}>
                {answer ? <>{answer}{inputAllowed && <span className="caret"></span>}</> : <span className="ph">（未入力）</span>}
              </div>

              <div id="kb" className={!inputAllowed ? "disabled" : ""}>
                <div className="kbgrid">
                  {KB_ROWS.map((row, ri) => (
                    <React.Fragment key={ri}>
                      {row.map((ch, ci) => (
                        ch ? <button key={`${ri}-${ci}`} className="k" onClick={() => pushChar(ch)}>{ch}</button>
                           : <div key={`${ri}-${ci}`} className="k empty" />
                      ))}
                    </React.Fragment>
                  ))}
                </div>
                <div className="special" id="special">
                  <button className="sk" onClick={() => transformLast(DAKUTEN)}>゛{DAKUTEN[answer.slice(-1)] && <span className="pv">{DAKUTEN[answer.slice(-1)]}</span>}</button>
                  <button className="sk" onClick={() => transformLast(HANDAKUTEN)}>゜{HANDAKUTEN[answer.slice(-1)] && <span className="pv">{HANDAKUTEN[answer.slice(-1)]}</span>}</button>
                  <button className="sk" onClick={() => transformLast(SMALL)}>小{SMALL[answer.slice(-1)] && <span className="pv">{SMALL[answer.slice(-1)]}</span>}</button>
                  <span className="sep" />
                  {["っ", "ゃ", "ゅ", "ょ", "ー"].map(c => <button key={c} className="sk" onClick={() => pushChar(c)}>{c}</button>)}
                  <span className="sep" />
                  <button className="sk" onClick={() => { if(inputAllowed) setAnswer(answer.slice(0, -1)) }}>⌫</button>
                  <button className="sk" onClick={() => { if(inputAllowed) setAnswer("") }}>全消</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="right">
          <div className="rhead"><span className="t">履歴</span><span className="s">新しい順</span></div>
          <div id="histList">
            {history.length === 0 ? <div className="rempty">まだ判定はありません</div> : (
              history.map((h, i) => {
                const cls = h.mark === "○" ? "mk-o" : h.mark === "×" ? "mk-x" : "mk-r";
                return (
                  <div key={i} className="hitem">
                    <span className={`mk ${cls}`}>{h.mark}</span><span className="a">{h.answer}</span>
                  </div>
                );
              })
            )}
          </div>
          <div className="judgewrap">
            <button id="judge" className={locked ? "locked" : ""} onClick={pressJudge} disabled={!judgeAllowed || locked}>
              {locked ? <><span className="small">判定中…</span><span className="cd">あと {Math.max(0, Math.ceil((LOCK_SEC * 1000 - (now - (lockStart || now))) / 1000))} 秒</span></> : "判定"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};