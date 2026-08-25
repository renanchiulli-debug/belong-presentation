const SITE_ID = 'belong-presentation';
const SHEET_NAME = 'Eventos';
const SPREADSHEET_ID = '1CviciUcEqTCm41-0ky6OSdWD0AximimKFUgnBvwrOas';
const SPREADSHEET_ID_PROPERTY = 'BELONG_ANALYTICS_SPREADSHEET_ID';
const MAX_EVENTS_PER_REQUEST = 25;

const HEADERS = [
  'recebido_em',
  'evento_em',
  'event_id',
  'anonymous_id',
  'session_id',
  'event_name',
  'deck',
  'slide_number',
  'slide_total',
  'screen_title',
  'progress_percent',
  'duration_ms',
  'page_path',
  'referrer_host',
  'device_type',
  'campaign_source',
  'campaign_medium',
  'campaign_name',
  'metadata_json'
];

const ALLOWED_EVENTS = new Set([
  'session_start',
  'session_end',
  'screen_view',
  'screen_leave',
  'resume_choice',
  'deck_complete',
  'deck_switch',
  'presentation_restart',
  'cta_click',
  'activity_interaction'
]);

const ALLOWED_METADATA_FIELDS = new Set([
  'action',
  'activity',
  'choice',
  'destination_slide',
  'duration_ms',
  'entry_mode',
  'option',
  'placement',
  'previous_deck',
  'previous_slide_number',
  'resume_prompt_shown'
]);

/**
 * Execute esta função uma vez, pelo editor do Apps Script, antes do deploy.
 * Ela associa o endpoint à planilha configurada e prepara a aba de eventos.
 */
function setupAnalytics() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);

  PropertiesService.getScriptProperties().setProperty(
    SPREADSHEET_ID_PROPERTY,
    spreadsheet.getId()
  );
  const sheet = getOrCreateEventSheet_(spreadsheet);
  return `Analytics configurado na aba "${sheet.getName()}" de "${spreadsheet.getName()}".`;
}

/** Resposta simples para conferir se a URL /exec está publicada. */
function doGet() {
  return jsonResponse_({
    ok: true,
    service: SITE_ID,
    message: 'Endpoint de analytics ativo.'
  });
}

/** Recebe um lote de eventos anônimos e grava uma linha por evento. */
function doPost(e) {
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!raw || raw.length > 50000) {
      return jsonResponse_({ok: false, error: 'invalid_payload'});
    }

    const payload = JSON.parse(raw);
    if (payload.site_id !== SITE_ID || !Array.isArray(payload.events)) {
      return jsonResponse_({ok: false, error: 'invalid_site_or_events'});
    }

    const receivedAt = new Date();
    const events = payload.events.slice(0, MAX_EVENTS_PER_REQUEST);
    const rows = events
      .map(event => eventToRow_(event, payload, receivedAt))
      .filter(Boolean);

    if (!rows.length) {
      return jsonResponse_({ok: true, inserted: 0});
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const spreadsheet = getConfiguredSpreadsheet_();
      const sheet = getOrCreateEventSheet_(spreadsheet);
      sheet
        .getRange(sheet.getLastRow() + 1, 1, rows.length, HEADERS.length)
        .setValues(rows);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    return jsonResponse_({ok: true, inserted: rows.length});
  } catch (error) {
    console.error(error);
    return jsonResponse_({ok: false, error: 'server_error'});
  }
}

function eventToRow_(event, payload, receivedAt) {
  if (!event || !ALLOWED_EVENTS.has(event.event_name)) return null;

  const eventTime = new Date(event.event_time);
  const safeEventTime = Number.isNaN(eventTime.getTime()) ? receivedAt : eventTime;

  return [
    receivedAt,
    safeEventTime,
    cleanId_(event.event_id),
    cleanId_(event.anonymous_id),
    cleanId_(event.session_id),
    event.event_name,
    cleanText_(event.deck, 20),
    cleanNumber_(event.slide_number, 0, 500),
    cleanNumber_(event.slide_total, 0, 500),
    cleanText_(event.screen_title, 180),
    cleanNumber_(event.progress_percent, 0, 100),
    cleanNumber_(event.duration_ms, 0, 86400000),
    cleanText_(payload.page_path, 300),
    cleanText_(payload.referrer_host, 180),
    cleanText_(payload.device_type, 20),
    cleanText_(payload.campaign_source, 100),
    cleanText_(payload.campaign_medium, 100),
    cleanText_(payload.campaign_name, 150),
    cleanText_(JSON.stringify(cleanMetadata_(event.metadata)), 2000)
  ];
}

function cleanMetadata_(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const clean = {};
  Object.keys(metadata).forEach(key => {
    if (!ALLOWED_METADATA_FIELDS.has(key)) return;
    const value = metadata[key];
    if (typeof value === 'boolean') {
      clean[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      clean[key] = Math.round(value);
    } else if (typeof value === 'string') {
      clean[key] = value.slice(0, 180);
    }
  });
  return clean;
}

function cleanId_(value) {
  const id = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
}

function cleanText_(value, maxLength) {
  let text = String(value || '').trim().slice(0, maxLength);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return text;
}

function cleanNumber_(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function getConfiguredSpreadsheet_() {
  const storedSpreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty(SPREADSHEET_ID_PROPERTY);
  const spreadsheetId = storedSpreadsheetId || SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Execute setupAnalytics() antes de publicar o web app.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function getOrCreateEventSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    const header = sheet.getRange(1, 1, 1, HEADERS.length);
    header
      .setValues([HEADERS])
      .setFontWeight('bold')
      .setBackground('#87014E')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, HEADERS.length);
    sheet.getRange('A:B').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }

  return sheet;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
