/// <reference path="./deno.d.ts" />

export default async function (req: Request): Promise<Response> {
  const IFLYTEK_API_KEY = Deno.env.get('IFLYTEK_API_KEY') || '';
  const IFLYTEK_APP_ID = Deno.env.get('IFLYTEK_APP_ID') || '';
  const IFLYTEK_API_SECRET = Deno.env.get('IFLYTEK_API_SECRET') || '';

  const result: Record<string, string> = {};

  try {
    const url = 'https://api.xfyun.cn/v1/service/v1/iat';
    const curTime = Math.floor(Date.now() / 1000).toString();

    const param = JSON.stringify({ engine_type: 'sms16k', aue: 'raw' });
    const paramBase64 = btoa(param);

    const checkSumInput = IFLYTEK_API_KEY + curTime + paramBase64;
    const keyData = new TextEncoder().encode(IFLYTEK_API_SECRET);
    const inputData = new TextEncoder().encode(checkSumInput);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, inputData);
    const sigBytes = new Uint8Array(sig);
    let sigBinary = '';
    for (let i = 0; i < sigBytes.byteLength; i++) {
      sigBinary += String.fromCharCode(sigBytes[i]);
    }
    const checkSum = btoa(sigBinary);

    const body = new URLSearchParams();
    body.set('audio', 'dGVzdA==');
    body.set('appid', IFLYTEK_APP_ID);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-Appid': IFLYTEK_APP_ID,
        'X-CurTime': curTime,
        'X-Param': paramBase64,
        'X-CheckSum': checkSum,
      },
      body: body.toString(),
    });

    result.status = response.status.toString();
    result.response = await response.text();
  } catch (e) {
    result.error = String(e);
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
}
