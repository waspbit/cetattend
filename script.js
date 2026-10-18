// ===== CONFIG: paste your Apps Script Web app URL (ends in /exec) =====
const API_URL = 'https://script.google.com/macros/s/AKfycbx4hFJMP8-ALAB0-IVZAqqC1MJTW4s3LLjZE8nb4zcVO7QJulv9slApBiaywZjFBywaBQ/exec';

const $ = id => document.getElementById(id);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const fmt = n => String(Math.round(n * 100) / 100);

/* Theme (follows device by default; toggle is remembered when storage is allowed) */
(function(){
  let t = null; try { t = localStorage.getItem('cet-theme'); } catch(e){}
  if (!t && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) t = 'dark';
  if (t) document.documentElement.setAttribute('data-theme', t);
})();
$('themeBtn').onclick = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('cet-theme', next); } catch(e){}  // theme only, never student data
};

function toast(m){ const t=$('toast'); t.textContent=m; t.hidden=false; setTimeout(()=>t.hidden=true,2800); }
function fieldErr(f, e, msg){ $(f).classList.toggle('invalid', !!msg); $(e).textContent = msg || ''; }
function formErr(msg){ const a=$('loginErr'); a.textContent = msg || ''; a.hidden = !msg; }

fetch(API_URL + '?action=courses')
  .then(r => r.json())
  .then(d => {
    const s = $('course'); s.textContent = '';
    s.appendChild(new Option('Select your course', ''));
    d.courses.forEach(c => s.appendChild(new Option(c, c)));
    if (!d.courses.length) { s.textContent=''; s.appendChild(new Option('No courses found', '')); }
    if (d.courses.length === 1) s.value = d.courses[0];
  })
  .catch(() => { $('course').textContent=''; $('course').appendChild(new Option('Could not load courses', '')); });

function setLoading(on){ $('loginBtn').disabled = on; $('loginBtn').classList.toggle('loading', on); $('loginTxt').textContent = on ? 'Checking…' : 'Log in'; }

function login(){
  formErr(''); fieldErr('fId','eId',''); fieldErr('fCourse','eCourse','');
  const id = $('sid').value.trim(), course = $('course').value;
  let bad = false;
  if (!id) { fieldErr('fId','eId','Enter your Student ID.'); bad = true; }
  if (!course) { fieldErr('fCourse','eCourse','Select your course.'); bad = true; }
  if (bad) return;
  setLoading(true);
  showSkeleton();
  fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ studentId: id, course: course }) })
    .then(r => r.json())
    .then(r => { setLoading(false); r.ok ? render(r.student) : (hideSkeleton(), formErr(r.message)); })
    .catch(() => { setLoading(false); hideSkeleton(); formErr('Could not reach the server. Check your connection and try again.'); });
}

function showSkeleton(){ $('loginErr').hidden = true; }
function hideSkeleton(){}

/* 90 -> "1 hr 30 mins", 30 -> "30 mins", 120 -> "2 hrs". Zero hours are left out. */
function fmtDur(min){
  min = Math.max(0, Math.round(min || 0));
  const h = Math.floor(min / 60), m = min % 60, parts = [];
  if (h > 0) parts.push(h + (h === 1 ? ' hr' : ' hrs'));
  if (m > 0) parts.push(m + (m === 1 ? ' min' : ' mins'));
  return parts.length ? parts.join(' ') : '0 mins';
}

function mins(s, k){ return s[k + 'Min'] != null ? s[k + 'Min'] : Math.round((s[k] || 0) * 60); }

function showStatus(s){
  const t = { exempt: 'Fully Exempt', required: 'Penalty Required', none: 'No Penalty' }[s.status];
  const m = s.status === 'exempt'
    ? 'Your recognized privilege qualifies you for full exemption from cleanup-drive penalties.'
    : s.status === 'required'
    ? 'Your required cleanup-drive penalty is ' + fmtDur(mins(s, 'requiredPenalty')) + '.'
    : 'You have no outstanding penalty hours.';
  $('mTitle').textContent = t; $('mMsg').textContent = m;
  $('mIcon').textContent = s.status === 'required' ? '!' : '\u2713';
  document.querySelector('.modal-box').className = 'modal-box ' + s.status;
  $('modal').hidden = false; $('mClose').focus();
}
function closeModal(){ $('modal').hidden = true; }

function stat(v, l){ const c = el('div','card stat'); c.appendChild(el('div','v',v)); c.appendChild(el('div','l',l)); return c; }
function rows(dl, pairs){ dl.textContent=''; pairs.forEach(([k,v]) => { dl.appendChild(el('dt',null,k)); dl.appendChild(el('dd',null,v)); }); }

function render(s){
  $('loginView').hidden = true; $('dashView').hidden = false; $('logoutBtn').hidden = false;
  $('welcome').textContent = 'Welcome, ' + (s.name || 'Student');
  $('subline').textContent = s.studentId + ' · ' + s.course;

  showStatus(s);

  const stats = $('stats'); stats.textContent = '';
  stats.append(stat(s.totalEvents,'Total events'), stat(s.attended,'Total attendance'),
               stat(s.absent,'Non-attendance'), stat(s.rate == null ? '—' : s.rate + '%','Attendance rate'));


  rows($('profile'), [['Full name', s.name || '—'], ['Student ID', s.studentId], ['Course', s.course],
    ['Privilege', s.privileges.length ? s.privileges.map(p => p.name).join(', ') : 'None']]);

  rows($('penalty'), [['Total penalty hours', fmtDur(mins(s, 'totalPenalty'))],
    ['Exemption status', s.status === 'exempt' ? 'Fully Exempt' : s.status === 'required' ? 'Penalty Required' : 'No Penalty'],
    ['Required penalty hours', fmtDur(mins(s, 'requiredPenalty'))]]);

  const pv = $('privs'); pv.textContent = '';
  if (!s.privileges.length) pv.appendChild(el('span','hint','No privileges recorded.'));
  s.privileges.forEach(p => pv.appendChild(el('span','badge ' + (p.recognized ? 'b-ok' : 'b-mute'), p.name + (p.recognized ? '' : ' (not exempting)'))));
  window.scrollTo(0,0);
}

function logout(){
  closeModal();
  ['stats','profile','penalty','privs','welcome','subline'].forEach(i => $(i).textContent = '');
  $('sid').value = ''; formErr('');
  $('dashView').hidden = true; $('logoutBtn').hidden = true; $('loginView').hidden = false;
  toast('You have been logged out.');
}

$('mClose').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
$('loginBtn').onclick = login;
$('logoutBtn').onclick = logout;
$('sid').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

 safely("year", () => { $("year").textContent = new Date().getFullYear(); });
