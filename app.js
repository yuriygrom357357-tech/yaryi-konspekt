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
  src: 'prog',
  mode: LS.get('mode','basic'),
  key: LS.get('key',''),
  files: [],          // {name, kind, slides:[{title, lines:[]}]}
  ai: false
};
const PH = t => `[${t}]`;

/* ================= PROGRAMME SELECTS ================= */
const selMod=$('#selMod'), selSubj=$('#selSubj'), selTheme=$('#selTheme'), selLesson=$('#selLesson');
function fill(sel, arr, label){ sel.innerHTML = arr.map((x,i)=>`<option value="${i}">${esc(label(x,i))}</option>`).join(''); }
function curMod(){ return PROGRAM[+selMod.value||0]; }
function curSubj(){ return curMod().subjects[+selSubj.value||0]; }
function curTheme(){ return curSubj().themes[+selTheme.value||0]; }
function curLesson(){ const t=curTheme(); return t.lessons.length ? t.lessons[+selLesson.value||0] : null; }
function initSelects(){
  fill(selMod, PROGRAM, m=>m.name);
  selMod.onchange=()=>{ fill(selSubj, curMod().subjects, s=>s.name); selSubj.onchange(); };
  selSubj.onchange=()=>{ fill(selTheme, curSubj().themes, t=>'Тема '+t.name); selTheme.onchange(); };
  selTheme.onchange=()=>{
    const t=curTheme();
    if(t.lessons.length){ fill(selLesson, t.lessons, l=>'Заняття '+l.name+' · '+l.h+' год'); selLesson.disabled=false; }
    else { selLesson.innerHTML='<option>— заняття вкажете на аркуші —</option>'; selLesson.disabled=true; }
    selLesson.onchange();
  };
  selLesson.onchange=()=>{ renderLessonCard(); updateMag(); LS.set('sel',[selMod.value,selSubj.value,selTheme.value,selLesson.value]); };
  const sv=LS.get('sel',null);
  selMod.onchange();
  if(sv){ try{
    selMod.value=sv[0]; selMod.onchange(); selSubj.value=sv[1]; selSubj.onchange(); selTheme.value=sv[2]; selTheme.onchange();
    if(!selLesson.disabled){ selLesson.value=sv[3]; selLesson.onchange(); }
  }catch(e){} }
}
function renderLessonCard(){
  const l=curLesson(), c=$('#lessonCard');
  if(!l){ c.innerHTML=`<b>Деталізації занять цієї теми немає в базі.</b><br>Додаток сформує каркас, а в режимі Gemini — запропонує навчальні питання й зміст. Можна також перейти на вкладку «Своя тема».`; return; }
  c.innerHTML=`<div class="chips"><span class="chip">${l.h} год</span><span class="chip">${esc(l.method)}</span>${l.place&&l.place!=='—'?`<span class="chip">${esc(l.place)}</span>`:''}</div>
  <b>Навчальні питання за програмою:</b><ul>${l.q.map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`;
}

/* ================= TABS ================= */
$$('.tab').forEach(b=>b.onclick=()=>{
  S.src=b.dataset.src; $$('.tab').forEach(x=>x.setAttribute('aria-selected', x===b));
  $('#srcProg').hidden=S.src!=='prog'; $('#srcOwn').hidden=S.src!=='own'; updateMag();
});
['ownSubj','ownTheme','ownLesson','ownHours','ownMethod','ownQ','notes'].forEach(id=>$('#'+id).addEventListener('input',updateMag));

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
  if(S.src==='prog'){ n+=2; if(curLesson()) n+=1; }
  else { if($('#ownTheme').value.trim()) n++; if($('#ownLesson').value.trim()) n+=2; }
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
  const names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>+a.match(/\d+/)[0]-+b.match(/\d+/)[0]);
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
    if(!title && lines.length) title=lines.shift();
    if(title||lines.length) slides.push({title,lines});
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
      if(!slides.length) throw new Error('у файлі не знайдено тексту');
      S.files.push({name:f.name,kind:ext,slides});
      toast(`✓ ${f.name}: ${slides.length} ${ext==='pptx'||ext==='pdf'?'слайдів/сторінок':'блоків'}`);
    }catch(e){ toast('⚠ '+f.name+': '+e.message,5000); }
  }
  renderFiles(); updateMag();
}
function renderFiles(){
  $('#files').innerHTML=S.files.map((f,i)=>`<div class="file"><span>▮</span><span>${esc(f.name)} · <span style="color:var(--dim)">${f.slides.length} фрагм.</span></span><button class="x" data-i="${i}" aria-label="Прибрати">×</button></div>`).join('');
  $$('#files .x').forEach(b=>b.onclick=()=>{ S.files.splice(+b.dataset.i,1); renderFiles(); updateMag(); });
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
  if(S.src==='prog'){
    const m=curMod(), s=curSubj(), t=curTheme(), l=curLesson();
    return { module:m.name, subject:s.name, theme:t.name, lesson:l?l.name:'', h:l?l.h:1, method:l?l.method:'', q:l?l.q.slice():[], place:l?l.place:'', fromProgram:true, hasLesson:!!l };
  }
  return { module:'', subject:$('#ownSubj').value.trim(), theme:$('#ownTheme').value.trim(), lesson:$('#ownLesson').value.trim(),
    h:Math.max(1,+$('#ownHours').value||1), method:$('#ownMethod').value.trim(),
    q:$('#ownQ').value.split('\n').map(x=>clean(x.replace(/^\s*\d+[.)]\s*/,''))).filter(Boolean), place:'', fromProgram:false, hasLesson:!!$('#ownLesson').value.trim() };
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
    final: FINAL_TXT
  };
}

/* ================= GEMINI ================= */
const SYS = `Ти — досвідчений методист навчального центру Збройних Сил України. Ти складаєш плани-конспекти занять за Програмою об’єднаної (суміщеної) підготовки командирів відділень за ВОС-100 (35 діб, СТП 7-(01,02,04)242.(62), 2026).
Правила:
- Пиши українською, чіткою військовою термінологією, без markdown, без зірочок і решіток.
- Навчальні питання бери з програми (формулювання не змінюй; якщо їх більше 6 — об’єднай логічно у 3–5). Якщо питань немає — сформулюй 2–4 питання за темою і матеріалами.
- «Короткий зміст» до кожного питання: 5–9 змістовних тез, кожна з нового рядка і починається з «– ». Основне джерело — надані матеріали (презентація, нотатки). Якщо матеріалів немає — використовуй загальновідомі відкриті знання за темою.
- Не вигадуй номерів наказів, назв документів, прізвищ, цифр, яких немає в матеріалах. Якщо дані невідомі — став заповнювач у квадратних дужках, напр. [уточнити].
- «Керівництва та посібники» — тільки програма підготовки та документи, прямо названі в матеріалах.
- Мета: навчальна і виховна, 2–3 речення.
- Матеріальне забезпечення: конкретний перелік під заняття і місце проведення.
- Заключна частина: підбиття підсумків, перевірка засвоєння, завдання на самопідготовку, заходи безпеки, впорядкування місця заняття.`;
const SCHEMA = {type:'OBJECT',properties:{
  goal:{type:'STRING'}, materials:{type:'STRING'}, literature:{type:'STRING'},
  questions:{type:'ARRAY',items:{type:'OBJECT',properties:{q:{type:'STRING'},c:{type:'STRING'}},required:['q','c']}},
  final:{type:'STRING'}}, required:['goal','materials','literature','questions','final']};
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

${onlyContent?'Збережи формулювання навчальних питань без змін, перепиши лише «Короткий зміст» (c) — змістовніше і точніше. Інші поля поверни як є або покращ.':'Склади поля плану-конспекту.'} Відповідь — тільки JSON за схемою.`;
}
async function buildAI(){
  const L=lessonInfo(), tm=timing(L.h);
  const r=await gemini(lessonPrompt(L,tm,false), SCHEMA);
  const base=buildBasic();
  return { L, tm, ai:true,
    goal:r.goal||base.goal, materials:r.materials||base.materials, literature:r.literature||base.literature,
    questions:(r.questions||[]).filter(x=>x&&x.q).map(x=>({q:x.q,c:x.c||''})).length ? r.questions.map(x=>({q:x.q,c:x.c||''})) : base.questions,
    final:r.final||base.final };
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
const markPh = v => esc(v).replace(/\[[^\]\n]{1,160}\]/g, m=>`<mark class="ph">${m}</mark>`);
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
<p><span class="lbl">ЧАС:</span> ${ce('time', tm.total+' хв ('+L.h+' '+(L.h===1?'академічна година':'академічні години')+')')}</p>
<p><span class="lbl">МІСЦЕ:</span> ${ce('place', (L.place&&L.place!=='—')?L.place:PH('навчальний клас / ділянка місцевості'))}</p>
<p><span class="lbl">МЕТОД:</span> ${ce('method', L.method||PH('лекція / показ / тренування / дискусія'))}</p>
<p><span class="lbl">МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ:</span> ${ce('materials', D.materials)}</p>
<p><span class="lbl">КЕРІВНИЦТВО ТА ПОСІБНИКИ:</span> ${ce('literature', D.literature)}</p>
<h4>ХІД ЗАНЯТТЯ</h4>
<h5>І. ВСТУПНА ЧАСТИНА – ${ce('introMin', String(tm.intro))} хв.</h5>
${INTRO.map((x,i)=>`<p><b>${i+1}. ${esc(x[0])}</b> ${ce('intro'+i, x[1])}</p>`).join('')}
<h5>ІІ. ОСНОВНА ЧАСТИНА – ${ce('mainMin', String(tm.main))} хв.</h5>
<table id="qtable"><thead><tr><th>Навчальні питання</th><th>Короткий зміст</th></tr></thead><tbody>${rows}</tbody></table>
<button class="addrow" id="addRow">+ додати навчальне питання</button>
<h5>ІІІ. ЗАКЛЮЧНА ЧАСТИНА – ${ce('finMin', String(tm.fin))} хв.</h5>
<p>${ce('final', D.final)}</p>
<p style="margin-top:22px"><span class="lbl">КЕРІВНИК ЗАНЯТТЯ:</span> ${ce('leader', REQ.leader||PH('військове звання, підпис, ініціали та прізвище'))}</p>`;
  $('#docArea').innerHTML=`<div class="paper-wrap"><div class="sheet" id="sheet" data-file="${esc(fileName(L))}" data-ai="${D.ai?1:0}">${html}</div></div>`;
  afterRender();
}
function qRow(x,i){
  return `<tr><td class="q"><span class="qn">Навчальне питання №${i+1}.</span> ${ce('q',x.q)}<div class="rowtools"><button class="tool" data-act="up" title="Вище">↑</button><button class="tool" data-act="down" title="Нижче">↓</button><button class="tool" data-act="del" title="Видалити">✕</button></div></td><td>${ce('c',x.c,'cbox').replace('<span','<div').replace(/<\/span>$/,'</div>')}</td></tr>`;
}
function renumber(){ $$('#qtable tbody tr').forEach((tr,i)=>tr.querySelector('.qn').textContent=`Навчальне питання №${i+1}.`); }
function afterRender(loaded){
  const sheet=$('#sheet');
  $('#empty')?.remove(); $('#docbar').hidden=false; $('#exAi').hidden=S.mode!=='ai';
  $$('#sheet .cbox').forEach(d=>{ d.style.whiteSpace='pre-wrap'; });
  sheet.addEventListener('click',e=>{
    const b=e.target.closest('[data-act]'); if(b){ const tr=b.closest('tr');
      if(b.dataset.act==='del'){ if($$('#qtable tbody tr').length>1) tr.remove(); }
      if(b.dataset.act==='up' && tr.previousElementSibling) tr.parentNode.insertBefore(tr,tr.previousElementSibling);
      if(b.dataset.act==='down' && tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling,tr);
      renumber(); saveCurrent(); }
    if(e.target.id==='addRow'){ const tb=$('#qtable tbody'); tb.insertAdjacentHTML('beforeend',qRow({q:PH('формулювання питання'),c:PH('тези')},tb.children.length)); $$('#sheet .cbox').forEach(d=>d.style.whiteSpace='pre-wrap'); saveCurrent(); }
  });
  sheet.addEventListener('input',e=>{ const el=e.target.closest('[data-k]'); if(el) el.querySelectorAll('mark.ph').forEach(m=>{ if(!/^\[[^\]]*\]$/.test(m.textContent)) m.replaceWith(...m.childNodes); }); clearTimeout(saveCurrent._t); saveCurrent._t=setTimeout(saveCurrent,800); });
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
    intro: INTRO.map((x,i)=>[x[0],txt('intro'+i)]),
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
function run(t,{b=false}={}){ return `<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>${b?'<w:b/><w:bCs/>':''}<w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t xml:space="preserve">${X(t)}</w:t></w:r>`; }
function para(runs,{jc='both',ind=0,first=0,after=0,before=0,keep=false}={}){
  return `<w:p><w:pPr>${keep?'<w:keepNext/>':''}<w:spacing w:before="${before}" w:after="${after}" w:line="240" w:lineRule="auto"/>${ind||first?`<w:ind w:left="${ind}" w:firstLine="${first}"/>`:''}<w:jc w:val="${jc}"/></w:pPr>${runs}</w:p>`;
}
function lbl(label,value,opt={}){ return para(run(label+' ',{b:true})+run(value),{first:709,...opt}); }
function cellParas(text,bold){ const lines=String(text).split('\n').filter(l=>l.trim()!==''); return (lines.length?lines:['']).map(l=>para(run(l,{b:bold}),{jc:'left'})).join(''); }
function buildDocxXml(d){
  const W=9355, c1=3300, c2=W-c1;
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
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="851" w:bottom="1134" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}
async function exportDocx(){
  const d=readDoc(), zip=new JSZip();
  zip.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`);
  zip.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('word/styles.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman"/><w:sz w:val="28"/><w:szCs w:val="28"/><w:lang w:val="uk-UA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`);
  zip.file('docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X('План-конспект '+d.file)}</dc:title><dc:creator>ЯРИЙ — помічник конспектів</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString().slice(0,19)}Z</dcterms:created></cp:coreProperties>`);
  zip.file('word/document.xml',buildDocxXml(d));
  const blob=await zip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
  download(blob, d.file+'.docx'); toast('✓ Word збережено: '+d.file+'.docx');
}
function download(blob,name){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }

/* ================= ACTIONS ================= */
$('#exDocx').onclick=()=>exportDocx().catch(e=>toast('⚠ '+e.message));
$('#exPrint').onclick=()=>{ document.title=readDoc().file; window.print(); setTimeout(()=>document.title='ЯРИЙ — помічник конспектів',1500); };
$('#exPdf').onclick=()=>{ toast('У вікні друку оберіть «Зберегти як PDF» (Save as PDF)',4500); setTimeout(()=>$('#exPrint').onclick(),700); };
$('#exTxt').onclick=()=>{ const d=readDoc(); download(new Blob([docText(d)],{type:'text/plain;charset=utf-8'}), d.file+'.txt'); toast('✓ TXT збережено'); };
$('#exCopy').onclick=async()=>{ try{ await navigator.clipboard.writeText(docText(readDoc())); toast('✓ Текст скопійовано — вставляйте куди завгодно'); }catch(e){ toast('Не вдалося скопіювати'); } };
$('#exAi').onclick=async()=>{
  if(!S.key){ openKey(); return; }
  const b=$('#exAi'); b.disabled=true; b.textContent='✨ Gemini працює…';
  try{
    const d=readDoc(), L=lessonInfo(); L.subject=d.subject; L.theme=d.theme; L.lesson=d.lesson; L.method=d.method; L.place=d.place;
    const r=await gemini(lessonPrompt(L,timing(L.h),true,d.questions.map(x=>x.q)), SCHEMA);
    const trs=$$('#qtable tbody tr');
    (r.questions||[]).forEach((x,i)=>{ if(trs[i]&&x.c){ const c=trs[i].querySelector('[data-k="c"]'); c.innerHTML=markPh(x.c); } });
    $('#sheet').dataset.ai='1'; saveCurrent(); toast('✓ Короткий зміст покращено');
  }catch(e){ toast('⚠ Gemini: '+e.message,6000); }
  b.disabled=false; b.textContent='✨ Покращити зміст';
};

$('#fire').onclick=async()=>{
  const f=$('#fire');
  if(S.src==='own' && !$('#ownTheme').value.trim() && !$('#ownLesson').value.trim()){ toast('Вкажіть тему або заняття'); $('#ownTheme').focus(); return; }
  f.classList.add('recoil'); $('#flash').classList.remove('go'); void $('#flash').offsetWidth; $('#flash').classList.add('go');
  setTimeout(()=>f.classList.remove('recoil'),350);
  let D;
  if(S.mode==='ai' && S.key){
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

/* ================= INIT ================= */
initSelects(); updateLed(); setMode(S.key?S.mode:'basic',true); updateMag();
if(!LS.get('seenInfo',false)){ LS.set('seenInfo',true); setTimeout(()=>openModal('#mInfo'),600); }
if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
