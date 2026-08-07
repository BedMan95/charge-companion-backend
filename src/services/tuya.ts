export async function generateSignature(
  clientId: string,
  secret: string,
  method: string,
  path: string,
  query: Record<string, string>,
  body: string,
  t: string,
  nonce: string = '',
  accessToken: string = ''
): Promise<{ sign: string; stringToSign: string }> {
  const contentHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body)
  );

  const hashArray = Array.from(new Uint8Array(contentHash));
  const contentHashStr = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  let queryStr = '';
  if (Object.keys(query).length > 0) {
    queryStr = Object.keys(query)
      .sort()
      .map(key => `${key}=${query[key]}`)
      .join('&');
    queryStr = `?${queryStr}`;
  }

  const stringToSign = [
    method,
    contentHashStr,
    '',
    path + queryStr
  ].join('\n');

  const strForSign = clientId + accessToken + t + nonce + stringToSign;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(strForSign)
  );

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const sign = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

  return { sign, stringToSign };
}

export async function getTuyaAccessToken(
  clientId: string,
  clientSecret: string,
  baseUrl: string
): Promise<string> {
  const t = Date.now().toString();
  const path = '/v1.0/token?grant_type=1';

  const { sign } = await generateSignature(
    clientId,
    clientSecret,
    'GET',
    '/v1.0/token',
    { grant_type: '1' },
    '',
    t
  );

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      'client_id': clientId,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256'
    }
  });

  const data = await response.json() as any;
  if (!data.success) {
    throw new Error(`Failed to get Tuya token: ${data.msg}`);
  }

  return data.result.access_token;
}

export async function getDeviceStatus(
  clientId: string,
  clientSecret: string,
  baseUrl: string,
  deviceId: string,
  accessToken: string
): Promise<number> {
  const t = Date.now().toString();
  const path = `/v1.0/iot-03/devices/${deviceId}/status`;

  const { sign } = await generateSignature(
    clientId,
    clientSecret,
    'GET',
    path,
    {},
    '',
    t,
    '',
    accessToken
  );

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: {
      'client_id': clientId,
      'access_token': accessToken,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256'
    }
  });

  const data = await response.json() as any;
  if (!data.success) {
    throw new Error(`Failed to get Tuya device status: ${data.msg}`);
  }

  const powerStatus = data.result.find((s: any) => s.code === 'cur_power');
  if (!powerStatus) {
    throw new Error('Power status not found');
  }

  return Number(powerStatus.value) / 10;
}

export async function sendTuyaCommand(
  clientId: string,
  clientSecret: string,
  baseUrl: string,
  deviceId: string,
  accessToken: string,
  commands: any[]
): Promise<any> {
  const t = Date.now().toString();
  const path = `/v1.0/iot-03/devices/${deviceId}/commands`;
  const body = JSON.stringify({ commands });

  const { sign } = await generateSignature(
    clientId,
    clientSecret,
    'POST',
    path,
    {},
    body,
    t,
    '',
    accessToken
  );

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'client_id': clientId,
      'access_token': accessToken,
      'sign': sign,
      't': t,
      'sign_method': 'HMAC-SHA256',
      'Content-Type': 'application/json'
    },
    body
  });

  return response.json();
}

export async function turnOffDevice(
  clientId: string,
  clientSecret: string,
  baseUrl: string,
  deviceId: string,
  accessToken: string
): Promise<boolean> {
  const data = await sendTuyaCommand(clientId, clientSecret, baseUrl, deviceId, accessToken, [
    { code: 'switch_1', value: false }
  ]);
  return data.success;
}