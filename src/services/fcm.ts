function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function base64url(source: ArrayBuffer) {
  let encoded = btoa(String.fromCharCode(...new Uint8Array(source)));
  encoded = encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return encoded;
}

async function getGoogleAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const encodedHeader = base64url(encoder.encode(JSON.stringify(header)).buffer as ArrayBuffer);
  const encodedClaim = base64url(encoder.encode(JSON.stringify(claim)).buffer as ArrayBuffer);
  const toSign = `${encodedHeader}.${encodedClaim}`;

  const pem = sa.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');

  const binaryDer = str2ab(atob(pem));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(toSign)
  );

  const jwt = `${toSign}.${base64url(signature)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json() as any;
  if (!data.access_token) {
    throw new Error('Failed to get Google Access Token');
  }

  return data.access_token;
}

export async function sendFcmNotification(
  serviceAccountJson: string,
  fcmToken: string,
  title: string,
  body: string
) {
  const sa = JSON.parse(serviceAccountJson);
  const accessToken = await getGoogleAccessToken(serviceAccountJson);
  const projectId = sa.project_id;

  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        notification: {
          title,
          body,
        },
      },
    }),
  });

  return res.json();
}