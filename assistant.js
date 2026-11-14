/* Voice assistant — answers questions about the portfolio using its own data.
   Uses the browser's speech recognition (where available) and speech synthesis. No server, no API key. */
(function(){
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const SPEECH_LANG = {en:'en-IN', hi:'hi-IN', mr:'mr-IN', gu:'gu-IN', ta:'ta-IN'};
const el = id => document.getElementById(id);
let rec = null, listening = false;

/* keywords per intent, across all five languages (lower-case) */
const K = {
  greet:    ['hello','hi ','hey','namaste','नमस्ते','नमस्कार','નમસ્તે','வணக்கம்'],
  about:    ['who','about','introduce','yourself','tell me','asheesh','कौन','परिचय','बारे','कोण','बद्दल','કોણ','વિશે','யார்','பற்றி'],
  skills:   ['skill','technolog','tech','stack','language','tools','framework','टेक्नोलॉजी','टेक','स्किल','तंत्रज्ञान','स्टॅक','ટેક્નોલોજી','ટેક','સ્કિલ','தொழில்நுட்ப','திறன்'],
  current:  [' now','right now','current','working on','building','latest','अभी','बना रहे','सध्या','बनवत','હાલ','બનાવ','இப்போது','உருவாக்கு'],
  projects: ['project','portfolio','work','built','प्रोजेक्ट','काम','પ્રોજેક્ટ','திட்ட'],
  exp:      ['experience','job','company','career','employ','अनुभव','नौकरी','कंपनी','नोकरी','અનુભવ','નોકરી','કંપની','அனுபவ','வேலை','நிறுவன'],
  edu:      ['education','degree','study','college','mca','qualification','शिक्षा','पढ़ाई','डिग्री','शिक्षण','શિક્ષણ','ડિગ્રી','கல்வி','பட்ட'],
  certs:    ['certif','nptel','course','सर्टिफ़िकेट','सर्टिफिकेट','प्रमाणपत्र','પ્રમાણપત્ર','சான்றிதழ்'],
  services: ['service','offer','provide','what can he do','सेवा','सर्विस','સેવા','சேவை'],
  contact:  ['contact','hire','email','mail','phone','call','reach','संपर्क','हायर','ईमेल','फ़ोन','फोन','ઈમેલ','ફોન','સંપર્ક','தொடர்பு','மின்னஞ்சல்'],
  wa:       ['whatsapp','व्हाट्सएप','व्हॉट्सॲप','વોટ્સએપ','வாட்ஸ்அப்'],
  donate:   ['donate','donation','support','upi','pay','chai','दान','सपोर्ट','चाय','पाठिंबा','चहा','સપોર્ટ','ચા','ஆதரவு','நன்கொடை'],
  dark:     ['dark','डार्क','अंधेरा','ડાર્ક','இருள்'],
  light:    ['light mode','light theme','लाइट','લાઇટ','வெளிர்']
};
const LANG_WORDS = {
  en:['english','इंग्लिश','अंग्रेज़ी','अंग्रेजी','ઇંગ્લિશ','ஆங்கிலம்'],
  hi:['hindi','हिंदी','हिन्दी','હિન્દી','ஹிந்தி','இந்தி'],
  mr:['marathi','मराठी','મરાઠી','மராத்தி'],
  gu:['gujarati','गुजराती','ગુજરાતી','குஜராத்தி'],
  ta:['tamil','तमिल','તમિલ','தமிழ்']
};
const has = (q, list) => list.some(w => q.includes(w));
const strip = h => String(h).replace(/<[^>]+>/g, '');
const join = a => a.filter(Boolean).join(', ');
const go = id => { const s = el(id); if (s) s.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); };

function answer(raw){
  const q = ' ' + raw.toLowerCase().trim() + ' ';
  if (!D) return t('load_fail');
  const P = profile(), PR = D.PR, SK = D.SK;

  // language switch
  for (const [code, words] of Object.entries(LANG_WORDS)) {
    if (has(q, words) && (code !== LANG)) { setLang(code); return t('a_lang'); }
  }
  // theme switch
  if (has(q, K.dark) && !has(q, K.projects)) { setMode('dark'); return t('a_theme_dark'); }
  if (has(q, K.light)) { setMode('light'); return t('a_theme_light'); }

  // a specific project by name
  const proj = PR.find(p => { const n = p.title.toLowerCase().split(/[–—(]/)[0].trim(); return n.length > 2 && q.includes(n); });
  if (proj) {
    go('work');
    return t('a_project', {title: proj.title, desc: proj.description || '', status: t('st_' + (proj.status || 'live'))});
  }
  if (has(q, K.wa)) { const a = el('hWa'); if (a && a.href.startsWith('http')) window.open(a.href, '_blank', 'noopener'); return t('a_wa'); }
  if (has(q, K.donate) && P.upi) { go('support'); return t('a_donate', {upi: P.upi}); }
  if (has(q, K.contact)) { go('contact'); return t('a_contact', {email: P.email}); }
  if (has(q, K.certs) && D.CE.length) { go('experience'); return t('a_certs', {list: join(D.CE.map(c => c.title + (c.issuer ? ' (' + c.issuer + ')' : '')))}); }
  if (has(q, K.edu)) { go('experience'); return t('a_edu', {list: join(D.ED.map(e => e.degree))}); }
  if (has(q, K.exp)) {
    go('experience');
    const cur = D.EX.find(x => x.current) || D.EX[0], prev = D.EX.find(x => x !== cur);
    const line = x => strip(t('role_line', {role: x.title, company: x.company}));
    return prev ? t('a_exp', {cur: line(cur), prev: line(prev)}) : line(cur) + '.';
  }
  if (has(q, K.current)) {
    const b = PR.filter(p => p.status === 'building');
    return b.length ? t('a_current', {list: join(b.map(p => p.title + (p.tech ? ' (' + p.tech.replace(/\s*·\s*/g, ', ') + ')' : '')))}) : t('a_none_current');
  }
  // a specific technology
  const tech = SK.find(s => { const n = s.name.toLowerCase().replace(/\.js$/, ''); return n.length > 1 && new RegExp('(^|[^a-z])' + n.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&') + '([^a-z]|$)').test(q); });
  if (tech && !has(q, ['stack','technolog','skills'])) {
    const n = tech.name.toLowerCase().replace(/\.js$/, '').split(' ')[0];
    const uses = PR.filter(p => (p.tech + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(n)).slice(0, 3).map(p => p.title);
    return t('a_tech_yes', {tech: tech.name}) + (uses.length ? ' ' + t('a_tech_eg', {list: join(uses)}) : '');
  }
  const unknown = q.match(/(?:know|use|work with|worked with|experience (?:in|with))\s+([a-z][a-z0-9.+#-]{1,20})/);
  if (unknown && !['the','his','your','about','any','it','this','that','tech','technologies','skills'].includes(unknown[1])) return t('a_tech_no', {tech: unknown[1].replace(/^./, c => c.toUpperCase())});
  if (has(q, K.skills)) { go('stack'); return t('a_skills', {list: join(P.core && P.core.length ? P.core : SK.slice(0, 10).map(s => s.name))}); }
  if (has(q, K.services)) { go('about'); return t('a_services', {list: join((P.services || []).map(s => s.title))}); }
  if (has(q, K.projects)) {
    go('work');
    const top = PR.filter(p => p.featured).slice(0, 4).map(p => p.title);
    return t('a_projects', {n: PR.length, list: join(top)});
  }
  if (has(q, K.about)) { go('about'); return t('a_about', {name: P.name, role: P.tagline, company: P.company || '', desc: P.hero_desc || ''}); }
  if (has(q, K.greet) || q.trim().length < 4) return t('a_greet');
  return t('a_fallback');
}

/* ── speech out ── */
function speak(text){
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const code = SPEECH_LANG[LANG] || 'en-IN';
  u.lang = code;
  const voices = speechSynthesis.getVoices();
  const v = voices.find(v => v.lang === code) || voices.find(v => v.lang && v.lang.startsWith(code.slice(0, 2)));
  if (v) u.voice = v;
  u.rate = 1;
  speechSynthesis.speak(u);
}

/* ── chat log ── */
function add(who, text){
  const log = el('vaLog');
  const b = document.createElement('div');
  b.className = 'vab ' + who;
  b.textContent = text;
  log.appendChild(b);
  log.scrollTop = log.scrollHeight;
}
function ask(text){
  text = String(text || '').trim();
  if (!text) return;
  add('me', text);
  const a = answer(text);
  setTimeout(() => { add('bot', a); speak(a); }, 150);
}

/* ── speech in ── */
function setMic(on){
  listening = on;
  const m = el('vaMic');
  m.classList.toggle('on', on);
  m.setAttribute('aria-pressed', on);
  m.setAttribute('aria-label', t(on ? 'va_stop' : 'va_mic'));
  el('vaStatus').textContent = on ? t('a_listening') : '';
}
function listen(){
  if (!SR) { add('bot', t('a_unsupported')); el('vaInput').focus(); return; }
  if (listening) { rec && rec.stop(); return; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  rec = new SR();
  rec.lang = SPEECH_LANG[LANG] || 'en-IN';
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = '';
  rec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
    }
    el('vaStatus').textContent = (final + interim) || t('a_listening');
  };
  rec.onerror = e => {
    setMic(false);
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') add('bot', t('a_mic_denied'));
  };
  rec.onend = () => { setMic(false); if (final.trim()) ask(final); };
  setMic(true);
  try { rec.start(); } catch (e) { setMic(false); }
}

/* ── panel ── */
function open(on){
  el('vaPanel').hidden = !on;
  el('vaFab').setAttribute('aria-expanded', on);
  if (on) {
    if (!el('vaLog').children.length) add('bot', t('a_greet'));
    el('vaMic').focus();
  } else {
    if (rec && listening) rec.stop();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
}
el('vaFab').onclick = () => open(el('vaPanel').hidden);
el('vaClose').onclick = () => { open(false); el('vaFab').focus(); };
el('vaMic').onclick = listen;
el('vaForm').onsubmit = e => { e.preventDefault(); const i = el('vaInput'); ask(i.value); i.value = ''; };
el('vaChips').onclick = e => { const b = e.target.closest('button'); if (b) ask(b.textContent); };
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !el('vaPanel').hidden) { open(false); el('vaFab').focus(); } });
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => {};
if (!SR) el('vaMic').title = t('a_unsupported');
})();
