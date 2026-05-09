import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Side = "heads" | "tails";
type TabMode = "manual" | "auto";
type OnWinLossMode = "reset" | "increase";

interface HistoryEntry { result: Side; won: boolean; }

interface CoinCard {
  id: number;
  prediction: Side;
  result: Side | null;
  revealed: boolean;
}

interface ToastState {
  message: string;
  type: "win" | "lose" | "info" | null;
  visible: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MULTIPLIER      = 1.9;
const INITIAL_BALANCE = 10_000;
const FLIP_DURATION   = 1250;
const HISTORY_MAX     = 30;
const TOSS_OPTIONS    = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// ─── SVG Faces ────────────────────────────────────────────────────────────────
const HeadsSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2"/>
    <polygon points="40,15 46,33 65,33 50,44 56,62 40,51 24,62 30,44 15,33 34,33" fill="#8a5e0a" opacity="0.6"/>
    <polygon points="40,18 45,32 60,32 48,41 53,57 40,48 27,57 32,41 20,32 35,32" fill="#ffe082"/>
  </svg>
);
const TailsSVG = ({ size = 60 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="2"/>
    <circle cx="40" cy="40" r="22" fill="none" stroke="#4db6ac" strokeWidth="1.5"/>
    <text x="40" y="47" textAnchor="middle" fontSize="22" fontWeight="bold" fill="#4db6ac" fontFamily="serif">♛</text>
  </svg>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const parse  = (v: string) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const autoMul = (n: number) => parseFloat(Math.pow(MULTIPLIER, n).toFixed(2));
const winPct  = (n: number) => parseFloat(((0.5 ** n) * 100).toFixed(4));
const buildCards = (n: number): CoinCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, prediction: "heads" as Side, result: null, revealed: false }));

// ─── Styles ───────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

.cf {
  --bg:#0f1117; --panel:#181c27; --card:#1e2335; --border:#2a3050;
  --acc:#7c5ff5; --acc2:#5c44d0; --muted:#7a7f9a; --text:#e8e8f0;
  --gold:#f0a830; --gr:#4caf50; --gr2:#26a69a; --red:#ef5350;
  font-family:'Rajdhani',sans-serif; background:var(--bg); color:var(--text);
  display:flex; flex-direction:row; border-radius:12px; overflow:hidden;
  user-select:none; width:100%; min-height:480px;
}

/* ── Portrait: stack vertically ── */
@media (max-width: 560px) {
  .cf { flex-direction:column; min-height:unset; border-radius:0; }
  .cf-left { width:100% !important; min-width:unset !important; border-right:none !important; border-bottom:1px solid var(--border); max-height:unset; flex-direction:column; }
  .cf-right { flex:unset; }
  .cf-stage { min-height:220px !important; padding:16px 12px !important; }
  .cf-coin { width:100px !important; height:100px !important; }
  .cf-auto-grid { gap:8px !important; }
  .cf-coin-card { width:80px !important; height:80px !important; }
  .cf-stats-bar { flex-wrap:wrap; gap:10px !important; }
  .cf-panel-scroll { display:flex; flex-wrap:wrap; }
  .cf-panel-scroll .cf-section { flex:1 1 140px; }
  .cf-panel-actions { padding:10px 14px; display:flex; flex-direction:column; gap:8px; border-top:1px solid var(--border); }
}

/* ── Left panel ── */
.cf-left { width:200px; min-width:200px; background:var(--panel); border-right:1px solid var(--border); display:flex; flex-direction:column; overflow-y:auto; }
.cf-balance-bar { font-family:'Share Tech Mono',monospace; font-size:12px; color:var(--gold); padding:8px 14px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:6px; flex-shrink:0; }
.cf-tabs { display:flex; border-bottom:1px solid var(--border); flex-shrink:0; }
.cf-tab { flex:1; padding:10px 0; text-align:center; font-size:14px; font-weight:600; cursor:pointer; color:var(--muted); letter-spacing:.5px; transition:all .15s; }
.cf-tab.active { color:var(--text); background:var(--card); border-bottom:2px solid var(--acc); }
.cf-section { padding:10px 14px; border-bottom:1px solid var(--border); }
.cf-lbl { font-size:11px; color:var(--muted); letter-spacing:.8px; text-transform:uppercase; margin-bottom:5px; }

/* Inputs */
.cf-row { display:flex; gap:5px; align-items:center; }
.cf-inp { flex:1; background:var(--card); border:1px solid var(--border); border-radius:6px; padding:6px 8px; color:var(--text); font-family:'Share Tech Mono',monospace; font-size:12px; outline:none; min-width:0; transition:border-color .15s; }
.cf-inp:focus { border-color:var(--acc); }
.cf-inp:disabled { opacity:.45; cursor:not-allowed; }
.cf-sm { background:var(--card); border:1px solid var(--border); border-radius:6px; color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:11px; font-weight:600; padding:6px 7px; cursor:pointer; transition:all .15s; white-space:nowrap; }
.cf-sm:hover:not(:disabled) { border-color:var(--acc); color:var(--text); }
.cf-sm:disabled { opacity:.4; cursor:not-allowed; }
.cf-sel { width:100%; background:var(--card); border:1px solid var(--border); border-radius:6px; padding:7px 10px; color:var(--text); font-family:'Rajdhani',sans-serif; font-size:13px; outline:none; cursor:pointer; appearance:none; background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%237a7f9a' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat:no-repeat; background-position:right 10px center; }
.cf-sel:focus { border-color:var(--acc); }
.cf-sel:disabled { opacity:.4; cursor:not-allowed; }

/* Side buttons */
.cf-sides { display:flex; gap:8px; }
.cf-side { flex:1; padding:9px 6px; background:var(--card); border:2px solid var(--border); border-radius:8px; color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; text-align:center; }
.cf-side:hover { border-color:var(--muted); color:var(--text); }
.cf-side.heads.on { border-color:#7c5ff5; color:#a08aff; background:rgba(124,95,245,.12); }
.cf-side.tails.on { border-color:#26a69a; color:#4db6ac; background:rgba(38,166,154,.12); }

/* Main buttons */
.cf-btn { width:100%; padding:11px; background:var(--acc); border:none; border-radius:8px; color:#fff; font-family:'Rajdhani',sans-serif; font-size:15px; font-weight:700; cursor:pointer; letter-spacing:1px; transition:all .15s; }
.cf-btn:hover:not(:disabled) { background:var(--acc2); transform:translateY(-1px); }
.cf-btn:active:not(:disabled) { transform:translateY(0); }
.cf-btn:disabled { opacity:.5; cursor:not-allowed; transform:none; }
.cf-btn.stop { background:#c62828; }
.cf-btn.stop:hover:not(:disabled) { background:#b71c1c; }
.cf-btn.cash { background:linear-gradient(135deg,#f9a825,#f57f17); color:#1a1200; font-size:14px; }
.cf-btn.cash:hover:not(:disabled) { background:linear-gradient(135deg,#ffca28,#f9a825); transform:translateY(-1px); }

.cf-rand { width:100%; padding:8px; background:transparent; border:1px solid var(--border); border-radius:6px; color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:12px; font-weight:500; cursor:pointer; letter-spacing:.5px; transition:all .15s; }
.cf-rand:hover:not(:disabled) { border-color:var(--acc); color:var(--text); }
.cf-rand:disabled { opacity:.4; cursor:not-allowed; }

/* Win/loss row */
.cf-wl-row { display:flex; gap:5px; align-items:center; margin-top:6px; }
.cf-wl { flex:1; padding:5px 0; background:var(--card); border:1px solid var(--border); border-radius:5px; color:var(--muted); font-family:'Rajdhani',sans-serif; font-size:11px; font-weight:600; cursor:pointer; text-align:center; transition:all .15s; }
.cf-wl:hover:not(:disabled) { border-color:var(--acc); color:var(--text); }
.cf-wl:disabled { opacity:.4; cursor:not-allowed; }
.cf-wl.on { border-color:var(--acc); color:#a08aff; background:rgba(124,95,245,.12); }
.cf-pct { width:44px; background:var(--card); border:1px solid var(--border); border-radius:5px; padding:5px 4px; color:var(--text); font-family:'Share Tech Mono',monospace; font-size:11px; outline:none; text-align:right; }
.cf-pct:focus { border-color:var(--acc); }
.cf-pct:disabled { opacity:.4; cursor:not-allowed; }
.cf-inf { background:var(--card); border:1px solid var(--border); border-radius:5px; color:var(--muted); padding:5px 7px; font-size:13px; cursor:pointer; transition:all .15s; }
.cf-inf:hover { border-color:var(--acc); color:var(--text); }
.cf-inf.on { border-color:var(--acc); color:#a08aff; }
.cf-inf:disabled { opacity:.4; cursor:not-allowed; }

/* Profit/cashout section */
.cf-profit-box { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.cf-profit-num { font-family:'Share Tech Mono',monospace; font-size:15px; }
.cf-cashout-btn { padding:6px 14px; background:linear-gradient(135deg,#f9a825,#f57f17); border:none; border-radius:6px; color:#1a1200; font-family:'Rajdhani',sans-serif; font-size:13px; font-weight:700; cursor:pointer; letter-spacing:.5px; transition:all .15s; white-space:nowrap; }
.cf-cashout-btn:hover { background:linear-gradient(135deg,#ffca28,#f9a825); transform:scale(1.04); }

.cf-footer { padding:10px 14px; margin-top:auto; border-top:1px solid var(--border); flex-shrink:0; }

/* ── Right area ── */
.cf-right { flex:1; display:flex; flex-direction:column; background:var(--bg); min-width:0; }
.cf-stage { flex:1; display:flex; align-items:center; justify-content:center; position:relative; min-height:280px; padding:20px; }

/* Manual coin */
.cf-wrap { perspective:600px; }
.cf-coin { width:130px; height:130px; position:relative; transform-style:preserve-3d; }
.cf-coin.flip { animation:cfSpin 1.2s cubic-bezier(.25,.46,.45,.94) forwards; }
@keyframes cfSpin {
  0%   { transform:rotateY(0deg) rotateX(15deg); }
  20%  { transform:rotateY(360deg) rotateX(15deg) translateY(-30px); }
  50%  { transform:rotateY(900deg) rotateX(15deg) translateY(-50px); }
  80%  { transform:rotateY(1260deg) rotateX(15deg) translateY(-20px); }
  100% { transform:rotateY(var(--fr,1440deg)) rotateX(0deg) translateY(0); }
}
.cf-face { position:absolute; width:100%; height:100%; border-radius:50%; backface-visibility:hidden; display:flex; align-items:center; justify-content:center; }
.cf-fh { background:radial-gradient(circle at 35% 35%,#f5c842,#d4941a,#8a5e0a); box-shadow:0 0 0 6px #c07a10,inset 0 0 20px rgba(0,0,0,.3); }
.cf-ft { background:radial-gradient(circle at 35% 35%,#2bbbad,#1a8a82,#0d5551); box-shadow:0 0 0 6px #0f6b65,inset 0 0 20px rgba(0,0,0,.3); transform:rotateY(180deg); }

/* Auto grid */
.cf-auto-grid { display:flex; flex-wrap:wrap; gap:12px; justify-content:center; align-items:center; width:100%; }
.cf-card { position:relative; background:var(--card); border:2px solid var(--border); border-radius:10px; width:100px; height:100px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; transition:all .2s; }
.cf-card:hover { border-color:var(--muted); }
.cf-card.sh { border-color:#7c5ff5; }
.cf-card.st { border-color:#26a69a; }
.cf-card.ok { border-color:var(--gr); background:rgba(76,175,80,.08); }
.cf-card.no { border-color:var(--red); background:rgba(239,83,80,.08); }
.cf-card-n { position:absolute; top:6px; right:8px; font-size:10px; color:var(--muted); font-weight:600; }
.cf-card-l { font-size:10px; margin-top:4px; font-weight:600; letter-spacing:.5px; }
.cf-card-l.heads { color:#a08aff; }
.cf-card-l.tails { color:#4db6ac; }

/* Stats bar */
.cf-stats { background:var(--panel); border-top:1px solid var(--border); padding:10px 16px; display:flex; gap:16px; flex-wrap:wrap; }
.cf-stat { display:flex; flex-direction:column; gap:3px; }
.cf-stat-l { font-size:10px; color:var(--muted); letter-spacing:.8px; text-transform:uppercase; }
.cf-stat-v { background:var(--card); border:1px solid var(--border); border-radius:6px; padding:5px 10px; font-family:'Share Tech Mono',monospace; font-size:13px; }
.cf-stat-u { font-size:10px; color:var(--muted); margin-left:4px; }

/* History */
.cf-hist { background:var(--panel); border-top:1px solid var(--border); padding:8px 16px; flex-shrink:0; }
.cf-hist-dots { display:flex; gap:4px; overflow:hidden; }
.cf-dot { width:20px; height:20px; border-radius:50%; flex-shrink:0; display:flex; align-items:center; justify-content:center; font-size:8px; font-weight:700; color:#fff; }
.cf-dot.heads { background:#7c5ff5; }
.cf-dot.tails { background:#26a69a; }
.cf-dot.empty { background:var(--card); border:1px solid var(--border); }

/* Overlays */
.cf-res { position:absolute; top:18%; left:50%; transform:translateX(-50%); font-size:20px; font-weight:700; letter-spacing:2px; padding:8px 20px; border-radius:8px; opacity:0; transition:opacity .3s; pointer-events:none; white-space:nowrap; z-index:5; }
.cf-res.show { opacity:1; }
.cf-res.win  { color:var(--gr);  border:2px solid var(--gr);  background:rgba(76,175,80,.1); }
.cf-res.lose { color:var(--red); border:2px solid var(--red); background:rgba(239,83,80,.1); }
.cf-toast { position:absolute; top:12px; right:12px; padding:7px 14px; border-radius:8px; font-size:12px; font-weight:600; opacity:0; transform:translateY(-8px); transition:all .3s; pointer-events:none; z-index:10; }
.cf-toast.show { opacity:1; transform:translateY(0); }
.cf-toast.win  { background:rgba(76,175,80,.15); border:1px solid var(--gr);  color:var(--gr); }
.cf-toast.lose { background:rgba(239,83,80,.15); border:1px solid var(--red); color:var(--red); }
.cf-toast.info { background:rgba(240,168,48,.15); border:1px solid var(--gold); color:var(--gold); }

.cf-pulse { animation:cfP 1.4s ease-in-out infinite; }
@keyframes cfP { 0%,100%{opacity:1} 50%{opacity:.55} }

/* cashout glow animation */
@keyframes cfGlow {
  0%,100% { box-shadow:0 0 0 0 rgba(249,168,37,0); }
  50%      { box-shadow:0 0 12px 4px rgba(249,168,37,.4); }
}
.cf-cashout-btn.pulse { animation:cfGlow 1.6s ease-in-out infinite; }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function CoinFlip() {
  // shared
  const [tab,       setTab]       = useState<TabMode>("manual");
  const [balance,   setBalance]   = useState(INITIAL_BALANCE);
  const [sessionP,  setSessionP]  = useState(0);   // net profit display
  const [pendingCash, setPendingCash] = useState(0); // winnings held until cashout
  const [history,   setHistory]   = useState<HistoryEntry[]>([]);
  const [toast,     setToast]     = useState<ToastState>({ message:"", type:null, visible:false });
  const [resOv,     setResOv]     = useState<{ text:string; type:"win"|"lose"|null; visible:boolean }>({ text:"", type:null, visible:false });

  // manual
  const [bet,       setBet]       = useState("2.00");
  const [side,      setSide]      = useState<Side>("heads");
  const [flipping,  setFlipping]  = useState(false);
  const [flipAnim,  setFlipAnim]  = useState(false);
  const [finalRot,  setFinalRot]  = useState(0);
  const [coinRot,   setCoinRot]   = useState(0);
  const [canCash,   setCanCash]   = useState(false);  // show cashout after win

  // auto
  const [autoBet,   setAutoBet]   = useState("2.00");
  const [toss,      setToss]      = useState(5);
  const [betCnt,    setBetCnt]    = useState("0");
  const [infBets,   setInfBets]   = useState(true);
  const [winMode,   setWinMode]   = useState<OnWinLossMode>("reset");
  const [winPct_,   setWinPct_]   = useState("0");
  const [lossMode,  setLossMode]  = useState<OnWinLossMode>("reset");
  const [lossPct_,  setLossPct_]  = useState("0");
  const [stopP,     setStopP]     = useState("0.00");
  const [stopL,     setStopL]     = useState("0.00");
  const [cards,     setCards]     = useState<CoinCard[]>(() => buildCards(5));
  const [running,   setRunning]   = useState(false);
  const [roundP,    setRoundP]    = useState(0);
  const [revealing, setRevealing] = useState(false);

  const toastRef   = useRef<ReturnType<typeof setTimeout>|null>(null);
  const resRef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const autoRef    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const runningRef = useRef(false);
  const balRef     = useRef(INITIAL_BALANCE);
  const roundRef   = useRef(0);

  useEffect(() => { balRef.current = balance; }, [balance]);
  useEffect(() => { roundRef.current = roundP; }, [roundP]);
  useEffect(() => { setCards(buildCards(toss)); }, [toss]);

  // ── Toast / overlay ────────────────────────────────────────────────────────
  const fireToast = useCallback((message: string, type: "win"|"lose"|"info") => {
    if (toastRef.current) clearTimeout(toastRef.current);
    setToast({ message, type, visible: true });
    toastRef.current = setTimeout(() => setToast(p => ({ ...p, visible: false })), 2300);
  }, []);

  const fireRes = useCallback((text: string, type: "win"|"lose") => {
    if (resRef.current) clearTimeout(resRef.current);
    setResOv({ text, type, visible: true });
    resRef.current = setTimeout(() => setResOv(p => ({ ...p, visible: false })), 2300);
  }, []);

  const pushHistory = useCallback((result: Side, won: boolean) => {
    setHistory(p => [{ result, won }, ...p].slice(0, HISTORY_MAX));
  }, []);

  // ── Cashout ────────────────────────────────────────────────────────────────
  const cashOut = () => {
    if (pendingCash <= 0) return;
    setBalance(v => v + pendingCash);
    fireToast(`💰 提現 ${pendingCash.toFixed(2)} EUR 成功！`, "info");
    setPendingCash(0);
    setCanCash(false);
  };

  // ── Manual ─────────────────────────────────────────────────────────────────
  const doFlip = useCallback((forceSide?: Side) => {
    if (flipping) return;
    const b = parse(bet);
    if (b <= 0 || b > balRef.current) { fireToast(b > balRef.current ? "餘額不足！" : "無效金額", "lose"); return; }

    const chosen: Side = forceSide ?? side;
    setSide(chosen);
    setFlipping(true);
    setCanCash(false);

    const result: Side = Math.random() < 0.5 ? "heads" : "tails";
    const won = result === chosen;
    const rot = result === "heads" ? 1440 : 1620;

    setFinalRot(rot);
    setFlipAnim(true);
    setBalance(v => v - b);

    setTimeout(() => {
      setCoinRot(result === "heads" ? 0 : 180);
      setFlipAnim(false);

      const gain = won ? b * (MULTIPLIER - 1) : -b;
      if (won) {
        setPendingCash(p => p + b * MULTIPLIER);  // 贏錢存入待提現，不直接加餘額
        setSessionP(p => p + gain);
        setCanCash(true);
        fireRes(`勝利！ ＋${gain.toFixed(2)}`, "win");
        fireToast(`🎉 贏了 ${gain.toFixed(2)} EUR`, "win");
      } else {
        setSessionP(p => p + gain);
        fireRes(`輸了 −${b.toFixed(2)}`, "lose");
        fireToast(`💀 輸了 ${b.toFixed(2)} EUR`, "lose");
      }
      pushHistory(result, won);
      setFlipping(false);
    }, FLIP_DURATION);
  }, [flipping, bet, side, fireToast, fireRes, pushHistory]);

  // 隨機選擇一面 → 直接下注
  const randomAndBet = () => {
    const s: Side = Math.random() < 0.5 ? "heads" : "tails";
    doFlip(s);
  };

  // ── Auto round ─────────────────────────────────────────────────────────────
  const runRound = useCallback((
    curBet: number, remaining: number, sessP: number,
    sp: number, sl: number,
    wm: OnWinLossMode, wp: number,
    lm: OnWinLossMode, lp: number,
    preds: Side[], baseBet: number,
  ) => {
    if (!runningRef.current) return;
    const bal = balRef.current;
    if (sp > 0 && sessP >= sp) { stopAuto(); return; }
    if (sl > 0 && sessP <= -sl) { stopAuto(); return; }
    if (!infBets && remaining <= 0) { stopAuto(); return; }

    const b = Math.min(curBet, bal);
    if (b <= 0) { stopAuto(); return; }

    setBalance(v => v - b);
    setRevealing(true);

    const results: Side[] = preds.map(() => Math.random() < 0.5 ? "heads" : "tails");
    const allOk = results.every((r, i) => r === preds[i]);

    let delay = 0;
    results.forEach((res, i) => {
      delay += 280;
      const d = delay;
      autoRef.current = setTimeout(() => {
        setCards(prev => prev.map(c => c.id === i + 1 ? { ...c, result: res, revealed: true } : c));
      }, d);
    });

    autoRef.current = setTimeout(() => {
      const payout = allOk ? b * autoMul(preds.length) : 0;
      const gain   = payout - b;
      if (allOk) { setPendingCash(p => p + payout); fireToast(`🎉 全中！ ＋${gain.toFixed(2)}`, "win"); }
      else        { fireToast(`💀 輸了 ${b.toFixed(2)} EUR`, "lose"); }

      const newSessP = sessP + gain;
      setRoundP(newSessP);
      setSessionP(p => p + gain);
      pushHistory(allOk ? "heads" : "tails", allOk);

      let nextBet = wm === "reset" && allOk  ? baseBet : allOk  ? curBet * (1 + wp / 100)  : curBet;
      if (!allOk) nextBet = lm === "reset"   ? baseBet : curBet * (1 + lp / 100);

      const newRem = infBets ? remaining : remaining - 1;
      setRevealing(false);

      if (!runningRef.current) return;
      setTimeout(() => {
        setCards(prev => prev.map(c => ({ ...c, result: null, revealed: false })));
        autoRef.current = setTimeout(() => {
          if (!runningRef.current) return;
          runRound(nextBet, newRem, newSessP, sp, sl, wm, wp, lm, lp, preds, baseBet);
        }, 400);
      }, 700);
    }, delay + 400);
  }, [fireToast, pushHistory, infBets]);

  const stopAuto = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    setRevealing(false);
    if (autoRef.current) clearTimeout(autoRef.current);
  }, []);

  const startAuto = () => {
    if (running) { stopAuto(); return; }
    const b = parse(autoBet);
    if (b <= 0 || b > balance) { fireToast(b > balance ? "餘額不足！" : "無效金額", "lose"); return; }
    const preds = cards.map(c => c.prediction);
    const sp = parseFloat(stopP) || 0;
    const sl = parseFloat(stopL) || 0;
    const wp = parseFloat(winPct_) || 0;
    const lp = parseFloat(lossPct_) || 0;
    const cnt = infBets ? Infinity : parse(betCnt);
    runningRef.current = true;
    setRunning(true);
    setRoundP(0);
    setCards(prev => prev.map(c => ({ ...c, result: null, revealed: false })));
    runRound(b, cnt as number, 0, sp, sl, winMode, wp, lossMode, lp, preds, b);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const aMul    = autoMul(toss);
  const aChance = winPct(toss);
  const aPot    = (parse(autoBet) * aMul - parse(autoBet)).toFixed(2);

  const cardCls = (c: CoinCard) => {
    if (c.revealed) return "cf-card " + (c.result === c.prediction ? "ok" : "no");
    return "cf-card " + (c.prediction === "heads" ? "sh" : "st");
  };

  const histDots = Array.from({ length: HISTORY_MAX }, (_, i) => history[i] || null);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{CSS}</style>
      <div className="cf">

        {/* ════ LEFT PANEL ════ */}
        <div className="cf-left">
          <div className="cf-balance-bar"><span>⬡</span><span>{balance.toFixed(2)} EUR</span></div>

          <div className="cf-tabs">
            <div className={`cf-tab ${tab==="manual"?"active":""}`} onClick={()=>!running&&setTab("manual")}>手動</div>
            <div className={`cf-tab ${tab==="auto"?"active":""}`}   onClick={()=>!flipping&&setTab("auto")}>自動</div>
          </div>

          {/* ── MANUAL ── */}
          {tab === "manual" && (<>
            <div className="cf-section">
              <div className="cf-lbl">下注金額</div>
              <div className="cf-row">
                <input className="cf-inp" type="number" min="0.01" step="0.01" value={bet} disabled={flipping} onChange={e=>setBet(e.target.value)}/>
                <button className="cf-sm" disabled={flipping} onClick={()=>setBet(v=>Math.max(0.01,parse(v)/2).toFixed(2))}>½</button>
                <button className="cf-sm" disabled={flipping} onClick={()=>setBet(v=>(parse(v)*2).toFixed(2))}>2×</button>
              </div>
            </div>

            <div className="cf-section">
              <button className="cf-btn" disabled={flipping} onClick={()=>doFlip()}>下注</button>
            </div>

            {/* 隨機選擇一面 → 直接下注 */}
            <div className="cf-section">
              <button className="cf-rand" disabled={flipping} onClick={randomAndBet}>隨機選擇一面</button>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">選擇面</div>
              <div className="cf-sides">
                <button className={`cf-side heads ${side==="heads"?"on":""}`} onClick={()=>setSide("heads")}>正面 ★</button>
                <button className={`cf-side tails ${side==="tails"?"on":""}`} onClick={()=>setSide("tails")}>反面 ♛</button>
              </div>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">總利潤 <span style={{fontSize:10,color:"var(--muted)"}}>(1.90×)</span></div>
              <div className="cf-profit-box">
                <span className="cf-profit-num" style={{color: pendingCash>0?"var(--gr)":sessionP>=0?"var(--muted)":"var(--red)"}}>
                  {pendingCash > 0 ? `+${pendingCash.toFixed(2)}` : sessionP.toFixed(2)} EUR
                </span>
                {pendingCash > 0 && (
                  <button className={`cf-cashout-btn ${canCash?"pulse":""}`} onClick={cashOut}>提現</button>
                )}
              </div>
            </div>

            <div className="cf-footer">
              <div className="cf-lbl">餘額</div>
              <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:13}}>{balance.toFixed(2)}</div>
            </div>
          </>)}

          {/* ── AUTO ── */}
          {tab === "auto" && (<>
            <div className="cf-section">
              <div className="cf-lbl">下注金額</div>
              <div className="cf-row">
                <input className="cf-inp" type="number" min="0.01" step="0.01" value={autoBet} disabled={running} onChange={e=>setAutoBet(e.target.value)}/>
                <button className="cf-sm" disabled={running} onClick={()=>setAutoBet(v=>Math.max(0.01,parse(v)/2).toFixed(2))}>½</button>
                <button className="cf-sm" disabled={running} onClick={()=>setAutoBet(v=>(parse(v)*2).toFixed(2))}>2×</button>
              </div>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">投擲</div>
              <select className="cf-sel" value={toss} disabled={running} onChange={e=>setToss(Number(e.target.value))}>
                {TOSS_OPTIONS.map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">下注次數</div>
              <div className="cf-row">
                <input className="cf-inp" type="number" min="1" value={betCnt} disabled={running||infBets} onChange={e=>setBetCnt(e.target.value)} style={{opacity:infBets?.4:1}}/>
                <button className={`cf-inf ${infBets?"on":""}`} disabled={running} onClick={()=>setInfBets(p=>!p)}>∞</button>
              </div>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">贏得時</div>
              <div className="cf-wl-row">
                <button className={`cf-wl ${winMode==="reset"?"on":""}`}    disabled={running} onClick={()=>setWinMode("reset")}>重置</button>
                <button className={`cf-wl ${winMode==="increase"?"on":""}`} disabled={running} onClick={()=>setWinMode("increase")}>增加</button>
                <input className="cf-pct" type="number" min="0" value={winPct_} disabled={running||winMode==="reset"} onChange={e=>setWinPct_(e.target.value)} style={{opacity:winMode==="reset"?.4:1}}/>
                <span style={{fontSize:11,color:"var(--muted)"}}>%</span>
              </div>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">輸掉時</div>
              <div className="cf-wl-row">
                <button className={`cf-wl ${lossMode==="reset"?"on":""}`}    disabled={running} onClick={()=>setLossMode("reset")}>重置</button>
                <button className={`cf-wl ${lossMode==="increase"?"on":""}`} disabled={running} onClick={()=>setLossMode("increase")}>增加</button>
                <input className="cf-pct" type="number" min="0" value={lossPct_} disabled={running||lossMode==="reset"} onChange={e=>setLossPct_(e.target.value)} style={{opacity:lossMode==="reset"?.4:1}}/>
                <span style={{fontSize:11,color:"var(--muted)"}}>%</span>
              </div>
            </div>

            <div className="cf-section">
              <div className="cf-lbl">在利潤時停止</div>
              <input className="cf-inp" type="number" min="0" step="0.01" value={stopP} disabled={running} onChange={e=>setStopP(e.target.value)} style={{width:"100%"}}/>
            </div>
            <div className="cf-section">
              <div className="cf-lbl">在損失時停止</div>
              <input className="cf-inp" type="number" min="0" step="0.01" value={stopL} disabled={running} onChange={e=>setStopL(e.target.value)} style={{width:"100%"}}/>
            </div>

            {/* 隨機選擇（自動模式下只重新分配預測，不直接下注） */}
            <div className="cf-section">
              <button className="cf-rand" disabled={running} onClick={()=>setCards(p=>p.map(c=>({...c,prediction:Math.random()<.5?"heads":"tails",result:null,revealed:false})))}>隨機選擇</button>
            </div>
            <div className="cf-section">
              <button className={`cf-btn ${running?"stop":""}`} onClick={startAuto}>
                {running?"停止自動下注":"開始自動下注"}
              </button>
            </div>

            {/* 總利潤 + 提現（自動模式） */}
            <div className="cf-section">
              <div className="cf-lbl">總利潤</div>
              <div className="cf-profit-box">
                <span className="cf-profit-num" style={{color:pendingCash>0?"var(--gr)":sessionP>=0?"var(--muted)":"var(--red)"}}>
                  {pendingCash > 0 ? `+${pendingCash.toFixed(2)}` : sessionP.toFixed(2)} EUR
                </span>
                {pendingCash > 0 && (
                  <button className="cf-cashout-btn" onClick={cashOut}>提現</button>
                )}
              </div>
            </div>
          </>)}
        </div>

        {/* ════ RIGHT AREA ════ */}
        <div className="cf-right">
          <div className="cf-stage">
            <div className={`cf-res ${resOv.visible?"show":""} ${resOv.type??""}`}>{resOv.text}</div>
            <div className={`cf-toast ${toast.visible?"show":""} ${toast.type??""}`}>{toast.message}</div>

            {/* Manual coin */}
            {tab === "manual" && (
              <div className="cf-wrap">
                <div
                  className={`cf-coin ${flipAnim?"flip":""}`}
                  style={{"--fr":`${finalRot}deg`, transform:flipAnim?undefined:`rotateY(${coinRot}deg)`} as React.CSSProperties}
                >
                  <div className="cf-face cf-fh"><HeadsSVG size={70}/></div>
                  <div className="cf-face cf-ft"><TailsSVG size={70}/></div>
                </div>
              </div>
            )}

            {/* Auto grid */}
            {tab === "auto" && (
              <div className="cf-auto-grid">
                {cards.map(c=>(
                  <div key={c.id} className={cardCls(c)} onClick={()=>{ if(running||revealing)return; setCards(p=>p.map(x=>x.id===c.id?{...x,prediction:x.prediction==="heads"?"tails":"heads",result:null,revealed:false}:x)); }}>
                    <span className="cf-card-n">{c.id}</span>
                    {(c.revealed && c.result)
                      ? (c.result==="heads" ? <HeadsSVG size={50}/> : <TailsSVG size={50}/>)
                      : (c.prediction==="heads" ? <HeadsSVG size={50}/> : <TailsSVG size={50}/>)
                    }
                    <span className={`cf-card-l ${c.prediction}`}>{c.prediction==="heads"?"正面":"反面"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Auto stats */}
          {tab === "auto" && (
            <div className="cf-stats">
              <div className="cf-stat">
                <span className="cf-stat-l">贏得利潤 ({aMul}×)</span>
                <div className="cf-stat-v"><span className={running?"cf-pulse":""}>{aPot}</span><span className="cf-stat-u">EUR</span></div>
              </div>
              <div className="cf-stat">
                <span className="cf-stat-l">機會</span>
                <div className="cf-stat-v"><span>{aChance}</span><span className="cf-stat-u">%</span></div>
              </div>
              {running && (
                <div className="cf-stat">
                  <span className="cf-stat-l">本輪利潤</span>
                  <div className="cf-stat-v" style={{color:roundP>=0?"var(--gr)":"var(--red)"}}>
                    <span>{roundP>=0?"+":""}{roundP.toFixed(2)}</span><span className="cf-stat-u">EUR</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div className="cf-hist">
            <div className="cf-lbl" style={{marginBottom:6,fontSize:10}}>歷史記錄</div>
            <div className="cf-hist-dots">
              {histDots.map((e,i)=>(
                <div key={i} className={`cf-dot ${e?e.result:"empty"}`}>{e?(e.result==="heads"?"H":"T"):""}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
