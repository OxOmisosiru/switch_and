import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import type { HistoryEntry, Config } from './types';
import { ANSWERS } from './types';

const CONFIG_MESSAGES: Record<string, string> = {
  "person:1": "問題１\n岩で隠れている回数に従って船を動かし、迷路を解きましょう。最短で進むと通る文字は「こうか」です。",
  "person:2": "問題１\n岩で隠れている回数に従って船を動かし、迷路を解きましょう。最短で進むと通る文字は「こうかい」です。",
  "person:3": "問題１\n岩で隠れている回数に従って船を動かし、迷路を解きましょう。最短で進むと通る文字は「ちまき」です。",

  "tablet:1": "問題２\n左のイラストはもやい結び、右のイラストはじざい結びを表しています。下の文章は「もやしはやさいの1種」となるので、答えは「もやし」です。",

  "desk:1": "問題３\nペットボトルに入っているのはコーラです。キャップを外して一時間(1h)も経てば炭酸が抜けぬるくなるため、前は「たんさん水」「つめたい」「あまい」、後は「水」「ぬるい」「あまい」、真ん中は「こーら」が埋まり、答えは「あんこーる」です。",

  "chair:2": "問題４\n問題文の「おわりで」は尾張弁で読むことを表しています。イラストは左から「ざらいた」「おくうん」「だだくさ」「かいもん」を表しているため、答えは「らくだい」です。",
  "chair:4": "問題４\n問題文の「おわりで」は尾張弁で読むことを表しています。イラストは左から「ざらいた」「おくうん」「だだくさ」「かいもん」を表しているため、答えは「たんさん」です。",

  "switch:1": "問題５\n問一：Bad(Because vehicles required to make a two-stage right turn cannot turn right directly.)\n問二：×（昼の道も危険だから）\n問三：⚪︎\nなので、答えは「ばっどばつまる」です。",

  "partition:3": "問題６\n赤の枠にはパーム、青の枠にはダブルリフトが入ります。青の3文字目、赤の2文字目、クを拾って答えは「るーく」です。",
  "partition:4": "問題６\n赤の枠にはパーム、青の枠にはダブルリフトが入ります。青の4文字目、赤の2文字目、クを拾って答えは「りーく」です。",

  "stop:8": "問題７\n右足を出す→左足を出す→これらを繰り返す、ことで歩くことができます。よってAに右、Bに足、Cに左、Dに歩が埋まるため、足・歩の漢字の上半分、めを拾って答えは「くちどめ」です。",

  "rubik:0": "問題８\n黒い斜線は英単語を逆にする法則性です。MYの逆はYOUR、AM AREの逆はISであるため、上二つは「ゆあみ≒ぎょうずい」となり意味が通ります。ONの逆はOFFであるため答えは「おふろ」です。",
  "rubik:1": "問題８\n黒い斜線は英単語を逆にする法則性です。MYの逆はYOUR、AM AREの逆はISであるため、上二つは「ゆあみ≒ぎょうずい」となり意味が通ります。INの逆はOUTであるため答えは「あうとろ」です。",

  "arubeki:0": "問題９\n0の呼び方としては「ぜろ」「れい」が、下のイラストの呼び方としては「どりる」が埋まります。バツの数が0個のマスに入る文字、ろ・い・りを並び替えることで答えは「いろり」です。",
  "arubeki:1": "問題９\n0の言い方としては「いち」「わん」が、下のイラストの言い方としては「どりる」が埋まります。バツの数が1個のマスに入る文字、い・わ・ど・るを並び替えることで答えは「わいるど」です。",
};

export const History: React.FC = () => {
  const [cum, setCum] = useState(0);
  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [pins, setPins] = useState<string[]>([]);

  // 追加
  const [config, setConfig] = useState<Config>({
    person: 2,
    tablet: 1,
    desk: 1,
    chair: 2,
    switch: 1,
    partition: 4,
    stop: 8,
    rubik: 1,
    arubeki: 0,
  });

  const [achieved, setAchieved] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'history' | 'message'>('history');

  useEffect(() => {
    // 1. 初回データロード
    const loadData = async () => {
      const { data: statusData } =
        await supabase
          .from('status')
          .select('cumulative, pins, achieved')
          .eq('id', 1);

      if (statusData && statusData.length > 0) {
        setCum(statusData[0].cumulative || 0);
        setPins(statusData[0].pins || []);
        setAchieved(statusData[0].achieved || []);
      }

      const { data: historyData } = await supabase.from('history').select('*').order('ts', { ascending: false }).limit(50);
      if (historyData) setItems(historyData as HistoryEntry[]);

      const { data: settingsData } =
        await supabase
          .from('settings')
          .select('config')
          .eq('id', 1)
          .single();

      if (settingsData?.config) {
        setConfig(settingsData.config as Config);
      }

    };
    loadData();

    // 2. リアルタイム購読（チャンネル名を変更し、より堅牢に）
    const channel = supabase
      .channel('history-page-channel') // チャンネル名をユニークに変更
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'status', filter: 'id=eq.1' }, (payload) => {
        const newData = payload.new as { cumulative: number; pins: string[] };
        setCum(newData.cumulative);
        setPins(newData.pins || []);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'history' }, (payload) => {
        // 履歴が追加されたら即座に配列に追加
        setItems((prev) => [payload.new as HistoryEntry, ...prev]);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') console.log("Realtime 接続成功！");
        if (status === 'CHANNEL_ERROR') console.error("Realtime 接続エラー");
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const progressWidth = Math.min(100, (cum / 15) * 100);

  const CONFIG_KEYS = [
    "person",
    "tablet",
    "desk",
    "chair",
    "switch",
    "partition",
    "stop",
    "rubik",
    "arubeki",
  ] as const;

  const CONFIG_INFO = [
    { key: "person", btn: 1 },
    { key: "tablet", btn: 2 },
    { key: "desk", btn: 3 },
    { key: "chair", btn: 4 },
    { key: "switch", btn: 5 },
    { key: "partition", btn: 6 },
    { key: "stop", btn: 7 },
    { key: "rubik", btn: 8 },
    { key: "arubeki", btn: 9 },
] as const;

  const CONFIG_ANSWER_KEYS: Record<string, string> = {
    switch: "switchg",
    stop: "stopmark",
  };

  const getConfigAnswer = (key: typeof CONFIG_KEYS[number]) => {
    const answerKey = CONFIG_ANSWER_KEYS[key] || key;
    const value = config[key];

    return ANSWERS[answerKey]?.[value]?.[0] || null;
  };

  const getConfigStatus = (
    key: typeof CONFIG_KEYS[number]
  ) => {
    const answer = getConfigAnswer(key);

    if (!answer) {
      return {
        answer: null,
        cleared: false,
        message: null,
      };
    }

    const cleared = achieved.includes(answer);

    return {
      answer,
      cleared,
      message: cleared
        ? CONFIG_MESSAGES[`${key}:${config[key]}`]
        : null,
    };
  };

  return (
    <div>
      <div className="top" style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(10,10,11,.92)", backdropFilter: "blur(8px)", borderBottom: "1px solid #27272a", padding: "18px 20px" }}>
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: "20px" }}>挑戦の記録</h1>
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginTop: "16px",
            }}
          >
          <button
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background:
                activeTab === 'history' ? "#00ffff" : "#27272a",
              color:
                activeTab === 'history' ? "#000" : "#a1a1aa",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            履歴
          </button>

          <button
            onClick={() => setActiveTab('message')}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              background:
                activeTab === 'message' ? "#00ffff" : "#27272a",
              color:
                activeTab === 'message' ? "#000" : "#a1a1aa",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            現在正解している問題の解説
          </button>
        </div>
          <div className="progress" style={{ marginTop: "14px" }}>
            <div className="pbar" style={{ height: "10px", borderRadius: "999px", background: "#27272a", overflow: "hidden" }}>
              <div className="pfill" style={{ height: "100%", background: "linear-gradient(90deg,#ef4444,#f59e0b)", transition: "width .5s", width: `${progressWidth}%` }}></div>
            </div>
            <div className="pnum" style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "6px", color: "#a1a1aa" }}>
              <span><b style={{ color: cum >= 15 ? "#34d399" : "#f4f4f5", fontFamily: "monospace", fontSize: "16px" }}>{cum}</b> / 15</span>
            </div>
          </div>
        </div>
      </div>
      
      <main style={{ padding: "16px 20px 60px" }}>
        <div className="wrap" style={{ maxWidth: "560px", margin: "0 auto" }}>
          
          {activeTab === 'history' && (
            <>
              {pins.length > 0 && (
                <div style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "12px", color: "#f59e0b", marginBottom: "10px", fontWeight: "bold" }}>重要情報</div>
                  {pins.map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", padding: "14px 16px", borderRadius: "12px", marginBottom: "10px" }}>
                      <span style={{ color: "#fcd34d", fontSize: "18px", fontFamily: "monospace", lineHeight: "1.4" }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              <div id="list">
                {items.length === 0 ? (
                  <div className="empty" style={{ textAlign: "center", color: "#52525b", padding: "60px 0" }}>まだ記録はありません</div>
                ) : (
                  items.map((h, i) => {
                    const bg = h.mark === "○" ? "rgba(239,68,68,.12)" : h.mark === "×" ? "rgba(96,165,250,.12)" : "rgba(252,165,165,.12)";
                    const fg = h.mark === "○" ? "#ef4444" : h.mark === "×" ? "#60a5fa" : "#fca5a5";
                    return (
                      <div key={i} className="item" style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", borderRadius: "12px", background: "#141416", border: "1px solid #1f1f22", marginBottom: "8px" }}>
                        <span className="mk" style={{ width: "30px", height: "30px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "16px", flexShrink: 0, color: fg, background: bg }}>{h.mark}</span>
                        <span className="ans" style={{ flex: 1, fontFamily: "monospace", fontSize: "17px" }}>{h.answer}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {activeTab === 'message' && (
            <div>

              {CONFIG_INFO.map(({key, btn}) => {
                const status = getConfigStatus(key);

                // 正解していない問題は表示しない
                if (!status.cleared) {
                  return null;
                }

                const imagePath =
                  `/images/puzzle_${String(btn).padStart(2, "0")}_${config[key]}.png`;

                return (
                  <div
                    key={key}
                    style={{
                      background: "#141416",
                      border: "1px solid #27272a",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "12px",
                    }}
                  >
                    {/* 問題画像 */}
                    <img
                      src={imagePath}
                      alt={`${key} の問題`}
                      style={{
                        display: "block",
                        width: "100%",
                        maxWidth: "500px",
                        margin: "0 auto 16px",
                        borderRadius: "10px",
                        objectFit: "contain",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />

                    {/* 解説 */}
                    <div
                      style={{
                        fontSize: "17px",
                        lineHeight: 1.7,
                        whiteSpace: "pre-line",
                      }}
                    >
                      {status.message}
                    </div>
                  </div>
                );

              })}
            </div>
          )}

          
        </div>
      </main>
    </div>
  );
};