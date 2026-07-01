export interface Config {
  person: number;
  tablet: number;
  desk: number;
  chair: number;
  switch: number;
  partition: number;
  stop: number;
  rubik: number;
  arubeki: number;
}

export interface HistoryEntry {
  id?: string;
  answer: string;
  mark: string;
  perf: number;
  ts: number;
}

// 共通の正解配列
export const ANSWERS: Record<string, Record<number, string[]>> = {
  person: { 1: ["こうか"], 2: ["こうかい"], 3: ["ちまき"]},
  tablet: { 1: ["もやし"] },
  desk: { 1: ["あんこーる"] },
  chair: { 2: ["らくだい"], 4: ["たんさん"] },
  switchg: { 1: ["ばっどばつまる"] },
  partition: { 3: ["るーく"], 4: ["りーく"] },
  stopmark: { 8: ["くちどめ"] },
  rubik: { 0:["おふろ"], 1: ["あうとろ"] },
  arubeki: { 0: ["いろり"], 1: ["わいるど"] },
};