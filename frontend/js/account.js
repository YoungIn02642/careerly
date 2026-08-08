// ════════════════════════════════════════════════════════════
//  CAREERLY — 계정 관리 (마이페이지 › 계정 관리 탭)
//
//  ── 어디에 저장되나 ──
//  이름·이메일은 users 테이블(회원가입 때 받은 값)이고, 나머지는 profiles 다.
//  **이름·이메일은 여기서 고치지 않는다** — 이름은 본인확인과 맞물려 있고,
//  이메일은 로그인 계정 식별에 쓰인다. 화면에는 읽기 전용으로 보여만 준다.
//
//  ── 사진 ──
//  파일 서버가 없어서 브라우저에서 256px 로 줄여 base64 로 저장한다(profiles.avatar).
//  디스크에 두면 Railway 재배포 때 사라진다. 서버도 형식·용량을 다시 검사한다 —
//  여기 줄이는 코드는 우회할 수 있기 때문이다.
// ════════════════════════════════════════════════════════════
window.Account = (() => {

  const AVATAR_PX = 256;          // 프로필 사진 한 변 (원형으로 잘라 쓴다)
  const AVATAR_QUALITY = 0.82;    // JPEG 품질 — 256px 에서 이 정도면 눈에 띄는 손실이 없다

  const GENDERS = [
    { id: '',       label: '선택 안 함' },
    { id: 'male',   label: '남성' },
    { id: 'female', label: '여성' },
    { id: 'other',  label: '기타' },
  ];

  let avatarState = null;         // 현재 편집 중인 사진 (data URL) · null = 없음

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── 진입점 ──────────────────────────────────────────────────
  async function render(container, user) {
    container.innerHTML = `<div class="sf-hint-inline">불러오는 중…</div>`;
    const p = (await DB.getProfile()) || {};

    avatarState = p.avatar || null;

    /* 연락처는 비어 있으면 본인인증 번호를 기본값으로 채운다.
       인증값(users.phone)은 신원 확인용이라 그대로 두고, 여기서 고친 값은
       profiles.phone 에 따로 저장된다 — 연락처를 바꿔도 중복가입 차단은 유지된다. */
    const phone = p.phone || user.phoneMasked || '';

    container.innerHTML = `
      <div class="sf-head">
        <h1>계정 관리</h1>
        <p class="sf-sub">이름과 이메일은 가입할 때 받은 정보예요. 나머지는 자유롭게 채우거나 비워둘 수 있습니다.</p>
      </div>

      <div class="success-box" id="ac-success">저장했어요.</div>
      <div class="error-box"   id="ac-error"></div>

      <div class="sf-section">
        <div class="sf-section-title"><i class="ti ti-camera"></i>프로필 사진</div>
        <div class="ac-avatar-row">
          <div class="ac-avatar" id="ac-avatar-preview">${avatarImg(avatarState, user)}</div>
          <div class="ac-avatar-actions">
            <input type="file" id="ac-avatar-file" accept="image/png,image/jpeg,image/webp" hidden />
            <button type="button" class="btn-inline" id="ac-avatar-pick">사진 올리기</button>
            <button type="button" class="btn-inline" id="ac-avatar-clear"
                    ${avatarState ? '' : 'hidden'}>삭제</button>
            <span class="field-hint">정사각형으로 잘려요. ${AVATAR_PX}px 로 줄여서 저장합니다.</span>
          </div>
        </div>
      </div>

      <div class="sf-section">
        <div class="sf-section-title"><i class="ti ti-id"></i>기본 정보</div>

        <div class="sf-row-2">
          <div class="form-group">
            <label>이름</label>
            <input type="text" value="${esc(user.name || '')}" readonly />
            <span class="field-hint">가입할 때 받은 이름이에요.</span>
          </div>
          <div class="form-group">
            <label>이메일</label>
            <input type="email" value="${esc(user.email || '')}" readonly />
            <span class="field-hint">로그인 계정과 연결돼 있어 바꿀 수 없어요.</span>
          </div>
        </div>

        <div class="sf-row-3">
          <!-- 별명은 users 에 있다(회원가입 때 받는다). 스펙 입력에 있던 것을
               여기로 옮겼다 — 채점되는 값이 아니라 '누구인지'에 가깝다. -->
          <div class="form-group">
            <label>별명</label>
            <input type="text" id="ac-nickname" value="${esc(user.nickname || '')}"
                   placeholder="2~20자" autocomplete="nickname" />
          </div>
          <div class="form-group">
            <label>성별</label>
            <select id="ac-gender">
              ${GENDERS.map(g =>
                `<option value="${g.id}" ${(p.gender || '') === g.id ? 'selected' : ''}>${g.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>생년월일</label>
            <input type="date" id="ac-birthdate" value="${esc(p.birthdate || '')}"
                   max="${new Date().toISOString().slice(0, 10)}" />
          </div>
        </div>
        <span class="field-hint">별명을 비워두면 다른 회원에게 이름을 가려서(홍*동) 보여줘요.</span>

        <div class="sf-row-2">
          <div class="form-group">
            <label>전화번호</label>
            <input type="tel" id="ac-phone" value="${esc(phone)}" placeholder="010-1234-5678" />
            ${user.verified
              ? `<span class="field-hint">본인인증한 번호와 달라도 괜찮아요. 연락받을 번호를 적어주세요.</span>`
              : ''}
          </div>
          <div class="form-group">
            <label>주소</label>
            <input type="text" id="ac-address" value="${esc(p.address || '')}"
                   placeholder="예: 서울시 강남구" />
          </div>
        </div>
      </div>

      <button class="btn-save"   id="ac-save">저장하기</button>
      <button class="btn-cancel" id="ac-cancel">취소</button>

      ${passwordSection(user)}
    `;

    bind(user);
    bindPassword(user);
  }

  /* 사진이 없으면 이름 첫 글자를 원 안에 띄운다 — 빈 회색 동그라미보다 낫다. */
  function avatarImg(src, user) {
    if (src) return `<img src="${esc(src)}" alt="프로필 사진" />`;
    const initial = (user.nickname || user.name || user.username || '?').trim().charAt(0);
    return `<span class="ac-avatar-initial">${esc(initial)}</span>`;
  }

  // ── 사진 ────────────────────────────────────────────────────
  /* 원본을 그대로 base64 로 만들면 5MB 사진이 7MB 문자열이 된다.
     정사각형으로 잘라 256px 로 줄이면 30KB 안팎이 된다. */
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('이미지 형식을 인식하지 못했어요.'));
        img.onload = () => {
          /* 짧은 변에 맞춰 가운데를 정사각형으로 잘라낸다. 안 자르고 늘이면
             얼굴이 찌그러진다. */
          const side = Math.min(img.width, img.height);
          const sx = (img.width - side) / 2;
          const sy = (img.height - side) / 2;

          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = AVATAR_PX;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
          /* PNG 로 두면 사진은 오히려 커진다. 투명도가 필요 없으므로 JPEG. */
          resolve(canvas.toDataURL('image/jpeg', AVATAR_QUALITY));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ── 이벤트 ──────────────────────────────────────────────────
  function bind(user) {
    const file = document.getElementById('ac-avatar-file');

    document.getElementById('ac-avatar-pick').addEventListener('click', () => file.click());

    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (!f) return;
      hideMsg();
      try {
        avatarState = await shrink(f);
        document.getElementById('ac-avatar-preview').innerHTML = avatarImg(avatarState, user);
        document.getElementById('ac-avatar-clear').hidden = false;
      } catch (e) {
        showErr(e.message);
      } finally {
        /* 같은 파일을 다시 골라도 change 가 나게 비워 둔다 —
           안 비우면 '삭제 후 같은 사진 다시 올리기'가 안 된다. */
        file.value = '';
      }
    });

    document.getElementById('ac-avatar-clear').addEventListener('click', () => {
      avatarState = null;
      document.getElementById('ac-avatar-preview').innerHTML = avatarImg(null, user);
      document.getElementById('ac-avatar-clear').hidden = true;
    });

    document.getElementById('ac-save').addEventListener('click', () => save());
    document.getElementById('ac-cancel').addEventListener('click', () => navigate('main'));
  }

  function hideMsg() {
    document.getElementById('ac-success').style.display = 'none';
    document.getElementById('ac-error').style.display = 'none';
  }
  function showErr(msg) {
    const el = document.getElementById('ac-error');
    el.textContent = msg;
    el.style.display = 'block';
    document.getElementById('ac-success').style.display = 'none';
  }

  // ── 저장 ────────────────────────────────────────────────────
  async function save() {
    hideMsg();
    const btn = document.getElementById('ac-save');

    const phone = document.getElementById('ac-phone').value.trim();
    /* 가려진 번호(010-****-5678)를 그대로 저장하면 연락할 수 없는 값이 남는다.
       기본값을 손대지 않았다는 뜻이므로 아예 보내지 않는다. */
    const phoneOut = phone.includes('*') ? undefined : phone;

    /* 별명은 users 테이블이라 프로필과 저장 경로가 다르다.
       길이 규칙은 서버(2~20자)와 같아야 한다 — 어긋나면 통과시켜 놓고 400 이 난다. */
    const nickname = document.getElementById('ac-nickname').value.trim();
    if (nickname && (nickname.length < 2 || nickname.length > 20)) {
      showErr('별명은 2~20자로 입력해주세요.');
      return;
    }

    btn.disabled = true;
    try {
      await DB.updateUser({ nickname: nickname || null });
      await DB.updateProfile({
        avatar: avatarState,
        gender: document.getElementById('ac-gender').value,
        birthdate: document.getElementById('ac-birthdate').value,
        address: document.getElementById('ac-address').value.trim(),
        ...(phoneOut === undefined ? {} : { phone: phoneOut }),
      });
      document.getElementById('ac-success').style.display = 'block';
      /* 네비의 '○○님' 이 별명을 쓴다. 갱신하지 않으면 저장했는데 헤더는
         옛 이름인 채로 남아 저장이 안 된 것처럼 보인다. */
      updateNavAuth();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      showErr('저장에 실패했어요. ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ── 비밀번호 변경 ───────────────────────────────────────────
  /* 위의 '저장하기' 와 **따로** 저장한다. 프로필 저장에 묶으면 이름만 고치려다
     비밀번호까지 건드리게 되고, 실패했을 때 무엇이 저장되고 무엇이 안 됐는지
     알 수 없다. 서버도 /api/auth/password 로 따로 받는다.

     규칙(8~20자·영문+숫자)은 서버 isValidPassword 와 같아야 한다 —
     어긋나면 화면에서 통과시켜 놓고 400 이 난다. */
  const PW_RE = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]{8,20}$/;

  function passwordSection(user) {
    /* 소셜 가입자는 비밀번호 자체가 없다. 빈 입력칸을 보여주면 뭘 적어야 하는지
       알 수 없으므로 아예 폼을 걷어내고 어디서 바꾸는지만 알려준다. */
    if (user.provider) {
      return `
        <div class="sf-section">
          <div class="sf-section-title"><i class="ti ti-lock"></i>비밀번호</div>
          <p class="sf-sub">${esc(user.provider)} 로 가입한 계정이라 비밀번호가 없어요.
             비밀번호는 ${esc(user.provider)} 에서 관리해 주세요.</p>
        </div>`;
    }

    return `
      <div class="sf-section">
        <div class="sf-section-title"><i class="ti ti-lock"></i>비밀번호 변경</div>

        <div class="success-box" id="pw-success">비밀번호를 변경했어요.</div>
        <div class="error-box"   id="pw-error"></div>

        <div class="form-group">
          <label>현재 비밀번호</label>
          <input type="password" id="pw-current" autocomplete="current-password"
                 placeholder="지금 쓰는 비밀번호" />
          <span class="field-hint">본인 확인을 위해 필요해요.</span>
        </div>

        <div class="sf-row-2">
          <div class="form-group">
            <label>새 비밀번호</label>
            <input type="password" id="pw-new" autocomplete="new-password"
                   placeholder="8~20자, 영문과 숫자 포함" />
          </div>
          <div class="form-group">
            <label>새 비밀번호 확인</label>
            <input type="password" id="pw-new2" autocomplete="new-password"
                   placeholder="한 번 더 입력" />
          </div>
        </div>

        <button class="btn-inline" id="pw-submit" disabled>비밀번호 변경</button>
      </div>`;
  }

  function bindPassword(user) {
    if (user.provider) return;

    const cur = document.getElementById('pw-current');
    const nw = document.getElementById('pw-new');
    const nw2 = document.getElementById('pw-new2');
    const btn = document.getElementById('pw-submit');
    const err = document.getElementById('pw-error');
    const ok = document.getElementById('pw-success');

    /* 세 칸이 다 차기 전에는 잠가 둔다. 확인란까지 채우기 전에 눌러
       '안 맞는다' 는 오류를 보는 것보다, 못 누르는 편이 덜 성가시다. */
    const sync = () => { btn.disabled = !cur.value || !nw.value || !nw2.value; };
    [cur, nw, nw2].forEach(el => el.addEventListener('input', sync));

    const fail = msg => {
      err.textContent = msg;
      err.style.display = 'block';
      ok.style.display = 'none';
    };

    btn.addEventListener('click', async () => {
      err.style.display = 'none';
      ok.style.display = 'none';

      /* 두 번 입력받는 것은 오타로 자기 계정에서 잠기는 일을 막기 위해서다.
         이건 서버가 알 수 없는 검사라 여기서만 한다. */
      if (nw.value !== nw2.value) return fail('새 비밀번호가 서로 달라요.');
      if (!PW_RE.test(nw.value)) return fail('비밀번호는 8~20자이며 영문과 숫자를 모두 포함해야 해요.');
      if (nw.value === cur.value) return fail('지금 쓰는 비밀번호와 다른 것으로 정해 주세요.');

      btn.disabled = true;
      try {
        await DB.changePassword({ currentPassword: cur.value, newPassword: nw.value });
        /* 성공하면 세 칸을 비운다. 남겨 두면 화면에 비밀번호가 계속 떠 있고,
           '변경됐다' 는 안내와 채워진 칸이 같이 보여 또 눌러야 하나 싶어진다. */
        cur.value = nw.value = nw2.value = '';
        ok.style.display = 'block';
      } catch (e) {
        fail(e.message);
      } finally {
        sync();
      }
    });
  }

  // ── 탈퇴 ────────────────────────────────────────────────────
  /* 되돌릴 수 없는 동작이다. 실수로 눌러지는 일이 없도록 세 겹으로 막는다.
       ① 무엇이 사라지는지 먼저 보여준다
       ② '탈퇴하겠습니다' 를 직접 입력
       ③ 비밀번호 재확인 (소셜 가입자는 아이디)
     서버도 ②를 뺀 나머지를 다시 확인한다 — 화면만 믿으면 안 된다. */
  const CONFIRM_WORD = '탈퇴하겠습니다';

  function renderWithdraw(container, user) {
    /* 소셜 가입자는 비밀번호가 없다. publicUser 에 provider 가 실려 온다. */
    const isSocial = !!user.provider;

    container.innerHTML = `
      <div class="sf-head">
        <h1>탈퇴하기</h1>
        <p class="sf-sub">계정을 지우면 되돌릴 수 없어요. 아래 내용을 확인해 주세요.</p>
      </div>

      <div class="wd-warn">
        <div class="wd-warn-title"><i class="ti ti-alert-triangle"></i> 함께 사라지는 것</div>
        <ul>
          <li>계정 정보(이름·이메일·사진·연락처)</li>
          <li>입력한 스펙 전부 — 학점·어학·자격증·대외활동</li>
          <li>CAS 점수와 그동안의 비교 기록</li>
          <li>멘토링 신청·진행 내역${user.role === 'mentor' ? ' 및 멘토 프로필·가능 일정' : ''}</li>
        </ul>
        <p class="wd-warn-note">
          같은 아이디로 다시 가입할 수 없고, 지운 데이터는 복구되지 않습니다.
          잠시 쉬고 싶은 것이라면 로그아웃만 해도 됩니다.
        </p>
      </div>

      <div class="error-box" id="wd-error"></div>

      <div class="sf-section">
        <div class="form-group">
          <label>확인 문구</label>
          <input type="text" id="wd-confirm" placeholder="${CONFIRM_WORD}" autocomplete="off" />
          <span class="field-hint"><b>${CONFIRM_WORD}</b> 를 그대로 입력해 주세요.</span>
        </div>
        <div class="form-group">
          <label>${isSocial ? '아이디' : '비밀번호'}</label>
          <input type="${isSocial ? 'text' : 'password'}" id="wd-secret"
                 placeholder="${isSocial ? user.username : '현재 비밀번호'}"
                 autocomplete="${isSocial ? 'off' : 'current-password'}" />
          <span class="field-hint">${isSocial
            ? '소셜 계정은 비밀번호가 없어서 아이디로 확인해요.'
            : '본인 확인을 위해 한 번 더 입력해 주세요.'}</span>
        </div>
      </div>

      <button class="btn-save wd-danger" id="wd-submit" disabled>탈퇴하기</button>
      <button class="btn-cancel" id="wd-cancel">돌아가기</button>
    `;

    const confirmEl = document.getElementById('wd-confirm');
    const secretEl = document.getElementById('wd-secret');
    const submit = document.getElementById('wd-submit');
    const err = document.getElementById('wd-error');

    /* 문구와 비밀번호가 **둘 다** 채워지기 전에는 버튼을 잠가 둔다.
       눌러 놓고 오류 문구를 보는 것보다, 아예 못 누르는 편이 안전하다. */
    const sync = () => {
      submit.disabled = confirmEl.value.trim() !== CONFIRM_WORD || !secretEl.value.trim();
    };
    confirmEl.addEventListener('input', sync);
    secretEl.addEventListener('input', sync);

    document.getElementById('wd-cancel').addEventListener('click', () => selectMypageTab('account'));

    submit.addEventListener('click', async () => {
      err.style.display = 'none';
      /* 마지막 관문. 버튼이 잠겨 있어도 콘솔로 누를 수 있으므로 여기서 한 번 더 본다. */
      if (confirmEl.value.trim() !== CONFIRM_WORD) {
        err.textContent = `확인 문구가 달라요. '${CONFIRM_WORD}' 를 그대로 입력해 주세요.`;
        err.style.display = 'block';
        return;
      }
      if (!window.confirm('정말 탈퇴하시겠어요? 되돌릴 수 없습니다.')) return;

      submit.disabled = true;
      try {
        await DB.withdraw(isSocial
          ? { username: secretEl.value.trim() }
          : { password: secretEl.value });
        alert('탈퇴가 완료되었습니다. 그동안 이용해 주셔서 감사합니다.');
        updateNavAuth();
        navigate('main');
      } catch (e) {
        err.textContent = e.message;
        err.style.display = 'block';
      } finally {
        sync();
      }
    });
  }

  return { render, renderWithdraw };
})();
