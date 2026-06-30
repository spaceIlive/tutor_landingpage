/**
 * Premium IB — Applications backend (Google Apps Script)
 *
 * 두 가지 사용 방식:
 *
 *  A) 바운드(Bound) — 권장 / 기본
 *     1) 대상 Google Sheet 에서 확장프로그램 → Apps Script
 *     2) 이 파일 내용을 그대로 붙여넣고 저장
 *     3) SHEET_ID 는 그대로 '' 비워두면 됨
 *     4) Deploy → New deployment → Web app
 *        Execute as: Me / Who has access: Anyone
 *     5) 발급된 URL 을 script.js 의 APPS_SCRIPT_URL 에 붙여넣기
 *
 *  B) 독립형(Standalone) — 스크립트를 시트와 분리
 *     1) script.google.com 에서 새 프로젝트 생성
 *     2) 아래 SHEET_ID 에 대상 시트의 ID 입력
 *        (시트 URL: docs.google.com/spreadsheets/d/[이부분이ID]/edit)
 *     3) 이후 절차는 A 와 동일
 */

// 비워두면 바운드 모드(스크립트가 붙은 시트 사용).
// 값을 채우면 그 ID의 시트로 강제 연결.
var SHEET_ID   = '';
var SHEET_NAME = 'Applications';

var HEADERS = [
  'submitted_at',
  'name',
  'contact',
  'university',
  'ib_score',
  'subjects',
  'availability',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'landing_url',
  'user_agent',
  'ip_address'
];

function doGet(e) {
  return _json({ ok: true, service: 'premium-ib-applications' });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var payload = JSON.parse(raw);

    var sheet = _getOrCreateSheet();
    _ensureHeaders(sheet);

    var row = HEADERS.map(function (key) {
      var v = payload[key];
      if (v === undefined || v === null) return '';
      return v;
    });

    sheet.appendRow(row);

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message || err) });
  }
}

function _getOrCreateSheet() {
  var ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet not found. Set SHEET_ID or run as a bound script.');
  }
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  return sheet;
}

function _ensureHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#0A1428')
      .setFontColor('#C9A961');
    sheet.setFrozenRows(1);
  }
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
