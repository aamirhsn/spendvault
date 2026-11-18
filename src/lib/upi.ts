export interface UpiPayload {
  raw: string;
  vpa: string; // pa
  name: string; // pn
  mcc: string; // mc
  amount?: string; // am
  currency?: string; // cu
  note?: string; // tn
  txnRef?: string; // tr
  mode?: string;
  purpose?: string;
  orgId?: string;
  isMerchant: boolean;
  params: Record<string, string>;
}

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/**
 * Parse a UPI QR payload such as
 *   upi://pay?pa=merchant@okaxis&pn=Some%20Store&mc=5411&tr=...&cu=INR
 * Also handles Bharat QR strings that embed a UPI URI, and the `upi://mandate` scheme.
 */
export function parseUpi(text: string): UpiPayload | null {
  const raw = text.trim();
  const m = raw.match(/upi:\/\/[a-z]+\?[^\s]*/i);
  if (!m) return null;
  const query = m[0].slice(m[0].indexOf('?') + 1);
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const k = (i < 0 ? part : part.slice(0, i)).toLowerCase();
    const v = i < 0 ? '' : safeDecode(part.slice(i + 1));
    params[k] = v;
  }
  const vpa = params.pa ?? '';
  if (!vpa) return null;
  const mcc = (params.mc ?? '').replace(/\D/g, '');
  return {
    raw,
    vpa,
    name: params.pn ?? '',
    mcc,
    amount: params.am,
    currency: params.cu,
    note: params.tn,
    txnRef: params.tr,
    mode: params.mode,
    purpose: params.purpose,
    orgId: params.orgid,
    isMerchant: !!mcc && mcc !== '0000',
    params,
  };
}
