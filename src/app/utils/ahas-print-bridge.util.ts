/**
 * AHAS Print Service (iOS) — local HTTP on 127.0.0.1:8765.
 *
 * Safari blocks fetch() from HTTPS POS → http://127.0.0.1 (mixed content).
 * Fix: on the user tap, open about:blank and install a message listener there;
 * when the receipt arrives, postMessage the ESC/POS payload into that window
 * (still not HTTPS, so localhost fetch can proceed).
 */

export const AHAS_PRINT_ORIGINS = ['http://127.0.0.1:8765', 'http://localhost:8765'] as const;
export const AHAS_BRIDGE_WINDOW_NAME = 'drink-ahas-print';
export const AHAS_RESULT_MESSAGE_TYPE = 'drink-ahas-print-result';
export const AHAS_JOB_MESSAGE_TYPE = 'drink-ahas-print-job';
export const AHAS_READY_MESSAGE_TYPE = 'drink-ahas-print-ready';

const AHAS_BRIDGE_WAIT_MS = 15_000;

export type AhasPrintDetail =
  | 'sent_fetch'
  | 'sent_opaque'
  | 'sent_form'
  | 'unreachable'
  | 'no_payload'
  | 'popup_blocked'
  | 'timeout'
  | 'standalone_blocked';

export type AhasPrintResult = {
  ok: boolean;
  detail: AhasPrintDetail;
};

type AhasBridgeMessage = {
  type: typeof AHAS_RESULT_MESSAGE_TYPE;
  ok: boolean;
  via?: 'fetch' | 'opaque' | 'form';
  hint?: string;
};

/** iOS Home Screen / PWA — window.open is usually blocked. */
export function isIosStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

export function detectNeedsAhasBridgeWindow(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Must run synchronously on the print/checkout tap (before await HTTP).
 * Installs a long-lived listener in about:blank — do not rewrite later.
 */
export function createAhasBridgeWindow(): Window | null {
  try {
    const win = window.open('about:blank', AHAS_BRIDGE_WINDOW_NAME);
    if (!win) return null;
    if (!installAhasBridgeListener(win)) {
      try {
        win.close();
      } catch {
        // ignore
      }
      return null;
    }
    return win;
  } catch {
    return null;
  }
}

export function closeAhasBridgeWindow(win: Window | null | undefined): void {
  if (!win || win.closed) return;
  try {
    win.close();
  } catch {
    // ignore
  }
}

/** Tiny ESC/POS for ทดสอบเชื่อม on the receipt-printer page. */
export function buildAhasTestEscPosBase64(): string {
  const text = new TextEncoder().encode('D-rink AHAS OK\n');
  const parts = [0x1b, 0x40, ...text, 0x1b, 0x64, 0x04, 0x1d, 0x56, 0x01];
  return bytesToBase64(Uint8Array.from(parts));
}

export async function sendEscPosToAhasPrintService(
  escPosBase64: string,
  bridgeWin?: Window | null,
): Promise<AhasPrintResult> {
  const base64 = escPosBase64.replace(/\s/g, '');
  if (!base64) {
    return { ok: false, detail: 'no_payload' };
  }

  if (isIosStandaloneDisplay() && (!bridgeWin || bridgeWin.closed)) {
    return { ok: false, detail: 'standalone_blocked' };
  }

  let win = bridgeWin && !bridgeWin.closed ? bridgeWin : null;
  if (!win) {
    win = createAhasBridgeWindow();
  }
  if (!win) {
    return {
      ok: false,
      detail: isIosStandaloneDisplay()
        ? 'standalone_blocked'
        : detectNeedsAhasBridgeWindow()
          ? 'popup_blocked'
          : 'unreachable',
    };
  }

  const resultPromise = waitForAhasBridgeResult(win);
  try {
    win.postMessage({ type: AHAS_JOB_MESSAGE_TYPE, base64 }, '*');
  } catch {
    closeAhasBridgeWindow(win);
    return { ok: false, detail: 'unreachable' };
  }

  const result = await resultPromise;
  if (result.ok) {
    window.setTimeout(() => closeAhasBridgeWindow(win), 1800);
  } else {
    closeAhasBridgeWindow(win);
  }
  return result;
}

function waitForAhasBridgeResult(win: Window): Promise<AhasPrintResult> {
  return new Promise((resolve) => {
    let settled = false;

    const finish = (result: AhasPrintResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== win) return;
      const data = event.data as AhasBridgeMessage | null;
      if (!data || data.type !== AHAS_RESULT_MESSAGE_TYPE) return;
      const via = data.via;
      finish({
        ok: Boolean(data.ok),
        detail: data.ok
          ? via === 'form'
            ? 'sent_form'
            : via === 'opaque'
              ? 'sent_opaque'
              : 'sent_fetch'
          : 'unreachable',
      });
    };

    const timer = window.setTimeout(() => {
      finish({ ok: false, detail: 'timeout' });
    }, AHAS_BRIDGE_WAIT_MS);

    window.addEventListener('message', onMessage);
  });
}

/**
 * Listener page in about:blank — receives ESC/POS via postMessage, talks to AHAS.
 */
function installAhasBridgeListener(win: Window): boolean {
  const originsJson = JSON.stringify([...AHAS_PRINT_ORIGINS]);
  const jobTypeJson = JSON.stringify(AHAS_JOB_MESSAGE_TYPE);
  const resultTypeJson = JSON.stringify(AHAS_RESULT_MESSAGE_TYPE);
  const readyTypeJson = JSON.stringify(AHAS_READY_MESSAGE_TYPE);

  try {
    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D-rink → AHAS</title></head>
<body style="margin:0;font-family:sans-serif;background:#111;color:#f5f5f5">
<div style="padding:1.25rem;max-width:28rem">
  <p style="font-size:1.1rem;font-weight:700;margin:0 0 0.5rem">กำลังเชื่อม AHAS Print Service</p>
  <p id="msg" style="margin:0;line-height:1.45;color:#ccc">รอใบเสร็จจาก D-rink… อย่าปิดหน้าต่างนี้</p>
</div>
<script>
(function () {
  var origins = ${originsJson};
  var jobType = ${jobTypeJson};
  var resultType = ${resultTypeJson};
  var readyType = ${readyTypeJson};
  var msg = document.getElementById('msg');
  var busy = false;

  function setMsg(text) {
    if (msg) msg.textContent = text;
  }

  function report(ok, via, hint) {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: resultType, ok: ok, via: via, hint: hint || '' }, '*');
      }
    } catch (e) {}
    setMsg(ok
      ? 'ส่งแล้ว — ดู Utskriftshistorik ในแอพ AHAS แล้วกลับไป D-rink ได้'
      : (hint || 'ส่งไม่ถึง AHAS'));
  }

  function decodeBytes(b64) {
    try {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch (e) {
      return new Uint8Array(0);
    }
  }

  function fetchCors(url, init) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 2500);
    return fetch(url, Object.assign({}, init, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store'
    }))
      .then(function (res) { return res.status; })
      .catch(function () { return null; })
      .finally(function () { clearTimeout(timer); });
  }

  function fetchOpaque(url, body, contentType) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 2500);
    return fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': contentType },
      body: body
    })
      .then(function () { return true; })
      .catch(function () { return false; })
      .finally(function () { clearTimeout(timer); });
  }

  function buildCorsBodies(base64, bytes) {
    return [
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ content: base64, content_type: 'escpos', copies: 1 })
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ type: 'print', format: 'escpos', data: base64 })
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ data: base64, format: 'escpos' })
      },
      {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ escpos: base64 })
      },
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes
      },
      {
        headers: { 'Content-Type': 'text/plain' },
        body: base64
      }
    ];
  }

  async function pingServer() {
    for (var o = 0; o < origins.length; o++) {
      var status = await fetchCors(origins[o] + '/', { method: 'GET' });
      if (status != null) return origins[o];
      status = await fetchCors(origins[o] + '/health', { method: 'GET' });
      if (status != null) return origins[o];
      try {
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, 2000);
        await fetch(origins[o] + '/', { method: 'GET', mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
        clearTimeout(timer);
        return origins[o];
      } catch (e) {
        try { clearTimeout(timer); } catch (e2) {}
      }
    }
    return null;
  }

  async function tryCorsPrint(origin, base64, bytes) {
    var paths = ['/api/print', '/print', '/escpos', '/raw', '/api/v1/print', '/'];
    var bodies = buildCorsBodies(base64, bytes);
    for (var p = 0; p < paths.length; p++) {
      for (var b = 0; b < bodies.length; b++) {
        var status = await fetchCors(origin + paths[p], {
          method: 'POST',
          headers: bodies[b].headers,
          body: bodies[b].body
        });
        if (status != null && status >= 200 && status < 300) return true;
      }
    }
    return false;
  }

  async function tryOpaquePrint(origin, base64, bytes) {
    var paths = ['/print', '/api/print', '/escpos', '/raw', '/'];
    var attempts = [
      { body: bytes, type: 'application/octet-stream' },
      { body: bytes, type: 'application/vnd.escpos' },
      { body: base64, type: 'text/plain' },
      { body: JSON.stringify({ content: base64, content_type: 'escpos' }), type: 'application/json' },
      { body: JSON.stringify({ type: 'print', format: 'escpos', data: base64 }), type: 'application/json' }
    ];
    var anySent = false;
    for (var p = 0; p < paths.length; p++) {
      for (var a = 0; a < attempts.length; a++) {
        if (await fetchOpaque(origin + paths[p], attempts[a].body, attempts[a].type)) {
          anySent = true;
        }
      }
    }
    return anySent;
  }

  function tryForm(origin, base64) {
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = origin + '/api/print';
    form.acceptCharset = 'UTF-8';
    var fields = { content: base64, content_type: 'escpos', copies: '1' };
    Object.keys(fields).forEach(function (name) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = fields[name];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    report(true, 'form');
    form.submit();
  }

  async function handleJob(base64) {
    if (busy) return;
    busy = true;
    setMsg('กำลังส่งไป AHAS (localhost:8765)…');
    var bytes = decodeBytes(base64);
    if (!bytes.byteLength) {
      report(false, null, 'ข้อมูลใบเสร็จว่าง');
      busy = false;
      return;
    }
    try {
      var origin = await pingServer();
      if (!origin) {
        report(false, null, 'เปิดไม่ถึง localhost:8765 — สลับไปเปิดแอพ AHAS ให้เห็น RUNNING แล้วลองใหม่');
        busy = false;
        return;
      }
      setMsg('เจอ AHAS แล้ว กำลังส่งใบเสร็จ…');
      if (await tryCorsPrint(origin, base64, bytes)) {
        report(true, 'fetch');
        busy = false;
        return;
      }
      if (await tryOpaquePrint(origin, base64, bytes)) {
        report(true, 'opaque');
        busy = false;
        return;
      }
      tryForm(origin, base64);
    } catch (e) {
      report(false, null, 'ส่งไม่สำเร็จ');
    }
    busy = false;
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== jobType) return;
    if (typeof data.base64 !== 'string') return;
    handleJob(data.base64);
  });

  try {
    if (window.opener) {
      window.opener.postMessage({ type: readyType }, '*');
    }
  } catch (e) {}
})();
</script>
</body>
</html>`);
    doc.close();
    return true;
  } catch {
    return false;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
