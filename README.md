# Premium IB — 1기 튜터 모집 랜딩페이지

IB Final 43점 이상 프리미엄 튜터 1기 모집을 위한 단일 페이지 랜딩사이트.
프론트는 정적 HTML/CSS/JS, 백엔드는 Google Apps Script, DB는 Google Spreadsheet,
호스팅은 Netlify.

## 파일 구조

```
├── index.html               # 랜딩페이지
├── styles.css               # Dark Luxury 디자인 시스템
├── script.js                # 폼 검증 · 유입 추적 · Apps Script 호출
├── apps-script/Code.gs      # Sheets 적재용 Apps Script 코드
├── netlify.toml             # Netlify 정적 호스팅 설정
└── README.md
```

## 1) Google Sheet & Apps Script 셋업

1. 새 Google Sheet 생성 (예: `Premium IB Applications`)
2. **Extensions → Apps Script** 열기
3. `Code.gs` 내용을 `apps-script/Code.gs` 파일 내용으로 교체 후 저장
4. **Deploy → New deployment** → Type: **Web app**
   - Description: `premium-ib v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
5. 발급된 Web App URL 복사

## 2) 프론트 연결

`script.js` 상단의 다음 상수를 위에서 복사한 URL로 교체:

```js
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/REPLACE_ME/exec";
```

## 3) Netlify 배포

옵션 A — Drag & Drop:
1. https://app.netlify.com/drop 으로 이동
2. 프로젝트 폴더 통째로 드래그

옵션 B — GitHub 연결 (권장):
1. GitHub 저장소에 push
2. Netlify → Add new site → Import from Git → 저장소 선택
3. Publish directory: `.` (이미 `netlify.toml`에 지정됨)

## 4) 검증 체크리스트

- [ ] 데스크탑 / 모바일 두 폭에서 레이아웃 OK
- [ ] 폼 모든 필드 비워서 제출 → "모든 항목을 입력해 주세요" 에러
- [ ] IB 점수 50 입력 → "0–45 사이의 숫자" 에러
- [ ] 정상 제출 → 성공 패널로 전환, Google Sheet 1행 추가
- [ ] `?utm_source=test&utm_medium=ig` 진입 → 제출 → Sheet에 `utm_*` 채워짐
- [ ] Sheet에 `ip_address`, `referrer`, `user_agent` 모두 기록됨

## 운영 노트

- 시트 컬럼은 `apps-script/Code.gs`의 `HEADERS` 배열에 정의됨. 수정 시 첫 행도 수동으로 맞춰주거나 헤더 행을 삭제하고 한 번 다시 받으면 자동 재생성됨.
- 프론트에서 보내는 키와 헤더 이름이 1:1 매칭되어야 해당 컬럼에 들어감.
- 점수 인증 서류는 의도적으로 폼 단계에서 받지 않음 (매칭 확정 후 수집).
