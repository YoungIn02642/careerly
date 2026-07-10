/* ════════════════════════════════════════════════════════════
   CAREERLY · Home interactions + Tweaks (Wanted-style landing)
   ════════════════════════════════════════════════════════════ */

/* ── 멘토링 계열 화면도 이제 같은 라우터를 쓴다. 기존 호출부 호환용 별칭. ── */
function openMentoring(sub) { navigate(sub || 'dashboard'); }
window.openMentoring = openMentoring;

/* ── job carousel ───────────────────────────────────────── */
function railScroll(dir) {
  const rail = document.getElementById('job-rail');
  if (!rail) return;
  rail.scrollBy({ left: dir * 332, behavior: 'smooth' });
}
window.railScroll = railScroll;

/* ── scroll to insights ─────────────────────────────────── */
function goInsights() {
  const go = () => {
    const el = document.getElementById('insights-sec');
    if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: 'smooth' });
  };
  const main = document.getElementById('page-main');
  if (main && main.classList.contains('active')) { go(); }
  else { navigate('main'); setTimeout(go, 60); }
}
window.goInsights = goInsights;

/* ── main page hook (called by app.js showPage) ─────────── */
function renderHome() { applyTweaks(); refreshStartFree(); }
window.renderHome = renderHome;

/* ── "무료로 시작하기" — 로그인 상태별 동작 ───────────────── */
function currentUser() {
  try { return window.DB && DB.currentUser ? DB.currentUser() : null; } catch (e) { return null; }
}
function startFree() {
  if (currentUser()) navigate('mypage');   // 이미 로그인 → 내 대시보드(마이페이지)
  else navigate('signup');                 // 비로그인 → 회원가입
}
window.startFree = startFree;
function refreshStartFree() {
  const logged = !!currentUser();
  document.querySelectorAll('.js-start-free').forEach(b => {
    b.textContent = logged ? '내 대시보드 보기' : '무료로 시작하기';
  });
}
window.refreshStartFree = refreshStartFree;

/* ════════════════════════════════════════════════════════════
   NOTIFICATIONS — 종 아이콘 드롭다운 + 빨간점 (localStorage)
   ════════════════════════════════════════════════════════════ */
const NOTI_KEY = 'careerly_notifications_read';
const NOTIFICATIONS = [
  { ic: '🤝', title: '멘토링 신청이 승인되었습니다.', time: '10분 전', go: 'mentoring' },
  { ic: '✨', title: '새로운 추천 멘토가 도착했습니다.', time: '1시간 전', go: 'search' },
  { ic: '✍️', title: '작성하지 않은 멘토링 후기가 있습니다.', time: '어제', go: 'mentoring' },
  { ic: '🗺️', title: '커리어 로드맵이 업데이트되었습니다.', time: '2일 전', go: 'career' },
];
function notiIsRead() { return localStorage.getItem(NOTI_KEY) === 'true'; }
function syncNotiDot() {
  const dot = document.getElementById('noti-dot');
  if (dot) dot.classList.toggle('on', !notiIsRead());
}
function buildNotiPanel() {
  const panel = document.getElementById('noti-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="noti-head">
      <span class="noti-head-title">알림</span>
      <span class="noti-head-clear" onclick="markNotiRead()">모두 읽음</span>
    </div>
    <div class="noti-list">
      ${NOTIFICATIONS.map((n, i) => `
        <div class="noti-item ${notiIsRead() ? '' : 'unread'}" onclick="notiClick(${i})">
          <div class="noti-item-ic">${n.ic}</div>
          <div class="noti-item-body">
            <div class="noti-item-title">${n.title}</div>
            <div class="noti-item-time">${n.time}</div>
          </div>
        </div>`).join('')}
    </div>`;
}
function toggleNoti(e) {
  if (e) e.stopPropagation();
  const panel = document.getElementById('noti-panel');
  if (!panel) return;
  const willOpen = !panel.classList.contains('on');
  if (willOpen) { buildNotiPanel(); markNotiRead(); }
  panel.classList.toggle('on', willOpen);
}
window.toggleNoti = toggleNoti;
function markNotiRead() {
  localStorage.setItem(NOTI_KEY, 'true');
  syncNotiDot();
  document.querySelectorAll('#noti-panel .noti-item').forEach(el => el.classList.remove('unread'));
}
window.markNotiRead = markNotiRead;
function notiClick(i) {
  document.getElementById('noti-panel').classList.remove('on');
  const n = NOTIFICATIONS[i];
  if (n && n.go) navigate(n.go);
}
window.notiClick = notiClick;
document.addEventListener('click', e => {
  const panel = document.getElementById('noti-panel');
  const wrap = e.target.closest('.noti-wrap');
  if (panel && panel.classList.contains('on') && !wrap) panel.classList.remove('on');
});

/* ════════════════════════════════════════════════════════════
   TWEAKS — home direction + accent
   ════════════════════════════════════════════════════════════ */
const TW = Object.assign({ homeDir: 'a', accent: 'both' }, window.TWEAKS || {});

function applyTweaks() {
  const b = document.body;
  b.classList.remove('dir-a', 'dir-b', 'dir-c', 'acc-purple', 'acc-blue');
  b.classList.add('dir-' + TW.homeDir);
  if (TW.accent === 'purple') b.classList.add('acc-purple');
  else if (TW.accent === 'blue') b.classList.add('acc-blue');
  // sync panel segmented controls
  syncSeg('tw-dir', TW.homeDir);
  syncSeg('tw-acc', TW.accent);
}
function syncSeg(id, val) {
  const seg = document.getElementById(id);
  if (!seg) return;
  seg.querySelectorAll('button').forEach(btn => btn.classList.toggle('on', btn.dataset.v === val));
}
function setTweak(key, val) {
  TW[key] = val;
  applyTweaks();
  try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*'); } catch (e) {}
}

/* panel show / hide */
function openTweaks()  { document.getElementById('tweaks-panel').classList.add('on'); }
function closeTweaks() {
  document.getElementById('tweaks-panel').classList.remove('on');
  try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
}
window.closeTweaks = closeTweaks;

/* host protocol — listener first, then announce */
window.addEventListener('message', e => {
  const t = e.data && e.data.type;
  if (t === '__activate_edit_mode')   openTweaks();
  if (t === '__deactivate_edit_mode') document.getElementById('tweaks-panel').classList.remove('on');
});

document.addEventListener('DOMContentLoaded', () => {
  applyTweaks();
  refreshStartFree();
  syncNotiDot();
  // wire segmented controls
  const dir = document.getElementById('tw-dir');
  const acc = document.getElementById('tw-acc');
  if (dir) dir.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => setTweak('homeDir', btn.dataset.v)));
  if (acc) acc.querySelectorAll('button').forEach(btn =>
    btn.addEventListener('click', () => setTweak('accent', btn.dataset.v)));
  // announce availability
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
});
