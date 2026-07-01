# 방문자 로그 기능 설계

**Date:** 2026-07-01
**Status:** Approved

## 목적

랜딩 페이지에 유입된 방문자 수와 유입 경로를 파악하기 위해, 페이지 로드 시점에
Apps Script 백엔드로 방문 이벤트를 전송하고 Google Sheet의 별도 시트에 기록한다.

관리자(사이트 오너)만 시트에서 확인하는 용도이며, 방문자 수를 페이지에 노출하지 않는다.

## 요구사항

- 방문자가 페이지를 로드할 때마다 백엔드로 방문 이벤트 1건 기록 (dedup 없음)
- 기록 항목: 방문 시각, IP 주소, referrer, UTM 5종(source/medium/campaign/term/content), landing URL
- 기존 폼 제출(Applications 시트)과 별개 시트(`Visits`)에 저장
- 방문 로깅 실패는 조용히 무시 — 페이지 UX에 영향 없음
- 기존 Apps Script Web App URL과 배포를 재사용 (신규 배포 불필요)

## Non-Goals

- 방문자 수의 페이지 내 노출
- 세션/일자 단위 dedup
- User Agent, 화면 크기, 지리정보 등 추가 메타데이터 수집
- 실시간 대시보드/차트

## 아키텍처

```
[Browser]
  ├── DOMContentLoaded
  │     ├── captureFirstTouch()   (기존)
  │     ├── logVisit()            (신규, fire-and-forget)
  │     │     ├── fetchIp()  ← 기존 헬퍼 재사용
  │     │     └── fetch(APPS_SCRIPT_URL, {type: 'visit', ...})
  │     ├── setupReveal()         (기존)
  │     └── setupForm()           (기존)
  ↓
[Apps Script Web App]  doPost(e)
  ├── payload.type === 'visit'  → Visits 시트에 append
  └── else                      → Applications 시트에 append (기존 로직)
  ↓
[Google Spreadsheet]
  ├── Applications 시트 (기존)
  └── Visits 시트 (신규, 자동 생성)
```

## Frontend 변경 (`script.js`)

**신규 함수 `logVisit()`**
- `fetchIp()`로 IP 조회 (기존 헬퍼 재사용, 3초 타임아웃)
- payload 구성:
  ```js
  {
    type:         'visit',
    visited_at:   new Date().toISOString(),
    ip_address:   ip,
    referrer:     tracking.referrer,
    utm_source:   tracking.utm_source,
    utm_medium:   tracking.utm_medium,
    utm_campaign: tracking.utm_campaign,
    utm_term:     tracking.utm_term,
    utm_content:  tracking.utm_content,
    landing_url:  tracking.landing_url
  }
  ```
- `fetch(APPS_SCRIPT_URL, ...)`로 POST (기존 form과 동일한 `text/plain` 헤더 → CORS preflight 회피)
- 오류는 `.catch(() => {})` 로 조용히 삼킴
- 반환값 무시 — await 하지 않음

**부팅 순서 변경 (`DOMContentLoaded`)**
```js
captureFirstTouch();
logVisit();          // 신규, 백그라운드
setupReveal();
setupForm();
```

**폼 제출 payload 영향 없음**
- 기존 payload에는 `type` 필드가 없음 → 백엔드에서 else 브랜치로 자연스럽게 흘러감

## Backend 변경 (`apps-script/Code.gs`)

**신규 상수**
```js
var VISITS_SHEET_NAME = 'Visits';
var VISIT_HEADERS = [
  'visited_at',
  'ip_address',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'landing_url'
];
```

**`doPost(e)` 라우팅**
```js
function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var payload = JSON.parse(raw);

    if (payload.type === 'visit') {
      return _handleVisit(payload);
    }
    return _handleApplication(payload);
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}
```

**헬퍼 리팩터**
- `_getOrCreateSheet(name)` — 인자로 시트명 받음 (기본값 없음, 명시적 전달)
- `_ensureHeaders(sheet, headers)` — 헤더 배열 인자로 받음
- 기존 `_handleApplication` / 신규 `_handleVisit`은 각각 자기 시트명과 헤더 배열을 넘김
- 헤더 스타일(볼드 + 네이비 배경 + 골드 글자)은 두 시트 모두 동일하게 적용

**응답**
- Visits 기록도 성공 시 `_json({ ok: true })` 반환 (프론트가 무시하긴 하지만 일관성 유지)

## 데이터 흐름 예시

1. 사용자가 `https://premium-ib.example.com/?utm_source=instagram&utm_campaign=1gi` 접속
2. 브라우저: `captureFirstTouch()`로 UTM sessionStorage 저장 → `logVisit()`이 IP 조회 후 백엔드 POST
3. Apps Script: `payload.type === 'visit'` → `Visits` 시트에 한 행 추가
4. 시트 모습:
   | visited_at | ip_address | referrer | utm_source | utm_campaign | ... |
   |---|---|---|---|---|---|
   | 2026-07-01T14:22:31.412Z | 203.0.113.42 | https://instagram.com/ | instagram | 1gi | ... |

## 오류 처리

- **IP 조회 실패:** `ip_address` 빈 문자열로 기록 (기존 form 동작과 동일)
- **네트워크 실패 / Apps Script 5xx:** 프론트는 조용히 삼킴, 서버는 응답만 못 돌려줌
- **시트 없음:** `_getOrCreateSheet`가 자동 생성 후 헤더까지 세팅
- **payload JSON 파싱 실패:** 기존 try/catch가 잡아 `{ok:false, error:...}` 반환

## 테스트 계획

- 로컬에서 `index.html` 열고 DevTools Network 탭에서 `logVisit`의 POST 요청 확인
- 응답 200 확인
- Google Sheet에서 `Visits` 탭 새로 생성됐는지, 헤더가 세팅됐는지, 방문 행이 append 됐는지 확인
- UTM 파라미터 붙여서 재접속 → 해당 컬럼에 값 들어가는지 확인
- 오프라인(devtools) 상태에서 페이지 로드 → 콘솔에 unhandled promise rejection 없는지 확인
- 폼 제출 정상 동작 (Applications 시트에 여전히 기록) 확인

## 배포

- Apps Script: `Code.gs` 수정 후 **Deploy → Manage deployments → 기존 배포 편집 → 새 버전**
  - URL은 그대로 유지되므로 프론트 재배포 필요 없음
- Netlify: `script.js` 변경 커밋 후 자동 배포
