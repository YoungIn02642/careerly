// CAS 화면의 6개 표시 영역과 활동 분류의 단일 출처.
// 총점 배점은 cas.js가 맡고, 이 모듈은 레이더·비교·부족 항목의 묶음만 담당한다.
const CASProfileAPI = (() => {
  const GROUPS = [
    { key: 'gpa',       label: '학점',     kind: 'quant' },
    { key: 'volunteer', label: '봉사활동', kind: 'qual', hint: '서포터즈·기자단·봉사활동' },
    { key: 'language',  label: '어학',     kind: 'quant', hint: '어학성적·교환학생·어학연수' },
    { key: 'cert',      label: '자격증',   kind: 'quant' },
    { key: 'internal',  label: '대내활동', kind: 'qual', hint: '동아리·학회·연구·교내 비교과' },
    { key: 'external',  label: '대외활동', kind: 'qual', hint: '인턴십·교외 공모전·프로젝트' },
  ];

  const SCHOOL_RE = /교내|교내전|학교|대학|학과|학부|캠퍼스|총학생회|학생회/;
  const textOf = a => [a?.name, a?.org, a?.companyName].filter(Boolean).join(' ');

  function activityGroup(a) {
    if (!a) return null;
    if (a.type === 'volunteer' || a.type === 'extracurricular') return 'volunteer';
    if (a.type === 'exchange') return 'language';
    if (['club', 'research', 'campus'].includes(a.type)) return 'internal';
    if (a.type === 'internship') return 'external';
    if (a.type === 'competition' || a.type === 'project') {
      return SCHOOL_RE.test(textOf(a)) ? 'internal' : 'external';
    }
    return a.type === 'other' ? 'external' : null;
  }

  const activities = spec => CAS.normalizeActivities(spec || {});
  const groupActivities = (spec, key) => activities(spec).filter(a => activityGroup(a) === key);
  const activityCount = (spec, key) => groupActivities(spec, key).length;
  const activityScore = (spec, key) => groupActivities(spec, key)
    .reduce((sum, a) => sum + CAS.scoreActivity(a), 0);

  function gpa45(spec) {
    return spec?.gpa != null && spec?.gpaMax ? spec.gpa / spec.gpaMax * 4.5 : null;
  }

  /* 어학은 시험 환산지수에 교환학생·어학연수 경험을 최대 15점 보태 한 축으로 묶는다.
     시험 미입력이어도 관련 경험이 있으면 축이 완전히 0이 되지 않는다. */
  function languageValue(spec) {
    const indexed = CAS.langIndex(spec?.scores);
    const count = activityCount(spec, 'language');
    if (indexed == null && !count) return null;
    const test = indexed || 0;
    const exchange = Math.min(15, count * 10);
    return Math.min(100, test + exchange);
  }

  function value(spec, key) {
    if (key === 'gpa') return gpa45(spec);
    if (key === 'language') return languageValue(spec);
    if (key === 'cert') return (spec?.certs || []).length;
    return activityScore(spec, key);
  }

  function peerAverage(specs, key) {
    const vals = (specs || []).map(s => value(s, key)).filter(v => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }

  function comparison(spec, agg, key) {
    const mine = value(spec, key);
    const peer = peerAverage(agg?.specs, key);
    return { mine, peer, ratio: peer ? (CAS.relativeScore(mine, peer) || 0) : (mine ? 1 : 0) };
  }

  return {
    GROUPS, activityGroup, groupActivities, activityCount, activityScore,
    gpa45, languageValue, value, peerAverage, comparison,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CASProfileAPI;
if (typeof window !== 'undefined') window.CASProfile = CASProfileAPI;
