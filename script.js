// ACCESSIBLE EXAM — custom + Braille answer mode, hand gestures, head nod, voice
const $=id=>document.getElementById(id),$$=s=>[...document.querySelectorAll(s)];
const LET="ABCDE",BR={A:"⠁",B:"⠃",C:"⠉",D:"⠙",E:"⠑"};
const HOLD=1000,NOD_T=.035,NOD_R=.015,NOD_CD=1500;
const S={mode:null,qs:[],i:0,sel:null,done:false,on:false,paused:false,ans:[]};

// ---------- storage + preferences ----------
const store={get(k,d){try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const pref={voice:true,lang:"auto",theme:"dark",...store.get("ae-pref",{})};
const THEMES=["dark","light","contrast"];
let curExam=null,cur=null;
const exams=()=>store.get("ae-exams",[]),setExams=v=>store.set("ae-exams",v),atts=()=>store.get("ae-att",[]),setAtts=v=>store.set("ae-att",v);
const savePref=()=>store.set("ae-pref",pref);
function paint(){
  document.documentElement.dataset.theme=pref.theme;
  $("themeBtn").textContent="Theme: "+pref.theme;
  $("soundBtn").textContent="Sound "+(pref.voice?"on":"off");
  $("soundBtn").setAttribute("aria-pressed",pref.voice);
  $("voiceLang").value=pref.lang;
  $("who").value=pref.who||"";
}
$("who").oninput=e=>{pref.who=e.target.value;savePref()};
$("themeBtn").onclick=()=>{pref.theme=THEMES[(THEMES.indexOf(pref.theme)+1)%3];savePref();paint()};
$("soundBtn").onclick=()=>{pref.voice=!pref.voice;if(!pref.voice)speechSynthesis.cancel();savePref();paint()};
$("voiceLang").onchange=e=>{pref.lang=e.target.value;savePref()};

function toast(m){const t=$("toast");t.textContent=m;t.classList.add("show");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("show"),4000)}

// ---------- voice (English + Filipino) ----------
const T={
  en:{start:"Exam started. I will read the question now.",q:n=>`Question ${n}.`,opt:l=>`Option ${l}:`,
    sel:l=>`Option ${l} selected. Nod your head to confirm.`,ok:l=>`Answer ${l} confirmed.`,first:"Please select an answer first.",
    braille:n=>`Question ${n}. Read question ${n} from your Braille material. Show your answer using one to five fingers.`,
    done:(s,t)=>`Exam complete. Your score is ${s} out of ${t}.`,doneB:n=>`Braille exam complete. ${n} answers recorded.`,
    pause:"Exam paused.",resume:"Exam resumed.",cam:"Camera could not be started. You can still answer with the keyboard.",none:l=>`There is no option ${l} for this question.`},
  fil:{start:"Nagsimula na ang pagsusulit. Babasahin ko na ang tanong.",q:n=>`Tanong ${n}.`,opt:l=>`Opsyon ${l}:`,
    sel:l=>`Napili ang opsyon ${l}. Tumango upang kumpirmahin.`,ok:l=>`Nakumpirma ang sagot na ${l}.`,first:"Pumili muna ng sagot.",
    braille:n=>`Tanong ${n}. Basahin ang tanong ${n} sa iyong Braille na materyal. Ipakita ang sagot gamit ang isa hanggang limang daliri.`,
    done:(s,t)=>`Tapos na ang pagsusulit. Ang iyong iskor ay ${s} sa ${t}.`,doneB:n=>`Tapos na ang Braille na pagsusulit. Naitala ang ${n} na sagot.`,
    pause:"Naka-pause ang pagsusulit.",resume:"Nagpapatuloy ang pagsusulit.",cam:"Hindi masimulan ang kamera. Maaari pa ring sumagot gamit ang keyboard.",none:l=>`Walang opsyon ${l} sa tanong na ito.`}
};
const FIL=new Set("ano bakit kumusta salamat magandang gusto paano kailangan kayo kami mga ang ng sa ito iyan hindi oo opo pwede tulong saan dapat na nang ako ikaw siya sila ka mo ko wala tama mali bukas araw lahat hapon gabi ay".split(" "));
function detect(t){ // whole-word match (the old substring check flagged almost any English text as Filipino)
  const w=(t||"").toLowerCase().match(/[a-zñ']+/g)||[],h=w.filter(x=>FIL.has(x)).length;
  return h>=2||h/(w.length||1)>=.25?"fil-PH":"en-US";
}
const vlang=()=>pref.lang!=="auto"?pref.lang:(S.mode==="custom"&&S.qs[S.i]?detect(S.qs[S.i].q):"en-US");
const tr=()=>T[vlang()==="fil-PH"?"fil":"en"];
function speak(txt){
  if(!pref.voice)return;
  const lang=vlang();speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(txt);u.lang=lang;u.rate=.9;
  const v=speechSynthesis.getVoices().find(v=>lang==="fil-PH"?/^(fil|tl)/i.test(v.lang):/^en/i.test(v.lang));
  if(v)u.voice=v;speechSynthesis.speak(u);
}
let ac;function beep(f,d=.12){ // audio cue so the answer is heard, not only seen
  if(!pref.voice)return;
  try{ac=ac||new AudioContext();const o=ac.createOscillator(),g=ac.createGain();o.frequency.value=f;g.gain.value=.08;o.connect(g).connect(ac.destination);o.start();o.stop(ac.currentTime+d)}catch{}
}

// ---------- screens ----------
const SCREENS=["modeSelection","customSetup","brailleSetup","examArea","result","teacher","review"];
function show(id){SCREENS.forEach(s=>$(s).classList.toggle("hidden",s!==id));$("progress").classList.toggle("hidden",id!=="examArea");if(id==="modeSelection")renderLib();if(id==="teacher")renderAtts();scrollTo(0,0)}
$$("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
$("brailleModeButton").onclick=()=>{curExam=null;$("bName").value="Braille exam";show("brailleSetup")};
$("teacherBtn").onclick=()=>show("teacher");
$("customModeButton").onclick=()=>{
  curExam=null;$("qList").replaceChildren();$("examName").value=store.get("ae-dname","Untitled exam");show("customSetup");
  {const d=store.get("ae-draft",[]);if(d.length){d.forEach(addQ);toast("Your last draft was restored.")}else for(let k=0;k<3;k++)addQ()}
};

// ---------- exam builder ----------
let uid=0;
const readQs=()=>$$(".qcard").map(c=>({q:c.querySelector(".q").value.trim(),o:[...c.querySelectorAll(".o")].map(i=>i.value.trim()),c:(c.querySelector("input[type=radio]:checked")||{}).value||""}));
const save=()=>{if(curExam)return;store.set("ae-draft",readQs());store.set("ae-dname",$("examName").value)};
function addQ(d={}){
  const c=document.createElement("fieldset");c.className="qcard";const id=++uid;
  c.innerHTML=`<legend>Question <span class="qn"></span></legend><button type="button" class="rm">Remove</button>
  <input class="q" aria-label="Question text" placeholder="Type the question">
  <div class="choices">${[...LET].map(l=>`<label><span class="badge" aria-hidden="true">${BR[l]}</span><input class="o" aria-label="Choice ${l}" placeholder="Choice ${l}${l>"B"?" (optional)":""}"></label>`).join("")}</div>
  <div class="correct">Correct answer: ${[...LET].map(l=>`<label class="pill"><input type="radio" name="c${id}" value="${l}"><span>${l}</span></label>`).join("")}</div>`;
  c.querySelector(".q").value=d.q||"";
  c.querySelectorAll(".o").forEach((i,k)=>i.value=(d.o||[])[k]||"");
  if(d.c){const r=c.querySelector(`input[value=${d.c}]`);if(r)r.checked=true}
  c.querySelector(".rm").onclick=()=>{c.remove();renum();save()};
  $("qList").appendChild(c);renum();
}
const renum=()=>$$(".qn").forEach((e,i)=>e.textContent=i+1);
$("qList").addEventListener("input",save);$("examName").addEventListener("input",save);
$("addQ").onclick=()=>{addQ();$$(".qcard").pop().querySelector(".q").focus()};
$("clearQs").onclick=()=>{if(confirm("Remove all questions?")){$("qList").replaceChildren();addQ();save()}};

function parse(txt){ // "Q: …", "A) …", "Answer: B"
  const out=[];let cur=null,m;
  for(const raw of txt.split(/\r?\n/)){
    const l=raw.trim();if(!l)continue;
    if(m=l.match(/^(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d+\s*[.)])\s*(.+)/i)){cur={q:m[1],o:[],c:""};out.push(cur)}
    else if(cur&&(m=l.match(/^([a-e])\s*[.):-]\s*(.+)/i)))cur.o[LET.indexOf(m[1].toUpperCase())]=m[2];
    else if(cur&&(m=l.match(/^(?:ans(?:wer)?|correct)\s*[:=-]?\s*([a-e])/i)))cur.c=m[1].toUpperCase();
    else if(cur&&!cur.o.length)cur.q+=" "+l;
  }
  return out.map(x=>({q:x.q,o:Array.from({length:5},(_,i)=>x.o[i]||""),c:x.c}));
}
$("importBtn").onclick=()=>{
  const r=parse($("pasteBox").value);if(!r.length)return toast("No questions found. Start each one with “Q:” and list choices as A) B) C)…");
  $$(".qcard").filter(c=>!c.querySelector(".q").value&&![...c.querySelectorAll(".o")].some(i=>i.value)).forEach(c=>c.remove());
  r.forEach(addQ);renum();save();$("pasteBox").value="";toast(`Added ${r.length} question${r.length>1?"s":""}.`);
};
function clean(r){
  const o=[];for(const v of r.o){if(!v)break;o.push(v)}
  const k=LET.indexOf(r.c);
  return{q:r.q,o,c:r.c,ok:!!r.q&&o.length>=2&&o.length===r.o.filter(Boolean).length&&k>=0&&k<o.length};
}
function validQs(){
  const rs=readQs().map(clean);if(!rs.length)return toast("Add at least one question");
  const cards=$$(".qcard");rs.forEach((r,i)=>cards[i].classList.toggle("bad",!r.ok));
  const bad=rs.findIndex(r=>!r.ok);
  if(bad>=0){cards[bad].scrollIntoView({behavior:"smooth",block:"center"});return toast(`Question ${bad+1}: add the question, at least two choices in order (A, B, C…), and the correct answer.`)}
  return rs.map(({q,o,c})=>({q,o,c}));
}
function saveExamRec(mode,qs,name){
  const L=exams(),n=(name||"").trim()||"Untitled exam";let e=L.find(x=>x.id===curExam);
  if(e)Object.assign(e,{name:n,mode,qs,updated:Date.now()});else{e={id:Date.now().toString(36),name:n,mode,qs,updated:Date.now()};L.push(e);curExam=e.id}
  setExams(L);return e;
}
$("saveExam").onclick=()=>{const rs=validQs();if(rs){saveExamRec("custom",rs,$("examName").value);toast("Exam saved.")}};
$("startCustom").onclick=()=>{const rs=validQs();if(rs){const e=saveExamRec("custom",rs,$("examName").value);begin("custom",e.qs,e.name)}};
$("startBraille").onclick=()=>{
  const n=+$("bCount").value,key=$("bKey").value.toUpperCase().match(/[A-E]/g)||[];
  if(!Number.isInteger(n)||n<1||n>100)return toast("Enter a number from 1 to 100.");
  if(key.length&&key.length!==n)return toast(`The answer key has ${key.length} letters but the exam has ${n} questions.`);
  const e=saveExamRec("braille",Array.from({length:n},(_,i)=>({q:"",o:[],c:key[i]||""})),$("bName").value);begin("braille",e.qs,e.name);
};

// ---------- exam flow ----------
const hist=[];let holdFor=null,holdStart=0,lastWarn=0;
function setStage(l,msg,p){$("answerLetter").textContent=l;$("answerBraille").textContent=BR[l]||"⠀";$("answerMsg").textContent=msg;$("stage").style.setProperty("--p",p)}
function restore(){S.sel?setStage(S.sel,`Option ${S.sel}. Nod or press Enter to confirm.`,1):setStage("—","Show 1–5 fingers",0)}
function reset(){
  S.sel=null;S.done=false;hist.length=0;holdFor=null;neutral=null;nodOn=false;
  $("stage").classList.remove("active","locked");setStage("—","Show 1–5 fingers",0);
  $("selStatus").textContent="None";$("nodStatus").textContent="Waiting";$("fingerStatus").textContent="Waiting";$("nodMeter").style.setProperty("--v",0);
}
function begin(mode,qs,name){
  Object.assign(S,{mode,qs,name,t0:Date.now(),i:0,on:true,paused:false,ans:[]});
  document.body.classList.remove("paused");$("pause").textContent="Pause";
  reset();show("examArea");
  $("modeLabel").textContent=mode==="custom"?"Custom exam":"Braille answer mode";
  $("normalQ").classList.toggle("hidden",mode!=="custom");$("brailleQ").classList.toggle("hidden",mode==="custom");$("repeat").classList.toggle("hidden",mode!=="custom");
  render();startCamera();
  setTimeout(()=>{if(mode==="custom"){speak(tr().start);setTimeout(readQ,1800)}else speak(tr().braille(1))},500);
}
function render(){
  const q=S.qs[S.i];
  $("qNum").textContent=S.i+1;$("qTotal").textContent=S.qs.length;$("progressFill").style.width=(S.i/S.qs.length*100)+"%";
  if(S.mode==="braille")return $("bNum").textContent=S.i+1;
  $("qText").textContent=q.q;
  $("options").replaceChildren(...q.o.map((o,k)=>{
    const L=LET[k],b=document.createElement("button");b.type="button";b.className="opt";b.id="opt-"+L;
    b.innerHTML=`<span class="l">${L}</span><span class="g" aria-hidden="true">${BR[L]}</span><span class="t"></span>`;
    b.querySelector(".t").textContent=o;b.onclick=()=>pick(L);return b;
  }));
}
function readQ(){
  const q=S.qs[S.i];if(S.mode!=="custom"||!q||!S.on)return;const t=tr();
  speak(t.q(S.i+1)+" "+q.q+". "+q.o.map((o,k)=>t.opt(LET[k])+" "+o+".").join(" "));
}
function pick(l){
  if(!S.on||S.paused||S.done)return;
  if(S.mode==="custom"&&LET.indexOf(l)>=S.qs[S.i].o.length){
    if(Date.now()-lastWarn>3000){lastWarn=Date.now();$("answerMsg").textContent=tr().none(l);speak(tr().none(l))}
    return;
  }
  S.sel=l;setStage(l,`Option ${l}. Nod or press Enter to confirm.`,1);$("stage").classList.add("active");
  $$(".opt").forEach(o=>o.classList.toggle("selected",o.id==="opt-"+l));
  $("selStatus").textContent="Option "+l;$("nodStatus").textContent="Nod to confirm";beep(660);speak(tr().sel(l));
}
function confirmA(){
  if(!S.on||S.paused||S.done)return;
  if(!S.sel){$("nodStatus").textContent="Select an answer first";speak(tr().first);return}
  S.done=true;S.ans[S.i]=S.sel;
  $("nodStatus").textContent=`Answer ${S.sel} confirmed`;$("answerMsg").textContent=`Answer ${S.sel} confirmed`;
  $("stage").classList.replace("active","locked");beep(880,.2);speak(tr().ok(S.sel));
  setTimeout(()=>S.on&&next(),1800);
}
function next(){
  S.i++;if(S.i>=S.qs.length)return finish();
  reset();render();setTimeout(()=>S.mode==="custom"?readQ():speak(tr().braille(S.i+1)),500);
}
function finish(){
  S.on=false;S.i=Math.min(S.i,S.qs.length-1);speechSynthesis.cancel();stopCamera();
  const keyed=S.qs.some(q=>q.c),n=S.ans.filter(Boolean).length;
  let s=0;S.qs.forEach((q,i)=>{if(q.c&&S.ans[i]===q.c)s++});
  $("score").textContent=`${keyed?s:n} / ${S.qs.length}`;$("scoreNote").textContent=keyed?"correct answers":"answers recorded";
  $("record").replaceChildren(...S.qs.map((q,i)=>{
    const a=S.ans[i]||"—",d=document.createElement("div");d.className="rec "+(!q.c?"":a===q.c?"right":"wrong");
    d.innerHTML=`<small>Q${i+1}</small><b>${a}</b>`+(q.c&&a!==q.c?`<small>Key ${q.c}</small>`:"");return d;
  }));
  const who=$("who").value.trim();
  S.aid=Date.now().toString(36);
  setAtts([{id:S.aid,exam:S.name,mode:S.mode,qs:S.qs,ans:Array.from({length:S.qs.length},(_,i)=>S.ans[i]||""),who,date:Date.now(),dur:Math.round((Date.now()-S.t0)/1000),note:""},...atts()].slice(0,200));
  $("fileName").value=S.name+(who?" - "+who:"");show("result");
  const t=tr();speak(keyed?t.done(s,S.qs.length):t.doneB(n));
}
$("repeat").onclick=readQ;
$("confirm").onclick=confirmA;
$("pause").onclick=()=>{
  if(!S.on)return;S.paused=!S.paused;speechSynthesis.cancel();
  $("pause").textContent=S.paused?"Resume":"Pause";document.body.classList.toggle("paused",S.paused);speak(S.paused?tr().pause:tr().resume);
};
$("end").onclick=()=>{if(S.on&&confirm("End the exam now? Unanswered questions stay blank."))finish()};
$("retake").onclick=()=>begin(S.mode,S.qs);
$("newExam").onclick=()=>{S.on=false;S.qs=[];$("qList").replaceChildren();show("modeSelection")};
function csvOut(rows,name){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`,a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob([rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}));
  a.download=(name.trim().replace(/[\\/:*?"<>|]+/g,"-")||"exam-results")+".csv";a.click();
}
$("csv").onclick=()=>csvOut([["Question","Answer","Key"],...S.qs.map((q,i)=>[i+1,S.ans[i]||"",q.c||""])],$("fileName").value);
$("toReview").onclick=()=>openReview(S.aid);
addEventListener("keydown",e=>{ // keyboard works as a full fallback for gestures
  if(!S.on||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toUpperCase();
  if(/^[A-E]$/.test(k))pick(k);else if(/^[1-5]$/.test(k))pick(LET[k-1]);
  else if(k==="ENTER"&&!e.target.closest(".controls"))confirmA();
  else if(k==="R")readQ();else if(k==="P")$("pause").click();else return;
  e.preventDefault();
});

// ---------- saved exams + teacher review ----------
const el=(h,cls="row",tag="div")=>{const d=document.createElement(tag);d.className=cls;d.innerHTML=h;return d};
function renderLib(){
  const L=exams();
  $("library").replaceChildren(...(L.length?L:[null]).map(e=>{
    if(!e)return el("No saved exams yet. Build one and it is saved when you start or press Save exam.");
    const d=el(`<span class="grow"><b></b><small></small></span><button class="chip">Start</button><button class="chip">Edit</button><button class="chip">Rename</button><button class="chip">Delete</button>`);
    d.querySelector("b").textContent=e.name;
    d.querySelector("small").textContent=`${e.qs.length} ${e.mode==="custom"?"questions":"Braille questions"}, saved ${new Date(e.updated).toLocaleDateString()}`;
    const [go,ed,rn,del]=d.querySelectorAll("button");
    go.onclick=()=>{curExam=e.id;begin(e.mode,e.qs,e.name)};
    ed.onclick=()=>{
      curExam=e.id;
      if(e.mode==="custom"){$("qList").replaceChildren();e.qs.forEach(q=>addQ({q:q.q,o:Array.from({length:5},(_,i)=>q.o[i]||""),c:q.c}));$("examName").value=e.name;show("customSetup")}
      else{$("bName").value=e.name;$("bCount").value=e.qs.length;$("bKey").value=e.qs.every(q=>q.c)?e.qs.map(q=>q.c).join(""):"";show("brailleSetup")}
    };
    rn.onclick=()=>{const n=prompt("Exam name",e.name);if(n&&n.trim()){const A=exams();A.find(x=>x.id===e.id).name=n.trim();setExams(A);renderLib()}};
    del.onclick=()=>{if(confirm(`Delete “${e.name}”? Past results are kept.`)){setExams(exams().filter(x=>x.id!==e.id));renderLib()}};
    return d;
  }));
}
const score=a=>a.qs.reduce((s,q,i)=>s+(q.c&&a.ans[i]===q.c?1:0),0);
function renderAtts(){
  const A=atts();
  $("attempts").replaceChildren(...(A.length?A:[null]).map(a=>{
    if(!a)return el("No finished exams yet.");
    const d=el(`<span class="grow"><b></b><small></small></span><span class="chip"></span>`,"row","button");
    d.querySelector("b").textContent=a.exam+(a.who?" - "+a.who:"");
    d.querySelector("small").textContent=new Date(a.date).toLocaleString();
    d.querySelector(".chip").textContent=a.qs.some(q=>q.c)?`${score(a)} / ${a.qs.length}`:"Needs key";
    d.onclick=()=>openReview(a.id);return d;
  }));
}
function openReview(id){
  cur=atts().find(a=>a.id===id);if(!cur)return;
  $("revTitle").textContent=cur.exam+(cur.who?" - "+cur.who:"");$("revNote").value=cur.note||"";drawRev();show("review");
}
function drawRev(){
  const keyed=cur.qs.some(q=>q.c);
  $("revSum").textContent=`${new Date(cur.date).toLocaleString()}, ${Math.floor(cur.dur/60)}m ${cur.dur%60}s. `+(keyed?`${score(cur)} of ${cur.qs.length} correct.`:"No answer key yet. Pick the correct answers below to score it.");
  $("revList").replaceChildren(...cur.qs.map((q,i)=>{
    const a=cur.ans[i]||"—",d=el(`<span class="grow"><b></b><small></small></span><span>Answer <b class="ans"></b></span><label>Key <select><option value="">?</option>${[...LET].map(l=>`<option>${l}</option>`).join("")}</select></label>`,"row "+(!q.c?"":a===q.c?"good":"miss"));
    d.querySelector("b").textContent=`${i+1}. ${q.q||"Braille question "+(i+1)}`;
    d.querySelector("small").textContent=q.o.map((o,k)=>`${LET[k]}) ${o}`).join("   ");
    d.querySelector(".ans").textContent=a;
    const s=d.querySelector("select");s.value=q.c||"";s.setAttribute("aria-label","Correct answer for question "+(i+1));
    s.onchange=()=>{q.c=s.value;drawRev()};return d;
  }));
}
$("revSave").onclick=()=>{cur.note=$("revNote").value;const A=atts();A[A.findIndex(a=>a.id===cur.id)]=cur;setAtts(A);toast("Review saved.")};
$("revDel").onclick=()=>{if(confirm("Delete this result?")){setAtts(atts().filter(a=>a.id!==cur.id));show("teacher")}};
$("revCsv").onclick=()=>csvOut([["Question","Answer","Key","Result"],...cur.qs.map((q,i)=>[i+1,cur.ans[i]||"",q.c||"",!q.c?"":cur.ans[i]===q.c?"Correct":"Wrong"]),[],["Score",score(cur)+"/"+cur.qs.length],["Teacher comment",$("revNote").value]],cur.exam+(cur.who?" - "+cur.who:""));

// ---------- hand gestures ----------
function countFingers(l){
  let c=0;[[8,6],[12,10],[16,14],[20,18]].forEach(([t,p])=>{if(l[t].y<l[p].y)c++});
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  if(d(l[4],l[5])>d(l[3],l[5])*1.15)c++;
  return c;
}
function gesture(c){ // needs 5 of the last 7 frames to agree, then a 1s hold; the ring fills while holding
  if(!S.on||S.paused||S.done)return;
  hist.push(c);if(hist.length>7)hist.shift();
  const a=hist.filter(v=>v===c).length>=5?LET[c-1]:null;
  if(!a||a===S.sel){holdFor=null;return restore()}
  if(holdFor!==a){holdFor=a;holdStart=Date.now()}
  const p=Math.min((Date.now()-holdStart)/HOLD,1);
  setStage(a,`Hold steady for ${a}…`,p);
  if(p>=1){holdFor=null;pick(a);if(S.sel!==a)restore()}
}

// ---------- head nod + camera (MediaPipe) ----------
let neutral=null,nodOn=false,nodAt=0,lastNod=0,camera=null,camOn=false;
const cv=$("canvas"),ctx=cv.getContext("2d"),vid=$("camera");
const setCam=(t,err)=>{$("camState").textContent=t;$("camState").classList.toggle("err",!!err)};
if(window.Hands&&window.FaceMesh&&window.Camera){
  const hands=new Hands({locateFile:f=>"https://cdn.jsdelivr.net/npm/@mediapipe/hands/"+f});
  hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.6,minTrackingConfidence:.6});
  hands.onResults(r=>{
    if(vid.videoWidth){cv.width=vid.videoWidth;cv.height=vid.videoHeight}
    ctx.clearRect(0,0,cv.width,cv.height);
    const l=r.multiHandLandmarks&&r.multiHandLandmarks[0];
    if(!l){$("fingerStatus").textContent="No hand";hist.length=0;holdFor=null;if(S.on)restore();return}
    drawConnectors(ctx,l,HAND_CONNECTIONS,{color:"#7c8aff",lineWidth:4});drawLandmarks(ctx,l,{color:"#fff",radius:3});
    const c=countFingers(l);$("fingerStatus").textContent=c+(c===1?" finger":" fingers");gesture(c);
  });
  const face=new FaceMesh({locateFile:f=>"https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/"+f});
  face.setOptions({maxNumFaces:1,refineLandmarks:false,minDetectionConfidence:.6,minTrackingConfidence:.6});
  face.onResults(r=>{
    const f=r.multiFaceLandmarks&&r.multiFaceLandmarks[0];if(!f){neutral=null;return}
    const h=f[152].y-f[10].y;if(h<=0)return;
    const p=(f[1].y-f[10].y)/h;if(neutral===null){neutral=p;return}
    const m=p-neutral,now=Date.now();
    $("nodMeter").style.setProperty("--v",Math.max(0,Math.min(m/NOD_T,1)));
    if(S.paused||S.done)return;
    if(!nodOn&&Math.abs(m)<NOD_R)neutral+=m*.05; // slowly follow posture changes
    if(m>NOD_T&&!nodOn&&now-lastNod>NOD_CD){nodOn=true;nodAt=now;$("nodStatus").textContent="Head down…"}
    else if(nodOn&&m<NOD_R&&now-nodAt>150&&now-nodAt<2000){nodOn=false;lastNod=now;confirmA()}
    else if(nodOn&&now-nodAt>2000){nodOn=false;$("nodStatus").textContent="Nod again"}
  });
  camera=new Camera(vid,{width:640,height:480,onFrame:async()=>{
    if(!S.on||!camOn)return;
    try{await hands.send({image:vid});await face.send({image:vid})}catch(e){console.error(e)}
  }});
}
async function startCamera(){
  if(!camera){setCam("Keyboard only",true);toast("Gesture engine didn’t load. Use A–E and Enter to answer.");return}
  try{setCam("Starting…");camOn=true;await camera.start();setCam("Camera on")}
  catch(e){console.error(e);camOn=false;setCam("Camera error",true);$("fingerStatus").textContent="Camera unavailable";speak(tr().cam);toast("Camera unavailable. Use A–E and Enter to answer.")}
}
function stopCamera(){
  camOn=false;setCam("Off");
  if(vid.srcObject){vid.srcObject.getTracks().forEach(t=>t.stop());vid.srcObject=null}
}

paint();show("modeSelection");

// ---------- install as an app ----------
let installEv=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEv=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!installEv)return;installEv.prompt();await installEv.userChoice;installEv=null;$("installBtn").classList.add("hidden")};
addEventListener("appinstalled",()=>{$("installBtn").classList.add("hidden");toast("App installed.")});
if("serviceWorker" in navigator&&location.protocol!=="file:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(console.error));
