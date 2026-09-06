/**
 * AHAS Print Service (iOS) — local HTTP on 127.0.0.1:8765.
 *
 * Safari blocks fetch() from an HTTPS POS page → http://127.0.0.1 (mixed content).
 * Fix: open about:blank on the user click, run fetch/form from that window, report via postMessage.
 *
 * From about:blank, no-cors POST can still deliver bytes (unlike from HTTPS).
 * AHAS did not publish the body — we probe common ESC/POS shapes + no-cors.
 */

export const AHAS_PRINT_ORIGINS = ['http://127.0.0.1:8765', 'http://localhost:8765'] as const;
export const AHAS_BRIDGE_WINDOW_NAME = 'drink-ahas-print';
export const AHAS_RESULT_MESSAGE_TYPE = 'drink-ahas-print-result';

const AHAS_BRIDGE_WAIT_MS = 12_000;

export type AhasPrintDetail =
  | 'sent_fetch'
  | 'sent_opaque'
  | 'sent_form'
  | 'unreachable'
  | 'no_payload'
  | 'popup_blocked'
  | 'timeout';

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

/** Open on the same user gesture as เช็กบิล / พิมพ์ — before awaiting the receipt API. */
export function createAhasBridgeWindow(): Window | null {
  try {
    const win = window.open('about:blank', AHAS_BRIDGE_WINDOW_NAME);
    if (!win) return null;
    try {
      win.document.title = 'D-rink → AHAS';
      win.document.body.innerHTML =
        '<p style="font-family:sans-serif;padding:1rem;color:#333">รอใบเสร็จจาก D-rink…</p>';
    } catch {
      // ignore
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

export function detectNeedsAhasBridgeWindow(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/iPad|iPhone|iPod/i.test(navigator.userAgent)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
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

  let win = bridgeWin && !bridgeWin.closed ? bridgeWin : null;
  if (!win) {
    win = createAhasBridgeWindow();
  }
  if (!win) {
    return {
      ok: false,
      detail: detectNeedsAhasBridgeWindow() ? 'popup_blocked' : 'unreachable',
    };
  }

  const resultPromise = waitForAhasBridgeResult(win);
  if (!injectAhasPrintRunner(win, base64)) {
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
 * Runs inside about:blank (not HTTPS) so localhost is not mixed-content-blocked.
 * Order: CORS 2xx → no-cors POST (deliver) → form navigation.
 */
function injectAhasPrintRunner(win: Window, base64: string): boolean {
  const originsJson = JSON.stringify([...AHAS_PRINT_ORIGINS]);
  const base64Json = JSON.stringify(base64);
  const messageTypeJson = JSON.stringify(AHAS_RESULT_MESSAGE_TYPE);

  try {
    const doc = win.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="th">
<head><meta charset="utf-8"><title>D-rink → AHAS</title></head>
<body>
<p id="msg" style="font-family:sans-serif;padding:1rem;color:#333">กำลังส่งใบเสร็จไป AHAS Print Service…</p>
<script>
(function () {
  var origins = ${originsJson};
  var base64 = ${base64Json};
  var messageType = ${messageTypeJson};
  var msg = document.getElementById('msg');

  function report(ok, via, hint) {
    try {
      if (window.opener) {
        window.opener.postMessage({ type: messageType, ok: ok, via: via, hint: hint || '' }, '*');
      }
    } catch (e) {}
    if (msg) {
      msg.textContent = ok
        ? 'ส่งแล้ว — ดู Utskriftshistorik ในแอพ AHAS ถ้ามีรายการแสดงว่าถึงแอพแล้ว'
        : (hint || 'ส่งไม่ถึง AHAS — เปิดแอพค้างไว้ให้เห็น RUNNING แล้วอนุญาตป๊อปอัป');
    }
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

  function buildCorsBodies(bytes) {
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
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ payload: base64, type: 'escpos' })
      },
      {
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes
      },
      {
        headers: { 'Content-Type': 'application/vnd.escpos' },
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
      // no-cors GET — if it resolves, something answered on the port
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

  async function tryCorsPrint(origin, bytes) {
    var paths = ['/api/print', '/print', '/escpos', '/raw', '/api/v1/print', '/'];
    var bodies = buildCorsBodies(bytes);
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

  async function tryOpaquePrint(origin, bytes) {
    var paths = ['/print', '/api/print', '/escpos', '/raw', '/'];
    var attempts = [
      { body: bytes, type: 'application/octet-stream' },
      { body: bytes, type: 'application/vnd.escpos' },
      { body: base64, type: 'text/plain' },
      { body: JSON.stringify({ content: base64, content_type: 'escpos' }), type: 'application/json' },
      { body: JSON.stringify({ type: 'print', format: 'escpos', data: base64 }), type: 'application/json' },
      { body: JSON.stringify({ data: base64 }), type: 'application/json' }
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

  function tryForm(origin) {
    var attempts = [
      { path: '/api/print', fields: { content: base64, content_type: 'escpos', copies: '1' } },
      { path: '/print', fields: { data: base64, format: 'escpos', type: 'print' } },
      { path: '/print', fields: { content: base64 } },
      { path: '/', fields: { data: base64 } }
    ];
    var attempt = attempts[0];
    var form = document.createElement('form');
    form.method = 'POST';
    form.action = origin + attempt.path;
    form.acceptCharset = 'UTF-8';
    Object.keys(attempt.fields).forEach(function (name) {
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = attempt.fields[name];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    report(true, 'form');
    form.submit();
    return true;
  }

  (async function run() {
    var bytes = decodeBytes(base64);
    if (!bytes.byteLength) {
      report(false, null, 'ข้อมูลใบเสร็จว่าง');
      return;
    }

    var origin = await pingServer();
    if (!origin) {
      report(false, null, 'เปิดไม่ถึง localhost:8765 — เปิดแอพ AHAS ค้างไว้ให้เห็น RUNNING');
      return;
    }

    if (await tryCorsPrint(origin, bytes)) {
      report(true, 'fetch');
      return;
    }

    if (await tryOpaquePrint(origin, bytes)) {
      report(true, 'opaque');
      return;
    }

    tryForm(origin);
  })().catch(function () {
    report(false, null, 'ส่งไม่สำเร็จ');
  });
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
