// ACCESSIBLE EXAM — custom + Braille answer mode, hand gestures, head nod, voice
const CFG = window.CFG || { GOOGLE_CLIENT_ID: "", ALLOW_GUEST: true, TEACHERS: [] };
const $=id=>document.getElementById(id),$$=s=>[...document.querySelectorAll(s)];
const LET="ABCDE",BR={A:"⠁",B:"⠃",C:"⠉",D:"⠙",E:"⠑"};
const HOLD=1000,THUMB_HOLD=700;
const S={mode:null,qs:[],i:0,sel:null,done:false,on:false,paused:false,ans:[]};
BR.T="⠞";BR.F="⠋";
// question helpers: old saved exams have no type/points, so they count as multiple choice worth 1 point
const qt=q=>(q&&q.t)||"mc",qp=q=>(q&&q.p!=null&&!isNaN(q.p))?+q.p:1;
const lab=l=>l==="T"?"TRUE":l==="F"?"FALSE":"Option "+l;
const tfL=v=>v==="T"?"TRUE":v==="F"?"FALSE":(v||"");
const f=n=>Number.isInteger(n)?n:+(+n).toFixed(2);
const TL={mc:"Multiple choice",tf:"True or false",essay:"Essay"};
const hint=()=>{const t=qt(S.qs[S.i]);return t==="tf"?"1 finger = TRUE, 2 fingers = FALSE":t==="essay"?"Speak your answer, then thumbs-up":"Show 1–5 fingers"};
function calc(a){ // essays count only once the teacher gives points
  let s=0,max=0,am=0,pend=0;
  a.qs.forEach((q,i)=>{const t=qt(q),p=qp(q);max+=p;
    if(t==="essay"){const g=(a.g||{})[i];if(g&&g.pts!=null&&g.pts!=="")s+=Math.min(+g.pts,p);else pend++}
    else{am+=p;if(q.c&&a.ans[i]===q.c)s+=p}});
  return{s,max,am,pend};
}

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
    lb:l=>l==="T"?"True":l==="F"?"False":`Option ${l}`,
    sel:l=>`${T.en.lb(l)} selected. Give a thumbs-up to confirm.`,ok:l=>`${T.en.lb(l)} confirmed.`,first:"Please select an answer first.",
    braille:n=>`Question ${n}. Read question ${n} from your Braille material. Show your answer using one to five fingers.`,
    tfHow:"True or false. Show one finger for true, two fingers for false.",
    essayHow:"This is an essay question. Press the microphone button, or the M key, to answer by voice. Then give a thumbs-up to submit.",
    empty:"Your essay answer is empty.",essayOk:"Essay answer saved.",
    done:(s,t)=>`Exam complete. Your score is ${s} out of ${t}.`,doneB:n=>`Braille exam complete. ${n} answers recorded.`,donePend:"Exam complete. Your essay is waiting for teacher grading.",
    pause:"Exam paused.",resume:"Exam resumed.",cam:"Camera could not be started. You can still answer with the keyboard.",none:l=>`There is no option ${l} for this question.`},
  fil:{start:"Nagsimula na ang pagsusulit. Babasahin ko na ang tanong.",q:n=>`Tanong ${n}.`,opt:l=>`Opsyon ${l}:`,
    lb:l=>l==="T"?"Totoo":l==="F"?"Mali":`Opsyon ${l}`,
    sel:l=>`Napili ang ${T.fil.lb(l)}. Mag-thumbs-up para kumpirmahin.`,ok:l=>`Nakumpirma ang ${T.fil.lb(l)}.`,first:"Pumili muna ng sagot.",
    braille:n=>`Tanong ${n}. Basahin ang tanong ${n} sa iyong Braille na materyal. Ipakita ang sagot gamit ang isa hanggang limang daliri.`,
    tfHow:"Totoo o Mali. Isang daliri para sa Totoo, dalawang daliri para sa Mali.",
    essayHow:"Ito ay tanong na sanaysay. Pindutin ang mikropono, o ang M key, para sumagot gamit ang boses. Pagkatapos, mag-thumbs-up para i-submit.",
    empty:"Walang laman ang iyong sagot.",essayOk:"Nai-save ang iyong sagot sa sanaysay.",
    done:(s,t)=>`Tapos na ang pagsusulit. Ang iyong iskor ay ${s} sa ${t}.`,doneB:n=>`Tapos na ang Braille na pagsusulit. Naitala ang ${n} na sagot.`,donePend:"Tapos na ang pagsusulit. Hinihintay pa ang pag-grade ng guro sa iyong sanaysay.",
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
const SCREENS=["modeSelection","customSetup","brailleSetup","examArea","result","teacher","review","login"];
function show(id){
  if((id==="teacher"||id==="review")&&!isTeacher()){toast("Only teachers can check results.");id="modeSelection"}
 SCREENS.forEach(s=>$(s).classList.toggle("hidden",s!==id));$("progress").classList.toggle("hidden",id!=="examArea");if(id!=="examArea")stopRec();if(id==="modeSelection")renderLib();if(id==="teacher")renderAtts();scrollTo(0,0)}
$$("[data-go]").forEach(b=>b.onclick=()=>show(b.dataset.go));
$("brailleModeButton").onclick=()=>{curExam=null;$("bName").value="Braille exam";show("brailleSetup")};
$("teacherBtn").onclick=()=>show("teacher");
$("customModeButton").onclick=()=>{
  curExam=null;$("qList").replaceChildren();$("examName").value=store.get("ae-dname","Untitled exam");show("customSetup");
  {const d=store.get("ae-draft",[]);if(d.length){d.forEach(addQ);toast("Your last draft was restored.")}else for(let k=0;k<3;k++)addQ()}
};

// ---------- exam builder ----------
let uid=0;
const readQs=()=>$$(".qcard").map(c=>{const t=c.querySelector(".ty").value;return{t,q:c.querySelector(".q").value.trim(),o:[...c.querySelectorAll(".o")].map(i=>i.value.trim()),c:t==="essay"?"":((c.querySelector(t==="tf"?".tfp input:checked":".mcp input:checked")||{}).value||""),p:parseFloat(c.querySelector(".pt").value),r:c.querySelector(".rb").value.trim()}});
const save=()=>{if(curExam)return;store.set("ae-draft",readQs());store.set("ae-dname",$("examName").value)};
function addQ(d={}){
  const c=document.createElement("fieldset"),id=++uid;c.className="qcard";c.dataset.t=d.t||"mc";
  c.innerHTML=`<legend>Question <span class="qn"></span></legend><button type="button" class="rm">Remove</button>
  <div class="qtop"><label>Type<select class="ty"><option value="mc">Multiple choice</option><option value="tf">True or false</option><option value="essay">Essay</option></select></label>
  <label>Points<input class="pt" type="number" min="0" step="0.5"></label></div>
  <input class="q" aria-label="Question text" placeholder="Type the question or essay instructions">
  <div class="mcp"><div class="choices">${[...LET].map(l=>`<label><span class="badge" aria-hidden="true">${BR[l]}</span><input class="o" aria-label="Choice ${l}" placeholder="Choice ${l}${l>"B"?" (optional)":""}"></label>`).join("")}</div>
  <div class="correct">Correct answer: ${[...LET].map(l=>`<label class="pill"><input type="radio" name="c${id}" value="${l}"><span>${l}</span></label>`).join("")}</div></div>
  <div class="tfp correct">Correct answer: <label class="pill"><input type="radio" name="t${id}" value="T"><span>True</span></label><label class="pill"><input type="radio" name="t${id}" value="F"><span>False</span></label></div>
  <label class="esp">Grading rubric or teacher notes, optional<textarea class="rb" rows="2"></textarea></label>`;
  c.querySelector(".ty").value=d.t||"mc";c.querySelector(".pt").value=d.p??1;
  c.querySelector(".q").value=d.q||"";c.querySelector(".rb").value=d.r||"";
  c.querySelectorAll(".o").forEach((i,k)=>i.value=(d.o||[])[k]||"");
  if(d.c){const r=c.querySelector((d.t==="tf"?".tfp":".mcp")+` input[value="${d.c}"]`);if(r)r.checked=true}
  c.querySelector(".ty").onchange=e=>{c.dataset.t=e.target.value};
  c.querySelector(".rm").onclick=()=>{c.remove();renum();save()};
  $("qList").appendChild(c);renum();
}
function totals(){const r=readQs();$("totals").textContent=`${r.length} question${r.length===1?"":"s"}, ${f(r.reduce((s,q)=>s+(isNaN(q.p)?0:q.p),0))} points in total`}
const renum=()=>{$$(".qn").forEach((e,i)=>e.textContent=i+1);totals()};
$("qList").addEventListener("input",()=>{save();totals()});$("examName").addEventListener("input",save);
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
  const p=Number.isFinite(r.p)&&r.p>=0?r.p:NaN,base={...r,p};
  if(r.t==="essay")return{...base,o:[],c:"",ok:!!r.q&&p>0};
  if(r.t==="tf")return{...base,o:[],ok:!!r.q&&(r.c==="T"||r.c==="F")&&p>=0};
  const o=[];for(const v of r.o){if(!v)break;o.push(v)}
  const k=LET.indexOf(r.c);
  return{...base,o,ok:!!r.q&&o.length>=2&&o.length===r.o.filter(Boolean).length&&k>=0&&k<o.length&&p>=0};
}
function validQs(){
  const rs=readQs().map(clean);if(!rs.length)return toast("Add at least one question");
  const cards=$$(".qcard");rs.forEach((r,i)=>cards[i].classList.toggle("bad",!r.ok));
  const bad=rs.findIndex(r=>!r.ok);
  if(bad>=0){cards[bad].scrollIntoView({behavior:"smooth",block:"center"});return toast(`Question ${bad+1}: add the question text, points and correct answer. Multiple choice needs two or more choices in order. Essays need points above 0.`)}
  return rs.map(({t,q,o,c,p,r})=>({t,q,o,c,p,r}));
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
const tbuf=[];let thStart=0,thArmed=false,lastConf=0;
function setStage(l,msg,p){$("answerLetter").textContent=l;$("answerBraille").textContent=BR[l]||"⠀";$("answerMsg").textContent=msg;$("stage").style.setProperty("--p",p)}
function restore(){S.sel?setStage(S.sel,`${lab(S.sel)}. Thumbs-up or Enter to confirm.`,1):setStage("—",hint(),0)}
function reset(){
  S.sel=null;S.done=false;hist.length=0;tbuf.length=0;holdFor=null;thStart=0;thArmed=false;
  $("stage").classList.remove("active","locked");setStage("—",hint(),0);
  $("selStatus").textContent="None";$("nodStatus").textContent="Waiting";$("fingerStatus").textContent="Waiting";$("nodMeter").style.setProperty("--v",0);
}
function begin(mode,qs,name){
  Object.assign(S,{mode,qs,name,t0:Date.now(),i:0,on:true,paused:false,ans:[]});
  document.body.classList.remove("paused");$("pause").textContent="Pause";
  reset();show("examArea");
  $("modeLabel").textContent=mode==="custom"?"Custom exam":"Braille answer mode";
  $("normalQ").classList.toggle("hidden",mode!=="custom");$("brailleQ").classList.toggle("hidden",mode==="custom");$("repeat").classList.toggle("hidden",mode!=="custom");
  render();
  startCamera();
  if(mode==="custom"){speak(tr().start);readQ();}
  else{speak(tr().braille(1));}
}
function render(){
  const q=S.qs[S.i],t=qt(q);stopRec();
  $("qNum").textContent=S.i+1;$("qTotal").textContent=S.qs.length;$("progressFill").style.width=(S.i/S.qs.length*100)+"%";
  if(S.mode==="braille")return $("bNum").textContent=S.i+1;
  $("qText").textContent=q.q;
  $("options").classList.toggle("hidden",t==="essay");$("essayQ").classList.toggle("hidden",t!=="essay");
  $("fingerGuide").innerHTML=(t==="essay"?"<span><b>M</b> Microphone</span>":t==="tf"?"<span><b>1</b> ⠞ TRUE</span><span><b>2</b> ⠋ FALSE</span>":[...LET].map((l,i)=>`<span><b>${i+1}</b> ${BR[l]} ${l}</span>`).join(""))+"<span><b>Thumbs-up</b> confirms</span>";
  if(t==="essay"){$("essayBox").value="";recUI();return}
  const list=t==="tf"?[["T","TRUE"],["F","FALSE"]]:q.o.map((o,k)=>[LET[k],o]);
  $("options").replaceChildren(...list.map(([L,txt])=>{
    const b=document.createElement("button");b.type="button";b.className="opt"+(t==="tf"?" tf":"");b.id="opt-"+L;
    b.innerHTML=`<span class="l">${t==="tf"?(L==="T"?"1":"2"):L}</span><span class="g" aria-hidden="true">${BR[L]}</span><span class="t"></span>`;
    b.querySelector(".t").textContent=txt;b.onclick=()=>pick(L);return b;
  }));
}
function readQ(){
  const q=S.qs[S.i];if(S.mode!=="custom"||!q||!S.on)return;const t=tr(),ty=qt(q);
  speak(t.q(S.i+1)+" "+q.q+". "+(ty==="essay"?t.essayHow:ty==="tf"?t.tfHow:q.o.map((o,k)=>t.opt(LET[k])+" "+o+".").join(" ")));
}
function pick(l){
  if(!S.on||S.paused||S.done)return;const q=S.qs[S.i],t=qt(q);
  const bad=t==="essay"||(t==="tf"?!(l==="T"||l==="F"):(LET.indexOf(l)<0||(S.mode==="custom"&&LET.indexOf(l)>=q.o.length)));
  if(bad){if(t!=="essay"&&Date.now()-lastWarn>3000){lastWarn=Date.now();$("answerMsg").textContent=tr().none(l);speak(tr().none(l))}return}
  S.sel=l;setStage(l,`${lab(l)}. Thumbs-up or Enter to confirm.`,1);$("stage").classList.add("active");
  $$(".opt").forEach(o=>o.classList.toggle("selected",o.id==="opt-"+l));
  $("selStatus").textContent=lab(l);$("nodStatus").textContent="Thumbs-up to confirm";beep(660);speak(tr().sel(l));
}
function confirmA(){
  if(!S.on||S.paused||S.done)return;thArmed=false;lastConf=Date.now();
  const t=qt(S.qs[S.i]);let val;
  if(t==="essay"){stopRec();val=$("essayBox").value.trim();if(!val){$("nodStatus").textContent="Answer is empty";speak(tr().empty);return}}
  else{if(!S.sel){$("nodStatus").textContent="Select an answer first";speak(tr().first);return}val=S.sel}
  S.done=true;S.ans[S.i]=val;
  const msg=t==="essay"?"Essay saved":lab(val)+" confirmed";
  $("nodStatus").textContent=msg;$("answerMsg").textContent=msg;
  $("stage").classList.remove("active");$("stage").classList.add("locked");beep(880,.2);speak(t==="essay"?tr().essayOk:tr().ok(val));
  setTimeout(()=>S.on&&next(),1800);
}
function next(){
  S.i++;if(S.i>=S.qs.length)return finish();
  reset();render();setTimeout(()=>S.mode==="custom"?readQ():speak(tr().braille(S.i+1)),500);
}
function finish(){
  stopRec();S.on=false;S.i=Math.min(S.i,S.qs.length-1);speechSynthesis.cancel();stopCamera();
  const who=$("who").value.trim();S.aid=Date.now().toString(36);
  const att={id:S.aid,exam:S.name,mode:S.mode,qs:S.qs,ans:Array.from({length:S.qs.length},(_,i)=>S.ans[i]||""),g:{},who,email:user?user.email:"",date:Date.now(),dur:Math.round((Date.now()-S.t0)/1000),note:""};
  setAtts([att,...atts()].slice(0,200));
  const c=calc(att),n=att.ans.filter(Boolean).length,hasE=S.qs.some(q=>qt(q)==="essay"),keyed=S.qs.some(q=>q.c),t=tr();
  $("score").classList.toggle("pending",c.pend>0);
  if(c.pend){$("score").textContent="Essay grading pending.";$("scoreNote").textContent=`Auto-graded so far: ${f(c.s)} of ${f(c.am)} points. Your teacher will grade the essay.`}
  else if(keyed||hasE){$("score").textContent=`${f(c.s)} / ${f(c.max)}`;$("scoreNote").textContent="points"}
  else{$("score").textContent=`${n} / ${S.qs.length}`;$("scoreNote").textContent="answers recorded"}
  $("record").replaceChildren(...S.qs.map((q,i)=>{
    const ty=qt(q),a=S.ans[i],ok=ty!=="essay"&&q.c,d=document.createElement("div");
    d.className="rec "+(!ok?"":a===q.c?"right":"wrong");
    d.innerHTML=`<small>Q${i+1}</small><b></b>`+(ok&&a!==q.c?`<small>Key ${ty==="tf"?(q.c==="T"?"True":"False"):q.c}</small>`:"");
    d.querySelector("b").textContent=!a?"—":ty==="essay"?"Essay":ty==="tf"?(a==="T"?"True":"False"):a;return d;
  }));
  show("result");speak(c.pend?t.donePend:(keyed||hasE)?t.done(f(c.s),f(c.max)):t.doneB(n));
}
$("repeat").onclick=readQ;
$("confirm").onclick=confirmA;
$("pause").onclick=()=>{
  if(!S.on)return;S.paused=!S.paused;speechSynthesis.cancel();if(S.paused)stopRec();
  $("pause").textContent=S.paused?"Resume":"Pause";document.body.classList.toggle("paused",S.paused);speak(S.paused?tr().pause:tr().resume);
};
function endExam(){
  if(!S.on){toast("Start an exam before ending it.");return}
  if(confirm("End the exam now? Unanswered questions stay blank."))finish();
}
$("end").onclick=endExam;
$("retake").onclick=()=>begin(S.mode,S.qs);
$("newExam").onclick=()=>{S.on=false;S.qs=[];$("qList").replaceChildren();show("modeSelection")};
function csvOut(rows,name){
  const q=v=>`"${String(v).replace(/"/g,'""')}"`,a=document.createElement("a");
  a.href=URL.createObjectURL(new Blob(["\ufeff"+rows.map(r=>r.map(q).join(",")).join("\n")],{type:"text/csv"}));
  a.download=(name.trim().replace(/[\\/:*?"<>|]+/g,"-")||"exam-results")+".csv";a.click();
}
function csvRows(a){
  const g0=a.g||{},c=calc(a),rows=[["Student Name","Examination Name","Question Number","Question Type","Question","Student Answer","Correct Answer","Maximum Points","Earned Points","Grading Status","Teacher Comment"]];
  a.qs.forEach((q,i)=>{
    const t=qt(q),p=qp(q),g=g0[i]||{},ans=a.ans[i]||"";let earn="",st="";
    if(t==="essay"){earn=g.pts==null||g.pts===""?"":g.pts;st=earn===""?"Pending":"Graded"}
    else if(q.c){earn=ans===q.c?p:0;st="Auto-graded"}else st="No answer key";
    rows.push([a.who||"",a.exam,i+1,TL[t],q.q||"Braille question "+(i+1),t==="tf"?tfL(ans):ans,t==="essay"?"":t==="tf"?tfL(q.c):(q.c||""),p,earn,st,g.cm||""]);
  });
  rows.push(["Total score",a.exam,"","","","","",c.max,c.s,c.pend?"Essay grading pending":"Final",a.note||""]);
  return rows;
}
$("csv").onclick=()=>csvOut(csvRows(atts().find(a=>a.id===S.aid)||{qs:S.qs,ans:S.ans,exam:S.name,who:""}),$("fileName").value);
$("toReview").onclick=()=>openReview(S.aid);
addEventListener("keydown",e=>{ // keyboard works as a full fallback for gestures
  if(!S.on)return;
  if(e.key==="Enter"&&(e.ctrlKey||e.metaKey)){confirmA();e.preventDefault();return}
  if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.ctrlKey||e.metaKey||e.altKey)return;
  const k=e.key.toUpperCase(),t=qt(S.qs[S.i]);
  if(t==="tf"&&(k==="T"||k==="F"))pick(k);else if(t==="tf"&&(k==="1"||k==="2"))pick(k==="1"?"T":"F");
  else if(t==="mc"&&/^[A-E]$/.test(k))pick(k);else if(t==="mc"&&/^[1-5]$/.test(k))pick(LET[k-1]);
  else if(k==="M"&&t==="essay")recOn?stopRec(true):startRec();
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
      if(e.mode==="custom"){$("qList").replaceChildren();e.qs.forEach(q=>addQ({t:q.t,q:q.q,o:Array.from({length:5},(_,i)=>(q.o||[])[i]||""),c:q.c,p:q.p,r:q.r}));$("examName").value=e.name;show("customSetup")}
      else{$("bName").value=e.name;$("bCount").value=e.qs.length;$("bKey").value=e.qs.every(q=>q.c)?e.qs.map(q=>q.c).join(""):"";show("brailleSetup")}
    };
    rn.onclick=()=>{const n=prompt("Exam name",e.name);if(n&&n.trim()){const A=exams();A.find(x=>x.id===e.id).name=n.trim();setExams(A);renderLib()}};
    del.onclick=()=>{if(confirm(`Delete “${e.name}”? Past results are kept.`)){setExams(exams().filter(x=>x.id!==e.id));renderLib()}};
    return d;
  }));
}
function renderAtts(){
  const A=atts();
  $("attempts").replaceChildren(...(A.length?A:[null]).map(a=>{
    if(!a)return el("No finished exams yet.");
    const d=el(`<span class="grow"><b></b><small></small></span><span class="chip"></span>`,"row","button");
    d.querySelector("b").textContent=a.exam+(a.who?" - "+a.who:"");
    d.querySelector("small").textContent=new Date(a.date).toLocaleString()+(a.email?", "+a.email:"");
    const c=calc(a);d.querySelector(".chip").textContent=c.pend?"Grade essay":(a.qs.some(q=>q.c)||a.qs.some(q=>qt(q)==="essay"))?`${f(c.s)} / ${f(c.max)}`:"Needs key";
    d.onclick=()=>openReview(a.id);return d;
  }));
}
function openReview(id){
  cur=atts().find(a=>a.id===id);if(!cur)return;cur.g=cur.g||{};
  $("revTitle").textContent=cur.exam+(cur.who?" - "+cur.who:"");$("revNote").value=cur.note||"";drawRev();show("review");
}
function sumRev(){
  const c=calc(cur),keyed=cur.qs.some(q=>q.c||qt(q)==="essay");
  $("revSum").textContent=`${new Date(cur.date).toLocaleString()}, ${cur.email?cur.email+", ":""}${Math.floor(cur.dur/60)}m ${cur.dur%60}s. `+(c.pend?`Essay grading pending. Auto-graded so far: ${f(c.s)} of ${f(c.am)} points.`:keyed?`Final score: ${f(c.s)} of ${f(c.max)} points.`:"No answer key yet. Pick the correct answers below to score it.");
}
function persist(){const A=atts(),k=A.findIndex(a=>a.id===cur.id);if(k>=0){A[k]=cur;setAtts(A)}}
function drawRev(){
  sumRev();
  $("revList").replaceChildren(...cur.qs.map((q,i)=>{
    const t=qt(q),p=qp(q),a=cur.ans[i]||"";
    if(t==="essay"){
      const g=cur.g[i]||{},d=el(`<div class="grow"><b></b><small></small><div class="essay-ans"></div></div><label>Points (max ${f(p)})<input type="number" min="0" max="${p}" step="0.5" aria-label="Points for question ${i+1}"></label><label class="cmt">Comment<input aria-label="Comment for question ${i+1}"></label>`,"row essay-row");
      d.querySelector("b").textContent=`${i+1}. ${q.q}`;
      d.querySelector("small").textContent=`Essay, max ${f(p)} points`+(q.r?`. Rubric: ${q.r}`:"");
      d.querySelector(".essay-ans").textContent=a||"(No answer)";
      const [pi,ci]=d.querySelectorAll("input");pi.value=g.pts??"";ci.value=g.cm||"";
      pi.oninput=()=>{const v=pi.value;cur.g[i]={...(cur.g[i]||{}),pts:v===""?null:Math.max(0,Math.min(+v,p))};persist();sumRev()};
      pi.onchange=()=>{if(pi.value!=="")pi.value=Math.max(0,Math.min(+pi.value,p))};
      ci.oninput=()=>{cur.g[i]={...(cur.g[i]||{}),cm:ci.value};persist()};
      return d;
    }
    const d=el(`<span class="grow"><b></b><small></small></span><span>Answer <b class="ans"></b></span><label>Key <select></select></label><span class="pts"></span>`,"row "+(!q.c?"":a===q.c?"good":"miss"));
    d.querySelector("b").textContent=`${i+1}. ${q.q||"Braille question "+(i+1)}`;
    d.querySelector("small").textContent=`${TL[t]}, ${f(p)} pts`+((q.o||[]).length?". "+q.o.map((o,k)=>`${LET[k]}) ${o}`).join("   "):"");
    d.querySelector(".ans").textContent=(t==="tf"?tfL(a):a)||"—";
    d.querySelector(".pts").textContent=q.c?`${a===q.c?f(p):0} / ${f(p)} pts`:`- / ${f(p)} pts`;
    const s=d.querySelector("select");
    s.innerHTML=(t==="tf"?[["","?"],["T","True"],["F","False"]]:[["","?"],...[...LET].map(l=>[l,l])]).map(([v,x])=>`<option value="${v}">${x}</option>`).join("");
    s.value=q.c||"";s.setAttribute("aria-label","Correct answer for question "+(i+1));
    s.onchange=()=>{q.c=s.value;persist();drawRev()};return d;
  }));
}
$("revSave").onclick=()=>{cur.note=$("revNote").value;persist();toast("Review saved.")};
$("revDel").onclick=()=>{if(confirm("Delete this result?")){setAtts(atts().filter(a=>a.id!==cur.id));show("teacher")}};
$("revCsv").onclick=()=>{cur.note=$("revNote").value;persist();csvOut(csvRows(cur),cur.exam+(cur.who?" - "+cur.who:""))};

// ---------- Google sign-in (identifies the person; see note about security) ----------
let user=store.get("ae-user",null);
const configured=()=>CFG.GOOGLE_CLIENT_ID&&!/^PASTE/.test(CFG.GOOGLE_CLIENT_ID);
const isTeacher=()=>!CFG.TEACHERS.length||(!!user&&CFG.TEACHERS.map(x=>x.toLowerCase()).includes(user.email));
const jwt=t=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))));
function authUI(){
  $("userBox").textContent=user?user.name:"";$("userBox").classList.toggle("hidden",!user);
  $("outBtn").classList.toggle("hidden",!user);
  $("teacherBtn").classList.toggle("hidden",!isTeacher());$("toReview").classList.toggle("hidden",!isTeacher());
  if(user){pref.who=user.name;$("who").value=user.name}
}
function onCred(r){
  let p;try{p=jwt(r.credential)}catch{return toast("Sign-in failed. Please try again.")}
  if(!p.email_verified)return toast("That Google email isn’t verified.");
  user={name:p.name||p.email,email:p.email.toLowerCase()};store.set("ae-user",user);authUI();show("modeSelection");
}
function initGoogle(){
  if(!configured())return;
  if(!(window.google&&google.accounts)){$("loginMsg").textContent="Google sign-in couldn’t load. Check your internet connection.";return}
  google.accounts.id.initialize({client_id:CFG.GOOGLE_CLIENT_ID,callback:onCred});
  google.accounts.id.renderButton($("gbtn"),{theme:"outline",size:"large",shape:"pill",text:"signin_with"});
}
$("guestBtn").classList.toggle("hidden",!CFG.ALLOW_GUEST);
$("guestBtn").onclick=()=>show("modeSelection");
$("outBtn").onclick=()=>{try{google.accounts.id.disableAutoSelect()}catch{}user=null;store.set("ae-user",null);authUI();show(configured()?"login":"modeSelection")};
addEventListener("load",initGoogle);

// ---------- voice-to-text essay (Web Speech API) ----------
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec=null,recOn=false,recWant=false,committed="",fallbackLang=null;
function recMsg(m,err){$("recStatus").textContent=m;$("recStatus").classList.toggle("err",!!err)}
function recUI(){
  $("recStart").disabled=recOn;$("recStop").disabled=!recOn;$("essayQ").classList.toggle("listening",recOn);
  const micOn=!!recOn;$("micToggle").textContent=micOn?"Mic off":"Mic on";$("micToggle").setAttribute("aria-pressed",String(micOn));
  if(!($("recStatus").classList.contains("err")&&!recOn))recMsg(recOn?"Listening… speak now":SR?"Microphone off":"Voice typing isn’t supported in this browser. You can type your answer.",!SR);
}
function toggleMic(){
  if(!S.on||S.paused){toast("Start the exam before using the microphone.");return}
  if(recOn)stopRec(true);else startRec();
}
function startRec(){
  if(!S.on||S.paused||recOn)return;
  if(!SR){recUI();toast("This browser doesn’t support speech recognition. Please type your answer.");return}
  speechSynthesis.cancel();committed=$("essayBox").value.trim();recWant=true;fallbackLang=null;recMsg("Starting microphone…");runRec();
}
function runRec(){
  const me=rec=new SR();me.continuous=true;me.interimResults=true;me.lang=fallbackLang||vlang();
  me.onstart=()=>{recOn=true;recUI();beep(520,.08)};
  me.onresult=e=>{
    if(rec!==me)return;let interim="";
    for(let k=e.resultIndex;k<e.results.length;k++){ // finals are appended once; interim text is replaced on every event
      const r=e.results[k],tx=r[0].transcript.trim();
      if(r.isFinal)committed=(committed+" "+tx).trim();else interim+=(interim?" ":"")+tx;
    }
    const b=$("essayBox");b.value=(committed+(interim?" "+interim:"")).trim();b.scrollTop=b.scrollHeight;
  };
  me.onerror=e=>{
    if(rec!==me||e.error==="no-speech"||e.error==="aborted")return;
    if(e.error==="language-not-supported"){fallbackLang="en-US";toast("This voice language isn’t available here. Using English.");return}
    recWant=false;
    const m=e.error==="not-allowed"||e.error==="service-not-allowed"?"Microphone access was blocked. Allow the microphone in your browser settings, or type your answer."
      :e.error==="audio-capture"?"No microphone was found. Connect one, or type your answer."
      :e.error==="network"?"The speech service is unavailable. Check your internet connection, or type your answer."
      :"Voice typing stopped ("+e.error+"). You can type your answer.";
    recMsg(m,true);toast(m);
  };
  me.onend=()=>{
    if(rec!==me)return;recOn=false;
    if(recWant&&S.on&&!S.paused)setTimeout(()=>{if(recWant&&!recOn)runRec()},300); // browsers stop after silence, so restart and keep the text
    else{recWant=false;recUI()}
  };
  try{me.start()}catch{recWant=false;recUI()}
}
function stopRec(soft){ // soft: let the last words arrive; otherwise drop the session
  recWant=false;if(rec){try{rec.stop()}catch{}if(!soft)rec=null}recOn=false;recUI();
}
$("recStart").onclick=startRec;
$("recStop").onclick=()=>stopRec(true);
$("micToggle").onclick=toggleMic;
$("recClear").onclick=()=>{committed="";$("essayBox").value="";$("essayBox").focus()};
$("essayBox").addEventListener("input",()=>{if(recOn)stopRec(true)}); // typing by hand ends the voice session

// ---------- hand gestures ----------
function countFingers(l){
  let c=0;[[8,6],[12,10],[16,14],[20,18]].forEach(([t,p])=>{if(l[t].y<l[p].y)c++});
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  if(d(l[4],l[5])>d(l[3],l[5])*1.15)c++;
  return c;
}
function gesture(c){ // 5 of the last 7 frames must agree, then a 1s hold. Meaning of the fingers depends on the question type
  if(!S.on||S.paused||S.done)return;
  const t=qt(S.qs[S.i]);if(t==="essay"){restore();return}
  hist.push(c);if(hist.length>7)hist.shift();
  const L=t==="tf"?(c===1?"T":c===2?"F":null):LET[c-1];
  const a=L&&hist.filter(v=>v===c).length>=5?L:null;
  if(!a||a===S.sel){holdFor=null;return restore()}
  if(holdFor!==a){holdFor=a;holdStart=Date.now()}
  const p=Math.min((Date.now()-holdStart)/HOLD,1);
  setStage(a,`Hold steady for ${lab(a)}…`,p);
  if(p>=1){holdFor=null;pick(a);if(S.sel!==a)restore()}
}
function thumbsUp(l){ // thumb up and extended, other four fingers curled, hand upright
  const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),tip=l[4];
  const folded=[[8,6],[12,10],[16,14],[20,18]].every(([t,p])=>l[t].y>l[p].y);
  const up=tip.y<l[3].y&&l[3].y<l[2].y;
  const above=[8,12,16,20].every(i=>tip.y<l[i].y-.04);
  const vertical=Math.abs(tip.y-l[2].y)>Math.abs(tip.x-l[2].x)*1.3;
  return folded&&up&&above&&vertical&&l[0].y>tip.y+.08&&d(tip,l[0])>d(l[5],l[0]);
}
function thumb(on,noHand){ // stable for 5 of 7 frames, held 0.7s, must be released after each confirm
  if(!S.on||S.paused||S.done)return;
  tbuf.push(on);if(tbuf.length>7)tbuf.shift();
  const n=tbuf.filter(Boolean).length;
  if(!on&&(noHand||n<2)&&Date.now()-lastConf>1500)thArmed=true;
  if(!(on&&n>=5&&thArmed)){thStart=0;$("nodMeter").style.setProperty("--v",0);return}
  if(!thStart)thStart=Date.now();
  const p=Math.min((Date.now()-thStart)/THUMB_HOLD,1);
  $("nodMeter").style.setProperty("--v",p);$("nodStatus").textContent="Hold thumbs-up…";
  if(p>=1){thStart=0;confirmA()}
}

// ---------- head nod + camera (MediaPipe) ----------
let camera=null,camOn=false;
const cv=$("canvas"),ctx=cv.getContext("2d"),vid=$("camera");
const setCam=(t,err)=>{$("camState").textContent=t;$("camState").classList.toggle("err",!!err)};
if(window.Hands&&window.Camera){
  const hands=new Hands({locateFile:f=>"https://cdn.jsdelivr.net/npm/@mediapipe/hands/"+f});
  hands.setOptions({maxNumHands:1,modelComplexity:1,minDetectionConfidence:.6,minTrackingConfidence:.6});
  hands.onResults(r=>{
    if(vid.videoWidth){cv.width=vid.videoWidth;cv.height=vid.videoHeight}
    ctx.clearRect(0,0,cv.width,cv.height);
    const l=r.multiHandLandmarks&&r.multiHandLandmarks[0];
    if(!l){$("fingerStatus").textContent="No hand";hist.length=0;holdFor=null;thumb(false,true);if(S.on)restore();return}
    drawConnectors(ctx,l,HAND_CONNECTIONS,{color:"#7c8aff",lineWidth:4});drawLandmarks(ctx,l,{color:"#fff",radius:3});
    if(thumbsUp(l)){$("fingerStatus").textContent="Thumbs-up";hist.length=0;holdFor=null;thumb(true);return}
    thumb(false);
    const c=countFingers(l);$("fingerStatus").textContent=c+(c===1?" finger":" fingers");gesture(c);
  });
  camera=new Camera(vid,{width:640,height:480,onFrame:async()=>{
    if(!S.on||!camOn)return;
    try{await hands.send({image:vid})}catch(e){console.error(e)}
  }});
}
async function startCamera(){
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setCam("Camera blocked",true);toast("This browser does not allow camera access.");return}
  if(!camera){
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"user"},audio:false});
      vid.srcObject=stream;await vid.play();camOn=true;setCam("Camera on");$("cameraToggle").textContent="Camera off";$("cameraToggle").setAttribute("aria-pressed","true");
      return;
    }catch(e){
      console.error(e);setCam("Camera error",true);$("cameraToggle").textContent="Camera on";$("cameraToggle").setAttribute("aria-pressed","false");$("fingerStatus").textContent="Camera unavailable";speak(tr().cam);toast("Camera unavailable. Use A–E and Enter to answer.");return;
    }
  }
  try{setCam("Starting…");camOn=true;$("cameraToggle").textContent="Camera off";$("cameraToggle").setAttribute("aria-pressed","true");await camera.start();setCam("Camera on")}
  catch(e){console.error(e);camOn=false;setCam("Camera error",true);$("cameraToggle").textContent="Camera on";$("cameraToggle").setAttribute("aria-pressed","false");$("fingerStatus").textContent="Camera unavailable";speak(tr().cam);toast("Camera unavailable. Use A–E and Enter to answer.")}
}
function stopCamera(){
  camOn=false;setCam("Off");$("cameraToggle").textContent="Camera on";$("cameraToggle").setAttribute("aria-pressed","false");
  if(vid.srcObject){vid.srcObject.getTracks().forEach(t=>t.stop());vid.srcObject=null}
  if(camera&&typeof camera.stop==="function")try{camera.stop()}catch{};
}
$("cameraToggle").onclick=()=>{if(camOn)stopCamera();else startCamera();};

paint();authUI();show(!configured()||user?"modeSelection":"login");

// ---------- install as an app ----------
let installEv=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();installEv=e;$("installBtn").classList.remove("hidden")});
$("installBtn").onclick=async()=>{if(!installEv)return;installEv.prompt();await installEv.userChoice;installEv=null;$("installBtn").classList.add("hidden")};
addEventListener("appinstalled",()=>{$("installBtn").classList.add("hidden");toast("App installed.")});
if("serviceWorker" in navigator&&location.protocol!=="file:")addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(console.error));
