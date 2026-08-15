// ════════════════════════════════════════════════════════════
//  C:road — 직업 분류 카탈로그 (한국고용직업분류 KECO 2018)
//   출처: 임금직업정보시스템(워크피디아) · 고용노동부·한국고용정보원
//   1차 분류 10 → 2차 분류 35 → 직업 461. 직업마다 평균임금이 붙어 있다.
//
//   ── ncs.js 와 달리 정적 파일이 아니다 ──
//   분류 트리가 200KB 라서 모든 페이지에 얹으면 로드맵을 안 여는 사용자까지 부담을
//   진다. 그래서 서버(/api/jobs)에서 **처음 열 때 한 번만** 받아 메모리에 둔다.
//   대신 호출부는 load() 를 await 해야 한다(NCS 는 동기였다).
// ════════════════════════════════════════════════════════════
window.KECO = (() => {

  let _data = null;        // { majors, counts, wageUnit, ... }
  let _promise = null;

  /* 한 번만 받아 온다. 실패하면 다음 호출에서 다시 시도할 수 있게 캐시를 비운다 —
     네트워크가 잠깐 끊긴 것 때문에 로드맵이 영영 안 열리면 안 된다. */
  function load() {
    if (!_promise) {
      _promise = DB.jobCatalog()
        .then(d => { _data = d; return d; })
        .catch(e => { _promise = null; throw e; });
    }
    return _promise;
  }

  const ready   = () => !!_data;

  /* 화면 번호(no)는 서버가 붙여 준다. 그런데 브라우저에 옛 응답이 캐시돼 있으면
     그 필드가 없어서 화면에 undefined 가 찍힌다(실제로 겪었다).
     서버가 안 줬으면 공식 코드에서 즉석으로 만들어 둔다 — 숫자 하나 때문에
     화면이 깨지지는 않게. */
  const MAJORS  = () => (_data?.majors || []).map(m =>
    m.no != null ? m : { ...m, no: Number(m.code) + 1 });
  const counts  = () => _data?.counts || { majors: 0, middles: 0, jobs: 0 };
  const meta    = () => _data || {};

  const byId = code => MAJORS().find(m => m.code === code) || null;
  const middleById = (majorCode, middleCode) =>
    (byId(majorCode)?.middles || []).find(m => m.code === middleCode) || null;
  const jobById = (majorCode, middleCode, jobCode) =>
    (middleById(majorCode, middleCode)?.jobs || []).find(j => j.code === jobCode) || null;

  /* ── 옛 스펙 매칭 ────────────────────────────────────────────
     스펙 레코드는 아직 학과(dept) 스키마라 직업코드로 이어지지 않는다.
     서버가 2차 분류에 얹어 준 legacy 조건으로 집계 대상을 고른다.
     legacy 가 없는 2차 분류는 null 을 돌려주고, 화면은 '데이터 없음'으로 빠진다(정상). */
  function matcher(legacy) {
    if (!legacy || !legacy.dept?.length) return null;
    return s =>
      legacy.dept.includes(s.dept) &&
      (!legacy.field?.length || legacy.field.includes(s.field));
  }
  function middleMatcher(majorCode, middleCode) {
    return matcher(middleById(majorCode, middleCode)?.legacy);
  }
  function majorMatcher(majorCode) {
    const fns = (byId(majorCode)?.middles || []).map(m => matcher(m.legacy)).filter(Boolean);
    if (!fns.length) return null;
    return s => fns.some(fn => fn(s));
  }

  /* 임금 표기. 원본 단위가 만원이라 그대로 쓰면 '3500' 이 얼마인지 안 읽힌다.
     1억 이상은 억 단위로 끊어 준다. */
  function wageText(manwon) {
    if (manwon == null) return '자료 없음';
    if (manwon >= 10000) {
      const eok = Math.floor(manwon / 10000);
      const rest = manwon % 10000;
      return rest ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
    }
    return `${manwon.toLocaleString()}만원`;
  }

  /* 원본 데이터에는 일자리 전망(psctCdNm)도 들어 있지만 화면에는 쓰지 않는다.
     '유지/다소 증가' 같은 다섯 단계는 근거 기간·산출 방법이 원본에 없어서,
     학생이 진로를 정하는 근거로 쓰기엔 뜻이 불분명하다. 데이터는 남겨 두고
     쓰기로 정해지면 그때 화면에 올린다. */

  return {
    load, ready, MAJORS, counts, meta,
    byId, middleById, jobById,
    middleMatcher, majorMatcher,
    wageText,
  };
})();
