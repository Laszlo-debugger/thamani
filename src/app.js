const D = window.__D, M = D.macroK, ICO = window.__ICO;
const GOALS = {
  income:{t:"Income now",s:"I want cash reaching my account",h:"after-tax dividend, whether it is covered by earnings, and whether it beats the risk-free rate"},
  growth:{t:"Growth",s:"I want the price to rise",h:"earnings growth against what you pay, penalising profit that will not repeat"},
  safety:{t:"Safety first",s:"I want to not lose money",h:"dividend coverage, liquidity, momentum, and whether it keeps pace with inflation"},
  preserve:{t:"I cannot afford to lose it",s:"This is money I need",h:"nothing on this exchange — see the answer"}
};
const IDX = {}; D.counters.forEach(c => IDX[c.tk] = c);
let GOAL = null, Q = "", AMT = null;
try { GOAL = localStorage.getItem("th-goal"); AMT = parseFloat(localStorage.getItem("th-amt"))||null; } catch(e){}
if (!GOALS[GOAL]) GOAL = null;
if (!(AMT > 0)) AMT = null;
const A = ()=> AMT || M.order;
/* gate 1 and every score depend on YOUR amount, so they are computed here, not baked in */
function gates(c){
  const g1 = c.to >= A()*10;
  return [g1, c.g[1], c.g[2], c.g[3], c.g[4]];
}
function pctOfDay(c){ return c.to ? +(A()/c.to*100).toFixed(1) : null; }
function shares(c){ return Math.floor(A()/c.price); }
function scoreOf(c, goal){
  if (goal==="preserve") return null;
  const g = gates(c);
  if (!g[0]) return null;                      // access gate uses YOUR amount
  const s = c.sc[goal];
  return s;                                     // other gates unchanged
}

/* ── helpers ── */
const E = (s)=>String(s==null?"":s);
const num=(v,d=2,suf="")=>v==null?'<span class="fl">&mdash;</span>':v.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d})+suf;
const mny=(v)=>v>=1e9?(v/1e9).toFixed(2)+"bn":v>=1e6?(v/1e6).toFixed(1)+"m":Math.round(v/1e3)+"k";
const chg=(c)=>c==null?"&mdash;":`<span class="${c>0?'up':c<0?'dn':'fl'}">${c>0?"+":""}${c.toFixed(2)}%</span>`;
const hrs=(iso)=>(Date.now()-new Date(iso).getTime())/36e5;
const age=(h)=>h<1?Math.max(1,Math.round(h*60))+" min ago":h<48?Math.round(h)+" hours ago":Math.round(h/24)+" days ago";
const fmtA=()=>{const v=A();return v>=1e6?"KES "+(v/1e6).toFixed(v%1e6?2:1)+"m":"KES "+v.toLocaleString()};
const ksh=(v)=>"KES "+Math.round(v).toLocaleString();
const tick=(b)=>b?'<i class="pa">&#10003;</i>':'<i class="fa">&#10007;</i>';

function verdict(c, goal){
  const g = goal || "safety";
  if (g === "preserve") return {v:"NA", why:"On this goal nothing on the exchange qualifies. See the Desk."};
  const s = scoreOf(c, g);
  if (s == null){
    if (!gates(c)[0]) return {v:"NA", why:`<b>Fails the access gate.</b> A full day of trading is ${mny(c.to)} — your ${fmtA()} would be ${pctOfDay(c)}% of it. You would push the price up against yourself buying, and find nobody there selling.`};
    if (g==="income") return {v:"NA", why:"No covered dividend, so it cannot answer an income goal."};
    if (g==="growth") return {v:"NA", why:"No published earnings, so growth cannot be assessed."};
    return {v:"NA", why:"Fails an earlier gate — see the gate panel."};
  }
  const band = g==="income" ? [70,45] : g==="growth" ? [25,12] : [15,5];
  const v = s >= band[0] ? "BUY" : s >= band[1] ? "HOLD" : "AVOID";
  return {v, s, why:null};
}

function ring(c, goal){
  const g = goal==="preserve"||!goal ? "safety" : goal;
  const raw = scoreOf(c, g);
  const cap = g==="income"?90:g==="growth"?40:35;
  const pct = raw==null ? 0 : Math.max(0, Math.min(1, raw/cap));
  const col = raw==null ? "#3a3a44" : pct>.72 ? "#e5a32c" : pct>.42 ? "#c98500" : "#8a5a2a";
  const dash = (2*Math.PI*15*pct).toFixed(1);
  return `<div class="ring"><svg viewBox="0 0 34 34" width="34" height="34">
<circle cx="17" cy="17" r="15" fill="none" stroke="#20202a" stroke-width="2.6"/>
<circle cx="17" cy="17" r="15" fill="none" stroke="${col}" stroke-width="2.6" stroke-linecap="round"
 stroke-dasharray="${dash} 200"/></svg><i style="color:${col}">${raw==null?"–":Math.max(0,Math.round(raw))}</i></div>`;
}

/* momentum: three states, not two. A reading, calm, or NOT VERIFIED.
   An unverified reading must never render as calm — that is the failure mode
   that makes a stale page look current. */
function rsiPill(c){
  if(c.rsiu) return '<span class="pill wn" title="Momentum could not be re-checked">not verified</span>';
  if(c.rsi==null) return '<span class="pill ok">calm</span>';
  return `<span class="pill ${c.rsi>=90?'bd':c.rsi>=80?'wn':'gd'}">${Math.round(c.rsi)}</span>`;
}
function rsiWords(c){
  if(c.rsiu) return "Momentum has not been re-checked since the reading was taken, so it is not counted. Treat the timing of this one as unknown rather than as safe.";
  if(c.rsi==null) return "Below 70 &mdash; the crowd has not piled in";
  return c.rsi>=90 ? "Severely overbought" : "Overbought &mdash; you would be arriving after the move";
}

/* ── charts ── */
function spark(vals, w=170, h=54){
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(hi===lo) hi=lo+1;
  const pad=(hi-lo)*.18; lo-=pad; hi+=pad;
  const n=vals.length, X=i=>6+i*(w-12)/(n-1), Y=v=>h-8-(v-lo)/(hi-lo)*(h-18);
  const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const z = lo<0&&0<hi ? `<line x1="6" y1="${Y(0).toFixed(1)}" x2="${w-6}" y2="${Y(0).toFixed(1)}" stroke="#2b2b33" stroke-dasharray="2 3"/>`:"";
  const dots=vals.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i===n-1?4:2.3}" fill="${i===n-1?'#c98500':'#a06e13'}" stroke="#16161b" stroke-width="2"><title>${D.tlabels[i]}: ${v>0?"+":""}${v.toFixed(1)}%</title></circle>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${z}<polyline points="${pts}" fill="none" stroke="#c98500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}
function spark3(vals, labels, w=170, h=54){
  let lo=Math.min(...vals), hi=Math.max(...vals);
  if(hi===lo) hi=lo+1;
  const pad=(hi-lo)*.18; lo-=pad; hi+=pad;
  const n=vals.length, X=i=>6+i*(w-12)/(n-1), Y=v=>h-8-(v-lo)/(hi-lo)*(h-18);
  const pts=vals.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const dots=vals.map((v,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="${i===n-1?4:2.6}" fill="${i===n-1?'#c98500':'#a06e13'}" stroke="#16161b" stroke-width="2"><title>${labels[i]}: ${v.toFixed(2)}</title></circle>`).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
<polyline points="${pts}" fill="none" stroke="#c98500" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${dots}</svg>`;
}
function fiveYear(){
  const hm = D.histmeta, L = [hm.d1, hm.d2, hm.d3];
  const ks = Object.keys(D.hist).sort((a,b)=>D.hist[b].t-D.hist[a].t);
  const best = D.hist[ks[0]], worst = D.hist[ks[ks.length-1]];
  const grew = ks.filter(k=>D.hist[k].t>0).length;
  const fellFirst = ks.filter(k=>D.hist[k].e<0).length;
  const panels = ks.map(k=>{const h=D.hist[k];
    return `<a class="smc" href="#/stock/${k}"><h5>${h.n}<s>${k}</s></h5>${spark3([h.a,h.b,h.c],L)}
<f><span>${h.a.toFixed(2)} &rarr; ${h.c.toFixed(2)}</span><b class="${h.t>0?'up':'dn'}">${h.t>0?"+":""}${Math.round(h.t)}%</b></f>
<div style="font:9.5px var(--mono);color:var(--tm);margin-top:2px">2021&ndash;24 ${h.e>0?"+":""}${Math.round(h.e)}% &middot; 2024&ndash;26 ${h.l>0?"+":""}${Math.round(h.l)}%</div></a>`}).join("");
  const rows = ks.map(k=>{const h=D.hist[k], then=Math.floor(A()/h.a)*h.c;
    return `<tr onclick="location.hash='#/stock/${k}'"><td><b>${h.n}</b> <span style="color:var(--tm);font:10.5px var(--mono)">${k}</span></td>
<td class="mono">${h.a.toFixed(2)}</td><td class="mono" style="color:var(--tm)">${h.b.toFixed(2)}</td><td class="mono"><b>${h.c.toFixed(2)}</b></td>
<td class="mono ${h.e>0?'up':'dn'}">${h.e>0?"+":""}${h.e.toFixed(0)}%</td>
<td class="mono ${h.l>0?'up':'dn'}">${h.l>0?"+":""}${h.l.toFixed(0)}%</td>
<td class="mono ${h.t>0?'up':'dn'}"><b>${h.t>0?"+":""}${h.t.toFixed(0)}%</b></td>
<td class="mono ${then>A()?'up':'dn'}">${ksh(then)}</td></tr>`}).join("");
  return `<section style="margin-top:34px"><div class="eyb">Five years, and it is not a curve</div>
<h2 class="st">What ${hm.n} of these shares cost in 2021, in 2024, and now</h2>
<p class="lede">Three closes, ${hm.d1} to ${hm.d3} &mdash; four years and ten months. Every figure is the price printed on a page that stamped its own trading date, and I checked both pages myself rather than taking one reading. <b>The line between the dots is not data.</b> It is drawn so you can see the shape; the price did things in between that no source available here recorded.</p>
<div class="grid g4" style="margin:14px 0 4px">
<div class="kpi"><v>${grew}/${hm.n}</v><k>Worth more than in 2021</k></div>
<div class="kpi w"><v>${fellFirst}</v><k>Fell over the first three years</k></div>
<div class="kpi"><v>+${Math.round(best.t)}%</v><k>${best.n}, best of the ${hm.n}</k></div>
<div class="kpi c"><v>${Math.round(worst.t)}%</v><k>${worst.n}, worst of the ${hm.n}</k></div></div>
<div class="sm" style="margin-top:12px">${panels}</div>
<div class="card" style="margin-top:16px"><div class="scroll"><table>
<thead><tr><th>Company</th><th>${hm.d1}</th><th>${hm.d2}</th><th>${hm.d3}</th><th>To 2024</th><th>Since 2024</th><th>Whole period</th><th>${fmtA()} then, now</th></tr></thead>
<tbody>${rows}</tbody></table></div>
<div style="margin-top:12px;font:11px/1.7 var(--mono);color:var(--tm)">Last column: whole shares ${fmtA()} would have bought at the 2021 price, valued at the 2026 price. Price only &mdash; the dividends paid in between are on top, and for the banks that is a large amount left out.</div></div>
<div class="co r"><b>Read Safaricom first.</b> The most owned share on this exchange, the one everybody's aunt holds, is <b>${Math.abs(Math.round(D.hist.SCOM.t))}% below</b> where it was five years ago &mdash; it fell ${Math.abs(Math.round(D.hist.SCOM.e))}% to November 2024 and has since climbed ${Math.round(D.hist.SCOM.l)}%. Anyone who bought in 2021 waited four years to be wrong and is still not whole. <b>${fellFirst} of these ${hm.n} were worth less in 2024 than in 2021.</b> Nearly all of the gain you see happened in the last twenty-one months, which is also why so much of this market now reads as overbought.</div>
<div class="co b"><b>What this is not.</b> Not adjusted for dividends, bonus issues or share splits &mdash; a company that split its shares would show here as a fall that never happened, so check the counter's own page before trusting a number. And not a daily series. ${hm.note} Two verified dates and today is what is honestly available, and it is still enough to see which shares went up, which went nowhere, and which went backwards.</div>
</section>`;
}
function divChart(){
  const items = D.counters.filter(c=>c.dy>0 && c.flag!=="TRAP")
    .sort((a,b)=>b.net-a.net).slice(0,16);
  const mx = Math.max(...items.map(i=>Math.abs(i.net-M.tbn)))*1.1;
  const W=880,BH=22,GAP=8,NX=214,ZX=524,HALF=300,sc=HALF/mx;
  const H=items.length*(BH+GAP)+34;
  const rows=items.map((c,i)=>{
    const y=26+i*(BH+GAP), d=c.net-M.tbn, wpx=Math.max(Math.abs(d)*sc,2.5);
    const x = d>=0?ZX:ZX-wpx, col = d>=0?"#c98500":"#3987e5";
    const cov = c.payout!=null && c.payout<90;
    const vx = d>=0 ? x+wpx+9 : x-9;
    return `<g><rect x="${x.toFixed(1)}" y="${y}" width="${wpx.toFixed(1)}" height="${BH}" rx="4" fill="${col}" opacity="${gates(c)[0]?1:.4}"/>
<text x="${NX}" y="${y+15}" text-anchor="end" fill="#f2f0ec" font-size="12" font-weight="600" font-family="Archivo,sans-serif">${c.name}</text>
<text x="${vx.toFixed(1)}" y="${y+15}" text-anchor="${d>=0?'start':'end'}" fill="#a5a09a" font-size="11.5" font-weight="600" font-family="Roboto Mono,monospace">${c.net.toFixed(2)}% <tspan fill="${cov?'#4cc98e':'#e8a83c'}">${cov?'✓':'⚠'}</tspan></text>
<title>${c.name} (${c.tk}) — ${c.net.toFixed(2)}% after ${M.divt*100}% tax · payout ${c.payout==null?'?':c.payout}% · ${cov?'covered':'NOT covered'} · ${gates(c)[0]?'absorbs your order':'illiquid at your size'}</title></g>`;
  }).join("");
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">
<line x1="${ZX}" y1="14" x2="${ZX}" y2="${H-6}" stroke="#f0c968" stroke-width="1.5" stroke-dasharray="4 3"/>
<text x="${ZX}" y="10" text-anchor="middle" fill="#f0c968" font-size="10" font-weight="700" font-family="Roboto Mono,monospace" letter-spacing="1">T-BILL ${M.tbn.toFixed(2)}% NET</text>
${rows}</svg>`;
}
function cliff(){
  const it=[...D.counters].sort((a,b)=>b.to-a.to).slice(0,18), mx=it[0].to;
  const W=880,BH=20,GAP=6,H=it.length*(BH+GAP)+14;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%">`+it.map((c,i)=>{
    const y=6+i*(BH+GAP), w=Math.max((c.to/mx)*(W-290),2);
    return `<g><text x="176" y="${y+14}" text-anchor="end" fill="#f2f0ec" font-size="12" font-weight="600" font-family="Archivo,sans-serif">${c.name}</text>
<rect x="184" y="${y}" width="${w.toFixed(1)}" height="${BH}" rx="4" fill="${gates(c)[0]?'#e5a32c':'#7a570d'}"><title>${c.name}: ${mny(c.to)} traded · your order = ${pctOfDay(c)}% of the day</title></rect>
<text x="${(184+w+8).toFixed(1)}" y="${y+14}" fill="#a5a09a" font-size="11" font-weight="600" font-family="Roboto Mono,monospace">${mny(c.to)} <tspan fill="${gates(c)[0]?'#4cc98e':'#e8a83c'}">${gates(c)[0]?'✓':'⚠'}</tspan></text></g>`;
  }).join("")+`</svg>`;
}
function bars(series,w=430,h=190){
  const mx=Math.max(...series.map(s=>s[1]))*1.15, n=series.length, bw=(w-56)/n-10;
  const grid=[0,1,2,3].map(k=>`<line x1="46" y1="${(h-28-(h-46)*k/3).toFixed(1)}" x2="${w-6}" y2="${(h-28-(h-46)*k/3).toFixed(1)}" stroke="#26262e"/>`).join("");
  const ramp=["#7a570d","#a06e13","#c58619","#e5a32c"];
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">${grid}`+series.map((s,i)=>{
    const bh=(s[1]/mx)*(h-46), x=48+i*((w-56)/n)+5, y=h-28-bh;
    return `<g><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${ramp[Math.min(i,3)]}"><title>${s[0]}: KSh ${s[1]}m</title></rect>
<text x="${(x+bw/2).toFixed(1)}" y="${(y-6).toFixed(1)}" text-anchor="middle" fill="#f2f0ec" font-size="11" font-weight="600" font-family="Roboto Mono,monospace">${s[1]}</text>
<text x="${(x+bw/2).toFixed(1)}" y="${h-10}" text-anchor="middle" fill="#726d66" font-size="10" font-weight="600" font-family="Roboto Mono,monospace">${s[0]}</text></g>`;
  }).join("")+`</svg>`;
}

/* ══ watchlist ══ */
function watchlist(sel){
  const g = GOAL==="preserve"||!GOAL ? "safety" : GOAL;
  const list = [...D.counters].sort((a,b)=>{
    const A2=scoreOf(a,g), B2=scoreOf(b,g);
    if(A2==null&&B2==null) return a.to>b.to?-1:1;
    if(A2==null) return 1; if(B2==null) return -1;
    return B2-A2;
  });
  const chips = Object.keys(GOALS).map(k=>
    `<button class="gchip ${GOAL===k?'on':''}" data-g="${k}">${GOALS[k].t}</button>`).join("");
  const rows = list.map(c=>{
    const v = verdict(c, GOAL);
    const hide = Q && !(c.tk.toLowerCase().includes(Q) || c.name.toLowerCase().includes(Q));
    const risk = c.flag==="QUALITY"||c.flag==="PAYOUT"||c.flag==="TRAP" ? "#ef8078"
               : c.rsi ? "#e8a83c" : gates(c)[0] ? "#4cc98e" : "#726d66";
    return `<a class="row ${c.tk===sel?'on':''} ${hide?'off':''}" href="#/stock/${c.tk}">
${ring(c,GOAL)}
<div class="rmid"><div class="rtk"><b>${c.tk}</b><span class="dot" style="background:${risk}"></span><s>${c.name}</s></div>
<div class="rpx"><span>${c.price.toFixed(2)}</span><em class="${c.chg>0?'up':c.chg<0?'dn':'fl'}" style="background:${c.chg>0?'rgba(76,201,142,.12)':c.chg<0?'rgba(239,128,120,.12)':'transparent'}">${c.chg>0?"+":""}${c.chg.toFixed(2)}%</em></div></div>
<div class="rend"><span class="vd ${v.v}">${v.v}</span></div></a>`;
  }).join("");
  return `<div class="pane"><div class="stick">
<div class="wl"><div class="wlh"><b>Watchlist &middot; ranked</b><span style="font:10px var(--mono);color:var(--tm)">${list.length} listed</span></div>
<div class="gchips">${chips}</div></div>
<div class="wlist">${rows}</div>
<div class="wl" style="border-top:1px solid var(--line);border-bottom:0">
<div style="font:11px/1.55 var(--mono);color:var(--tm)">Ring = score on your goal. Dot: <span style="color:#4cc98e">green</span> clean, <span style="color:#e8a83c">amber</span> overbought, <span style="color:#ef8078">red</span> earnings or dividend flag, <span style="color:#726d66">grey</span> cannot buy at your size.</div></div>
</div></div>`;
}

/* ══ wire panel ══ */
function wire(tkFilter){
  const items = tkFilter ? D.news.filter(n=>n.tk===tkFilter||n.tk==="MKT") : D.news;
  const news = items.slice(0,8).map((n,i)=>`<div class="row" style="display:block;padding:12px 14px;${i===0?'background:rgba(201,133,0,.05);border-left-color:var(--gd)':''}">
<div class="ihd" style="margin-bottom:5px"><span class="iwho">${n.who}</span><span class="iage" data-age="${n.d}">&nbsp;</span></div>
<div style="font-size:12.5px;line-height:1.45;font-weight:500">${n.head}</div></div>`).join("");
  const pulse = D.macro.slice(0,8).map(m=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--ink2);font:11px var(--mono)">
<span style="color:var(--tm)">${m[0]}</span><span style="color:var(--gdt);font-weight:500;text-align:right">${m[1]}</span></div>`).join("");
  return `<div class="pane"><div class="stick">
<div class="wl"><div class="wlh"><b>The wire</b>${tkFilter?`<a href="#/stock/${tkFilter}" style="font:10px var(--mono);color:var(--gd)">${tkFilter} only</a>`:''}</div></div>
<div style="max-height:44vh;overflow-y:auto">${news}</div>
<div class="wl" style="border-top:1px solid var(--line)"><div class="wlh"><b>Market pulse</b></div>${pulse}</div>
<div class="wl" style="border-bottom:0"><div class="co" style="margin:0;font-size:12.5px">
<b>This page cannot refresh itself.</b> No live feed exists for the NSE that a published document can reach. Every item is stamped with its own age instead of pretending.</div></div>
</div></div>`;
}

/* ══ DESK ══ */
function deskCentre(){
  const liq = D.counters.filter(c=>gates(c)[0]).length;
  const ob = D.counters.filter(c=>c.rsi!=null).length;
  const unver = D.counters.filter(c=>c.rsiu).length;
  const mtm = unver >= D.counters.length*0.9;   // momentum has aged out wholesale
  const all5 = D.counters.filter(c=>gates(c).every(Boolean)).length;
  const covBeat = D.counters.filter(c=>c.g[2]&&c.g[3]);
  const g = GOAL||"safety";
  const top = [...D.counters].filter(c=>scoreOf(c,g)!=null).sort((a,b)=>scoreOf(b,g)-scoreOf(a,g)).slice(0,6);
  const shortlist = GOAL==="preserve" ? `<div class="co r"><b>The honest answer is not on this exchange.</b>
The 364-day Treasury bill pays <b>${M.t364}%</b> gross, <b>${M.tbn}%</b> after the ${M.intt*100}% tax &mdash; <b>+${(M.tbn-M.infl).toFixed(2)}%</b> real against ${M.infl}% inflation. Government obligation, no stockbroker, 50,000 minimum through DhowCSD.
<br><br>Infrastructure bonds are <b>tax exempt</b>, which is why three reopened issues drew a record <b>460.4bn of bids against a 150bn target</b> &mdash; roughly <b>+5.3% real</b>, about four times the T-bill.
<br><br><b>Every liquid share here with a covered dividend pays you less than the T-bill after tax.</b> If this is money you need, no amount of screening changes that.</div>`
  : `<div class="scroll"><table><thead><tr><th>Counter</th><th>Score</th><th>Price</th><th>Div net</th><th>vs T-bill</th><th>Momentum</th><th>Verdict</th></tr></thead><tbody>
${top.map(c=>{const v=verdict(c,GOAL);return `<tr onclick="location.hash='#/stock/${c.tk}'"><td><b>${c.name}</b> <span style="color:var(--tm);font:10.5px var(--mono)">${c.tk}</span></td>
<td class="mono">${scoreOf(c,g)}</td><td class="mono">${c.price.toFixed(2)}</td>
<td class="mono">${c.dy?c.net.toFixed(2)+'%':'<span class="fl">none</span>'}</td>
<td class="mono">${c.dy?`<span class="${c.net>M.tbn?'up':'dn'}">${(c.net-M.tbn).toFixed(2)}</span>`:'<span class="fl">&mdash;</span>'}</td>
<td>${rsiPill(c)}</td>
<td><span class="vd ${v.v}">${v.v}</span></td></tr>`}).join("")}
</tbody></table></div>`;

  return `<div class="pane"><div class="page">
<div class="eyb">The desk &middot; ${GOALS[GOAL||'safety'].t}</div>
<h1 class="pt">${GOAL==="preserve"?"There is a right answer, and it is not a share":"What survives on your goal"}</h1>
<p class="lede">Ranked by ${GOALS[GOAL||'safety'].h}. Sized for <b>${fmtA()}</b> &mdash; which is why the access gate comes first and eliminates ${57-liq} of the 57 counters before valuation is even considered. ${liq<8?"At this size the exchange is nearly closed to you; a smaller amount opens it up.":liq>34?"At this size almost the whole exchange is open, so valuation does the work.":""}</p>
${shortlist}

<section style="margin-top:30px"><div class="eyb">Market state</div><h2 class="st">The condition of the whole exchange</h2>
<div class="grid g4" style="margin-top:12px">
<div class="kpi w"><v>${mtm?"&mdash;":0}</v><k>${mtm?"Oversold &mdash; not verified":"Oversold, all 57"}</k></div>
<div class="kpi w"><v>${mtm?"&mdash;":ob}</v><k>${mtm?"Overbought &mdash; not verified":"Overbought"}</k></div>
<div class="kpi"><v>${liq}</v><k>You can buy at your size</k></div>
<div class="kpi c"><v>&minus;1.17bn</v><k>Foreign net selling, one week</k></div>
<div class="kpi"><v>3.996tn</v><k>NSE market value</k></div>
<div class="kpi"><v>${M.tbn}%</v><k>T-bill after tax, no broker</k></div>
</div>
<div class="co ${mtm?'b':'r'}">${mtm
  ? `<b>Momentum has not been re-checked recently, so this page is not counting it.</b> The readings it had were taken on ${D.counters[0].sentiment_asof||"an earlier date"} and they stopped counting after ten days. Every counter now fails the timing gate on <b>unknown</b> rather than passing it on <b>calm</b> &mdash; which is the right way round. The prices, yields and dividend cover below are current; only the timing is blind.`
  : `<b>Nothing on this exchange is oversold and ${ob} counters are overbought.</b> The screen was run three separate times and returned zero every time. There is nowhere you can currently buy something the crowd has abandoned &mdash; that is a market condition, not a stock-picking problem.`}</div>
<div class="co b"><b>And the professionals were selling into it.</b> In the week to 14 August foreign investors were net sellers of <b>1.17bn in all five sessions</b>, more than double the week before, while locals were 76.2% of turnover. Turnover fell 5.62% and volume fell 25.61%. A market rising on fewer and fewer shares.</div>
</section>

<section><div class="eyb">The gate that decides everything</div><h2 class="st">Every dividend, after tax, against doing nothing</h2>
<p class="lede">Dividends on listed shares are taxed at ${M.divt*100}%. Interest on the 364-day Treasury bill is taxed at ${M.intt*100}%, leaving ${M.tbn}% net &mdash; the dashed line. Gold beats the government; blue loses to it. A tick means the dividend is covered by earnings.</p>
<div class="card"><div class="scroll">${divChart()}</div>
<div class="lgd"><span><span class="sw" style="background:#c98500"></span>Beats the T-bill</span>
<span><span class="sw" style="background:#3987e5"></span>Loses to it</span>
<span style="color:#4cc98e">&#10003; covered by earnings</span>
<span style="color:#e8a83c">&#9888; paid out of something else</span>
<span>Faded bars cannot absorb your order</span>
<span><b>Umeme excluded</b> &mdash; its 393.65% is returned capital, not income</span></div></div>
<div class="co r"><b>Read the top three bars.</b> The only counters clearly beating the government are <b>BAT at 134% payout</b> and <b>Standard Chartered at 99% payout with earnings down 42%</b> &mdash; they win the yield contest by not earning the yield. Strip those out and the best genuinely-earned income on the exchange is <b>Stanbic at 8.22% net</b>, and it traded 7,170 shares. <b>${all5===1?"One counter passes":all5===0?"No counter passes":all5+" counters pass"} all five gates at ${fmtA()}.</b></div>
</section>

<section><div class="eyb">The gate nobody mentions</div><h2 class="st">The liquidity cliff</h2>
<p class="lede">A full day of trading by counter, top eighteen. Your order must stay under 10% of a day, so you need ${mny(A()*10)} traded. Hover any bar.</p>
<div class="card"><div class="scroll">${cliff()}</div>
<div class="lgd"><span><span class="sw" style="background:#e5a32c"></span>Absorbs your order</span>
<span><span class="sw" style="background:#7a570d"></span>Does not</span><span>The other 39 counters are smaller still</span></div></div>
<div class="co r"><b>Every cheap share worth naming sits below this cliff.</b> TPS Serena at 3.68x earnings traded <b>87,000 shillings</b> &mdash; your order is fifteen times the entire day. BK Group's covered 7.53% traded 337,000. Stanbic's 8.65% traded 1.96m. <b>Safaricom alone traded 561m</b>, more than the next two counters combined.</div>
</section>

<section><div class="eyb">The pattern of the week</div><h2 class="st">Three companies raised the dividend as profit fell</h2>
<div class="scroll"><table><thead><tr><th>Company</th><th>H1 profit</th><th>Dividend</th><th class="tx">What was announced</th></tr></thead><tbody>
${D.divup.map(x=>`<tr onclick="location.hash='#/stock/${x.t}'"><td><b>${x.n}</b> <span style="color:var(--tm);font:10.5px var(--mono)">${x.t}</span></td>
<td class="mono dn">${x.p.toFixed(1)}%</td><td class="mono up">+${x.d}%</td><td class="tx">${x.x}</td></tr>`).join("")}
</tbody></table></div>
<div class="co r"><b>This is the most useful pattern on the page.</b> Three listed companies in one week raised interim dividends while profit fell &mdash; one by <b>39.8%</b>, ending a five-year growth streak. <b>Every dividend yield on every screen you will ever read is a trailing number.</b> When boards raise payouts into falling earnings, those yields are supported rather than earned, and the screens keep showing them as attractive right up until the cut.</div>
</section>

${datedCash()}

${fiveYear()}

<section><div class="eyb">Trend</div><h2 class="st">Trailing returns, one week to one year</h2>
<p class="lede">Six counters where the full return series was verified individually. Each panel has its own scale &mdash; Car &amp; General would flatten every other line to nothing. This is the short view; the five-year prices are in the section above.</p>
<div class="sm">${Object.keys(D.trend).map(tk=>{const v=D.trend[tk],c=IDX[tk];
return `<a class="smc" href="#/stock/${tk}"><h5>${c.name}<s>${tk}</s></h5>${spark(v)}
<f><span>1yr</span><b class="${v[v.length-1]>0?'up':'dn'}">${v[v.length-1]>0?"+":""}${Math.round(v[v.length-1])}%</b></f>
<div style="font:9.5px var(--mono);color:var(--tm);margin-top:2px">scale ${Math.round(Math.min(...v))}% to ${Math.round(Math.max(...v))}%</div></a>`}).join("")}</div>
<div class="co"><b>What the shapes say.</b> Car &amp; General is not a trend, it is a vertical line &mdash; <b>+1,066% in a year</b> with the steepest part in the last month. Kenya Power (+88%) and Co-op (+122%) doubled quietly while everyone watched it. And <b>Kenya Pipeline has done nothing at all in twelve months</b>, &minus;1.09% &mdash; the honest answer to why a 9-shilling share is not cheap. It was priced fully at listing, not ignored.</div>
</section>

<section><div class="eyb">Worked example</div><h2 class="st">What a real recovery looks like, and where to check it</h2>
<div class="grid g2">
<div class="card"><div style="font-size:12px;color:var(--ts);margin-bottom:6px;font-weight:600">Crown Paints &mdash; half-year net profit, KSh millions</div>${bars(D.crwn)}</div>
<div class="card"><p style="font-size:13.5px;line-height:1.62;color:var(--ts)">Four consecutive first halves from the company's own announcements: <b style="color:var(--tp)">37m &rarr; 75m &rarr; 437m &rarr; 486m</b>. Revenue rose from 5.64bn to 8.38bn. Full-year 2025 profit up 74.2% to 948m. On its face one of the cleanest turnarounds here.</p>
<p style="font-size:13.5px;line-height:1.62;color:var(--ts);margin-top:10px"><b style="color:var(--gdt)">Now the check that matters.</b> In this record half, operating cash flow <b style="color:var(--tp)">fell 40.9%</b> to 681m while current liabilities rose to 6.05bn. Profit up, cash down &mdash; that gap is receivables and stock.</p>
<p style="font-size:13.5px;line-height:1.62;color:var(--ts);margin-top:10px">It traded 618,000 shillings, so at your size it is academic. It is here because the test transfers: <b style="color:var(--tp)">always put profit growth next to cash generation.</b> That one comparison separates Crown Paints from Car &amp; General's associate income and Kenya Power's currency gains.</p></div>
</div></section>
</div></div>`;
}

/* ══ DOSSIER ══ */
const GATEQ = [
 ["Access","Can I buy it at my size?"],["Earnings","Is the profit repeatable?"],
 ["Dividend","Is it earned?"],["Hurdle","Does it beat the T-bill?"],["Timing","Am I early or late?"]];

function dossier(tk){
  const c = IDX[tk]; if(!c) return `<div class="pane"><div class="page"><h1 class="pt">Unknown counter</h1><p class="lede"><a href="#/markets" style="color:var(--gdt)">Back to markets &rarr;</a></p></div></div>`;
  const v = verdict(c, GOAL);
  const legal = D.legal.filter(l=>l.tks.includes(tk));
  const debt = D.debt.filter(x=>x.tk===tk);
  const news = D.news.filter(n=>n.tk===tk);
  const tr = D.trend[tk];
  const GG = gates(c); const gd = GG.map((p,i)=>{
    const detail = [
      p?`${mny(c.to)} traded &mdash; your ${fmtA()} is ${pctOfDay(c)}% of a day`:`only ${mny(c.to)} traded &mdash; your order is ${pctOfDay(c)}% of the day`,
      c.pe==null?"no published earnings":c.flag==="QUALITY"?"profit is not repeatable &mdash; see the note":c.flag==="TRAP"?"the yield is returned capital, not income":`${c.pe.toFixed(2)} years of profit`,
      c.payout==null?"no figure published":c.payout===0?"pays no dividend":`pays out ${c.payout}% of earnings`,
      c.dy?`${c.net.toFixed(2)}% net vs ${M.tbn}% risk-free`:"no dividend to compare",
      c.rsiu?"momentum not verified lately &mdash; unknown, so not counted":c.rsi==null?"momentum below 70 &mdash; not stretched":`momentum ${Math.round(c.rsi)} &mdash; overbought`
    ][i];
    return `<div class="gate ${p?'p':'f'}"><b>${GATEQ[i][0]} ${tick(p)}</b><s>${detail}</s></div>`;
  }).join("");

  const why = v.why || (()=>{
    const bits=[];
    if(GOAL==="income"||!GOAL) bits.push(c.dy?`a ${c.dy.toFixed(2)}% dividend that nets <b>${c.net.toFixed(2)}%</b> after tax and is covered ${c.payout?(100/c.payout).toFixed(1):'?'} times`:"no dividend at all");
    if(c.pe) bits.push(`${c.pe.toFixed(2)} years of profit`);
    if(c.epsg!=null) bits.push(`earnings ${c.epsg>0?'up':'down'} ${Math.abs(c.epsg).toFixed(0)}%`);
    bits.push(GG[0]?`${mny(c.to)} of daily turnover, so your order is invisible at ${pctOfDay(c)}%`:`only ${mny(c.to)} traded`);
    bits.push(c.rsiu?"and its momentum has not been re-checked recently":c.rsi==null?"and it is not overbought":`but momentum is ${Math.round(c.rsi)}`);
    return bits.join(", ")+".";
  })();

  return `<div class="pane">
<div class="dhd"><div class="dtop">
<div><div class="dname">${c.name}</div>
<div class="dmeta"><span class="chip">${c.tk}</span><span>${c.sec}</span><span>&middot;</span><span>MKT CAP ${c.mcap==null?'&mdash;':c.mcap>=1000?(c.mcap/1000).toFixed(2)+'tn':c.mcap.toFixed(2)+'bn'}</span>
${c.rat&&c.rat!=="—"?`<span class="pill ${c.rat.includes('buy')||c.rat.includes('Buy')?'ok':c.rat==='Sell'?'bd':'gd'}">${c.rat}</span>`:''}
${c.flag?`<span class="pill ${['QUALITY','PAYOUT','TRAP','MOMENTUM'].includes(c.flag)?'bd':'wn'}">${{QUALITY:'Earnings quality',PAYOUT:'Unearned dividend',TRAP:'Yield is not income',MOMENTUM:'Momentum extreme',LIQUIDITY:'Cannot buy at size',DIVUP:'Dividend up, profit down',YIELD:'Source conflict'}[c.flag]}</span>`:''}</div></div>
<div class="dpx"><b>${c.price.toFixed(2)}</b> <span style="font:13px var(--mono)">${chg(c.chg)}</span>
<div style="font:10.5px var(--mono);color:var(--tm);margin-top:4px">${c.vol.toLocaleString()} shares &middot; ${mny(c.to)} &middot; vol ${c.relvol==null?'&mdash;':c.relvol.toFixed(2)+'x normal'}</div>
<div style="font:10.5px var(--mono);color:${c.price_asof===D.macroK.stamp.slice(0,10)?'var(--tm)':'var(--gdt)'};margin-top:3px">close of ${c.price_asof||D.macroK.stamp.slice(0,10)}</div>
${c.price_conflict?`<div style="font:10.5px var(--mono);color:var(--wn);margin-top:3px">a second source says ${c.price_conflict.other.toFixed(2)}</div>`:''}</div>
</div></div>

<div class="page">
<div class="verd ${v.v}"><div style="font:700 9.5px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--tm);margin-bottom:6px">Verdict on ${GOALS[GOAL||'safety'].t}</div>
<h4>${v.v==="NA"?"Not assessable on this goal":`${v.v} &mdash; ${c.name}`}</h4>
<p>${why}</p></div>

${position(c)}
${divCash(c)}
${newsRead(c)}
<div class="eyb" style="margin-top:22px">The five gates</div>
<div class="gates">${gd}</div>

<section style="margin-top:26px"><h2 class="st">The numbers</h2>
<div class="scroll"><table><tbody>
<tr><td>Years of profit (P/E)</td><td class="mono">${num(c.pe)}</td><td class="tx">${c.pe==null?"No published earnings on either source consulted":c.pe<5?"Cheap on trailing earnings":c.pe<9?"Fair":c.pe<20?"Expensive":"Very expensive"}</td></tr>
<tr><td>Earnings per share</td><td class="mono">${num(c.eps)}</td><td class="tx">${c.eps!=null&&c.eps<0?"Loss-making":""}</td></tr>
<tr><td>Earnings growth</td><td class="mono">${c.epsg==null?'<span class="fl">&mdash;</span>':`<span class="${c.epsg>0?'up':'dn'}">${c.epsg>0?'+':''}${c.epsg.toFixed(1)}%</span>`}</td><td class="tx">Trailing twelve months against the prior year</td></tr>
<tr><td>Dividend, gross</td><td class="mono">${num(c.dy,2,'%')}</td><td class="tx"></td></tr>
<tr><td>Payout ratio</td><td class="mono">${c.payout==null?'<span class="fl">&mdash;</span>':c.payout===0?'<span class="fl">none</span>':`<span class="pill ${c.payout>=100?'bd':c.payout>=80?'wn':'ok'}">${c.payout}%</span>`}</td><td class="tx">${c.payout==null?"":c.payout===0?"Pays nothing":c.payout>=100?"Pays out more than it earns — this gets cut":c.payout>=80?"Tight cover":`Covered ${(100/c.payout).toFixed(1)} times`}</td></tr>
<tr><td>Dividend after ${M.divt*100}% tax</td><td class="mono"><b>${c.dy?c.net.toFixed(2)+'%':'<span class="fl">&mdash;</span>'}</b></td><td class="tx">What actually reaches your account</td></tr>
<tr><td>Against the T-bill (${M.tbn}%)</td><td class="mono">${c.dy?`<span class="${c.net>M.tbn?'up':'dn'}">${(c.net-M.tbn).toFixed(2)} pts</span>`:'<span class="fl">&mdash;</span>'}</td><td class="tx">${c.dy?(c.net>M.tbn?"Beats doing nothing":"Loses to a government Treasury bill"):""}</td></tr>
<tr><td>Real, after ${M.infl}% inflation</td><td class="mono">${c.dy?`<span class="${c.real>0?'up':'dn'}">${c.real>0?'+':''}${c.real.toFixed(2)}%</span>`:'<span class="fl">&mdash;</span>'}</td><td class="tx">Income only. Excludes any price movement</td></tr>
<tr><td>Traded, one day</td><td class="mono"><b>${mny(c.to)}</b></td><td class="tx">${c.vol.toLocaleString()} shares. Your ${fmtA()} is <b>${pctOfDay(c)}%</b> of it</td></tr>
<tr><td>Momentum (RSI)</td><td class="mono">${rsiPill(c)}</td><td class="tx">${rsiWords(c)}</td></tr>
</tbody></table></div></section>

${scoreGaps(c)}
${priceHistory(c)}
${tr?`<section><h2 class="st">Trailing returns</h2><div class="card" style="max-width:420px">${spark(tr,380,120)}
<div style="display:flex;justify-content:space-between;font:10.5px var(--mono);color:var(--tm);margin-top:6px">${D.tlabels.map((l,i)=>`<span>${l}<br><b style="font-size:12px;color:${tr[i]>0?'#4cc98e':'#ef8078'}">${tr[i]>0?'+':''}${tr[i].toFixed(1)}%</b></span>`).join("")}</div></div></section>`
:`<section><div class="co b"><b>No verified return series for this counter.</b> Multi-period history was confirmed individually for six names only. Rather than draw an unverified line, there is no chart here.</div></section>`}

<section><h2 class="st">Analyst note</h2><div class="card"><p style="font-size:13.5px;line-height:1.66;color:var(--ts)">${c.note}</p></div></section>

${debt.length?`<section><h2 class="st">Debt and borrowings</h2>${debt.map(x=>`<div class="item"><div class="ihd"><span class="iwho">${x.head}</span></div><p>${x.body}</p><div class="imp"><b>Read:</b> ${x.read}</div></div>`).join("")}</section>`:''}

${legal.length?`<section><h2 class="st">Legal and governance</h2><div class="grid g2">${legal.map(l=>`<div class="item">
<div class="ihd"><span class="pill ${l.sev==='critical'?'bd':l.sev==='elevated'?'wn':'gd'}">${l.sev}</span><span class="iage">${l.yr}</span></div>
<h3>${l.title}</h3><p style="font:10.5px var(--mono);color:var(--tm);margin-top:5px">${l.forum} &middot; ${l.status}</p><p>${l.body}</p>
<div class="imp"><b>Impact:</b> ${l.impact}</div></div>`).join("")}</div></section>`
:`<section><h2 class="st">Legal and governance</h2><div class="co"><b>Nothing verified on file for this counter.</b> The legal book covers what could be confirmed &mdash; absence here is not evidence of a clean record, only of nothing I could source.</div></section>`}

${news.length?`<section><h2 class="st">What was published</h2><div class="grid g2">${news.map(n=>`<div class="item"><div class="ihd"><span class="iwho">${n.who}</span><span class="iage" data-age="${n.d}">&nbsp;</span></div><h3>${n.head}</h3><p>${n.body}</p></div>`).join("")}</div></section>`:''}
</div></div>`;
}


/* ══ YOUR POSITION — the whole point of asking the amount ══ */
function position(c){
  const n = shares(c), cost = n*c.price, left = A()-cost;
  const grossDiv = c.dy ? cost*c.dy/100 : 0;
  const netDiv = grossDiv*(1-M.divt);
  const tb = A()*M.t364/100*(1-M.intt);
  const better = netDiv - tb;
  const ok = gates(c)[0];
  return `<section style="margin-top:4px"><div class="eyb">Your money in this one</div>
<h2 class="st">What ${fmtA()} actually buys here</h2>
<div class="card"><div class="scroll"><table><tbody>
<tr><td>Shares you could buy</td><td class="mono"><b>${n.toLocaleString()}</b></td><td class="tx">At ${c.price.toFixed(2)} each. ${left>0?ksh(left)+" left over — you cannot buy a part of a share":""}</td></tr>
<tr><td>What you would spend</td><td class="mono">${ksh(cost)}</td><td class="tx">Before your broker's commission, which is typically around 1.7% on small orders in Kenya</td></tr>
<tr><td>Your order as a share of one day</td><td class="mono ${ok?'up':'dn'}"><b>${pctOfDay(c)}%</b></td><td class="tx">${ok?"Under 10%, so you can buy without moving the price against yourself":"<b>Over 10% of a day's trading.</b> Your own buying would push the price up, and when you sell there may be nobody there. This is the gate most people never hear about."}</td></tr>
${c.dy?`<tr><td>Dividend, one year, in shillings</td><td class="mono">${ksh(grossDiv)}</td><td class="tx">${c.dy.toFixed(2)}% of what you spent. Paid as cash, usually twice a year</td></tr>
<tr><td>After the ${M.divt*100}% tax</td><td class="mono"><b>${ksh(netDiv)}</b></td><td class="tx">What actually reaches your bank account</td></tr>`
:`<tr><td>Dividend</td><td class="mono"><span class="fl">none</span></td><td class="tx">This company pays nothing. Your entire return depends on selling to someone later at a higher price</td></tr>`}
<tr><td>The same money in a Treasury bill</td><td class="mono">${ksh(tb)}</td><td class="tx">${M.t364}% for 364 days, less the ${M.intt*100}% tax. Government obligation, and you do not need a stockbroker for it</td></tr>
<tr style="border-top:2px solid var(--line2)"><td><b>Difference</b></td><td class="mono"><b class="${better>0?'up':'dn'}">${better>0?"+":""}${ksh(better)}</b></td>
<td class="tx"><b>${better>0?`You would earn ${ksh(better)} more in income here than in a Treasury bill.`:`You would earn ${ksh(-better)} <b>less</b> in income here than in a Treasury bill &mdash; and carry company risk for it. The only reason left to buy is a belief the price rises.`}</b></td></tr>
</tbody></table></div></div></section>`;
}

/* ══ WHAT THE NEWS DOES TO THE NUMBERS ══ */
function newsRead(c){
  const r = D.newsread[c.tk];
  if(!r) return `<section><div class="co"><b>No material news on file for this counter.</b> The verdict above rests on the ratios alone &mdash; and ratios are always backward-looking. Treat it as less reliable than a counter where the news is known.</div></section>`;
  const ic = r.dir==="up"?"ok":r.dir==="down"?"bd":"gd";
  const lab = r.dir==="up"?"News improves the case":r.dir==="down"?"News damages the case":"News cuts both ways";
  return `<section style="margin-top:22px"><div class="eyb">Read this before the ratios</div>
<h2 class="st">${r.t}</h2>
<div class="item" style="border-color:${r.dir==='down'?'#4a2020':r.dir==='up'?'#1d4030':'#3d2f0d'}">
<div class="ihd"><span class="pill ${ic}">${lab}</span></div>
<p style="font-size:13.5px;color:var(--tp)">${r.b}</p>
<div class="imp" style="color:var(--ts)"><b style="color:var(--gdt)">And the other side:</b> ${r.c}</div></div>
<div class="co b" style="font-size:13px"><b>Why this section exists.</b> Every ratio on this page is backward-looking. The news is what moves the price. A screen once showed a share at 12 years of profit while its results, published the day before, had tripled the profit &mdash; making it 5.8. The ratio was not wrong, it was late.</div></section>`;
}

/* ══ VERIFIED PRICE POINTS — real, dated, no invented lines ══ */
function priceHistory(c){
  const p = D.prices[c.tk];
  if(!p) return `<section><h2 class="st">Price history</h2><div class="co b"><b>No verified price history for this counter.</b> Five years of daily prices for the Nairobi exchange are not obtainable from the sources this page was built from &mdash; and rather than draw a line I cannot stand behind, there is nothing here. A stockbroker's terminal or the exchange's own historical data will give it to you. <b>Any page showing you a smooth five-year curve for all 57 counters is almost certainly generating it.</b></div></section>`;
  const vals = p.map(x=>parseFloat(x[1].replace(/,/g,"")));
  const lo=Math.min(...vals), hi=Math.max(...vals);
  const h = D.hist[c.tk];
  const arc = h ? `<div class="grid g2" style="margin:4px 0 14px">
<div class="card">${spark3([h.a,h.b,h.c],[D.histmeta.d1,D.histmeta.d2,D.histmeta.d3],420,120)}
<div style="display:flex;justify-content:space-between;font:10.5px var(--mono);color:var(--tm);margin-top:4px"><span>${D.histmeta.d1}<br>${h.a.toFixed(2)}</span><span style="text-align:center">${D.histmeta.d2}<br>${h.b.toFixed(2)}</span><span style="text-align:right">${D.histmeta.d3}<br><b style="color:var(--gdt)">${h.c.toFixed(2)}</b></span></div></div>
<div class="card"><table><tbody>
<tr><td>Whole period, 2021 to now</td><td class="mono ${h.t>0?'up':'dn'}"><b>${h.t>0?"+":""}${h.t.toFixed(0)}%</b></td></tr>
<tr><td>First three years, to Nov 2024</td><td class="mono ${h.e>0?'up':'dn'}">${h.e>0?"+":""}${h.e.toFixed(0)}%</td></tr>
<tr><td>Since Nov 2024</td><td class="mono ${h.l>0?'up':'dn'}">${h.l>0?"+":""}${h.l.toFixed(0)}%</td></tr>
<tr><td>${fmtA()} at the 2021 price, worth today</td><td class="mono ${Math.floor(A()/h.a)*h.c>A()?'up':'dn'}"><b>${ksh(Math.floor(A()/h.a)*h.c)}</b></td></tr>
</tbody></table>
<div style="font:11px/1.6 var(--mono);color:var(--tm);margin-top:8px">Price only. Dividends paid over those years are on top of this, and not counted here.</div></div></div>` : "";
  return `<section><h2 class="st">Price history &mdash; every point verified and dated</h2>
<p class="lede">These are the prices I could confirm with a date and a source. Not a modelled curve. The gap between them is real time in which the price did things nobody recorded here.</p>
${arc}
<div class="card"><div class="scroll"><table><thead><tr><th>When</th><th>Price</th><th>Move from first</th><th class="tx">What this point is</th></tr></thead><tbody>
${p.map((x,i)=>{const v=vals[i], d=(v/vals[0]-1)*100;
return `<tr><td class="mono" style="white-space:nowrap;color:var(--gdt)">${x[0]}</td><td class="mono"><b>${x[1]}</b></td>
<td class="mono">${i===0?'<span class="fl">&mdash;</span>':`<span class="${d>0?'up':'dn'}">${d>0?'+':''}${d.toFixed(0)}%</span>`}</td>
<td class="tx">${x[2]}</td></tr>`}).join("")}
</tbody></table></div>
<div style="margin-top:12px;font:11px var(--mono);color:var(--tm)">Range across verified points: ${lo.toFixed(2)} to ${hi.toFixed(2)} &mdash; a spread of ${((hi/lo-1)*100).toFixed(0)}%.</div></div></section>`;
}

/* ══ MARKETS ══ */
function markets(){
  const g = GOAL==="preserve"||!GOAL?"safety":GOAL;
  const rows = D.counters.map(c=>{
    const v=verdict(c,GOAL);
    const hide = Q && !(c.tk.toLowerCase().includes(Q)||c.name.toLowerCase().includes(Q));
    return `<tr class="${gates(c)[0]?'':'dim'} ${hide?'off':''}" onclick="location.hash='#/stock/${c.tk}'">
<td><b>${c.name}</b> <span style="color:var(--tm);font:10.5px var(--mono)">${c.tk}</span><div style="font:9px var(--mono);color:var(--tm);text-transform:uppercase;letter-spacing:.05em">${c.sec}</div></td>
<td class="mono">${c.price.toFixed(2)}</td><td class="mono">${chg(c.chg)}</td>
<td class="mono"><b>${mny(c.to)}</b><div style="font-size:9px;color:var(--tm)">${pctOfDay(c)}% of day</div></td>
<td class="mono">${num(c.pe)}</td><td class="mono">${num(c.eps)}</td>
<td class="mono">${c.epsg==null?'<span class="fl">&mdash;</span>':`<span class="${c.epsg>0?'up':'dn'}">${c.epsg>0?'+':''}${c.epsg.toFixed(0)}%</span>`}</td>
<td class="mono">${num(c.dy,2,'%')}</td>
<td>${c.payout==null?'<span class="fl">&mdash;</span>':c.payout===0?'<span class="fl">none</span>':`<span class="pill ${c.payout>=100?'bd':c.payout>=80?'wn':'ok'}">${c.payout}%</span>`}</td>
<td class="mono">${c.dy?`<b>${c.net.toFixed(2)}%</b>`:'<span class="fl">&mdash;</span>'}</td>
<td class="mono">${c.dy?`<span class="${c.net>M.tbn?'up':'dn'}">${(c.net-M.tbn).toFixed(2)}</span>`:'<span class="fl">&mdash;</span>'}</td>
<td>${rsiPill(c)}</td>
<td class="gt">${gates(c).map(tick).join("")}</td>
<td><span class="vd ${v.v}">${v.v}</span></td></tr>`;
  }).join("");
  return `<div class="page"><div class="eyb">Markets</div><h1 class="pt">All 57 listed counters</h1>
<p class="lede">Sorted by access first, then by what you pay for earnings. Faded rows cannot absorb your ${fmtA()}. Click any row for its dossier. Gates read: access &middot; real earnings &middot; dividend earned &middot; beats the T-bill &middot; not overbought.</p>
<div class="card" style="padding:0;overflow:hidden"><div class="scroll" style="max-height:74vh;overflow-y:auto"><table>
<thead><tr><th>Counter</th><th>Price</th><th>Day</th><th>Traded</th><th>Yrs profit</th><th>Earns</th><th>Growth</th><th>Div gross</th><th>Payout</th><th>Div net</th><th>vs T-bill</th><th>Momentum</th><th class="gt">1 2 3 4 5</th><th>Verdict</th></tr></thead>
<tbody>${rows}</tbody></table></div></div></div>`;
}

/* ══ NEWS / LEGAL / DEBT / METHOD ══ */
function newsPage(){
  return `<div class="page"><div class="eyb">The wire</div><h1 class="pt">What was actually published</h1>
<p class="lede">Company announcements and market reporting, most recent first, each stamped with its own age. A published page has no live feed &mdash; so instead of a fake ticker, every item tells you how old it is.</p>
<div class="grid g2">${D.news.map(n=>`<div class="item"><div class="ihd"><span class="iwho">${n.who}</span><span class="iage" data-age="${n.d}">&nbsp;</span></div>
<h3>${n.head}</h3><p>${n.body}</p>${n.tk!=="MKT"?`<div class="imp"><a href="#/stock/${n.tk}" style="color:var(--gdt)">Open the ${n.tk} dossier &rarr;</a></div>`:''}</div>`).join("")}</div></div>`;
}
function legalPage(){
  const cnt = {critical:0,elevated:0,watch:0};
  D.legal.forEach(l=>cnt[l.sev]++);
  const covered = new Set(); D.legal.forEach(l=>l.tks.forEach(t=>covered.add(t)));
  return `<div class="page"><div class="eyb">The docket</div><h1 class="pt">Court and conduct</h1>
<p class="lede">A share sits behind creditors and the state. This is the legal overlay on the counters in this screen &mdash; only matters that could be verified. <b>It is not a complete docket, and absence here is not evidence of a clean record.</b> Where a competitor's page lists a matter I could not source, I have left it out rather than repeat it.</p>
<div class="grid g4" style="margin-bottom:22px">
<div class="kpi w"><v>${cnt.critical}</v><k>Critical</k></div>
<div class="kpi"><v>${cnt.elevated}</v><k>Elevated</k></div>
<div class="kpi"><v>${cnt.watch}</v><k>Watch</k></div>
<div class="kpi"><v>${covered.size}</v><k>Counters with a matter on file</k></div></div>
<div class="grid g2">${D.legal.map(l=>`<div class="item"><div class="ihd">
<span class="pill ${l.sev==='critical'?'bd':l.sev==='elevated'?'wn':'gd'}">${l.sev}</span>
<span class="iage">${l.forum} &middot; ${l.yr}</span></div>
<h3>${l.title}</h3>
<p style="font:10.5px var(--mono);color:var(--gdt);margin-top:5px">${l.status}</p>
<p>${l.body}</p><div class="imp"><b>Impact:</b> ${l.impact}</div>
<div style="margin-top:9px">${l.tks.map(t=>`<a class="chip" href="#/stock/${t}">${t}</a>`).join("")}</div></div>`).join("")}</div>
<div class="co r" style="margin-top:20px"><b>The one to weigh before Monday.</b> On 5 August the DPP charged the chief executives of <b>KCB, NCBA and Co-operative Bank</b>. The individuals were charged, not the institutions. But those three are roughly a quarter of this exchange's value, and <b>all three must publish half-year results within days</b> &mdash; and two of them are the names this screen keeps surfacing.</div></div>`;
}
function debtPage(){
  return `<div class="page"><div class="eyb">Balance sheets</div><h1 class="pt">Debt, borrowings and what they signal</h1>
<p class="lede">What these companies owe, and more importantly which direction it is moving. Drawn from the half-year announcements published this month.</p>
<div class="grid g2">${D.debt.map(x=>`<div class="item"><div class="ihd">
<span class="pill ${x.sev==='critical'?'bd':x.sev==='elevated'?'wn':x.sev==='clear'?'ok':'gd'}">${x.sev}</span>
<a class="chip" href="#/stock/${x.tk}" style="margin-left:auto">${x.tk}</a></div>
<h3>${x.name} &mdash; ${x.head}</h3><p>${x.body}</p><div class="imp"><b>Read:</b> ${x.read}</div></div>`).join("")}</div>
<div class="co" style="margin-top:20px"><b>The one to understand properly.</b> KCB's 300bn note programme is <b>debt, not shares</b>. Nobody's slice of KCB gets smaller &mdash; there is no dilution. It means KCB intends to lend materially more, which is how a bank grows profit, and it means a <b>KCB bond will exist by October</b>. For anyone who would rather have a known return than a share price, that is a genuinely different instrument.</div>
<section style="margin-top:30px"><h2 class="st">The macro backdrop</h2>
<div class="card"><div class="scroll"><table><tbody>${D.macro.map(m=>`<tr><td>${m[0]}</td><td class="mono"><b>${m[1]}</b></td><td class="tx">${m[2]}</td></tr>`).join("")}</tbody></table></div></div></section>
<section><h2 class="st">What happens next</h2><div class="card"><div class="scroll"><table>
<thead><tr><th>Date</th><th>Event</th><th class="tx">Note</th></tr></thead><tbody>
${D.cal.map(c=>`<tr style="${c[3]?'background:rgba(201,133,0,.06)':''}"><td class="mono" style="color:var(--gdt);white-space:nowrap">${c[0]}</td><td><b>${c[1]}</b></td><td class="tx">${c[2]}</td></tr>`).join("")}
</tbody></table></div></div>
<div class="co r"><b>Five of the largest banks &mdash; KCB, Co-op, NCBA, I&amp;M and Stanbic &mdash; must report by 31 August, and as of 23 August none had.</b> Bank results this season split hard: Equity +31.5% and Diamond Trust +37% pre-tax against Absa &minus;10%, Standard Chartered &minus;17% and BOC &minus;39.8%. Anyone buying those five now is buying before the number.</div></section></div>`;
}
function methodPage(){
  return `<div class="page"><div class="eyb">Method</div><h1 class="pt">How to check me</h1>
<section><h2 class="st">Where every number came from</h2><div class="card"><ul style="padding-left:20px;font-size:13.5px;line-height:1.7;color:var(--ts)">
<li>Prices, volume, relative volume, momentum and analyst ratings: <b>TradingView Kenya</b> all-stocks and overbought/oversold screeners, captured at the close of Thursday 20 August 2026. The oversold screen was run three times and returned zero each time.</li>
<li><b>Historical prices, 25 October 2021 and 20 November 2024:</b> two full-market tables, each on a page that prints its own trading date &mdash; the first from <b>rich.co.ke</b>, an NSE-authorised data vendor whose table is frozen at 25 Oct 2021; the second from <b>afx</b>, whose summary page is headed &ldquo;Wednesday, November 20, 2024&rdquo;. Both were read twice, independently, and the dates on the pages are what dates the figures. Nothing between those two dates and this month could be verified, so nothing between them is shown. The exchange's own daily price lists exist but are published as scanned images with no readable text.</li>
<li>Earnings and dividends per share, share counts, payout ratios: verified counter by counter at <b>afx.kwayisi.org</b> on the evening of 20 August &mdash; specifically for Kenya Power, KenGen, Car &amp; General, Kenya Pipeline, BOC and Co-operative Bank, where TradingView had no figure or a conflicting one.</li>
<li>Results: company announcements 17&ndash;23 August 2026 as reported by <b>Business Daily</b> and <b>The Kenyan Wall Street</b>.</li>
<li>Macro: <b>Central Bank of Kenya</b>, 20 August 2026.</li>
<li>Tax: 5% withholding on listed dividends, 15% on government paper under ten years, infrastructure bonds exempt &mdash; PwC Kenya tax summary and the Central Bank's own description.</li>
<li>Colour: the gold single-series hue, the gold/blue diverging pair and the four-step ramp were each machine-validated for lightness band, chroma, colour-blind separation and contrast against this background. Nothing was chosen by eye.</li>
</ul></div></section>
<section><h2 class="st">What this page cannot do</h2><div class="card"><ul style="padding-left:20px;font-size:13.5px;line-height:1.7;color:var(--ts)">
<li><b>It cannot refresh itself.</b> No live prices, no live news. The badge in the header computes its own age from your clock and warns when it goes stale.</li>
<li><b>Five years of daily history is not here</b> for 51 of the 57 counters, because it could not be verified. Six have confirmed multi-period series. The rest show no chart rather than a guessed one.</li>
<li><b>The legal book is not a docket.</b> It is what could be confirmed.</li>
<li><b>Every dividend yield is trailing.</b> Three companies raised payouts into falling profit this month alone.</li>
<li><b>The access gate is calibrated to the amount you entered.</b> Change it in the header and the survivors change &mdash; that is the point of it.</li>
</ul></div></section>
<section><h2 class="st">Two figures I got wrong this week</h2><div class="card"><p style="font-size:13.5px;line-height:1.7;color:var(--ts)">I priced a toner order at ten times market when it was under three, because I read set quantities as single units. And I said there was &ldquo;no new information&rdquo; behind a share that had published results the day before. <b style="color:var(--tp)">Both were caught by the reader, not by me.</b> Check anything here that would cost you money.</p></div></section>
<div class="co r"><b>This is a factual screen, not investment advice.</b> The author is not a licensed investment adviser, cannot place trades and does not forecast prices. Nothing here accounts for your circumstances, timeframe, tax position or how much you can afford to lose.</div>
<p class="foot">Every chart is inline SVG with hover values. No external requests beyond the font stylesheet, no tracking, no analytics. Counters marked &mdash; have no published figure on either source consulted: that is a data gap, not a judgement.</p></div>`;
}


/* ══ LEARN ══ */
function learnPage(){
  return `<div class="page"><div class="eyb">Start here if this is new</div><h1 class="pt">What the numbers actually mean</h1>
<p class="lede">Nobody is born knowing this and none of it is complicated. Thirteen ideas, in the order they matter. Every one of them appears somewhere on this page attached to a real company, so you can see it working rather than just read a definition.</p>
${D.edu.map((e,i)=>`<div class="item" style="margin-bottom:12px">
<div class="ihd"><span class="pill gd">${String(i+1).padStart(2,"0")}</span><span style="font-family:var(--disp);font-size:19px;font-weight:600">${e.k}</span>
<span class="iage">also called ${e.also}</span></div>
<p style="font-size:14.5px;color:var(--tp);line-height:1.6">${e.s}</p>
<div class="imp" style="color:var(--ts);font-size:13px;line-height:1.65">${e.l}</div></div>`).join("")}
<section style="margin-top:28px"><h2 class="st">The order these questions go in</h2>
<div class="card"><p style="font-size:13.5px;line-height:1.7;color:var(--ts)">Most people ask &ldquo;is it cheap?&rdquo; first. That is the fourth question, not the first. In order:</p>
<div style="margin-top:14px">${[
 ["Can I actually buy it, and get out again?","If a day's trading is smaller than your order, the price on the screen is not a price you can get. This eliminates most of the exchange before anything else is considered."],
 ["Is the profit real and repeatable?","A currency gain or a share of an unaudited associate is not earnings power. It looks identical in a ratio."],
 ["If I want income, is the dividend earned?","Paying out more than you earn is a countdown. Three companies here are doing it right now."],
 ["Does it beat doing nothing?","The government pays 7.68% after tax with no company risk. Anything below that means you are taking risk for free."],
 ["Am I early or late?","Eleven counters here are overbought and none are oversold. Being late is not fatal, but you should know which you are."]
].map((x,i)=>`<div style="display:flex;gap:13px;padding:11px 0;border-bottom:1px solid var(--line)">
<span style="flex:0 0 26px;height:26px;border-radius:8px;background:var(--ink3);border:1px solid var(--line);display:grid;place-items:center;font:700 11px var(--mono);color:var(--gdt)">${i+1}</span>
<div><b style="font-size:14px">${x[0]}</b><div style="font-size:12.5px;color:var(--ts);line-height:1.55;margin-top:3px">${x[1]}</div></div></div>`).join("")}</div></div></section>
<section><h2 class="st">The four mistakes that cost the most</h2><div class="grid g2">
${[["A low share price is not a low valuation","Kenya Pipeline costs 9 shillings and is one of the most expensive things on this exchange &mdash; it earns 41 cents a share, so you are paying 22 years of profit, and it pays no dividend. Meanwhile a 560-shilling share can be cheap. <b>Price per share tells you nothing on its own.</b>"],
  ["Sorting by dividend yield","The top of that list is where the danger is. The highest yield here pays out 134% of earnings. The second highest pays 99% with earnings down 42%. The third is a company returning your own capital as its concession ends. <b>Yield without coverage is a countdown.</b>"],
  ["Trusting the estimated results date","Two banks here reported on 19 August against estimates of the 20th and 25th. A data page said a company would report on 31 August; it had reported on the 13th and the price had already moved 40%. <b>Only the company's own announcement is real.</b>"],
  ["Chasing the thing that already moved","A share up 1,066% in a year has been discovered. The people who were early are now selling to the people arriving. That can run further &mdash; but you are no longer being paid to be early, you are paying for someone else's early."]
].map(x=>`<div class="item"><h3>${x[0]}</h3><p>${x[1]}</p></div>`).join("")}</div></section>
</div>`;
}

/* ══ chrome ══ */
const NAVS = [["desk","Desk"],["markets","Markets"],["news","News"],["learn","Learn"],["legal","Legal"],["debt","Debt"]];
function header(route){
  const tape = [["NASI","238.13","+1.30%","g"],["NSE 25","6,637.29","+1.48%","g"],["Banking","276.63","+2.83%","g"],
   ["Mkt cap","3.996tn","record","g"],["Foreign","−1.17bn","5 sessions",""],["Turnover","3.92bn","−5.62%",""],
   ["Inflation","6.49%","Jul","" ],["T-bill 364","9.037%","7.68% net","g"],["CBR","8.75%","4th hold",""]];
  return `<header class="hd">
<a class="bmk" href="#/desk"><b>Thamani</b><s>NSE</s></a>
<nav class="nav">${NAVS.map(([k,l])=>`<a href="#/${k}" class="${route===k?'on':''}">${l}</a>`).join("")}<a href="#/method" class="${route==='method'?'on':''}">Method</a></nav>
<div class="sbox"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
<input id="q" placeholder="Ticker or name" value="${Q}" aria-label="Search counters"></div>
<button class="amt" id="amtbtn" title="Change your amount"><k>Your amount</k><v>${fmtA()}</v></button>
<div class="stat"><span class="age" id="age">&nbsp;</span><br>Prices to ${newestClose()} &middot; news to ${D.macroK.news.slice(0,10)}<br>${D.counters.length} counters</div>
</header>
<div class="tape">${tape.map(t=>`<div><k>${t[0]}</k><v>${t[1]}</v><c class="${t[3]}">${t[2]}</c></div>`).join("")}</div>`;
}
function bottomNav(route){
  return `<nav class="bn">${NAVS.map(([k,l])=>`<a href="#/${k}" class="${route===k?'on':''}">${ICO[k]}${l}</a>`).join("")}</nav>`;
}
function goalGate(step){
  const gd = D.goaldoc;
  if(step==="amt"){
    return `<div class="gate-ov" id="gate"><div class="gate-bx">
<div class="eyb">Step two of two</div>
<h2>How much are you working with?</h2>
<p style="color:var(--ts);font-size:14px;line-height:1.62;max-width:60ch">This is not a formality and it is not stored anywhere but your own browser. <b style="color:var(--tp)">The amount decides which shares you can actually buy.</b> A day's trading on this exchange is often smaller than a single order &mdash; enter 100,000 and most of the market opens up; enter 5 million and almost all of it closes. Every verdict on the next screen is calculated from this number.</p>
<div style="margin:22px 0 8px"><input id="amtin" class="amtin" type="text" inputmode="numeric" placeholder="e.g. 250,000" aria-label="Amount in Kenyan shillings" value="${AMT?AMT.toLocaleString():""}"></div>
<div class="qamt">${[50000,100000,250000,500000,1000000,1300000,5000000].map(v=>`<button class="qb" data-amt="${v}">${v>=1e6?(v/1e6)+"m":(v/1000)+"k"}</button>`).join("")}</div>
<button class="gbtn" id="amtgo" ${AMT?"":"disabled"}>${AMT?"Open the terminal":"Enter an amount to continue"}</button>
<p style="font:11px/1.6 var(--mono);color:var(--tm);margin-top:14px">Change it any time from the button in the header. Nothing is sent anywhere &mdash; this page makes no outside requests.</p>
</div></div>`;
  }
  return `<div class="gate-ov" id="gate"><div class="gate-bx">
<div class="dsc dsc-top"><b>Read this first.</b> This page is not investment advice and nobody behind it is a licensed investment adviser. The labels it prints &mdash; buy, hold, avoid &mdash; describe how a counter scores against the published rule set on the Method page. They are not a recommendation to you, they take no account of your circumstances, and they are worked out from figures that are already days old by the time you read them. <b>Anyone acting on this is making their own decision.</b> If you want advice about your own money, an adviser licensed by the Capital Markets Authority is the person who can give it.</div>
<div class="eyb">Step one of two</div>
<h2>What is this money for?</h2>
<p style="color:var(--ts);font-size:14px;line-height:1.62;max-width:60ch">The same share is a good idea for one purpose and a bad one for another. Read these properly &mdash; most people pick the one that sounds most impressive rather than the one that is true, and then wonder why the answer disappoints them.</p>
<div class="gopts">${Object.keys(GOALS).map(k=>`<button class="gopt" data-pick="${k}">
<b>${gd[k].t}</b><s>${gd[k].one}</s>
<div class="gexp"><p><b>What it means.</b> ${gd[k].mean}</p>
<p><b>What you accept.</b> ${gd[k].accept}</p>
<p><b>What kills it.</b> ${gd[k].kills}</p>
<p style="color:var(--gdt)"><b>So the test is:</b> ${gd[k].test}</p></div>
<i>Select &rarr;</i></button>`).join("")}</div>
<button class="gbtn" id="gogo" disabled>Select a goal to continue</button>
<p style="font:11px/1.6 var(--mono);color:var(--tm);margin-top:12px">You can change this any time from the chips above the watchlist. Nothing about this choice is permanent.</p>
</div></div>`;
}

/* ══ the notice that appears under every screen ══ */
function noticeBand(){
  return `<div class="wrap"><div class="dsc dsc-band">
<b>Not investment advice.</b> Nobody behind this page is licensed to advise you, and nothing here takes account of your circumstances, your debts or what you can afford to lose.
The buy, hold and avoid labels are the output of the published rule set on the Method page, applied to figures whose dates are printed beside them. Prices are the last close available to this page, not a live quote, and they can be wrong.
Every source is named on the Method page. Verify anything before you act on it, and for a decision about your own money speak to an adviser licensed by the Capital Markets Authority.
<span class="dsc-who">Thamani &middot; data close ${D.macroK.stamp.slice(0,10)} &middot; news to ${D.macroK.news.slice(0,10)}</span>
</div></div>`;
}

/* ══ dated cash: a declared amount with a date, not a trailing yield ══ */
function divCash(c){
  const d = (D.nextdiv||{})[c.tk];
  if(!d) return "";
  const n = shares(c), gross = n*d.amt, net = gross*(1-M.divt);
  const pctPrice = d.amt/c.price*100;
  return `<section style="margin-top:22px"><div class="eyb">Dated cash</div>
<h2 class="st">${d.kind} dividend of ${d.amt.toFixed(2)} a share, already declared</h2>
<div class="card"><div class="scroll"><table><tbody>
<tr><td>Declared</td><td class="mono">${d.declared}</td><td class="tx">${d.src}</td></tr>
<tr><td>On the register by</td><td class="mono" style="color:var(--gdt)"><b>${d.record}</b></td><td class="tx">Own the shares before this date or you get nothing. Three working days to settle, so buy about three working days earlier</td></tr>
<tr><td>Money reaches you</td><td class="mono"><b>${d.pay}</b></td><td class="tx">Paid as cash into your account</td></tr>
<tr><td>On your ${fmtA()}</td><td class="mono">${ksh(gross)}</td><td class="tx">${n.toLocaleString()} shares &times; ${d.amt.toFixed(2)}. That is ${pctPrice.toFixed(2)}% of what you pay for the share, for this one payment</td></tr>
<tr style="border-top:2px solid var(--line2)"><td><b>After the ${M.divt*100}% tax</b></td><td class="mono"><b>${ksh(net)}</b></td><td class="tx"><b>This is the only figure on this page that is a declared amount on a stated date rather than a trailing average.</b></td></tr>
</tbody></table></div>
<div class="co" style="margin-top:12px">${d.note}</div></div></section>`;
}
function datedCash(){
  const nd = D.nextdiv||{}, meta = D.nextdivmeta||{};
  const ks = Object.keys(nd).sort((a,b)=>nd[b].amt/IDX[b].price - nd[a].amt/IDX[a].price);
  if(!ks.length) return "";
  return `<section style="margin-top:34px"><div class="eyb">The only cash with a date on it</div>
<h2 class="st">Dividends actually declared, and when the money moves</h2>
<p class="lede">${meta.lede||""}</p>
<div class="card"><div class="scroll"><table>
<thead><tr><th>Company</th><th>Amount</th><th>% of the price</th><th>Register closes</th><th>Paid</th><th>On your ${fmtA()}, after tax</th></tr></thead>
<tbody>${ks.map(tk=>{const d=nd[tk], c=IDX[tk], n=shares(c), net=n*d.amt*(1-M.divt);
return `<tr onclick="location.hash='#/stock/${tk}'"><td><b>${c.name}</b> <span style="color:var(--tm);font:10.5px var(--mono)">${tk}</span></td>
<td class="mono"><b>${d.amt.toFixed(2)}</b></td><td class="mono">${(d.amt/c.price*100).toFixed(2)}%</td>
<td class="mono" style="color:var(--gdt)">${d.record}</td><td class="mono">${d.pay}</td>
<td class="mono"><b>${ksh(net)}</b></td></tr>`}).join("")}</tbody></table></div></div>
<div class="co b">${meta.gap||""}</div></section>`;
}
/* ══ a blank score is a measurement failure, and says which ══ */
function scoreGaps(c){
  const w = c.scwhy||{}, gaps = Object.keys(GOALS).filter(k=>k!=="preserve" && w[k]);
  if(!gaps.length) return "";
  return `<section style="margin-top:22px"><h2 class="st">What could not be scored here, and why</h2>
<div class="card"><table><tbody>${gaps.map(k=>
`<tr><td style="width:150px"><b>${GOALS[k].t}</b></td><td class="mono"><span class="pill wn">no score</span></td><td class="tx">${w[k]}</td></tr>`).join("")}
</tbody></table>
<div style="font:11px/1.6 var(--mono);color:var(--tm);margin-top:10px">A blank is not a low score. It means the question could not be answered from what is published, and a screen that prints a number anyway is inventing one.</div></div></section>`;
}

/* the newest close held by ANY counter — prices no longer share one date */
function newestClose(){
  const ds = D.counters.map(c=>c.price_asof).filter(Boolean).sort();
  return ds.length ? ds[ds.length-1] : D.macroK.stamp.slice(0,10);
}
function priceDateSpread(){
  const ds = [...new Set(D.counters.map(c=>c.price_asof).filter(Boolean))].sort();
  return ds;
}

/* ══ router ══ */
function route(){
  const h = (location.hash||"#/desk").replace(/^#\/?/,"") || "desk";
  const parts = h.split("/");
  const page = parts[0] || "desk";
  const app = document.getElementById("app");
  let body, chrome = true;
  if (page === "stock" && parts[1]) {
    body = `<div class="wrap"><div class="desk">${watchlist(parts[1])}${dossier(parts[1])}${wire(parts[1])}</div></div>`;
  } else if (page === "markets") { body = `<div class="wrap">${markets()}</div>`; }
  else if (page === "news")    { body = `<div class="wrap">${newsPage()}</div>`; }
  else if (page === "legal")   { body = `<div class="wrap">${legalPage()}</div>`; }
  else if (page === "debt")    { body = `<div class="wrap">${debtPage()}</div>`; }
  else if (page === "learn")   { body = `<div class="wrap">${learnPage()}</div>`; }
  else if (page === "method")  { body = `<div class="wrap">${methodPage()}</div>`; }
  else { body = `<div class="wrap"><div class="desk">${watchlist(null)}${deskCentre()}${wire(null)}</div></div>`; }
  app.innerHTML = header(page) + body + noticeBand() + bottomNav(page);
  if (!GOAL) app.insertAdjacentHTML("beforeend", goalGate("goal"));
  else if (!AMT) app.insertAdjacentHTML("beforeend", goalGate("amt"));
  wireUp();
  if (parts[0]==="stock") window.scrollTo(0,0);
}

function wireUp(){
  // staleness
  try{
    const hh = hrs(M.stamp), el = document.getElementById("age");
    if(el){ el.textContent = "Data " + age(hh); el.className = "age " + (hh<24?"f":"s"); }
  }catch(e){}
  document.querySelectorAll("[data-age]").forEach(s=>{
    try{ s.textContent = age(hrs(s.getAttribute("data-age")+"T09:00:00+03:00")); }catch(e){}
  });
  // search
  const q = document.getElementById("q");
  if(q) q.addEventListener("input", e=>{
    Q = e.target.value.trim().toLowerCase();
    document.querySelectorAll(".row[href]").forEach(r=>{
      const tk = r.getAttribute("href").split("/").pop();
      const c = IDX[tk];
      r.classList.toggle("off", !!Q && !(tk.toLowerCase().includes(Q)||c.name.toLowerCase().includes(Q)));
    });
    document.querySelectorAll("tbody tr[onclick]").forEach(r=>{
      const t = r.getAttribute("onclick").match(/stock\/(\w+)/);
      if(!t) return; const c = IDX[t[1]]; if(!c) return;
      r.classList.toggle("off", !!Q && !(c.tk.toLowerCase().includes(Q)||c.name.toLowerCase().includes(Q)));
    });
  });
  // goal chips
  document.querySelectorAll(".gchip").forEach(b=>b.addEventListener("click",()=>{
    GOAL = b.dataset.g; try{localStorage.setItem("th-goal",GOAL);}catch(e){}; route();
  }));
  // goal gate
  let pick = null;
  document.querySelectorAll(".gopt").forEach(b=>b.addEventListener("click",()=>{
    pick = b.dataset.pick;
    document.querySelectorAll(".gopt").forEach(x=>x.classList.toggle("on",x===b));
    const go = document.getElementById("gogo");
    go.disabled = false; go.textContent = "Enter as " + GOALS[pick].t.toLowerCase();
  }));
  const go = document.getElementById("gogo");
  if(go) go.addEventListener("click",()=>{
    if(!pick) return; GOAL = pick; try{localStorage.setItem("th-goal",GOAL);}catch(e){}; route();
  });
  // amount step
  const ain = document.getElementById("amtin"), ago = document.getElementById("amtgo");
  const parse = (s)=>parseFloat(String(s).replace(/[^0-9.]/g,""))||0;
  if(ain){
    ain.focus();
    const sync=()=>{ const v=parse(ain.value); ago.disabled = !(v>=1000);
      ago.textContent = v>=1000 ? "Open the terminal with "+(v>=1e6?"KES "+(v/1e6).toFixed(v%1e6?2:1)+"m":"KES "+v.toLocaleString()) : (v>0?"Minimum 1,000":"Enter an amount to continue"); };
    ain.addEventListener("input",()=>{ const v=parse(ain.value); ain.value = v? v.toLocaleString():""; sync(); });
    ain.addEventListener("keydown",e=>{ if(e.key==="Enter"&&!ago.disabled) ago.click(); });
    document.querySelectorAll(".qb").forEach(b=>b.addEventListener("click",()=>{
      ain.value = (+b.dataset.amt).toLocaleString(); sync(); ain.focus(); }));
    sync();
  }
  if(ago) ago.addEventListener("click",()=>{
    const v = parse(document.getElementById("amtin").value);
    if(!(v>=1000)) return; AMT = v; try{localStorage.setItem("th-amt",String(v));}catch(e){}; route();
  });
  const ab = document.getElementById("amtbtn");
  if(ab) ab.addEventListener("click",()=>{ AMT=null; try{localStorage.removeItem("th-amt");}catch(e){}; route(); });
}
window.addEventListener("hashchange", route);
route();
