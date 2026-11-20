/* ЯРИЙ · заповнення бланків-зразків (конспект DOCX, презентація PPTX) без зміни оформлення */
'use strict';
const TPL = (() => {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
  const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const XMLNS = 'http://www.w3.org/XML/1998/namespace';
  const parse = s => new DOMParser().parseFromString(s, 'application/xml');
  const ser = d => new XMLSerializer().serializeToString(d);
  const kids = (el, ns, ln) => [...el.childNodes].filter(n => n.nodeType === 1 && n.namespaceURI === ns && n.localName === ln);
  const all = (el, ns, ln) => [...el.getElementsByTagNameNS(ns, ln)];
  const norm = s => String(s || '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
  const ORD = ['ПЕРШОМУ', 'ДРУГОМУ', 'ТРЕТЬОМУ', 'ЧЕТВЕРТОМУ', 'П’ЯТОМУ', 'ШОСТОМУ', 'СЬОМОМУ', 'ВОСЬМОМУ'];
  const splitNum = s => { const m = String(s || '').match(/^\s*(\d+)[.:)]?\s*(.*)$/); return m ? [m[1], m[2].trim()] : ['', String(s || '').trim()]; };

  /* ---------------- WORD ---------------- */
  function wText(p) {
    let s = '';
    (function walk(n) {
      for (const c of n.childNodes) {
        if (c.nodeType !== 1) continue;
        if (c.namespaceURI === W) {
          if (c.localName === 't') { s += c.textContent; continue; }
          if (c.localName === 'br' || c.localName === 'cr') { s += '\n'; continue; }
          if (c.localName === 'tab') { s += '\t'; continue; }
          if (c.localName === 'p' && c !== p) continue; // nested (textbox) paragraphs are separate
          if (c.localName === 'del' || c.localName === 'instrText') continue;
        }
        walk(c);
      }
    })(p);
    return s;
  }
  function baseRPr(p) {
    const r = all(p, W, 'r').find(r => all(r, W, 't').length) || all(p, W, 'r')[0];
    let rp = r ? kids(r, W, 'rPr')[0] : null;
    if (!rp) { const pPr = kids(p, W, 'pPr')[0]; rp = pPr ? kids(pPr, W, 'rPr')[0] : null; }
    return rp ? rp.cloneNode(true) : null;
  }
  function setB(rPr, b) {
    if (b === null || b === undefined) return;
    ['b', 'bCs'].forEach(t => kids(rPr, W, t).forEach(n => rPr.removeChild(n)));
    const order = ['rStyle', 'rFonts'];
    let ref = [...rPr.childNodes].find(n => n.nodeType === 1 && !order.includes(n.localName)) || null;
    ['b', 'bCs'].forEach(t => { const e = rPr.ownerDocument.createElementNS(W, 'w:' + t); if (!b) e.setAttributeNS(W, 'w:val', '0'); rPr.insertBefore(e, ref); });
  }
  // segs: [{t, b}] ; b=null keeps base bold
  function wSet(p, segs) {
    const doc = p.ownerDocument, rp = baseRPr(p);
    [...p.childNodes].forEach(n => { if (!(n.nodeType === 1 && n.localName === 'pPr')) p.removeChild(n); });
    segs.forEach(sg => String(sg.t).split('\n').forEach((line, i) => {
      const r = doc.createElementNS(W, 'w:r');
      const rr = rp ? rp.cloneNode(true) : doc.createElementNS(W, 'w:rPr');
      setB(rr, sg.b); r.appendChild(rr);
      if (i) r.appendChild(doc.createElementNS(W, 'w:br'));
      const t = doc.createElementNS(W, 'w:t'); t.setAttributeNS(XMLNS, 'xml:space', 'preserve'); t.textContent = line; r.appendChild(t);
      p.appendChild(r);
    }));
  }
  const inTable = p => { for (let n = p.parentNode; n; n = n.parentNode) if (n.localName === 'tbl') return n; return null; };

  function isKonspektTemplate(xmlStr) { return /ПЛАН\s*[-–—]\s*КОНСПЕКТ/i.test(xmlStr.replace(/<[^>]+>/g, '')) && /Навчальн[іи]\s+питання/i.test(xmlStr.replace(/<[^>]+>/g, '')); }

  async function fillDocx(buf, d, opt = {}) {
    const zip = await JSZip.loadAsync(buf);
    const doc = parse(await zip.file('word/document.xml').async('string'));
    const body = all(doc, W, 'body')[0];
    const paras = all(body, W, 'p').filter(p => !inTable(p));
    const lab = (p, label, value) => wSet(p, [{ t: label + ' ', b: true }, { t: value || '', b: false }]);
    const [thN, thName] = splitNum(d.theme), [lsN, lsName] = splitNum(d.lesson);
    let qSlots = [], inQ = false, beforePlan = true;
    for (let i = 0; i < paras.length; i++) {
      const p = paras[i], tx = norm(wText(p)), next = paras[i + 1] ? norm(wText(paras[i + 1])) : '', prev = i ? norm(wText(paras[i - 1])) : '';
      if (/ПЛАН\s*[-–—]\s*КОНСПЕКТ/i.test(tx)) beforePlan = false;
      if (beforePlan) {
        if (/^_{8,}$/.test(tx) && /^\(посада\)/i.test(next) && d.apPos && !/^\[/.test(d.apPos)) wSet(p, [{ t: d.apPos, b: null }]);
        if (/^_{8,}$/.test(tx) && /^\(військове звання/i.test(next) && d.apName && !/^\[/.test(d.apName)) wSet(p, [{ t: d.apName, b: null }]);
        continue;
      }
      if (inQ) {
        if (/^\d+[.)]?\s*$/.test(tx)) { qSlots.push(p); continue; }
        if (tx === '' && qSlots.length === 0) continue;
        inQ = false;
      }
      let m;
      if (/предмет/i.test(tx) && /_{3,}/.test(tx)) { wSet(p, [{ t: wText(p).replace(/_{3,}/, d.subject || '____'), b: null }]); continue; }
      if (/^_{10,}$/.test(tx) && /предмет/i.test(prev)) { wSet(p, [{ t: d.subject || tx, b: null }]); continue; }
      if ((m = tx.match(/^(ТЕМА|Тема)\s*(№\s*)?\d*\s*([:.]?)/)) && norm(tx.replace(/^(ТЕМА|Тема)\s*(№\s*)?\d*\s*[:.\s]*/, '')) === '') {
        const sep = /:/.test(tx) ? ':' : '.'; lab(p, `${m[1]} ${thN || ''}${sep}`.replace(/ +([:.])/, '$1'), thName); continue; }
      if ((m = tx.match(/^(ЗАНЯТТЯ|Заняття)\s*(№\s*)?\d*/)) && norm(tx.replace(/^(ЗАНЯТТЯ|Заняття)\s*(№\s*)?\d*\s*[:.\s]*/, '')) === '') {
        const sep = /:/.test(tx) ? ':' : '.'; lab(p, `${m[1]} ${lsN || ''}${sep}`.replace(/ +([:.])/, '$1'), lsName); continue; }
      if (/^МЕТА(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(tx) && norm(tx.replace(/^МЕТА[\s:]*/i, '')) === '') { lab(p, 'МЕТА:', d.goal); continue; }
      if (/^ЧАС(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(tx) && norm(tx.replace(/^ЧАС[\s:]*/i, '')) === '') { lab(p, 'ЧАС:', d.time); continue; }
      if (/^МІСЦЕ(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(tx) && norm(tx.replace(/^МІСЦЕ[\s:]*/i, '')) === '') { lab(p, 'МІСЦЕ:', d.place); continue; }
      if (/^МЕТОД(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(tx) && norm(tx.replace(/^МЕТОД[\s:]*/i, '')) === '') { lab(p, 'МЕТОД:', d.method); continue; }
      if (/^МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ/i.test(tx) && norm(tx.replace(/^МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ[\s:]*/i, '')) === '') { lab(p, tx.replace(/[\s:]*$/, '') + ':', d.materials); continue; }
      if (/^КЕРІВНИЦТВ[ОА] ТА ПОСІБНИКИ/i.test(tx) && norm(tx.replace(/^КЕРІВНИЦТВ[ОА] ТА ПОСІБНИКИ[\s:]*/i, '')) === '') { lab(p, tx.replace(/[\s:]*$/, '') + ':', d.literature); continue; }
      if (/^НАВЧАЛЬНІ ПИТАННЯ\s*:?$/i.test(tx)) { inQ = true; qSlots = []; continue; }
      if (/ОСНОВНА ЧАСТИНА/i.test(tx) && /_{2,}/.test(tx)) { wSet(p, [{ t: wText(p).replace(/\s*_{2,}\s*/, ' ' + (d.mainMin || '') + ' '), b: null }]); continue; }
      if (/ЗАКЛЮЧНА ЧАСТИНА/i.test(tx) && /_{2,}/.test(tx)) { wSet(p, [{ t: wText(p).replace(/\s*_{2,}\s*/, ' ' + (d.finMin || '') + ' '), b: null }]); continue; }
      if (/КЕРІВНИК ЗАНЯТТЯ/i.test(tx) && /_{3,}/.test(tx) && d.leader && !/^\[/.test(d.leader)) { wSet(p, [{ t: wText(p).replace(/_{3,}/, d.leader), b: null }]); continue; }
    }
    // numbered questions list after «НАВЧАЛЬНІ ПИТАННЯ:»
    fillNumbered(qSlots, d.questions.map(x => x.q));
    // the questions table
    const tbl = all(body, W, 'tbl').find(t => /Навчальн[іи]\s+питання/i.test(norm(all(kids(t, W, 'tr')[0] || t, W, 't').map(x => x.textContent).join(' '))));
    if (tbl) {
      const rows = kids(tbl, W, 'tr'); const proto = rows[1] || rows[0];
      rows.slice(1).forEach(r => tbl.removeChild(r));
      d.questions.forEach((x, i) => {
        const r = proto.cloneNode(true), tcs = kids(r, W, 'tc');
        const fillCell = (tc, lines, bold) => {
          const ps = kids(tc, W, 'p'); const pp = ps[0]; ps.slice(1).forEach(q => tc.removeChild(q));
          lines.forEach((ln, j) => { const np = j ? pp.cloneNode(true) : pp; if (j) tc.appendChild(np); wSet(np, ln); });
        };
        if (tcs[0]) fillCell(tcs[0], [[{ t: `Навчальне питання №${i + 1}. `, b: true }, { t: x.q, b: true }]]);
        if (tcs[1]) fillCell(tcs[1], (x.c || '').split('\n').filter(l => l.trim()).map(l => [{ t: l, b: false }]).concat((x.c || '').trim() ? [] : [[{ t: '', b: false }]]));
        tbl.appendChild(r);
      });
    }
    zip.file('word/document.xml', ser(doc));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  }
  function fillNumbered(slots, items) {
    if (!slots.length) return;
    const last = slots[slots.length - 1];
    if (items.length > slots.length) {
      let after = last;
      for (let k = slots.length; k < items.length; k++) { const c = last.cloneNode(true); after.parentNode.insertBefore(c, after.nextSibling); after = c; slots.push(c); }
    }
    slots.forEach((p, i) => { if (i < items.length) wSet(p, [{ t: `${i + 1}. ${items[i]}`, b: null }]); else p.parentNode.removeChild(p); });
  }

  /* parse a FILLED konspekt (docx) into data for the sheet */
  async function parseKonspekt(buf) {
    const zip = await JSZip.loadAsync(buf); const f = zip.file('word/document.xml'); if (!f) return null;
    const doc = parse(await f.async('string')); const body = all(doc, W, 'body')[0];
    const paras = all(body, W, 'p').filter(p => !inTable(p)).map(p => norm(wText(p).replace(/\n/g, ' ')));
    const get = re => { const s = paras.find(t => re.test(t)); return s ? norm(s.replace(re, '').replace(/^[\s:.–-]*/, '')) : ''; };
    const d = { subject: '', theme: '', lesson: '', goal: '', time: '', place: '', method: '', materials: '', literature: '', questions: [], final: '' };
    const subjLine = paras.findIndex(t => /предмет/i.test(t));
    if (subjLine >= 0) { let s = paras[subjLine].replace(/^.*?предмет[уа]?\s*/i, '').replace(/_+/g, '').trim(); if (!s && paras[subjLine + 1] && !/_{5,}/.test(paras[subjLine + 1])) s = paras[subjLine + 1]; d.subject = s; }
    const th = paras.find(t => /^(ТЕМА|Тема)\s*(№\s*)?\d*/.test(t)); if (th) { const m = th.match(/^(?:ТЕМА|Тема)\s*(?:№\s*)?(\d*)\s*[:.]*\s*(.*)$/); d.theme = norm((m[1] ? m[1] + '. ' : '') + m[2]); }
    const ls = paras.find(t => /^(ЗАНЯТТЯ|Заняття)\s*(№\s*)?\d*/.test(t)); if (ls) { const m = ls.match(/^(?:ЗАНЯТТЯ|Заняття)\s*(?:№\s*)?(\d*)\s*[:.]*\s*(.*)$/); d.lesson = norm((m[1] ? m[1] + '. ' : '') + m[2]); }
    d.goal = get(/^МЕТА(?![А-ЯІЇЄҐа-яіїєґ'’])[\s:]*/i); d.time = get(/^ЧАС(?![А-ЯІЇЄҐа-яіїєґ'’])[\s:]*/i); d.place = get(/^МІСЦЕ(?![А-ЯІЇЄҐа-яіїєґ'’])[\s:]*/i); d.method = get(/^МЕТОД(?![А-ЯІЇЄҐа-яіїєґ'’])[\s:]*/i);
    d.materials = get(/^МАТЕРІАЛЬНЕ ЗАБЕЗПЕЧЕННЯ[\s:]*/i); d.literature = get(/^КЕРІВНИЦТВ[ОА] ТА ПОСІБНИКИ[\s:]*/i);
    const tbl = all(body, W, 'tbl').find(t => /Навчальн[іи]\s+питання/i.test(norm(all(kids(t, W, 'tr')[0] || t, W, 't').map(x => x.textContent).join(' '))));
    if (tbl) kids(tbl, W, 'tr').slice(1).forEach(tr => {
      const tcs = kids(tr, W, 'tc'); if (tcs.length < 2) return;
      const q = norm(kids(tcs[0], W, 'p').map(wText).join(' ')).replace(/^Навчальне питання\s*№?\s*\d+[.:]?\s*/i, '');
      const c = kids(tcs[1], W, 'p').map(p => norm(wText(p))).filter(Boolean).join('\n');
      if (q || c) d.questions.push({ q: q || '[навчальне питання]', c });
    });
    if (!d.questions.length) { // numbered list fallback
      const i0 = paras.findIndex(t => /^НАВЧАЛЬНІ ПИТАННЯ/i.test(t));
      if (i0 >= 0) for (let i = i0 + 1; i < paras.length && /^\d+[.)]/.test(paras[i]); i++) { const q = paras[i].replace(/^\d+[.)]\s*/, ''); if (q) d.questions.push({ q, c: '' }); }
    }
    const iF = paras.findIndex(t => /ЗАКЛЮЧНА ЧАСТИНА/i.test(t)), iL = paras.findIndex((t, i) => i > iF && /КЕРІВНИК ЗАНЯТТЯ/i.test(t));
    if (iF >= 0) d.final = paras.slice(iF + 1, iL > iF ? iL : iF + 6).join(' ');
    const filled = d.questions.some(x => x.c) || (d.theme && !/^\d*\.?\s*$/.test(d.theme)) || d.goal;
    return filled ? d : null;
  }

  /* ---------------- POWERPOINT ---------------- */
  const aText = sp => all(sp, A, 'p').map(p => { let s = ''; for (const c of p.childNodes) { if (c.localName === 'r' || c.localName === 'fld') s += all(c, A, 't').map(t => t.textContent).join(''); if (c.localName === 'br') s += '\n'; } return s; }).join('\n');
  const aParas = sp => { const tb = all(sp, P, 'txBody')[0]; return tb ? kids(tb, A, 'p') : []; };
  const pText = p => { let s = ''; for (const c of p.childNodes) { if (c.localName === 'r' || c.localName === 'fld') s += all(c, A, 't').map(t => t.textContent).join(''); } return s; };
  function aBaseRPr(p) {
    const r = kids(p, A, 'r').find(r => norm(pText(p))) || kids(p, A, 'r')[0];
    let rp = r ? kids(r, A, 'rPr')[0] : null;
    if (!rp) rp = kids(p, A, 'endParaRPr')[0];
    const doc = p.ownerDocument; const out = doc.createElementNS(A, 'a:rPr');
    if (rp) { [...rp.attributes].forEach(at => out.setAttribute(at.name, at.value)); [...rp.childNodes].forEach(c => out.appendChild(c.cloneNode(true))); }
    out.setAttribute('lang', 'uk-UA'); out.removeAttribute('dirty');
    return out;
  }
  function aSet(p, segs) {
    const doc = p.ownerDocument, rp = aBaseRPr(p), end = kids(p, A, 'endParaRPr')[0];
    [...p.childNodes].forEach(n => { if (n.nodeType === 1 && n.localName !== 'pPr') p.removeChild(n); });
    segs.forEach(sg => {
      const r = doc.createElementNS(A, 'a:r'); const rr = rp.cloneNode(true);
      if (sg.b === true) rr.setAttribute('b', '1'); else if (sg.b === false) rr.setAttribute('b', '0');
      if (sg.i === false) rr.setAttribute('i', '0');
      r.appendChild(rr); const t = doc.createElementNS(A, 'a:t'); t.textContent = sg.t; r.appendChild(t); p.appendChild(r);
    });
    if (end) p.appendChild(end);
  }
  function aFillLines(sp, lines, opt = {}) {
    const tb = all(sp, P, 'txBody')[0]; if (!tb) return;
    const ps = kids(tb, A, 'p'); const proto = ps.find(p => norm(pText(p))) || ps[0];
    const tmpl = proto.cloneNode(true);
    const auto = all(tmpl, A, 'buAutoNum').length > 0 || all(tmpl, A, 'buChar').length > 0;
    ps.forEach(p => tb.removeChild(p));
    (lines.length ? lines : ['']).forEach(ln => {
      const np = tmpl.cloneNode(true); tb.appendChild(np);
      if (Array.isArray(ln)) { if (auto) noBullet(np); aSet(np, ln); }
      else { const t = auto ? String(ln).replace(/^(•|\d+\.)\s*/, '') : ln; aSet(np, [{ t, b: opt.b }]); }
    });
    autofit(sp, lines.map(l => Array.isArray(l) ? l.map(s => s.t).join('') : l).join(' ').length, opt.cap || 380);
  }
  function noBullet(p) {
    let pPr = kids(p, A, 'pPr')[0]; const doc = p.ownerDocument;
    if (!pPr) { pPr = doc.createElementNS(A, 'a:pPr'); p.insertBefore(pPr, p.firstChild); }
    [...pPr.childNodes].filter(n => /^bu/.test(n.localName)).forEach(n => pPr.removeChild(n));
    pPr.setAttribute('indent', '0'); pPr.setAttribute('marL', '0');
    pPr.appendChild(doc.createElementNS(A, 'a:buNone'));
  }
  function autofit(sp, chars, cap) {
    const bp = all(sp, A, 'bodyPr')[0]; if (!bp) return;
    [...bp.childNodes].filter(n => ['normAutofit', 'spAutoFit', 'noAutofit'].includes(n.localName)).forEach(n => bp.removeChild(n));
    const na = bp.ownerDocument.createElementNS(A, 'a:normAutofit');
    if (chars > cap) { const sc = Math.max(55, Math.round(100 * Math.sqrt(cap / chars))); na.setAttribute('fontScale', sc * 1000); na.setAttribute('lnSpcReduction', chars > cap * 1.6 ? '20000' : '10000'); }
    bp.appendChild(na);
  }
  const shapes = doc => all(doc, P, 'sp').filter(sp => all(sp, P, 'txBody').length);
  const shGeom = (sp, SW, SH) => { const off = all(sp, A, 'off')[0], ext = all(sp, A, 'ext')[0]; if (!off || !ext) return { x: 0, y: 0, w: 0, h: 0, a: 0 }; const w = +ext.getAttribute('cx') / SW, h = +ext.getAttribute('cy') / SH; return { x: +off.getAttribute('x') / SW, y: +off.getAttribute('y') / SH, w, h, a: w * h }; };
  function isEmptyBox(sp, SW, SH) { const ps = aParas(sp); if (ps.length < 3) return false; if (norm(aText(sp))) return false; const g = shGeom(sp, SW, SH); return g.a > 0.1 && g.a < 0.7; }
  function isPresTemplate(texts) { const t = texts.join(' | ').toUpperCase(); return /№\s*1/.test(t) && /(ХІД ЗАНЯТТЯ|ЗАПИТАННЯ ПО|ПІДВЕДЕННЯ ПІДСУМКІВ)/.test(t); }

  async function slideList(zip) {
    const pres = parse(await zip.file('ppt/presentation.xml').async('string'));
    const rels = parse(await zip.file('ppt/_rels/presentation.xml.rels').async('string'));
    const map = {}; all(rels, 'http://schemas.openxmlformats.org/package/2006/relationships', 'Relationship').forEach(r => map[r.getAttribute('Id')] = r.getAttribute('Target'));
    return all(pres, P, 'sldId').map(s => ({ id: s.getAttribute('id'), rid: s.getAttributeNS(R, 'id'), path: 'ppt/' + map[s.getAttributeNS(R, 'id')].replace(/^\.?\//, '').replace(/^\/ppt\//, '') }));
  }

  async function presTexts(buf) {
    const zip = await JSZip.loadAsync(buf); const list = await slideList(zip); const out = [];
    for (const s of list) { const d = parse(await zip.file(s.path).async('string')); out.push(shapes(d).map(aText).map(norm).filter(Boolean).join(' / ')); }
    return out;
  }

  async function fillPptx(buf, d, x) {
    const zip = await JSZip.loadAsync(buf);
    const presXml = await zip.file('ppt/presentation.xml').async('string');
    const sz = presXml.match(/<p:sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/) || [0, 9144000, 6858000]; const SW = +sz[1], SH = +sz[2];
    let list = await slideList(zip);
    for (const s of list) { s.doc = parse(await zip.file(s.path).async('string')); s.texts = shapes(s.doc).map(sp => norm(aText(sp))); s.U = s.texts.join(' | ').toUpperCase(); }
    // classify
    let k = 0; const nQ = d.questions.length;
    list.forEach(s => {
      const num = s.texts.map(t => t.match(/^№\s*(\d+)\s*:?\s*$/)).find(Boolean);
      if (num) { k = +num[1]; s.role = 'qtitle'; s.k = k; return; }
      const zq = s.U.match(/ЗАПИТАННЯ ПО\s+(\S+)\s+НАВЧАЛЬНОМУ/);
      if (zq) { const i = ORD.findIndex(o => zq[1].replace(/'/g, '’').startsWith(o.slice(0, 4))); s.role = 'qcheck'; s.k = i >= 0 ? i + 1 : k; return; }
      if (/ПЕРЕВІРКА ЗНАНЬ/.test(s.U)) { s.role = k ? 'finalcheck' : 'prevcheck'; if (k) k = 99; return; }
      if (/ПІДВЕДЕННЯ ПІДСУМКІВ/.test(s.U)) { s.role = 'summary'; k = 99; return; }
      if (/КІНЦЕВІ ІНСТРУКЦІЇ/.test(s.U)) { s.role = 'final'; k = 99; return; }
      if (/КІНЕЦЬ ЗАНЯТТЯ/.test(s.U)) { s.role = 'end'; k = 99; return; }
      if (/УМОВИ ОЦІНЮВАННЯ|КРИТЕРІЇ ОЦІНЮВАННЯ/.test(s.U)) { s.role = 'eval'; return; }
      if (/МІСЦЕ\s*[–-]/.test(s.U) && /МЕТОД/.test(s.U)) { s.role = 'plan'; return; }
      if (/ТЕМА\s*\d*/.test(s.U) && /ЗАНЯТТЯ/.test(s.U) && /МЕТА/.test(s.U)) { s.role = 'topic'; return; }
      if (k > 0 && k < 99 && shapes(s.doc).some(sp => isEmptyBox(sp, SW, SH))) { s.role = 'qcont'; s.k = k; return; }
      if (k === 0 && shapes(s.doc).some(sp => isEmptyBox(sp, SW, SH))) { s.role = 'overview'; return; }
      s.role = 'keep';
    });
    const maxK = Math.max(0, ...list.filter(s => s.role === 'qtitle').map(s => s.k));
    // remove unused question blocks
    const removed = list.filter(s => s.k && s.k <= maxK && s.k > nQ && ['qtitle', 'qcheck', 'qcont'].includes(s.role));
    list = list.filter(s => !removed.includes(s));
    // clone last block for extra questions
    if (nQ > maxK && maxK > 0) {
      const block = list.filter(s => s.k === maxK && ['qtitle', 'qcheck', 'qcont'].includes(s.role));
      const lastIdx = list.indexOf(block[block.length - 1]);
      let insertAt = lastIdx + 1, n = Math.max(...Object.keys(zip.files).map(f => (f.match(/^ppt\/slides\/slide(\d+)\.xml$/) || [0, 0])[1] | 0));
      const clones = [];
      for (let q = maxK + 1; q <= nQ; q++) for (const b of block) {
        n++; const path = `ppt/slides/slide${n}.xml`;
        const relSrc = b.path.replace('slides/', 'slides/_rels/') + '.rels';
        if (zip.file(relSrc)) { let rx = await zip.file(relSrc).async('string'); rx = rx.replace(/<Relationship[^>]*notesSlide[^>]*\/>/g, ''); zip.file(path.replace('slides/', 'slides/_rels/') + '.rels', rx); }
        const doc = parse(ser(b.doc)); clones.push({ path, doc, role: b.role, k: q, isNew: true, texts: b.texts, U: b.U });
      }
      list.splice(insertAt, 0, ...clones);
    }
    const qs = d.questions;
    const chunks = qs.map(q => { const L = (q.c || '').split('\n').map(l => l.replace(/^[–\-•▪]\s*/, '').trim()).filter(l => l && !/^\[.*\]$/.test(l)); return L; });
    const used = qs.map(() => 0);
    const short = l => l.length > 95 ? l.slice(0, 95).replace(/\s\S*$/, '') + '…' : l;
    const take = (i, n = 4) => { const a = chunks[i].slice(used[i], used[i] + n).map(short); used[i] += a.length; return a; };
    const contentBox = (s) => shapes(s.doc).find(sp => isEmptyBox(sp, SW, SH));
    const capOf = (s, box, def = 4) => {
      const g = shGeom(box, SW, SH); let lim = def;
      all(s.doc, P, 'pic').forEach(pic => { const pg = shGeom(pic, SW, SH); if (pg.y > g.y - 0.02 && pg.y < g.y + g.h && pg.x < g.x + g.w && pg.x + pg.w > g.x) lim = Math.min(lim, Math.max(1, Math.floor((pg.y - g.y) / 0.052))); });
      return lim;
    };
    const titleShape = (s) => shapes(s.doc).find(sp => /^№\s*\d+/.test(norm(aText(sp)))) || shapes(s.doc).find(sp => /ЗАПИТАННЯ ПО/i.test(aText(sp)));
    let protoBox = null;
    for (const s of list) if (s.role === 'qtitle' && contentBox(s)) { protoBox = contentBox(s); break; }
    if (!protoBox) for (const s of list) if (contentBox(s)) { protoBox = contentBox(s); break; }

    for (const s of list) {
      const SP = shapes(s.doc);
      const qi = (s.k || 1) - 1;
      if (s.role === 'topic' || s.role === 'summary') fillTopic(SP, d, s.role === 'summary');
      else if (s.role === 'plan') fillPlan(SP, d);
      else if (s.role === 'eval') fillEval(SP, x);
      else if (s.role === 'qtitle' && qs[qi]) {
        const t = titleShape(s); if (t) { const p0 = aParas(t)[0]; aParas(t).slice(1).forEach(p => p.parentNode.removeChild(p)); aSet(p0, [{ t: `№${qi + 1}: ${qs[qi].q}`, b: null }]); autofit(t, qs[qi].q.length + 5, 60); }
        let box = contentBox(s);
        if (!box && protoBox) { box = s.doc.importNode(protoBox, true); const tree = all(s.doc, P, 'spTree')[0]; const maxId = Math.max(1, ...all(s.doc, P, 'cNvPr').map(c => +c.getAttribute('id') || 0)); all(box, P, 'cNvPr')[0].setAttribute('id', maxId + 1); tree.appendChild(box); }
        if (box) { const L = take(qi, capOf(s, box, 6)); aFillLines(box, L.length ? L.map(l => '• ' + l) : ['• [короткий зміст питання]'], { cap: 240 }); }
      }
      else if (s.role === 'qcont' && qs[qi]) { const box = contentBox(s); const L = box ? take(qi, capOf(s, box)) : []; if (box && L.length) aFillLines(box, L.map(l => '• ' + l), { cap: 240 }); }
      else if (s.role === 'qcheck' && qs[qi]) {
        const t = titleShape(s); if (t && s.isNew) { const p0 = aParas(t)[0]; aSet(p0, [{ t: `ЗАПИТАННЯ ПО ${ORD[qi] || (qi + 1) + '-МУ'} НАВЧАЛЬНОМУ ПИТАННЮ.`, b: null }]); }
        const qa = (x.checks || [])[qi] || { q: '', a: '' }; fillQA(SP, qa);
      }
      else if (s.role === 'finalcheck') fillQA(SP, { q: x.finalQ, a: x.finalA });
      else if (s.role === 'final') fillFinal(SP, x);
      else if (s.role === 'overview') { const box = contentBox(s); if (box) { const cap = capOf(s, box, 6); const items = qs.map((q, i) => `${i + 1}. ${q.q.length > 60 ? q.q.slice(0, 60).replace(/\s\S*$/, '') + '…' : q.q}`);
          const lines = cap >= items.length + 1 ? [[{ t: 'Навчальні питання:', b: true }], ...items.map(t => [{ t, b: false }])] : [[{ t: `Основна частина: ${qs.length} навчальн${qs.length === 1 ? 'е питання' : qs.length < 5 ? 'і питання' : 'их питань'}`, b: true }]];
          aFillLines(box, lines, { cap: 200 }); } }
    }
    // write slides
    for (const s of list) zip.file(s.path, ser(s.doc));
    // presentation.xml, rels, content types
    let pres = presXml, rels = await zip.file('ppt/_rels/presentation.xml.rels').async('string'), ct = await zip.file('[Content_Types].xml').async('string');
    for (const s of removed) {
      rels = rels.replace(new RegExp(`<Relationship[^>]*Id="${s.rid}"[^>]*/>`), '');
      zip.remove(s.path); const rp = s.path.replace('slides/', 'slides/_rels/') + '.rels'; if (zip.file(rp)) zip.remove(rp);
      ct = ct.replace(new RegExp(`<Override[^>]*PartName="/${s.path.replace(/\./g, '\\.')}"[^>]*/>`), '');
    }
    let ids = '', nid = 1000;
    for (const s of list) {
      if (s.isNew) {
        s.rid = 'rIdYk' + (nid); rels = rels.replace('</Relationships>', `<Relationship Id="${s.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="${s.path.replace('ppt/', '')}"/></Relationships>`);
        ct = ct.replace('</Types>', `<Override PartName="/${s.path}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`);
        s.id = String(3000 + nid); nid++;
      }
      ids += `<p:sldId id="${s.id}" r:id="${s.rid}"/>`;
    }
    pres = pres.replace(/<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/, `<p:sldIdLst>${ids}</p:sldIdLst>`).replace(/<p14:sectionLst[\s\S]*?<\/p14:sectionLst>/, '');
    zip.file('ppt/presentation.xml', pres); zip.file('ppt/_rels/presentation.xml.rels', rels); zip.file('[Content_Types].xml', ct);
    if (zip.file('docProps/app.xml')) { zip.remove('docProps/app.xml'); ct = ct.replace(/<Override[^>]*PartName="\/docProps\/app\.xml"[^>]*\/>/, ''); zip.file('[Content_Types].xml', ct); const rr = await zip.file('_rels/.rels').async('string'); zip.file('_rels/.rels', rr.replace(/<Relationship[^>]*Target="docProps\/app\.xml"[^>]*\/>/, '')); }
    return { blob: await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 }, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), slides: list.length };
  }
  function fillTopic(SP, d, summary) {
    const [thN, thName] = splitNum(d.theme), [lsN, lsName] = splitNum(d.lesson);
    for (const sp of SP) {
      const ps = aParas(sp); if (!ps.some(p => /^\s*Тема/i.test(norm(pText(p))))) continue;
      let qStart = -1;
      ps.forEach((p, i) => {
        const t = norm(pText(p));
        if (/^Тема(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(t)) aSet(p, [{ t: `Тема ${thN || ''}. `.replace(' .', '.'), b: true }, { t: thName, b: false }]);
        else if (/^Заняття(?![А-ЯІЇЄҐа-яіїєґ'’])/i.test(t)) aSet(p, [{ t: `Заняття ${lsN || ''}. `.replace(' .', '.'), b: true }, { t: lsName, b: false }]);
        else if (/^Мета заняття/i.test(t)) aSet(p, [{ t: 'Мета заняття: ', b: true }, { t: d.goal, b: false }]);
        else if (/^Навчальні питання/i.test(t)) qStart = i;
      });
      if (qStart >= 0) {
        const after = ps.slice(qStart + 1); const tb = ps[qStart].parentNode; const proto = ps[qStart].cloneNode(true);
        after.forEach(p => tb.removeChild(p));
        d.questions.forEach((q, i) => { const np = proto.cloneNode(true); tb.appendChild(np); aSet(np, [{ t: `${i + 1}. ${q.q}`, b: false, i: false }]); });
      }
      autofit(sp, aText(sp).length, summary ? 520 : 420);
    }
  }
  function fillPlan(SP, d) {
    for (const sp of SP) {
      const ps = aParas(sp); if (!ps.some(p => /^\s*Місце/i.test(norm(pText(p))))) continue;
      let nums = [];
      ps.forEach(p => {
        const t = norm(pText(p));
        if (/^Місце/i.test(t)) aSet(p, [{ t: 'Місце – ', b: null }, { t: d.place, b: false, i: false }]);
        else if (/^Час/i.test(t)) aSet(p, [{ t: 'Час – ', b: null }, { t: d.time, b: false, i: false }]);
        else if (/^Метод/i.test(t)) aSet(p, [{ t: 'Метод – ', b: null }, { t: d.method, b: false, i: false }]);
        else if (/^\d+\.\s*$/.test(t)) nums.push(p);
      });
      if (nums.length) {
        const last = nums[nums.length - 1];
        let after = last; for (let i = nums.length; i < d.questions.length; i++) { const c = last.cloneNode(true); after.parentNode.insertBefore(c, after.nextSibling); after = c; nums.push(c); }
        nums.forEach((p, i) => { if (i < d.questions.length) aSet(p, [{ t: `${i + 1}. ${d.questions[i].q}`, b: null }]); else p.parentNode.removeChild(p); });
      }
      autofit(sp, aText(sp).length, 520);
    }
  }
  function fillEval(SP, x) {
    for (const sp of SP) {
      const ps = aParas(sp);
      ps.forEach(p => {
        const t = norm(pText(p));
        if (/^УМОВИ ОЦІНЮВАННЯ/i.test(t)) aSet(p, [{ t: 'УМОВИ ОЦІНЮВАННЯ – ', b: null }, { t: x.evalCond || '', b: false, i: false }]);
        if (/^КРИТЕРІЇ ОЦІНЮВАННЯ/i.test(t)) aSet(p, [{ t: 'КРИТЕРІЇ ОЦІНЮВАННЯ – ', b: null }, { t: x.evalCrit || '', b: false, i: false }]);
      });
      if (ps.some(p => /ОЦІНЮВАННЯ/i.test(pText(p)))) autofit(sp, aText(sp).length, 520);
    }
  }
  function fillQA(SP, qa) {
    for (const sp of SP) {
      const ps = aParas(sp); const iq = ps.findIndex(p => /^Запитання/i.test(norm(pText(p)))), ia = ps.findIndex(p => /^Відповідь/i.test(norm(pText(p))));
      if (iq < 0 || ia < 0) continue;
      aSet(ps[iq], [{ t: 'Запитання: ', b: true }, { t: qa.q || '', b: false }]);
      aSet(ps[ia], [{ t: 'Відповідь: ', b: true }, { t: qa.a || '', b: false }]);
      autofit(sp, ((qa.q || '') + (qa.a || '')).length, 200);
    }
  }
  function fillFinal(SP, x) {
    for (const sp of SP) {
      const ps = aParas(sp);
      ps.forEach(p => {
        const raw = pText(p), t = norm(raw), tab = /^\t/.test(raw) ? '\t' : '';
        if (/^Завдання на самостійну підготовку/i.test(t)) aSet(p, [{ t: tab + 'Завдання на самостійну підготовку: ', b: null }, { t: x.selfTask || '', b: false }]);
        if (/^Наступне заняття/i.test(t)) aSet(p, [{ t: tab + 'Наступне заняття: ', b: null }, { t: x.next || '', b: false }]);
      });
    }
  }

  /* parse a FILLED 158-style presentation into sheet data */
  async function parsePresentation(buf) {
    const zip = await JSZip.loadAsync(buf); const list = await slideList(zip);
    const d = { subject: '', theme: '', lesson: '', goal: '', time: '', place: '', method: '', materials: '', literature: '', questions: [], final: '' };
    let cur = null, found = false;
    for (const s of list) {
      const doc = parse(await zip.file(s.path).async('string')); const SP = shapes(doc);
      const lines = SP.flatMap(sp => aParas(sp).map(p => norm(pText(p)))).filter(Boolean);
      const U = lines.join(' | ').toUpperCase();
      for (const t of lines) {
        let m;
        if ((m = t.match(/^Тема\s*(\d*)\.?\s*(.+)$/i)) && !d.theme) d.theme = norm((m[1] ? m[1] + '. ' : '') + m[2]);
        if ((m = t.match(/^Заняття\s*(\d*)\.?\s*(.+)$/i)) && !d.lesson) d.lesson = norm((m[1] ? m[1] + '. ' : '') + m[2]);
        if ((m = t.match(/^Мета заняття\s*:\s*(.+)$/i)) && !d.goal) d.goal = m[1];
        if ((m = t.match(/^Місце\s*[–-]\s*(.+)$/i))) d.place = m[1];
        if ((m = t.match(/^Час\s*[–-]\s*(.+)$/i))) d.time = m[1];
        if ((m = t.match(/^Метод\s*[–-]\s*(.+)$/i))) d.method = m[1];
      }
      const tq = lines.map(t => t.match(/^(?:Навчальне питання\s*)?№\s*(\d+)\s*[:.]?\s*(.*)$/i)).find(Boolean);
      if (tq) { found = true; cur = { q: tq[2] || '', c: [] }; d.questions[+tq[1] - 1] = cur; lines.filter(t => !/^(?:Навчальне питання\s*)?№\s*\d+/i.test(t) && !/^Відкрита інформація/i.test(t)).forEach(t => cur.c.push(t.replace(/^[•▪–-]\s*/, ''))); continue; }
      if (/ЗАПИТАННЯ ПО|ПЕРЕВІРКА ЗНАНЬ|ПІДВЕДЕННЯ|КІНЦЕВІ|КІНЕЦЬ/.test(U)) { cur = null; continue; }
      if (cur) lines.filter(t => !/^Відкрита інформація/i.test(t)).forEach(t => cur.c.push(t.replace(/^[•▪–-]\s*/, '')));
    }
    d.questions = d.questions.filter(Boolean).map(q => ({ q: q.q || '[навчальне питання]', c: q.c.map(l => '– ' + l).join('\n') }));
    return (found && (d.theme || d.questions.some(q => q.c))) ? d : null;
  }

  return { slideList, fillDocx, fillPptx, parseKonspekt, parsePresentation, presTexts, isKonspektTemplate, isPresTemplate, wText, norm };
})();
