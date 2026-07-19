import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function blobApiErrorMessage(blob: Blob, fallback: string): Promise<string> {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text) as { error?: string };
    return parsed.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain?.[1]?.trim() ?? null;
}

async function assertExcelBlob(body: Blob): Promise<void> {
  const type = body.type.toLowerCase();
  if (type.includes('json') || type.includes('text/html') || type.includes('text/plain')) {
    throw new HttpErrorResponse({
      error: await blobApiErrorMessage(body, 'ไม่สามารถสร้างไฟล์ Excel ได้'),
      status: 502,
    });
  }

  const head = new Uint8Array(await body.slice(0, 4).arrayBuffer());
  const isZip = head[0] === 0x50 && head[1] === 0x4b;
  if (!isZip) {
    throw new HttpErrorResponse({
      error: await blobApiErrorMessage(body, 'ไฟล์ที่ได้รับไม่ใช่ Excel — ลองรีเฟรชแล้วดาวน์โหลดใหม่'),
      status: 502,
    });
  }
}

/** Validate API blob response before saving as .xlsx (avoids Notepad-opening JSON errors). */
export async function parseExcelDownloadResponse(
  res: HttpResponse<Blob>,
): Promise<{ blob: Blob; filename: string }> {
  const body = res.body;
  if (!body || body.size === 0) {
    throw new HttpErrorResponse({
      error: { error: 'ไฟล์ว่าง — ลองใหม่อีกครั้ง' },
      status: 502,
    });
  }

  const contentType = res.headers.get('Content-Type') ?? body.type;
  if (contentType.toLowerCase().includes('json')) {
    throw new HttpErrorResponse({
      error: { error: await blobApiErrorMessage(body, 'ดาวน์โหลด Excel ไม่สำเร็จ') },
      status: res.status,
    });
  }

  await assertExcelBlob(body);

  const filename =
    parseContentDisposition(res.headers.get('Content-Disposition')) ?? 'D-rink-report.xlsx';

  const blob = new Blob([await body.arrayBuffer()], { type: XLSX_MIME });
  return { blob, filename };
}
