/* ЯРИЙ — помічник конспектів · 158 НЦ */
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS = {
  get(k, d){ try{ const v = localStorage.getItem('yaryi.'+k); return v==null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('yaryi.'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('yaryi.'+k); }catch(e){} }
};
function toast(msg, ms=2600){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('show'), ms); }

/* ================= STATE ================= */
const S = {
    mode: LS.get('mode','basic'),
  key: LS.get('key',''),
  files: [],          // {name, kind, slides:[{title, lines:[]}]}
  ai: false
};
const PH = t => `[${t}]`;

/* ================= LESSON SELECTS (+ свій варіант) ================= */
const selMod=$('#selMod'), selSubj=$('#selSubj'), selTheme=$('#selTheme'), selLesson=$('#selLesson');
const C='c';
const CUSTOM_OPT='<option value="c">✎ Свій варіант…</option>';
const isC = sel => sel.value===C;
function fill(sel, arr, label){ sel.innerHTML = arr.map((x,i)=>`<option value="${i}">${esc(label(x,i))}</option>`).join('') + CUSTOM_OPT; if(!arr.length) sel.value=C; }
function curMod(){ return isC(selMod)?null:PROGRAM[+selMod.value]; }
function curSubj(){ const m=curMod(); return (!m||isC(selSubj))?null:m.subjects[+selSubj.value]; }
function curTheme(){ const s=curSubj(); return (!s||isC(selTheme))?null:s.themes[+selTheme.value]; }
function curLesson(){ const t=curTheme(); return (!t||isC(selLesson)||!t.lessons.length)?null:t.lessons[+selLesson.value]; }
function syncCustom(){
  $('#cMod').hidden=!isC(selMod); $('#cSubj').hidden=!isC(selSubj); $('#cTheme').hidden=!isC(selTheme); $('#cLesson').hidden=!isC(selLesson);
  $('#cExtra').hidden=!isC(selLesson);
}
function initSelects(){
  fill(selMod, PROGRAM, m=>m.name);
  selMod.onchange=()=>{ const m=curMod(); fill(selSubj, m?m.subjects:[], s=>s.name); selSubj.onchange(); };
  selSubj.onchange=()=>{ const s=curSubj(); fill(selTheme, s?s.themes:[], t=>'Тема '+t.name); selTheme.onchange(); };
  selTheme.onchange=()=>{ const t=curTheme(); fill(selLesson, t?t.lessons:[], l=>'Заняття '+l.name+' · '+l.h+' год'); selLesson.onchange(); };
  selLesson.onchange=()=>{ syncCustom(); renderLessonCard(); updateMag(); saveSel(); };
  const sv=LS.get('sel2',null);
  selMod.onchange();
  if(sv){ try{
    const set=(sel,v)=>{ if([...sel.options].some(o=>o.value===v)) sel.value=v; };
    set(selMod,sv.v[0]); selMod.onchange(); set(selSubj,sv.v[1]); selSubj.onchange(); set(selTheme,sv.v[2]); selTheme.onchange(); set(selLesson,sv.v[3]); selLesson.onchange();
    Object.entries(sv.t||{}).forEach(([k,v])=>{ const el=$('#'+k); if(el) el.value=v; });
  }catch(e){} }
  ['cMod','cSubj','cTheme','cLesson','cHours','cMethod','cPlace','cQ'].forEach(id=>$('#'+id).addEventListener('input',()=>{ updateMag(); saveSel(); }));
}
function saveSel(){
  const t={}; ['cMod','cSubj','cTheme','cLesson','cHours','cMethod','cPlace','cQ'].forEach(id=>t[id]=$('#'+id).value);
  LS.set('sel2',{v:[selMod.value,selSubj.value,selTheme.value,selLesson.value],t});
}
function renderLessonCard(){
  const l=curLesson(), c=$('#lessonCard');
  if(isC(selLesson)){ c.hidden=true; return; }
  c.hidden=false;
  if(!l){ c.innerHTML='Оберіть заняття або «✎ Свій варіант».'; return; }
  c.innerHTML=`<div class="chips"><span class="chip">${l.h} год</span><span class="chip">${esc(l.method)}</span>${l.place&&l.place!=='—'?`<span class="chip">${esc(l.place)}</span>`:''}</div>
  <b>Навчальні питання за програмою:</b><ul>${l.q.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`;
}
$('#notes').addEventListener('input',updateMag);

/* ================= REQUISITES ================= */
const REQ = LS.get('req',{hourMin:'45',fileTag:'КВ'});
$$('[data-req]').forEach(el=>{
  if(REQ[el.dataset.req]!=null) el.value=REQ[el.dataset.req];
  el.addEventListener('input',()=>{ REQ[el.dataset.req]=el.value; LS.set('req',REQ); updateMag(); });
});
if(!REQ.apPos && !REQ.apName) $('#reqBox').open=true;

/* ================= MODE SELECTOR ================= */
function setMode(m, silent){
  if(m==='ai' && !S.key){ openKey(); return; }
  S.mode=m; LS.set('mode',m);
  $('#selector').dataset.mode=m;
  $$('.sel-opt').forEach(b=>b.setAttribute('aria-checked', b.dataset.mode===m));
  $('#selPct').textContent = m==='ai' ? '100%' : '80%';
  $('#fireSub').textContent = m==='ai' ? 'режим Gemini · повний зміст' : 'базовий режим · шаблон + програма';
  $('#exAi').hidden = !(m==='ai' && $('#sheet'));
  updateMag();
  if(!silent) toast(m==='ai' ? 'Режим АВ: Gemini підключено — 100%' : 'Режим ОД: базовий, без ШІ — 80%');
}
$$('.sel-opt').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
function updateLed(){
  const l=$('#ledKey');
  l.classList.toggle('on',!!S.key); l.classList.toggle('off',!S.key);
  l.querySelector('span').textContent = S.key ? 'GEMINI: ПІДКЛЮЧЕНО' : 'GEMINI: НЕ ПІДКЛЮЧЕНО';
}
$('#ledKey').onclick=openKey;

/* ================= MODALS ================= */
function openModal(id){ $(id).classList.add('open'); const f=$(id).querySelector('input,button.close'); f&&setTimeout(()=>f.focus(),50); }
function closeModals(){ $$('.modal').forEach(m=>m.classList.remove('open')); }
$$('[data-close]').forEach(b=>b.onclick=closeModals);
$$('.modal').forEach(m=>m.addEventListener('click',e=>{ if(e.target===m) closeModals(); }));
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeModals(); });
$('#btnInfo').onclick=()=>openModal('#mInfo');
function openKey(){
  $('#keyInp').value=S.key||''; $('#keyMsg').textContent=''; $('#keyMsg').className='msg';
  $('#st3').classList.toggle('done',!!S.key);
  openModal('#mKey');
}
$('#openStudio').addEventListener('click',()=>{ $('#st1').classList.add('done'); setTimeout(()=>$('#st2').classList.add('done'),1500); });
$('#pasteKey').onclick=async()=>{
  try{ const t=(await navigator.clipboard.readText()).trim(); if(t){ $('#keyInp').value=t; $('#st2').classList.add('done'); } else toast('Буфер обміну порожній'); }
  catch(e){ toast('Браузер не дав доступ до буфера — вставте ключ вручну (довге натискання → Вставити)'); $('#keyInp').focus(); }
};
$('#saveKey').onclick=async()=>{
  const k=$('#keyInp').value.trim().replace(/\s+/g,''), m=$('#keyMsg');
  if(!/^AIza[0-9A-Za-z_\-]{20,}$/.test(k)){ m.className='msg err'; m.textContent='Це не схоже на ключ Gemini. Він починається з «AIza…». Скопіюйте його повністю.'; return; }
  m.className='msg'; m.textContent='Перевіряю ключ…';
  try{
    const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=50',{headers:{'x-goog-api-key':k}});
    if(!r.ok){ const j=await r.json().catch(()=>({})); throw new Error(j?.error?.message||('HTTP '+r.status)); }
    const j=await r.json(); LS.set('models',(j.models||[]).map(x=>x.name.replace('models/','')));
    S.key=k; LS.set('key',k); updateLed(); $('#st3').classList.add('done');
    m.className='msg ok'; m.textContent='✓ Готово! Gemini підключено. Режим перемкнено на 100%.';
    setTimeout(()=>{ closeModals(); setMode('ai'); },900);
  }catch(e){ m.className='msg err'; m.textContent='Ключ не прийнято: '+e.message+'. Перевірте, що скопіювали його повністю, і що є інтернет.'; }
};
$('#delKey').onclick=e=>{ e.preventDefault(); S.key=''; LS.del('key'); updateLed(); setMode('basic',true); closeModals(); toast('Ключ видалено. Режим — базовий (80%).'); };

/* ================= READINESS MAGAZINE ================= */
function updateMag(){
  let n=0;
  const lessonOk = curLesson() || (isC(selLesson) && $('#cLesson').value.trim()) ? 1 : 0;
  const themeOk = curTheme() || $('#cTheme').value.trim() ? 1 : 0;
  n += themeOk + lessonOk*2;
  if(S.files.length) n+=2; else if($('#notes').value.trim().length>40) n+=1;
  ['apPos','apName','unit','leader'].forEach(k=>{ if((REQ[k]||'').trim()) n++; });
  if(S.mode==='ai') n++;
  n=Math.min(10,n);
  $('#mag').innerHTML=Array.from({length:10},(_,i)=>`<div class="round${i<n?' full':''}"></div>`).join('');
  $('#magLabel').textContent=`ГОТОВНІСТЬ ${n}/10`;
}

/* ================= FILE IMPORT ================= */
const drop=$('#drop'), fileInp=$('#file');
drop.onclick=()=>fileInp.click();
drop.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); fileInp.click(); } };
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop',e=>handleFiles(e.dataTransfer.files));
fileInp.onchange=()=>{ handleFiles(fileInp.files); fileInp.value=''; };
const clean = s => String(s||'').replace(/\s+/g,' ').trim();
function xml(str){ return new DOMParser().parseFromString(str,'application/xml'); }
const byTag=(el,t)=>[...el.getElementsByTagNameNS('*',t)];
async function parsePptx(file){
  const zip=await JSZip.loadAsync(file);
  let names; try{ names=(await TPL.slideList(zip)).map(s=>s.path).filter(n=>zip.file(n)); }catch(e){ names=null; }
  if(!names||!names.length) names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/\d+/)[0]-+b.match(/\d+/)[0]);
  const slides=[];
  for(const n of names){
    const doc=xml(await zip.file(n).async('string'));
    let title=''; const lines=[];
    for(const sp of byTag(doc,'sp')){
      const ph=byTag(sp,'ph')[0], type=ph?ph.getAttribute('type'):'';
      if(['sldNum','dt','ftr'].includes(type)) continue;
      const paras=byTag(sp,'p').map(p=>clean(byTag(p,'t').map(t=>t.textContent).join(''))).filter(Boolean);
      if(!paras.length) continue;
      if(!title && (type==='title'||type==='ctrTitle')) title=paras.join(' ');
      else lines.push(...paras);
    }
    // tables
    for(const tc of byTag(doc,'tc')){ const t=clean(byTag(tc,'t').map(x=>x.textContent).join(' ')); if(t && !lines.includes(t)) lines.push(t); }
    // notes
    const rel=zip.file(n.replace('slides/','slides/_rels/')+'.rels');
    if(rel){
      const m=(await rel.async('string')).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      if(m && zip.file('ppt/notesSlides/'+m[1])){
        const nd=xml(await zip.file('ppt/notesSlides/'+m[1]).async('string'));
        for(const sp of byTag(nd,'sp')){ const ph=byTag(sp,'ph')[0]; const ty=ph?ph.getAttribute('type'):''; if(ty!=='body') continue;
          byTag(sp,'p').forEach(p=>{ const t=clean(byTag(p,'t').map(x=>x.textContent).join('')); if(t) lines.push('Примітка: '+t); }); }
      }
    }
    const keep=lines.filter(l=>!/^Відкрита інформація$/i.test(l));
    if(!title && keep.length) title=keep.shift();
    if(/^(ПРАВИЛА ПОВОДЖЕННЯ|ПОРЯДОК ПРОВЕДЕННЯ|КІНЕЦЬ ЗАНЯТТЯ|158 НАВЧАЛЬНИЙ ЦЕНТР)/i.test(title||'')) continue;
    if(title||keep.length) slides.push({title,lines:keep});
  }
  return slides;
}
async function parseDocx(file){
  const zip=await JSZip.loadAsync(file); const doc=xml(await zip.file('word/document.xml').async('string'));
  const slides=[]; let cur=null;
  for(const p of byTag(doc,'p')){
    const t=clean(byTag(p,'t').map(x=>x.textContent).join('')); if(!t) continue;
    const st=byTag(p,'pStyle')[0]?.getAttribute('w:val')||'';
    const bold=byTag(p,'b').length>0 && t.length<120;
    if(/heading|заголов|Title/i.test(st) || (bold && t.length<100) || !cur){ cur={title:t,lines:[]}; slides.push(cur); }
    else cur.lines.push(t);
  }
  return slides;
}
async function parsePdf(file){
  let lib;
  try{ lib=await import('./lib/pdf.min.mjs'); }catch(e){ throw new Error('PDF не відкривається в офлайн-режимі з диска. Відкрийте додаток за посиланням або збережіть презентацію як PPTX.'); }
  lib.GlobalWorkerOptions.workerSrc='lib/pdf.worker.min.mjs';
  const pdf=await lib.getDocument({data:await file.arrayBuffer()}).promise; const slides=[];
  for(let i=1;i<=pdf.numPages;i++){
    const tc=await (await pdf.getPage(i)).getTextContent(); let line='', lines=[];
    for(const it of tc.items){ line+=it.str; if(it.hasEOL){ if(clean(line)) lines.push(clean(line)); line=''; } else line+=' '; }
    if(clean(line)) lines.push(clean(line));
    if(lines.length) slides.push({title:lines.shift(),lines});
  }
  return slides;
}
async function parseTxt(file){
  const t=await file.text();
  return t.split(/\n\s*\n/).map(b=>b.split('\n').map(clean).filter(Boolean)).filter(b=>b.length).map(b=>({title:b[0],lines:b.slice(1)}));
}
async function handleFiles(list){
  for(const f of list){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    try{
      toast('Заряджаю: '+f.name+'…');
      const slides = ext==='pptx'?await parsePptx(f): ext==='docx'?await parseDocx(f): ext==='pdf'?await parsePdf(f): await parseTxt(f);
      let ready=null;
      try{ if(ext==='docx') ready=await TPL.parseKonspekt(f); else if(ext==='pptx') ready=await TPL.parsePresentation(f); }catch(e){ ready=null; }
      if(!slides.length && !ready) throw new Error('у файлі не знайдено тексту');
      S.files.push({name:f.name,kind:ext,slides,ready});
      if(ready) toast(ext==='docx'?'✓ Розпізнано готовий конспект — можна одразу зробити з нього презентацію':'✓ Розпізнано заповнену презентацію — можна скласти з неї конспект',5000);
      toast(`✓ ${f.name}: ${slides.length} ${ext==='pptx'||ext==='pdf'?'слайдів/сторінок':'блоків'}`);
    }catch(e){ toast('⚠ '+f.name+': '+e.message,5000); }
  }
  renderFiles(); updateMag();
}
function renderFiles(){
  $('#files').innerHTML=S.files.map((f,i)=>`<div class="file"><span>▮</span><span>${esc(f.name)} · <span style="color:var(--dim)">${f.slides.length} фрагм.</span></span><button class="x" data-i="${i}" aria-label="Прибрати">×</button></div>${f.ready?`<button class="btn olive sm ready-btn" data-open="${i}">▶ ${f.kind==='docx'?'Відкрити як готовий конспект':'Скласти конспект з цієї презентації'}</button>`:''}`).join('');
  $$('#files .x').forEach(b=>b.onclick=()=>{ S.files.splice(+b.dataset.i,1); renderFiles(); updateMag(); });
  $$('#files [data-open]').forEach(b=>b.onclick=()=>{ const f=S.files[+b.dataset.open]; openParsed(f.ready, f.kind==='docx'?'Конспект відкрито з файлу «'+f.name+'»':'Конспект складено з презентації «'+f.name+'»'); });
}
function allSegments(){
  const segs=[]; S.files.forEach(f=>f.slides.forEach(s=>segs.push(s)));
  const notes=$('#notes').value.trim();
  if(notes) notes.split(/\n\s*\n/).forEach(b=>{ const L=b.split('\n').map(clean).filter(Boolean); if(L.length) segs.push({title:L[0],lines:L.slice(1)}); });
  return segs;
}
function materialsText(limit=60000){
  let out=''; S.files.forEach(f=>{ out+=`\n=== ${f.name} ===\n`; f.slides.forEach((s,i)=>{ out+=`[${i+1}] ${s.title}\n${s.lines.map(l=>'  '+l).join('\n')}\n`; }); });
  const n=$('#notes').value.trim(); if(n) out+=`\n=== Нотатки інструктора ===\n${n}\n`;
  return out.slice(0,limit);
}

/* ================= LESSON INFO ================= */
const ABBR={'Лідерство':'ЛІД','Організаційна підготовка':'ОП','Інформаційна безпека':'ІБ','Аналіз проведених дій (АПД / AAR)':'АПД','Методична підготовка':'МП','Психологічна підготовка':'ПСП','Інноваційні технології':'ІТ','Тактична догоспітальна допомога':'ТДД','Інженерна підготовка':'ІНЖ','Підготовка зі зв’язку':'ЗВ','Розвідувальна підготовка':'РП','Військова топографія':'ВТ','Тактична підготовка (вишкіл)':'ТП','Тактична підготовка':'ТП','Вогнева підготовка':'ВП','Фізична підготовка':'ФП'};
const num = s => (String(s).match(/^\s*(\d+)/)||[])[1]||'';
const stripNum = s => String(s).replace(/^\s*\d+\.\s*/,'').trim();
function lessonInfo(){
  const m=curMod(), sj=curSubj(), t=curTheme(), l=curLesson();
  const v=id=>$('#'+id).value.trim();
  const custom=isC(selLesson);
  return {
    module: m?m.name:v('cMod'), subject: sj?sj.name:v('cSubj'), theme: t?t.name:v('cTheme'),
    lesson: l?l.name:(custom?v('cLesson'):''),
    h: l?l.h:Math.max(1,+v('cHours')||1), method: l?l.method:(custom?v('cMethod'):''),
    q: l?l.q.slice():(custom?v('cQ').split('\n').map(x=>clean(x.replace(/^\s*\d+[.)]\s*/,''))).filter(Boolean):[]),
    place: l?l.place:(custom?v('cPlace'):''), fromProgram:!!l, hasLesson:!!(l||v('cLesson'))
  };
}
/* ================= BASIC GENERATOR (no AI) ================= */
const stem = w => w.toLowerCase().replace(/[^а-яіїєґa-z0-9]/g,'').slice(0,5);
const words = s => new Set(String(s).split(/\s+/).map(stem).filter(w=>w.length>=4));
function isTheory(method){ return /теорет|лекц|усне|бесід|пояснен/i.test(method||''); }
function cap(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
function lc1(s){ s=String(s||''); return s.charAt(0).toLowerCase()+s.slice(1); }
function groupQuestions(q){
  if(q.length<=7) return q.map(cap);
  const size=Math.ceil(q.length/5), out=[];
  for(let i=0;i<q.length;i+=size) out.push(q.slice(i,i+size).map((x,j)=>j?lc1(x):cap(x)).join('; '));
  return out;
}
function basicGoal(L){
  const name=stripNum(L.lesson)||stripNum(L.theme)||PH('назва заняття');
  return isTheory(L.method)
    ? `Навчальна: ознайомити курсантів із питаннями заняття «${name}», сформувати у них необхідні теоретичні знання для практичної діяльності командира відділення. Виховна: виховувати відповідальність, дисциплінованість, ініціативність та впевненість у власних діях.`
    : `Навчальна: навчити курсантів практичним діям за темою заняття «${name}», відпрацювати навички до рівня впевненого виконання в умовах, наближених до бойових. Виховна: виховувати рішучість, згуртованість, взаємовиручку та відповідальність за виконання завдання.`;
}
function basicMaterials(L){
  const field=/місцев|смуг|полігон/i.test(L.place) && !/клас/i.test(L.place);
  const parts = field ? ['навчальна ділянка місцевості'] : ['мультимедійний проєктор (телевізор)','ноутбук','презентація до заняття','класна дошка'];
  const S_=L.subject;
  if(/догоспіт/i.test(S_)) parts.push('турнікети','гемостатичні бинти','оклюзійні наліпки','манекени','ноші');
  else if(/Інженер/i.test(S_)) parts.push('навчальні (інертні) міни','щупи','маскувальні комплекти','шанцевий інструмент');
  else if(/Фізич/i.test(S_)) parts.push('тактична смуга перешкод','спорядження','макети зброї','секундомір');
  else if(/Інновац/i.test(S_)) parts.push('навчальні БпЛА / НРК / засоби РЕБ (за наявності)','симулятори');
  else if(/зв’язку/i.test(S_)) parts.push('радіостанції','таблиці позивних');
  else if(/Вогнев/i.test(S_)) parts.push('навчальна зброя','макети боєприпасів','мішені');
  return parts.join(', ')+', '+PH('уточнити за потреби');
}
function basicLiterature(){ return `Програма об’єднаної (суміщеної) підготовки командирів відділень за ВОС-100 (базовий рівень сержантського складу), СТП 7-(01,02,04)242.(62), видання друге, 2026 р.; ${PH('інші керівництва та посібники за програмою')}`; }
const FINAL_TXT = 'Нагадати тему, мету та навчальні питання заняття. Оцінити ступінь досягнення мети, відзначити кращих курсантів, вказати на типові помилки та недоліки. Відповісти на запитання. Дати завдання на самостійну підготовку. Оголосити тему наступного заняття. Перевірити наявність особового складу та навчального майна, нагадати заходи безпеки, навести порядок на місці проведення заняття.';
function distribute(qs, segs){
  // returns contents per question from slides
  const out=qs.map(()=>[]);
  if(!segs.length) return out.map(()=> '');
  const qW=qs.map(words);
  let cur=0;
  segs.forEach((s,idx)=>{
    if(idx===0 && segs.length>2 && /тема|заняття|план|питання/i.test(s.title) && s.lines.length<4) return; // title slide
    const sw=words(s.title+' '+s.lines.slice(0,3).join(' '));
    let best=-1, bs=0;
    qW.forEach((w,i)=>{ let sc=0; sw.forEach(x=>{ if(w.has(x)) sc++; }); if(sc>bs){ bs=sc; best=i; } });
    if(best>=0 && bs>=2) cur=best; else if(best>=0 && bs===1 && best>=cur) cur=best;
    const body=s.lines.filter(l=>l.length>2).slice(0,6).join('; ');
    out[cur].push('– '+s.title.replace(/[.:;]+$/,'')+(body?': '+body:''));
  });
  return out.map(a=>{ let t=a.join('\n'); if(t.length>1400) t=t.slice(0,1400).replace(/\s\S*$/,'')+'…'; return t; });
}
function basicQuestionsFromSlides(segs){
  const usable=segs.filter((s,i)=>!(i===0 && segs.length>2));
  if(!usable.length) return [];
  const n=Math.min(4,usable.length), size=Math.ceil(usable.length/n), qs=[];
  for(let i=0;i<usable.length;i+=size) qs.push(usable[i].title.replace(/[.:;]+$/,''));
  return qs;
}
function timing(h){
  const hm=+(REQ.hourMin||45), total=h*hm, fin=h>1?10:5, intro=2;
  return {total, intro, main:total-intro-fin, fin};
}
function buildBasic(){
  const L=lessonInfo(), segs=allSegments();
  let qs=groupQuestions(L.q);
  if(!qs.length) qs=basicQuestionsFromSlides(segs);
  if(!qs.length) qs=[PH('навчальне питання №1'),PH('навчальне питання №2'),PH('навчальне питання №3')];
  const cont=distribute(qs,segs);
  const tm=timing(L.h);
  return {
    L, tm, ai:false,
    goal: basicGoal(L), materials: basicMaterials(L), literature: basicLiterature(),
    questions: qs.map((q,i)=>({q, c: cont[i] || PH('короткий зміст: тези з презентації або відкритих джерел — заповніть вручну чи підключіть Gemini')})),
    final: (SAMPLE.doc&&SAMPLE.doc.final)||FINAL_TXT
  };
}

/* ================= GEMINI ================= */
const SYS = `Ти — досвідчений методист навчального центру Збройних Сил України. Ти складаєш плани-конспекти занять переважно за Програмою об’єднаної (суміщеної) підготовки командирів відділень за ВОС-100 (СТП 7-(01,02,04)242.(62), 2026), а також за будь-якими іншими темами, які вкаже інструктор.
Правила:
- Пиши українською, чіткою військовою термінологією, без markdown, без зірочок і решіток.
- Навчальні питання бери з програми (формулювання не змінюй; якщо їх більше 6 — об’єднай логічно у 3–5). Якщо питань немає — сформулюй 2–4 питання за темою і матеріалами.
- «Короткий зміст» до кожного питання: 5–9 змістовних тез, кожна з нового рядка і починається з «– ». Основне джерело — надані матеріали (презентація, нотатки). Якщо матеріалів немає — використовуй загальновідомі відкриті знання за темою.
- Не вигадуй номерів наказів, назв документів, прізвищ, цифр, яких немає в матеріалах. Якщо дані невідомі — став заповнювач у квадратних дужках, напр. [уточнити].
- «Керівництва та посібники» — тільки програма підготовки та документи, прямо названі в матеріалах.
- Мета: навчальна і виховна, 2–3 речення.
- Матеріальне забезпечення: конкретний перелік під заняття і місце проведення.
- Заключна частина: підбиття підсумків, перевірка засвоєння, завдання на самопідготовку, заходи безпеки, впорядкування місця заняття.
- Для кожного навчального питання: check_q — одне контрольне запитання курсантам, check_a — коротка правильна відповідь (з тексту «Короткого змісту»).
- evalCond — умови оцінювання (як і коли), evalCrit — критерії оцінок (відмінно/добре/задовільно/незадовільно), selfTask — завдання на самостійну підготовку, finalQ/finalA — підсумкове запитання по заняттю і відповідь.`;
const SCHEMA = {type:'OBJECT',properties:{
  goal:{type:'STRING'}, materials:{type:'STRING'}, literature:{type:'STRING'},
  questions:{type:'ARRAY',items:{type:'OBJECT',properties:{q:{type:'STRING'},c:{type:'STRING'},check_q:{type:'STRING'},check_a:{type:'STRING'}},required:['q','c','check_q','check_a']}},
  final:{type:'STRING'}, evalCond:{type:'STRING'}, evalCrit:{type:'STRING'}, selfTask:{type:'STRING'}, finalQ:{type:'STRING'}, finalA:{type:'STRING'}},
  required:['goal','materials','literature','questions','final','evalCond','evalCrit','selfTask','finalQ','finalA']};
const EXTRA_SCHEMA={type:'OBJECT',properties:{checks:{type:'ARRAY',items:{type:'OBJECT',properties:{q:{type:'STRING'},a:{type:'STRING'}},required:['q','a']}},evalCond:{type:'STRING'},evalCrit:{type:'STRING'},selfTask:{type:'STRING'},finalQ:{type:'STRING'},finalA:{type:'STRING'}},required:['checks','evalCond','evalCrit','selfTask','finalQ','finalA']};
async function aiExtras(d){
  const r=await gemini(`За цим планом-конспектом підготуй дані для слайдів: для кожного навчального питання — одне контрольне запитання і коротку правильну відповідь (з тексту конспекту), умови оцінювання (як і коли), критерії оцінювання (відмінно/добре/задовільно/незадовільно), завдання на самостійну підготовку, підсумкове запитання по всьому заняттю з відповіддю. Стисло, без markdown.\n\nКОНСПЕКТ:\n${docText(d).slice(0,30000)}\n\nВідповідь — тільки JSON.`, EXTRA_SCHEMA);
  const out={...r}; out.checks=(r.checks||[]).map(c=>({q:c.q,a:c.a})); return out;
}
async function gemini(prompt, schema){
  const avail=LS.get('models',[]);
  const pref=['gemini-flash-latest','gemini-2.5-flash','gemini-flash-lite-latest','gemini-2.5-flash-lite'];
  const extra=avail.filter(n=>/^gemini-[\d.]+-flash(-lite)?$/.test(n)).sort().reverse();
  const models=[...new Set([...pref.filter(m=>!avail.length||avail.includes(m)), ...extra, ...pref])];
  let lastErr;
  for(const model of models){
    const ctl=new AbortController(); const to=setTimeout(()=>ctl.abort(),120000);
    try{
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{
        method:'POST', signal:ctl.signal,
        headers:{'Content-Type':'application/json','x-goog-api-key':S.key},
        body:JSON.stringify({ systemInstruction:{parts:[{text:SYS}]}, contents:[{role:'user',parts:[{text:prompt}]}],
          generationConfig:{temperature:0.4, responseMimeType:'application/json', responseSchema:schema} })
      });
      clearTimeout(to);
      const j=await r.json().catch(()=>({}));
      if(!r.ok){ lastErr=new Error(j?.error?.message||('HTTP '+r.status)); if([400,401,403].includes(r.status) && /API key|permission|PERMISSION/i.test(lastErr.message)) throw lastErr; continue; }
      const txt=(j.candidates?.[0]?.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
      if(!txt){ lastErr=new Error('порожня відповідь моделі'); continue; }
      return JSON.parse(txt.replace(/^```json|```$/g,''));
    }catch(e){ clearTimeout(to); lastErr=e.name==='AbortError'?new Error('час очікування вичерпано'):e; if(/API key|PERMISSION/i.test(lastErr.message)) break; }
  }
  throw lastErr||new Error('Gemini недоступний');
}
function lessonPrompt(L, tm, onlyContent, curQs){
  const m=materialsText();
  return `ЗАНЯТТЯ:
Курс/модуль: ${L.module||'—'}
Предмет: ${L.subject||'—'}
Тема: ${L.theme||'—'}
Заняття: ${L.lesson||'— (запропонуй назву заняття в межах теми)'}
Тривалість: ${tm.total} хв (основна частина ${tm.main} хв)
Метод/форма: ${L.method||'—'}
Місце: ${L.place||'—'}
Навчальні питання ${L.fromProgram?'за програмою':'від інструктора'}:
${(curQs||L.q).map((q,i)=>`${i+1}. ${q}`).join('\n')||'— (сформулюй сам)'}

МАТЕРІАЛИ ІНСТРУКТОРА (презентація / нотатки):
${m||'— матеріалів немає, використовуй відкриті знання за темою'}

${SAMPLE.doc&&SAMPLE.doc.text?`ЗРАЗОК КОНСПЕКТУ ІНСТРУКТОРА (повтори його стиль, глибину, обсяг тез і манеру формулювань; зміст бери з теми заняття, а не зі зразка):\n${SAMPLE.doc.text.slice(0,12000)}\n\n`:''}${onlyContent?'Збережи формулювання навчальних питань без змін, перепиши лише «Короткий зміст» (c) — змістовніше і точніше. Інші поля поверни як є або покращ.':'Склади поля плану-конспекту.'} Відповідь — тільки JSON за схемою.`;
}
async function buildAI(){
  const L=lessonInfo(), tm=timing(L.h);
  const r=await gemini(lessonPrompt(L,tm,false), SCHEMA);
  const base=buildBasic();
  return { L, tm, ai:true,
    goal:r.goal||base.goal, materials:r.materials||base.materials, literature:r.literature||base.literature,
    questions:(r.questions||[]).filter(x=>x&&x.q).map(x=>({q:x.q,c:x.c||''})).length ? r.questions.map(x=>({q:x.q,c:x.c||''})) : base.questions,
    final:r.final||base.final,
    extra:{ checks:(r.questions||[]).map(x=>({q:x.check_q||'',a:x.check_a||''})), evalCond:r.evalCond, evalCrit:r.evalCrit, selfTask:r.selfTask, finalQ:r.finalQ, finalA:r.finalA } };
}

/* ================= RENDER SHEET ================= */
const INTRO = [
  ['Підготовка місця проведення заняття.','Особовий склад (курсанти) розміщений правильно. Відволікаючі фактори відсутні, освітлення в аудиторії прийнятне та відповідає вимогам для якісного навчання.'],
  ['Підготовка курсантів.','Перевірено наявність особового складу згідно з журналом бойової підготовки (списком особового складу). Перевірено наявність матеріальних засобів, необхідних для досягнення мети заняття (зошит, блокнот, ручка). Нагадано правила поведінки та заходи безпеки в аудиторії.'],
  ['Перевірка знань попереднього заняття.','Оголошено тему попереднього заняття. Проведено контрольне опитування особового складу за пройденим матеріалом.'],
  ['Доведення теми та мети заняття.','Доведено тему поточного заняття. Оголошено його навчальну та виховну мету.'],
  ['Організація та хід заняття.','Доведено місце, час та метод проведення заняття. Оголошено навчальні питання, а також порядок, умови та критерії оцінювання знань курсантів (як і коли проводитиметься контроль).'],
  ['Порядок проведення заняття.','Визначено порядок дій під час заняття: правила конспектування матеріалу, можливість та порядок постановки запитань і отримання відповідей на них. За потреби здійснено переміщення особового складу в класі.'],
  ['Мотивація особового складу.','Проведено мотивацію курсантів шляхом акцентування уваги на важливості та практичній значущості даної теми. Наведено приклади ситуацій із реального бойового досвіду.']
];
const markPh = v => esc(v).replace(/\[[^\]\n]{1,160}\]/g, m=>`<mark class="phm">${m}</mark>`);
const ce = (k, v, cls='') => `<span contenteditable="true" spellcheck="true" data-k="${k}" class="${cls}">${markPh(v)}</span>`;
function fileName(L){
  const ab=ABBR[L.subject]||(L.subject?L.subject.split(/\s+/).map(w=>w[0]).join('').toUpperCase().slice(0,4):'ПК');
  const tag=(REQ.fileTag||'КВ').trim();
  const t=num(L.theme)||'0', l=num(L.lesson)||'0';
  return [ab,tag,t,l].filter(Boolean).join('_');
}
function renderSheet(D){
  const L=D.L, tm=D.tm;
  const rows=D.questions.map((x,i)=>qRow(x,i)).join('');
  const html=`
<div class="approve">
  <div><b>ЗАТВЕРДЖУЮ</b></div>
  <div>${ce('apPos', REQ.apPos||PH('посада'))}</div>
  <div>${ce('apName', REQ.apName||PH('військове звання, підпис, ініціали та прізвище'))}</div>
  <div>${ce('apDate','«___» ____________ 2026 року')}</div>
</div>
<div class="title">ПЛАН - КОНСПЕКТ</div>
<p class="center">проведення заняття з предмету ${ce('subject', L.subject||PH('назва предмету'))}</p>
<p class="center" style="margin-bottom:14px">з особовим складом ${ce('unit', REQ.unit||PH('підрозділ / навчальна група'))}</p>
<p><span class="lbl">ТЕМА №</span> ${ce('theme', L.theme||PH('номер і назва теми'))}</p>
<p><span class="lbl">ЗАНЯТТЯ №</span> ${ce('lesson', L.lesson||PH('номер і назва заняття'))}</p>
<p><span class="lbl">МЕТА:</span> ${ce('goal', D.goal)}</p>
<p><span class="lbl">ЧАС:</span> ${ce('time', D.timeText || (tm.total+' хв ('+L.h+' '+(L.h===1?'академічна година':'академічні години')+')'))}</p>
<p><span class="lbl">МІСЦЕ:</span> ${ce('place', (L.place&&L.place!=='—')?L.place:PH('навчальний клас / ділянка місцевості'))}</p>
<p><span class="lbl">МЕТОД:</span> ${ce('method', L.method||PH('лекція / показ / тренування / дискусія'))}</p>
<p><span class="lbl">МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ:</span> ${ce('materials', D.materials)}</p>
<p><span class="lbl">КЕРІВНИЦТВО ТА ПОСІБНИКИ:</span> ${ce('literature', D.literature)}</p>
<h4>ХІД ЗАНЯТТЯ</h4>
<h5>І. ВСТУПНА ЧАСТИНА – ${ce('introMin', String(tm.intro))} хв.</h5>
${introList().map((x,i)=>`<p><b>${i+1}. ${ce('introT'+i, x[0])}</b> ${ce('intro'+i, x[1])}</p>`).join('')}
<h5>ІІ. ОСНОВНА ЧАСТИНА – ${ce('mainMin', String(tm.main))} хв.</h5>
<table id="qtable"><thead><tr><th>Навчальні питання</th><th>Короткий зміст</th></tr></thead><tbody>${rows}</tbody></table>
<button class="addrow" id="addRow">+ додати навчальне питання</button>
<h5>ІІІ. ЗАКЛЮЧНА ЧАСТИНА – ${ce('finMin', String(tm.fin))} хв.</h5>
<p>${ce('final', D.final)}</p>
<p style="margin-top:22px"><span class="lbl">КЕРІВНИК ЗАНЯТТЯ:</span> ${ce('leader', REQ.leader||PH('військове звання, підпис, ініціали та прізвище'))}</p>
<div hidden id="xtra" data-json="${esc(JSON.stringify(D.extra||null))}"></div>`;
  $('#docArea').innerHTML=`<div class="paper-wrap"><div class="sheet" id="sheet" data-file="${esc(fileName(L))}" data-ai="${D.ai?1:0}" data-intro="${introList().length}">${html}</div></div>`;
  afterRender();
}
function qRow(x,i){
  return `<tr><td class="q"><span class="qn">Навчальне питання №${i+1}.</span> ${ce('q',x.q)}<div class="rowtools"><button class="tool" data-act="up" title="Вище">↑</button><button class="tool" data-act="down" title="Нижче">↓</button><button class="tool" data-act="del" title="Видалити">✕</button></div></td><td>${ce('c',x.c,'cbox').replace('<span','<div').replace(/<\/span>$/,'</div>')}</td></tr>`;
}
function renumber(){ $$('#qtable tbody tr').forEach((tr,i)=>tr.querySelector('.qn').textContent=`Навчальне питання №${i+1}.`); }
function afterRender(loaded){
  const sheet=$('#sheet');
  $('#empty')?.remove(); $('#docbar').hidden=false; $('#exAi').hidden=S.mode!=='ai'; updateDest();
  $$('#sheet .cbox').forEach(d=>{ d.style.whiteSpace='pre-wrap'; });
  sheet.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(b){ const tr=b.closest('tr');
      if(b.dataset.act==='del'){ if($$('#qtable tbody tr').length>1) tr.remove(); }
      if(b.dataset.act==='up' && tr.previousElementSibling) tr.parentNode.insertBefore(tr,tr.previousElementSibling);
      if(b.dataset.act==='down' && tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling,tr);
      renumber(); saveCurrent(); }
    if(e.target.id==='addRow'){ const tb=$('#qtable tbody'); tb.insertAdjacentHTML('beforeend',qRow({q:PH('формулювання питання'),c:PH('тези')},tb.children.length)); $$('#sheet .cbox').forEach(d=>d.style.whiteSpace='pre-wrap'); saveCurrent(); }
  });
  sheet.addEventListener('input',e=>{ const el=e.target.closest('[data-k]'); if(el) el.querySelectorAll('mark.phm').forEach(m=>{ if(!/^\[[^\]]*\]$/.test(m.textContent)) m.replaceWith(...m.childNodes); }); clearTimeout(saveCurrent._t); saveCurrent._t=setTimeout(saveCurrent,800); });
  sheet.addEventListener('paste',e=>{ if(e.target.closest('[contenteditable]')){ e.preventDefault(); document.execCommand('insertText',false,(e.clipboardData||window.clipboardData).getData('text')); } });
  saveCurrent(!loaded);
}

/* ================= READ DOC FROM SHEET ================= */
function txt(k){ const el=$(`#sheet [data-k="${k}"]`); return el?el.innerText.replace(/ /g,' ').trim():''; }
function readDoc(){
  return {
    apPos:txt('apPos'), apName:txt('apName'), apDate:txt('apDate'), subject:txt('subject'), unit:txt('unit'),
    theme:txt('theme'), lesson:txt('lesson'), goal:txt('goal'), time:txt('time'), place:txt('place'), method:txt('method'),
    materials:txt('materials'), literature:txt('literature'),
    introMin:txt('introMin'), mainMin:txt('mainMin'), finMin:txt('finMin'),
    intro: Array.from({length:+($('#sheet').dataset.intro||INTRO.length)},(_,i)=>[txt('introT'+i)||(INTRO[i]||[''])[0],txt('intro'+i)]),
    questions: $$('#qtable tbody tr').map(tr=>({ q:tr.querySelector('[data-k="q"]').innerText.trim(), c:tr.querySelector('[data-k="c"]').innerText.trim() })),
    final:txt('final'), leader:txt('leader'), file:$('#sheet').dataset.file||'План-конспект'
  };
}
function docText(d){
  const L=[];
  L.push('ЗАТВЕРДЖУЮ',d.apPos,d.apName,d.apDate,'','ПЛАН - КОНСПЕКТ',`проведення заняття з предмету ${d.subject}`,`з особовим складом ${d.unit}`,'');
  L.push(`ТЕМА № ${d.theme}`,`ЗАНЯТТЯ № ${d.lesson}`,`МЕТА: ${d.goal}`,`ЧАС: ${d.time}`,`МІСЦЕ: ${d.place}`,`МЕТОД: ${d.method}`,`МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ: ${d.materials}`,`КЕРІВНИЦТВО ТА ПОСІБНИКИ: ${d.literature}`,'');
  L.push('ХІД ЗАНЯТТЯ','',`І. ВСТУПНА ЧАСТИНА – ${d.introMin} хв.`); d.intro.forEach((x,i)=>L.push(`${i+1}. ${x[0]} ${x[1]}`));
  L.push('',`ІІ. ОСНОВНА ЧАСТИНА – ${d.mainMin} хв.`); d.questions.forEach((x,i)=>{ L.push(`Навчальне питання №${i+1}. ${x.q}`,`Короткий зміст:`,x.c,''); });
  L.push(`ІІІ. ЗАКЛЮЧНА ЧАСТИНА – ${d.finMin} хв.`,d.final,'',`КЕРІВНИК ЗАНЯТТЯ: ${d.leader}`);
  return L.join('\n');
}

/* ================= DOCX EXPORT ================= */
const X = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const DX={font:'Times New Roman',sz:28};
function run(t,{b=false}={}){ const f=X(DX.font); return `<w:r><w:rPr><w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:cs="${f}"/>${b?'<w:b/><w:bCs/>':''}<w:sz w:val="${DX.sz}"/><w:szCs w:val="${DX.sz}"/></w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>`; }
function para(runs,{jc='both',ind=0,first=0,after=0,before=0,keep=false}={}){
  return `<w:p><w:pPr>${keep?'<w:keepNext/>':''}<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>${ind||first?`<w:ind w:left="${ind}" w:firstLine="${first}"/>`:''}<w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
}
function lbl(label,value,opt={}){ return para(run(label+' ',{b:true})+run(value),{first:709,...opt}); }
function cellParas(text,bold){ const lines=String(text).split('\n').filter(l=>l.trim()!==''); return (lines.length?lines:['']).map(l=>para(run(l,{b:bold}),{jc:'left'})).join(''); }
function buildDocxXml(d,sectPr){
  const W=DX.textW||9355, c1=3300, c2=W-c1;
  const border='<w:tblBorders>'+['top','left','bottom','right','insideH','insideV'].map(s=>`<w:${s} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`).join('')+'</w:tblBorders>';
  const cell=(w,inner,head)=>`<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${head?'<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>':''}</w:tcPr>${inner}</w:tc>`;
  const rows=[`<w:tr><w:trPr><w:tblHeader/></w:trPr>${cell(c1,para(run('Навчальні питання',{b:true}),{jc:'center'}),1)}${cell(c2,para(run('Короткий зміст',{b:true}),{jc:'center'}),1)}</w:tr>`]
    .concat(d.questions.map((x,i)=>`<w:tr><w:trPr><w:cantSplit/></w:trPr>${cell(c1,para(run(`Навчальне питання №${i+1}. `,{b:true})+run(x.q,{b:true}),{jc:'left'}))}${cell(c2,cellParas(x.c,false))}</w:tr>`));
  const table=`<w:tbl><w:tblPr><w:tblW w:w="${W}" w:type="dxa"/>${border}<w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="85" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid><w:gridCol w:w="${c1}"/><w:gridCol w:w="${c2}"/></w:tblGrid>${rows.join('')}</w:tbl>`;
  const A=5103;
  const body=[
    para(run('ЗАТВЕРДЖУЮ',{b:true}),{jc:'left',ind:A}),
    para(run(d.apPos),{jc:'left',ind:A}), para(run(d.apName),{jc:'left',ind:A}), para(run(d.apDate),{jc:'left',ind:A,after:240}),
    para(run('ПЛАН - КОНСПЕКТ',{b:true}),{jc:'center',before:120}),
    para(run('проведення заняття з предмету '+d.subject),{jc:'center'}),
    para(run('з особовим складом '+d.unit),{jc:'center',after:240}),
    lbl('ТЕМА №',d.theme), lbl('ЗАНЯТТЯ №',d.lesson), lbl('МЕТА:',d.goal), lbl('ЧАС:',d.time), lbl('МІСЦЕ:',d.place), lbl('МЕТОД:',d.method),
    lbl('МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ:',d.materials), lbl('КЕРІВНИЦТВО ТА ПОСІБНИКИ:',d.literature),
    para(run('ХІД ЗАНЯТТЯ',{b:true}),{jc:'center',before:240,after:120,keep:true}),
    para(run(`І. ВСТУПНА ЧАСТИНА – ${d.introMin} хв.`,{b:true}),{first:709,after:60,keep:true}),
    ...d.intro.map((x,i)=>para(run(`${i+1}. ${x[0]} `,{b:true})+run(x[1]),{first:709})),
    para(run(`ІІ. ОСНОВНА ЧАСТИНА – ${d.mainMin} хв.`,{b:true}),{first:709,before:120,after:60,keep:true}),
    table,
    para(run(`ІІІ. ЗАКЛЮЧНА ЧАСТИНА – ${d.finMin} хв.`,{b:true}),{first:709,before:200,after:60,keep:true}),
    para(run(d.final),{first:709}),
    para(run('КЕРІВНИК ЗАНЯТТЯ: ',{b:true})+run(d.leader),{jc:'left',before:360})
  ].join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w14 w15"><w:body>${body}${sectPr||'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr>'}</w:body></w:document>`;
}
async function exportDocx(){
  const d=readDoc(), blob=await buildDocxBlob(d), sm=SAMPLE.doc;
  download(blob, d.file+'.docx');
  toast(sm&&sm.fillable?'✓ Word збережено у бланку «'+sm.name+'»: '+d.file+'.docx':'✓ Word збережено: '+d.file+'.docx',4000);
}
async function buildDocxBlob(d){
  const sm=SAMPLE.doc;
  if(sm && sm.fillable) return TPL.fillDocx(sm.buf,d);
  if(sm){
    const zip=await JSZip.loadAsync(sm.buf);
    DX.font=sm.font||'Times New Roman'; DX.sz=sm.sz||28; DX.textW=sm.textW||9355;
    zip.file('word/document.xml',buildDocxXml(d,sm.sectPr));
    DX.font='Times New Roman'; DX.sz=28; DX.textW=9355;
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  }
  const zip=new JSZip();
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="uk-UA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X('План-конспект '+d.file)}</dc:title><dc:creator>ЯРИЙ — помічник конспектів</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file('word/document.xml',buildDocxXml(d));
  return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }

/* ================= ACTIONS ================= */
$('#exDocx').onclick=()=>exportDocx().catch(e=>toast('⚠ '+e.message));
$('#exPrint').onclick=()=>{ document.title=readDoc().file; window.print(); setTimeout(()=>document.title='ЯРИЙ — помічник конспектів',1500); };
/* ---------- PDF: справжній файл, одразу завантажується ---------- */
async function canvasPages(el, pdf, first){
  const cs=getComputedStyle(el), scale=2;
  const cw=Math.max(el.scrollWidth,el.offsetWidth), ch=Math.max(el.scrollHeight,el.offsetHeight);
  let canvas; try{ canvas=await html2canvas(el,{scale,backgroundColor:'#ffffff',useCORS:true,logging:false,foreignObjectRendering:true,width:cw,height:ch,windowWidth:cw+40,windowHeight:ch+40}); const t=canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/3),1,1).data; if(!canvas.width||t[3]===0) throw 0; }catch(e){ canvas=await html2canvas(el,{scale,backgroundColor:'#ffffff',useCORS:true,logging:false,width:cw,height:ch}); }
  const W=canvas.width, pageH=Math.round(W*297/210);
  const mTop=Math.round((parseFloat(cs.paddingTop)||40)*scale), mBot=Math.round((parseFloat(cs.paddingBottom)||40)*scale);
  const ctx=canvas.getContext('2d');
  const whiteRow=y=>{ const d=ctx.getImageData(0,y,W,1).data; for(let i=0;i<d.length;i+=16){ if(d[i]<235||d[i+1]<235||d[i+2]<235) return false; } return true; };
  let y=0, pageNo=0;
  while(y<canvas.height-4){
    const offset = pageNo===0 ? 0 : mTop;
    const cap = pageH - offset - mBot;
    let end = Math.min(canvas.height, y+cap);
    if(end<canvas.height){ let k=end; const lim=end-Math.round(cap*0.25); while(k>lim && !whiteRow(k)) k--; if(k>lim) end=k; }
    const h=end-y; if(h<=2) break;
    const pc=document.createElement('canvas'); pc.width=W; pc.height=pageH; const pctx=pc.getContext('2d');
    pctx.fillStyle='#fff'; pctx.fillRect(0,0,W,pageH); pctx.drawImage(canvas,0,y,W,h,0,offset,W,h);
    if(!(first.v)) pdf.addPage(); first.v=false;
    pdf.addImage(pc.toDataURL('image/jpeg',0.9),'JPEG',0,0,210,297);
    y=end; pageNo++;
    // skip leading blank rows on next page
    while(y<canvas.height-4 && whiteRow(y) && pageNo>0) y++;
  }
}
async function renderDocxInto(blob,host){
  await loadScript('lib/docx-preview.min.js');
  await window.docx.renderAsync(blob,host,null,{inWrapper:false,breakPages:true,ignoreHeight:true,ignoreWidth:false,renderHeaders:true,renderFooters:true,experimental:true,useBase64URL:true});
  await new Promise(r=>setTimeout(r,200));
  const names=[...new Set((host.innerHTML.match(/docx-num-\d+-\d+/g)||[]))];
  host.style.counterReset=names.map(n=>n+' 0').join(' ');
  const secs=[...host.querySelectorAll('section.docx')];
  secs.forEach(sec=>{ sec.style.boxShadow='none'; sec.style.overflow='visible'; });
  return secs;
}
async function exportPdf(){
  const b=$('#exPdf'), old=b.textContent; b.disabled=true; b.textContent='▮ PDF…';
  let host=null;
  try{
    await loadScript('lib/html2canvas.min.js'); await loadScript('lib/jspdf.umd.min.js');
    if(document.fonts&&document.fonts.ready) await document.fonts.ready;
    const d=readDoc(); const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4',compress:true}); const first={v:true};
    const blob=await buildDocxBlob(d);
    host=document.createElement('div'); host.style.cssText='position:fixed;left:-12000px;top:0;background:#fff;z-index:-1';
    document.body.appendChild(host);
    const secs=await renderDocxInto(blob,host); if(!secs.length) throw new Error('не вдалося відобразити документ');
    for(const sec of secs){ sec.style.minHeight='0'; sec.style.margin='0'; await canvasPages(sec,pdf,first); }
    pdf.save(d.file+'.pdf'); toast('✓ PDF збережено: '+d.file+'.pdf'+(SAMPLE.doc&&SAMPLE.doc.fillable?' (у бланку «'+SAMPLE.doc.name+'»)':''),4500);
  }catch(e){ toast('⚠ PDF: '+e.message+' — можна скористатися «ДРУК» → «Зберегти як PDF»',7000); }
  if(host) host.remove();
  b.disabled=false; b.textContent=old;
}
/* ---------- ПЛАН-КОНСПЕКТ: перегляд готового документа (як буде у Word) ---------- */
async function viewKonspekt(){
  if(!$('#sheet')) return;
  const d=readDoc(), sm=SAMPLE.doc, body=$('#docView');
  $('#mDocT').textContent='📄 ПЛАН-КОНСПЕКТ · '+d.file;
  $('#docViewNote').textContent= sm&&sm.fillable ? `Так виглядатиме документ у бланку «${sm.name}». Виправити текст можна на аркуші, потім відкрити знову.` : 'Так виглядатиме документ Word. Виправити текст можна на аркуші, потім відкрити знову.';
  body.innerHTML='<p class="prev-note">Завантажую…</p>'; openModal('#mDoc');
  try{ const blob=await buildDocxBlob(d); body.innerHTML=''; const secs=await renderDocxInto(blob,body); const avail=body.clientWidth-16; secs.forEach(sc=>{ const w=sc.offsetWidth; if(w>avail) sc.style.zoom=(avail/w).toFixed(3); }); }
  catch(e){ body.innerHTML=`<p class="prev-note">⚠ Не вдалося показати документ: ${esc(e.message)}. Скористайтеся кнопкою WORD.</p>`; }
}
$('#exView').onclick=viewKonspekt;
$('#dvDocx').onclick=()=>exportDocx().catch(e=>toast('⚠ '+e.message));
$('#dvPdf').onclick=()=>exportPdf();
$('#exPdf').onclick=exportPdf;
$('#exTxt').onclick=()=>{ const d=readDoc(); download(new Blob([docText(d)],{type:'text/plain;charset=utf-8'}), d.file+'.txt'); toast('✓ TXT збережено'); };
$('#exCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(docText(readDoc())); toast('✓ Текст скопійовано — вставляйте куди завгодно'); }catch(e){ toast('Не вдалося скопіювати'); } };
$('#exAi').onclick=async()=>{
  if(!S.key){ openKey(); return; }
  if(!navigator.onLine){ toast('Немає інтернету — Gemini недоступний'); return; }
  const b=$('#exAi'); b.disabled=true; b.textContent='✨ Gemini працює…';
  try{
    const d=readDoc(), L=lessonInfo(); L.subject=d.subject; L.theme=d.theme; L.lesson=d.lesson; L.method=d.method; L.place=d.place;
    const r=await gemini(lessonPrompt(L,timing(L.h),true,d.questions.map(x=>x.q)), SCHEMA);
    const trs=$$('#qtable tbody tr');
    (r.questions||[]).forEach((x,i)=>{ if(trs[i]&&x.c){ const c=trs[i].querySelector('[data-k="c"]'); c.innerHTML=markPh(x.c); } });
    if(r.questions){ const x=sheetExtras()||{}; x.checks=r.questions.map(q=>({q:q.check_q||'',a:q.check_a||''})); ['evalCond','evalCrit','selfTask','finalQ','finalA'].forEach(k=>{ if(r[k]) x[k]=r[k]; }); const xe=$('#xtra'); if(xe) xe.dataset.json=JSON.stringify(x); }
    $('#sheet').dataset.ai='1'; saveCurrent(); toast('✓ Короткий зміст покращено');
  }catch(e){ toast('⚠ Gemini: '+e.message,6000); }
  b.disabled=false; b.textContent='✨ Покращити зміст';
};

$('#fire').onclick=async()=>{
  const f=$('#fire');
  { const L=lessonInfo(); if(!L.theme && !L.lesson){ toast('Вкажіть тему або заняття'); (isC(selTheme)?$('#cTheme'):selTheme).focus(); return; } }
  f.classList.add('recoil'); $('#flash').classList.remove('go'); void $('#flash').offsetWidth; $('#flash').classList.add('go');
  setTimeout(()=>f.classList.remove('recoil'),350);
  let D;
  if(S.mode==='ai' && S.key && !navigator.onLine){ toast('Немає інтернету — сформовано в базовому режимі (80%)',4500); }
  if(S.mode==='ai' && S.key && navigator.onLine){
    f.disabled=true; f.classList.add('busy'); f.querySelector('span').textContent='GEMINI ПРАЦЮЄ…'; $('#fireSub').textContent='зазвичай 10–40 секунд';
    try{ D=await buildAI(); }
    catch(e){ toast('⚠ Gemini не відповів ('+e.message+'). Сформовано базовий варіант — 80%.',7000); D=buildBasic(); }
    f.disabled=false; f.classList.remove('busy'); f.querySelector('span').textContent='СФОРМУВАТИ'; setMode(S.mode,true);
  } else D=buildBasic();
  renderSheet(D);
  if(window.innerWidth<980) $('#docbar').scrollIntoView({behavior:'smooth'});
  toast(D.ai?'✓ План-конспект готовий (Gemini, 100%)':'✓ План-конспект готовий. Жовтим — що варто доповнити');
};

/* ================= HISTORY ================= */
function saveCurrent(isNew){
  const sh=$('#sheet'); if(!sh) return;
  const hist=LS.get('hist',[]); const d=readDoc();
  if(isNew || !sh.dataset.id){ sh.dataset.id=Date.now().toString(36); }
  const item={id:sh.dataset.id,title:(d.lesson&&!/^\[/.test(d.lesson)?d.lesson:d.theme)||'План-конспект',subject:d.subject,file:d.file,ts:Date.now(),ai:sh.dataset.ai==='1',html:sh.innerHTML};
  const i=hist.findIndex(h=>h.id===item.id); if(i>=0) hist.splice(i,1); hist.unshift(item);
  LS.set('hist',hist.slice(0,30));
  $('#savedTag').textContent='збережено '+new Date().toLocaleTimeString('uk-UA',{hour:'2-digit',minute:'2-digit'});
}
$('#btnHist').onclick=()=>{
  const hist=LS.get('hist',[]);
  $('#histList').innerHTML=hist.length?hist.map(h=>`<div class="hitem" data-id="${h.id}"><div><b>${esc(h.file)}</b> ${h.ai?'<span class="ai-badge">Gemini</span>':''}<br><span style="font-size:13px">${esc(h.title)}</span><small>${esc(h.subject||'')} · ${new Date(h.ts).toLocaleString('uk-UA')}</small></div><button class="del" data-del="${h.id}" aria-label="Видалити">🗑</button></div>`).join(''):'<p style="color:var(--muted)">Поки що порожньо. Сформовані конспекти з’являтимуться тут автоматично.</p>';
  openModal('#mHist');
};
$('#histList').addEventListener('click',e=>{
  const del=e.target.closest('[data-del]');
  if(del){ e.stopPropagation(); LS.set('hist',LS.get('hist',[]).filter(h=>h.id!==del.dataset.del)); $('#btnHist').onclick(); return; }
  const it=e.target.closest('.hitem'); if(!it) return;
  const h=LS.get('hist',[]).find(x=>x.id===it.dataset.id); if(!h) return;
  $('#docArea').innerHTML=`<div class="paper-wrap"><div class="sheet" id="sheet" data-file="${esc(h.file)}" data-ai="${h.ai?1:0}" data-id="${h.id}">${h.html}</div></div>`;
  afterRenderLoaded(); closeModals(); toast('Відкрито: '+h.file);
});
function afterRenderLoaded(){ afterRender(true); }

/* ================= SAMPLES (зразки) ================= */
const SAMPLE = { doc:null, ppt:null };
const IDB = {
  db: null,
  open(){ return this.db ? Promise.resolve(this.db) : new Promise((res,rej)=>{ const r=indexedDB.open('yaryi',1); r.onupgradeneeded=()=>r.result.createObjectStore('kv'); r.onsuccess=()=>{ this.db=r.result; res(this.db); }; r.onerror=()=>rej(r.error); }); },
  async get(k){ const db=await this.open(); return new Promise(res=>{ const q=db.transaction('kv').objectStore('kv').get(k); q.onsuccess=()=>res(q.result); q.onerror=()=>res(null); }); },
  async set(k,v){ const db=await this.open(); return new Promise(res=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').put(v,k); t.oncomplete=()=>res(true); t.onerror=()=>res(false); }); },
  async del(k){ const db=await this.open(); return new Promise(res=>{ const t=db.transaction('kv','readwrite'); t.objectStore('kv').delete(k); t.oncomplete=()=>res(true); }); }
};
function introList(){ return (SAMPLE.doc && SAMPLE.doc.intro && SAMPLE.doc.intro.length>=3) ? SAMPLE.doc.intro : INTRO; }
function mostCommon(arr){ const m={}; let best=null,bc=0; arr.forEach(v=>{ m[v]=(m[v]||0)+1; if(m[v]>bc){ bc=m[v]; best=v; } }); return best; }
async function analyzeDocSample(buf,name){
  const zip=await JSZip.loadAsync(buf);
  const f=zip.file('word/document.xml'); if(!f) throw new Error('це не схоже на документ Word');
  const xmlStr=await f.async('string');
  const sectPr=(xmlStr.match(/<w:sectPr[\s\S]*<\/w:sectPr>(?![\s\S]*<w:sectPr)/)||[])[0]||'';
  let font=mostCommon([...xmlStr.matchAll(/<w:rFonts[^>]*w:ascii="([^"]+)"/g)].map(m=>m[1]));
  let sz=+mostCommon([...xmlStr.matchAll(/<w:sz w:val="(\d+)"/g)].map(m=>m[1]));
  const st=zip.file('word/styles.xml'); if(st && (!font||!sz)){ const sx=await st.async('string'); font=font||(sx.match(/<w:rPrDefault>[\s\S]*?w:ascii="([^"]+)"/)||[])[1]; sz=sz||+((sx.match(/<w:rPrDefault>[\s\S]*?<w:sz w:val="(\d+)"/)||[])[1]||0); }
  // text width from sectPr
  const pw=+((sectPr.match(/<w:pgSz[^>]*w:w="(\d+)"/)||[])[1]||11906), pl=+((sectPr.match(/<w:pgMar[^>]*w:left="(\d+)"/)||[])[1]||1701), pr=+((sectPr.match(/<w:pgMar[^>]*w:right="(\d+)"/)||[])[1]||851);
  const doc=xml(xmlStr);
  const paras=byTag(doc,'p').map(p=>TPL.wText(p).replace(/[ \t\u00a0]+/g,' ').replace(/ *\n */g,'\n').trim()).filter(Boolean);
  const idx=re=>paras.findIndex(p=>re.test(p));
  const iIn=idx(/ВСТУПНА\s+ЧАСТИНА/i), iMain=idx(/ОСНОВНА\s+ЧАСТИНА/i), iFin=idx(/ЗАКЛЮЧНА\s+ЧАСТИНА/i), iLead=paras.findIndex((p,i)=>i>iFin && /КЕРІВНИК\s+ЗАНЯТТЯ/i.test(p));
  let intro=null;
  if(iIn>=0 && iMain>iIn){
    const items=[]; paras.slice(iIn+1,iMain).forEach(p=>{
      const body=p.replace(/^\s*\d+[.)]\s*/,'');
      if(body.includes('\n')){ const [t,...r]=body.split('\n'); items.push([t.trim().replace(/[.:]?$/,'.'),r.join(' ').trim()]); return; }
      const cut=body.search(/[.:*]\s/);
      items.push(cut>3&&cut<90?[body.slice(0,cut+1).trim(),body.slice(cut+1).trim()]:[body,'']);
    });
    if(items.length>=3) intro=items;
  }
  let final=null;
  if(iFin>=0){ const fin=paras.slice(iFin+1, iLead>iFin?iLead:iFin+8).map(p=>p.replace(/\n/,'. ').replace(/\.\. /,'. ').replace(/\n/g,' ')).join(' '); if(fin.length>40) final=fin; }
  return { kind:'doc', name, buf, font:font||'Times New Roman', sz:sz||28, sectPr, textW:Math.max(5000,pw-pl-pr), intro, final, text:paras.join('\n'), fillable:TPL.isKonspektTemplate(xmlStr) };
}
async function analyzePptSample(buf,name){
  const zip=await JSZip.loadAsync(buf);
  if(!zip.file('ppt/presentation.xml')) throw new Error('це не схоже на презентацію PowerPoint');
  const layouts=Object.keys(zip.files).filter(n=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n)).length;
  const texts=await TPL.presTexts(buf);
  return { kind:'ppt', name, buf, layouts, slides:texts.length, fillable:TPL.isPresTemplate(texts) };
}
const BUILTIN={
  k158v1:{kind:'doc',file:'templates/konspekt-158-v1.docx',name:'Бланк 158 НЦ — варіант 1',prev:'templates/preview/konspekt-158-v1.jpg'},
  k158v2:{kind:'doc',file:'templates/konspekt-158-v2.docx',name:'Бланк 158 НЦ — варіант 2',prev:'templates/preview/konspekt-158-v2.jpg'},
  p158:{kind:'ppt',file:'templates/prezentatsiya-158.pptx',name:'Презентація 158 НЦ',prev:'templates/preview/prezentatsiya-158.jpg'}
};
const TPL_DEFAULT={doc:'k158v1',ppt:'p158'};
function loadBin(url){ return new Promise((res,rej)=>{ const x=new XMLHttpRequest(); x.open('GET',url); x.responseType='arraybuffer'; x.onload=()=>(x.status===200||x.status===0)&&x.response?res(x.response):rej(new Error('не знайдено '+url)); x.onerror=()=>rej(new Error('не вдалося відкрити '+url)); x.send(); }); }
function renderSlots(){
  const d=SAMPLE.doc, p=SAMPLE.ppt;
  $('#selTplDoc').value=LS.get('tpl_doc',TPL_DEFAULT.doc); $('#selTplPpt').value=LS.get('tpl_ppt',TPL_DEFAULT.ppt);
  $('#slotDoc').classList.toggle('on',!!d); $('#slotPpt').classList.toggle('on',!!p);
  $('#stDoc').textContent = d ? (d.fillable?`✓ ${d.name} · заповнення бланку без зміни вигляду`:`✓ ${d.name} · ${d.font}, ${d.sz/2} пт (оформлення за зразком)`) : 'власний шаблон «Ярого» (Times New Roman 14)';
  updateDest();
  $('#stPpt').textContent = p ? (p.fillable?`✓ ${p.name} · ${p.slides} слайдів, заповнюються без зміни вигляду`:`✓ ${p.name} · оформлення з макетів зразка`) : 'темний військовий дизайн «Ярого»';
}
async function applyTpl(kind,val,silent){
  const prev=LS.get('tpl_'+kind,TPL_DEFAULT[kind]);
  if(val==='own'){ (kind==='doc'?$('#fDoc'):$('#fPpt')).click(); renderSlots(); return; }
  try{
    if(val==='none') SAMPLE[kind]=null;
    else { const b=BUILTIN[val]; const buf=await loadBin(b.file); SAMPLE[kind]= kind==='doc'? await analyzeDocSample(buf,b.name) : await analyzePptSample(buf,b.name); }
    LS.set('tpl_'+kind,val); renderSlots();
    if(!silent) toast(val==='none'?'Зразок вимкнено — стандартне оформлення «Ярого»':'✓ '+BUILTIN[val].name);
  }catch(e){ LS.set('tpl_'+kind,prev); renderSlots(); if(!silent) toast('⚠ '+e.message+(isFileMode?' — у офлайн-папці відкривайте через значок «ЯРИЙ»':''),6000); }
}
async function loadSample(kind,file){
  try{
    const buf=await file.arrayBuffer();
    const s = kind==='doc' ? await analyzeDocSample(buf,file.name) : await analyzePptSample(buf,file.name);
    SAMPLE[kind]=s; await IDB.set('sample_'+kind,{name:file.name,buf}); LS.set('tpl_'+kind,'own');
    renderSlots(); toast(s.fillable?'✓ Бланк розпізнано — бот заповнюватиме його, не змінюючи вигляду':'✓ Зразок заряджено — оформлення братиметься з нього',4500);
  }catch(e){ toast('⚠ Зразок не прийнято: '+e.message,5000); renderSlots(); }
}
[['doc','#fDoc','#slotDoc','#selTplDoc'],['ppt','#fPpt','#slotPpt','#selTplPpt']].forEach(([k,inp,slot,sel])=>{
  const el=$(slot), fi=$(inp);
  $(sel).onchange=()=>applyTpl(k,$(sel).value);
  fi.onchange=()=>{ if(fi.files[0]) loadSample(k,fi.files[0]); fi.value=''; };
  ['dragenter','dragover'].forEach(ev=>el.addEventListener(ev,e=>{ e.preventDefault(); el.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>el.addEventListener(ev,e=>{ e.preventDefault(); el.classList.remove('over'); }));
  el.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) loadSample(k,f); });
});
async function restoreSamples(){
  for(const k of ['doc','ppt']){
    const v=LS.get('tpl_'+k,TPL_DEFAULT[k]);
    try{
      if(v==='own'){ const o=await IDB.get('sample_'+k); if(o&&o.buf) SAMPLE[k]= k==='doc'? await analyzeDocSample(o.buf,o.name) : await analyzePptSample(o.buf,o.name); else LS.set('tpl_'+k,TPL_DEFAULT[k]); }
      if(LS.get('tpl_'+k,TPL_DEFAULT[k])!=='own') await applyTpl(k,LS.get('tpl_'+k,TPL_DEFAULT[k]),true);
    }catch(e){}
  }
  renderSlots();
}

function updateDest(){
  const el=$('#destLine'); if(!el) return; const d=SAMPLE.doc, p=SAMPLE.ppt;
  el.textContent=`WORD → ${d?(d.fillable?'у бланк «'+d.name+'»':'за зразком «'+d.name+'»'):'стандартний шаблон «Ярого»'}  ·  ПРЕЗЕНТАЦІЯ → ${p?(p.fillable?'у шаблон «'+p.name+'»':'за зразком «'+p.name+'»'):'військовий дизайн «Ярого»'}`;
}
$$('[data-prev]').forEach(b=>b.onclick=()=>{
  const k=b.dataset.prev, v=LS.get('tpl_'+k,TPL_DEFAULT[k]), s=SAMPLE[k], bi=BUILTIN[v];
  $('#mPrevT').textContent= k==='doc'?'👁 ЗРАЗОК КОНСПЕКТУ':'👁 ЗРАЗОК ПРЕЗЕНТАЦІЇ';
  let html='';
  if(bi) html=`<p class="prev-note"><b>${esc(bi.name)}</b> — порожній бланк. «Ярий» вписує в нього дані${k==='doc'?' (тема, заняття, мета, час, місце, метод, навчальні питання, таблиця «Навчальні питання / Короткий зміст», хвилини, підписи)':' (тема, заняття, мета, хід заняття, оцінювання, «№1, №2, №3» з тезами, запитання з відповідями, підсумки, кінцеві інструкції)'}, не змінюючи оформлення.</p><img class="prev-img" src="${bi.prev}" alt="${esc(bi.name)}">`;
  else if(s) html=`<p class="prev-note"><b>${esc(s.name)}</b> — ваш файл. ${s.fillable?'Розпізнано як бланк: дані вписуються у нього без зміни вигляду.':'Оформлення (шрифт, поля, стилі) береться з нього.'}</p>`;
  else html=`<p class="prev-note">Зразок не вибрано — ${k==='doc'?'документ буде у стандартному шаблоні «Ярого» (Times New Roman 14)':'слайди будуть у військовому дизайні «Ярого»'}.</p>`;
  $('#prevBody').innerHTML=html; openModal('#mPrev');
});

/* ================= EXTRAS (для слайдів шаблону) ================= */
function nextLessonText(){
  try{
    if(isC(selLesson)||!curTheme()) return PH('тема наступного заняття');
    const s=curSubj(), ti=+selTheme.value, li=+selLesson.value, t=s.themes[ti];
    if(t.lessons[li+1]) return `Тема ${t.name}. Заняття ${t.lessons[li+1].name}`;
    const nt=s.themes[ti+1]; if(nt) return `Тема ${nt.name}`+(nt.lessons[0]?`. Заняття ${nt.lessons[0].name}`:'');
  }catch(e){}
  return PH('тема наступного заняття');
}
function basicExtras(d){
  const lines=c=>c.split('\n').map(l=>noPh(l).replace(/^[–\-•▪]\s*/,'').trim()).filter(l=>l.length>2);
  return {
    checks:d.questions.map(x=>({ q:`Розкрийте зміст навчального питання «${noPh(x.q)}»?`, a:(lines(x.c).slice(0,2).join('; ')||PH('відповідь')) })),
    evalCond:'усне опитування та перевірка практичних дій курсантів під час основної частини і в ході підбиття підсумків заняття',
    evalCrit:'«відмінно» — дії та відповіді правильні й упевнені, без помилок; «добре» — з незначними помилками, виправленими самостійно; «задовільно» — з помилками, виправленими за допомогою керівника; «незадовільно» — завдання не виконано',
    selfTask:`повторити матеріал заняття «${stripNum(noPh(d.lesson))||noPh(d.theme)}» за конспектом`,
    next:nextLessonText(),
    finalQ:'Які навчальні питання було розглянуто на занятті?',
    finalA:d.questions.map((x,i)=>`${i+1}. ${noPh(x.q)}`).join('; ')
  };
}
function sheetExtras(){ try{ return JSON.parse($('#xtra')?.dataset.json||'null'); }catch(e){ return null; } }
function mergedExtras(d){
  const b=basicExtras(d), x=sheetExtras()||{};
  const checks=d.questions.map((q,i)=>{ const c=(x.checks||[])[i]; return c&&c.q?c:b.checks[i]; });
  return {...b,...Object.fromEntries(Object.entries(x).filter(([k,v])=>v&&k!=='checks')),checks,next:x.next||b.next};
}

/* ================= IMPORT READY FILES ================= */
function openParsed(p,label){
  const num=+((p.time||'').match(/\d+/)||[0])[0];
  const h = num && num<=8 ? num : Math.max(1,Math.round((num||45)/(+REQ.hourMin||45)));
  const L={module:'',subject:p.subject,theme:p.theme,lesson:p.lesson,h,method:p.method,place:p.place,q:p.questions.map(x=>x.q),fromProgram:false};
  const D={L,tm:timing(h),ai:false,goal:p.goal||basicGoal(L),materials:p.materials||basicMaterials(L),literature:p.literature||basicLiterature(),
    questions:(p.questions.length?p.questions:[{q:PH('навчальне питання'),c:''}]).map(x=>({q:x.q,c:x.c||PH('короткий зміст')})),
    final:p.final||(SAMPLE.doc&&SAMPLE.doc.final)||FINAL_TXT, timeText:p.time||''};
  renderSheet(D);
  if(window.innerWidth<980) $('#docbar').scrollIntoView({behavior:'smooth'});
  toast(`✓ ${label}. Тепер — WORD або ▶ ПРЕЗЕНТАЦІЯ`,4500);
}

/* ================= PRESENTATION ================= */
const noPh = s => String(s||'').replace(/\[[^\]]*\]/g,'').replace(/\s{2,}/g,' ').trim();
function shortB(s,n=170){ s=noPh(s).replace(/^[–\-•▪]\s*/,''); return s.length>n ? s.slice(0,n).replace(/\s\S*$/,'')+'…' : s; }
function sentences(t){ return noPh(t).split(/(?<=[.!?])\s+(?=[А-ЯІЇЄҐA-Z])/).map(x=>x.trim()).filter(x=>x.length>3); }
function slidesFromDoc(d){
  const S_=[];
  S_.push({kind:'title', title:stripNum(noPh(d.lesson))||noPh(d.theme)||'Заняття', sub:[noPh(d.subject), d.theme&&('Тема № '+noPh(d.theme)), d.lesson&&('Заняття № '+noPh(d.lesson))].filter(Boolean).join('\n')});
  const gm=noPh(d.goal); const g= /Виховна/i.test(gm) ? gm.split(/(?=Виховна)/i).map(x=>x.trim()).filter(Boolean) : sentences(gm); if(g.length) S_.push({title:'Мета заняття', bullets:g.map(x=>shortB(x,220))});
  S_.push({title:'Навчальні питання', bullets:d.questions.map((q,i)=>`${i+1}. ${shortB(q.q,150)}`)});
  d.questions.forEach((q,i)=>{
    let b=q.c.split('\n').map(x=>shortB(x)).filter(x=>x.length>2);
    if(b.length===1 && b[0].length>120) b=sentences(q.c).map(x=>shortB(x));
    if(!b.length) b=['Зміст питання доповнюється інструктором'];
    for(let j=0;j<b.length;j+=6) S_.push({title:`Питання ${i+1}. ${shortB(q.q,90)}${j?' (продовження)':''}`, bullets:b.slice(j,j+6)});
  });
  const f=sentences(d.final); if(f.length) S_.push({title:'Підсумки заняття', bullets:f.slice(0,6).map(x=>shortB(x))});
  return S_;
}
const SLIDE_SCHEMA={type:'OBJECT',properties:{slides:{type:'ARRAY',items:{type:'OBJECT',properties:{title:{type:'STRING'},bullets:{type:'ARRAY',items:{type:'STRING'}}},required:['title','bullets']}}},required:['slides']};
async function aiSlides(d){
  const r=await gemini(`Зроби з цього плану-конспекту структуру навчальної презентації для курсантів. 8–14 слайдів. Перший слайд — назва заняття (bullets: предмет, тема, заняття). Далі: мета, навчальні питання, по 1–2 слайди на кожне питання, підсумки. На слайді до 6 пунктів, кожен — до 14 слів, ємко і по суті, без markdown. Не вигадуй фактів, яких немає в конспекті.\n\nКОНСПЕКТ:\n${docText(d).slice(0,30000)}\n\nВідповідь — тільки JSON.`, SLIDE_SCHEMA);
  const sl=(r.slides||[]).filter(s=>s&&s.title);
  if(sl.length<3) throw new Error('замало слайдів');
  return sl.map((s,i)=> i===0 ? {kind:'title',title:s.title,sub:(s.bullets||[]).join('\n')} : {title:s.title,bullets:(s.bullets||[]).slice(0,7).map(x=>shortB(x,200))});
}
async function iconPng(){
  return new Promise(res=>{ const img=new Image(); img.onload=()=>{ const c=document.createElement('canvas'); c.width=c.height=256; c.getContext('2d').drawImage(img,0,0,256,256); try{ res(c.toDataURL('image/png')); }catch(e){ res(null); } }; img.onerror=()=>res(null); img.src='icons/icon.svg'; });
}
function loadScript(src){ return new Promise((res,rej)=>{ if(document.querySelector(`script[src="${src}"]`)) return res(); const s=document.createElement('script'); s.src=src; s.onload=res; s.onerror=()=>rej(new Error('не вдалося завантажити '+src)); document.head.appendChild(s); }); }
async function pptxDefault(slides,fileName){
  if(typeof PptxGenJS==='undefined') await loadScript('lib/pptxgen.min.js');
  const p=new PptxGenJS(); p.layout='LAYOUT_WIDE'; p.title=fileName; p.author='ЯРИЙ — помічник конспектів';
  const icon=await iconPng();
  const rail=[]; for(let x=0;x<13.4;x+=0.32) rail.push({rect:{x,y:0,w:0.2,h:0.14,fill:{color:'3A3F44'}}});
  p.defineSlideMaster({ title:'YARYI', background:{color:'191C1F'},
    objects:[{rect:{x:0,y:0,w:13.33,h:0.14,fill:{color:'111315'}}},...rail,
      {rect:{x:0,y:7.22,w:13.33,h:0.28,fill:{color:'111315'}}},
      {text:{text:'ЯРИЙ · помічник конспектів',options:{x:0.45,y:7.22,w:6,h:0.28,fontSize:10,color:'6D736F',fontFace:'Arial'}}},
      ...(icon?[{image:{data:icon,x:12.55,y:0.32,w:0.5,h:0.5}}]:[])],
    slideNumber:{x:12.45,y:7.22,w:0.6,h:0.28,color:'C9A24A',fontSize:10,fontFace:'Arial'} });
  slides.forEach(s=>{
    const sl=p.addSlide({masterName:'YARYI'});
    if(s.kind==='title'){
      sl.addShape(p.ShapeType.rect,{x:0.6,y:2.0,w:0.14,h:2.6,fill:{color:'C9A24A'}});
      sl.addText(s.title,{x:0.95,y:1.8,w:11.3,h:1.9,fontSize:40,bold:true,color:'E2BF63',fontFace:'Arial',valign:'bottom',fit:'shrink'});
      sl.addText(s.sub||'',{x:0.95,y:3.8,w:11.3,h:1.6,fontSize:18,color:'D9D4C4',fontFace:'Arial',valign:'top',fit:'shrink'});
      sl.addText('ПЛАН-КОНСПЕКТ · НАВЧАЛЬНЕ ЗАНЯТТЯ',{x:0.95,y:6.2,w:8,h:0.4,fontSize:12,color:'737B4F',fontFace:'Courier New',bold:true,charSpacing:3});
    } else {
      sl.addShape(p.ShapeType.rect,{x:0.45,y:0.42,w:0.1,h:0.62,fill:{color:'C9A24A'}});
      sl.addText(s.title,{x:0.7,y:0.3,w:11.6,h:0.9,fontSize:26,bold:true,color:'E2BF63',fontFace:'Arial',valign:'middle',fit:'shrink'});
      sl.addShape(p.ShapeType.line,{x:0.45,y:1.25,w:12.4,h:0,line:{color:'3A3F44',width:1.5}});
      const total=(s.bullets||[]).join(' ').length, fs= total>700?16: total>450?18:20;
      sl.addText((s.bullets||[]).map(b=>({text:b,options:{bullet:{code:'25AA',color:'C9A24A'},paraSpaceAfter:10}})),
        {x:0.75,y:1.5,w:11.9,h:5.5,fontSize:fs,color:'E6E3DA',fontFace:'Arial',valign:'top',fit:'shrink'});
    }
  });
  await p.writeFile({fileName:fileName+'.pptx'});
}
const NS_P='xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
function phAttrs(layoutXml, want){
  const phs=[...layoutXml.matchAll(/<p:ph\b([^>]*)\/?>/g)].map(m=>m[1]);
  const get=(a,k)=>(a.match(new RegExp('\\s'+k+'="([^"]*)"'))||[])[1];
  if(want==='title'){ const a=phs.find(a=>/type="(ctrTitle|title)"/.test(a)); return a?`type="${get(a,'type')}"`:null; }
  const a=phs.find(a=>/type="(subTitle|body|obj)"/.test(a)) || phs.find(a=>!/type=/.test(a) && /idx=/.test(a));
  if(!a) return null; const t=get(a,'type'), i=get(a,'idx'); return [t&&`type="${t}"`, i&&`idx="${i}"`].filter(Boolean).join(' ');
}
function spXml(id,name,ph,paras,scale){
  const ps=paras.map(t=>`<a:p><a:r><a:rPr lang="uk-UA" dirty="0"/><a:t>${X(t)}</a:t></a:r></a:p>`).join('')||'<a:p><a:endParaRPr lang="uk-UA"/></a:p>';
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph ${ph}/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr>${scale?`<a:normAutofit fontScale="${scale}" lnSpcReduction="10000"/>`:'<a:normAutofit/>'}</a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
}
function boxXml(id,paras,cx,cy){
  const ps=paras.map(t=>`<a:p><a:r><a:rPr lang="uk-UA" sz="2000"/><a:t>${X(t)}</a:t></a:r></a:p>`).join('');
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Text ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="${Math.round(cx*0.07)}" y="${Math.round(cy*0.25)}"/><a:ext cx="${Math.round(cx*0.86)}" cy="${Math.round(cy*0.65)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr wrap="square"><a:normAutofit/></a:bodyPr><a:lstStyle/>${ps}</p:txBody></p:sp>`;
}
async function pptxFromSample(sm,slides,fileName){
  const zip=await JSZip.loadAsync(sm.buf);
  let pres=await zip.file('ppt/presentation.xml').async('string');
  const relsPath='ppt/_rels/presentation.xml.rels';
  let rels=await zip.file(relsPath).async('string'), ct=await zip.file('[Content_Types].xml').async('string');
  const sz=pres.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/)||[0,12192000,6858000]; const cx=+sz[1], cy=+sz[2];
  const L=[];
  for(const n of Object.keys(zip.files).filter(n=>/^ppt\/slideLayouts\/slideLayout\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/(\d+)\.xml/)[1]-+b.match(/(\d+)\.xml/)[1])){
    const x=await zip.file(n).async('string'); L.push({n,x,type:(x.match(/<p:sldLayout\b[^>]*\stype="(\w+)"/)||[])[1]||''});
  }
  if(!L.length) throw new Error('у зразку немає макетів слайдів');
  const titleL=L.find(l=>l.type==='title')||L[0];
  const contentL=L.find(l=>l.type==='obj')||L.find(l=>l.type!=='title'&&phAttrs(l.x,'body')&&phAttrs(l.x,'title'))||titleL;
  Object.keys(zip.files).filter(n=>/^ppt\/(slides|notesSlides)\//.test(n)).forEach(n=>zip.remove(n));
  rels=rels.replace(/<Relationship\b[^>]*Type="[^"]*\/relationships\/slide"[^>]*\/>/g,'');
  ct=ct.replace(/<Override\b[^>]*PartName="\/ppt\/(slides|notesSlides)\/[^"]*"[^>]*\/>/g,'');
  pres=pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/,'').replace(/<p:sldIdLst\/>/,'').replace(/<p:custShowLst>[\s\S]*?<\/p:custShowLst>/,'').replace(/<p14:sectionLst[\s\S]*?<\/p14:sectionLst>/,'');
  // drop app.xml (slide titles/counts)
  if(zip.file('docProps/app.xml')){ zip.remove('docProps/app.xml'); ct=ct.replace(/<Override\b[^>]*PartName="\/docProps\/app\.xml"[^>]*\/>/,''); const rr=await zip.file('_rels/.rels').async('string'); zip.file('_rels/.rels',rr.replace(/<Relationship\b[^>]*Target="docProps\/app\.xml"[^>]*\/>/,'')); }
  let ids='';
  slides.forEach((s,i)=>{
    const n=i+1, rid='rIdYa'+n, lay=s.kind==='title'?titleL:contentL;
    const tPh=phAttrs(lay.x,'title'), bPh=phAttrs(lay.x,'body');
    const body=s.kind==='title' ? (s.sub||'').split('\n').filter(Boolean) : (s.bullets||[]);
    const total=body.join(' ').length, scale= s.kind==='title'?0: total>700?'70000': total>450?'85000':0;
    let tree='';
    tree+= tPh ? spXml(2,'Title',tPh,[s.title]) : boxXml(2,[s.title],cx,cy*0.3);
    tree+= bPh ? spXml(3,'Content',bPh,body,scale) : boxXml(3,body,cx,cy);
    zip.file(`ppt/slides/slide${n}.xml`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sld ${NS_P}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>${tree}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`);
    zip.file(`ppt/slides/_rels/slide${n}.xml.rels`,`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/${lay.n.split('/').pop()}"/></Relationships>`);
    rels=rels.replace('</Relationships>',`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${n}.xml"/></Relationships>`);
    ct=ct.replace('</Types>',`<Override PartName="/ppt/slides/slide${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
    ids+=`<p:sldId id="${300+n}" r:id="${rid}"/>`;
  });
  pres=pres.replace(/<p:sldSz\b/,`<p:sldIdLst>${ids}</p:sldIdLst><p:sldSz`);
  zip.file('ppt/presentation.xml',pres); zip.file(relsPath,rels); zip.file('[Content_Types].xml',ct);
  const blob=await zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.openxmlformats-officedocument.presentationml.presentation'});
  download(blob,fileName+'.pptx');
}
async function exportPptx(){
  if(!$('#sheet')) return;
  const b=$('#exPptx'), old=b.textContent; b.disabled=true;
  try{
    const d=readDoc(); let slides;
    if(!(SAMPLE.ppt&&SAMPLE.ppt.fillable) && S.mode==='ai' && S.key && navigator.onLine){ b.textContent='▶ GEMINI ГОТУЄ СЛАЙДИ…'; try{ slides=await aiSlides(d); }catch(e){ toast('Gemini не відповів — слайди зібрано з конспекту'); } }
    if(!slides) slides=slidesFromDoc(d);
    b.textContent='▶ ЗБИРАЮ PPTX…';
    if(SAMPLE.ppt && SAMPLE.ppt.fillable){
      let x=mergedExtras(d);
      if(S.mode==='ai' && S.key && navigator.onLine && !sheetExtras()){ b.textContent='▶ GEMINI ГОТУЄ ЗАПИТАННЯ…'; try{ x={...x,...await aiExtras(d)}; }catch(e){} }
      const r=await TPL.fillPptx(SAMPLE.ppt.buf,d,x); download(r.blob,d.file+'.pptx');
      toast(`✓ Презентація у шаблоні «${SAMPLE.ppt.name}»: ${d.file}.pptx · ${r.slides} слайдів`,4500);
      b.disabled=false; b.textContent=old; return;
    }
    if(SAMPLE.ppt) await pptxFromSample(SAMPLE.ppt,slides,d.file); else await pptxDefault(slides,d.file);
    toast(`✓ Презентація збережена: ${d.file}.pptx · ${slides.length} слайдів${SAMPLE.ppt?' · за зразком':''}`,4000);
  }catch(e){ toast('⚠ Презентація: '+e.message,6000); }
  b.disabled=false; b.textContent=old;
}
$('#exPptx').onclick=exportPptx;

/* ================= INSTALL / ONLINE-OFFLINE ================= */
const ONLINE_URL='https://yuriygrom357357-tech.github.io/yaryi-konspekt/';
let deferredPrompt=null;
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isFileMode=location.protocol==='file:';
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredPrompt=e; });
window.addEventListener('appinstalled',()=>{ deferredPrompt=null; closeModals(); toast('✓ «ЯРИЙ» встановлено — значок на робочому столі',4500); });
function instHint(){
  const ua=navigator.userAgent, h=$('#instHint'), b=$('#doInstall');
  b.disabled=false;
  if(isStandalone()){ h.textContent='✓ Ви вже працюєте у встановленому додатку «ЯРИЙ».'; b.disabled=true; return; }
  if(isFileMode){ h.innerHTML=`Це офлайн-папка. Щоб встановити версію з автооновленням, відкрийте з інтернетом: <a href="${ONLINE_URL}" target="_blank" rel="noopener">${ONLINE_URL}</a>`; b.disabled=true; return; }
  if(deferredPrompt){ h.textContent='Натисніть кнопку і підтвердьте «Установити». Значок з’явиться на робочому столі та в меню «Пуск» / Launchpad.'; return; }
  if(/iPhone|iPad|iPod/.test(ua)) h.textContent='iPhone / iPad: у Safari натисніть «Поділитися» (квадрат зі стрілкою) → «На початковий екран».';
  else if(/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua)) h.textContent='Safari на Mac: меню «Файл» → «Додати в Dock».';
  else if(/Firefox/.test(ua)) h.textContent='Firefox не встановлює сайти як додатки. Відкрийте цю сторінку в Chrome або Edge — або завантажте офлайн-папку нижче.';
  else if(/Android/.test(ua)) h.textContent='Android: меню ⋮ у Chrome → «Додати на головний екран» / «Установити додаток».';
  else h.textContent='Якщо вікно встановлення не з’явилось: у Chrome/Edge натисніть значок «Встановити» праворуч в адресному рядку, або меню ⋮ → «Трансляція, збереження й надсилання» → «Установити сторінку як додаток».';
}
$('#btnInstall').onclick=()=>{ instHint(); openModal('#mInstall'); };
$('#doInstall').onclick=async()=>{
  if(deferredPrompt){ deferredPrompt.prompt(); const r=await deferredPrompt.userChoice.catch(()=>({})); deferredPrompt=null; if(r.outcome!=='accepted') toast('Встановлення скасовано'); instHint(); }
  else { instHint(); toast('Скористайтеся підказкою під кнопкою',3500); }
};
$('#dlOffline').href = isFileMode ? ONLINE_URL+'yaryi-offline.zip' : 'yaryi-offline.zip';
if(isStandalone()) $('#btnInstall').title='Офлайн-папка';
function netState(showToast){
  const on=navigator.onLine, n=$('#net'); if(!n) return;
  n.classList.toggle('off',!on); n.querySelector('span').textContent=on?'ОНЛАЙН':'ОФЛАЙН';
  if(showToast) toast(on?'Зв’язок є — режим Gemini доступний':'Немає інтернету — працює базовий режим (80%)',3500);
}
window.addEventListener('online',()=>netState(true)); window.addEventListener('offline',()=>netState(true));

/* ================= INIT ================= */
initSelects(); restoreSamples(); updateLed(); netState(false); setMode(S.key?S.mode:'basic',true); updateMag();
if(!LS.get('seenInfo',false)){ LS.set('seenInfo',true); setTimeout(()=>openModal('#mInfo'),600); }
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
