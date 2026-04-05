// upload-worker/src/index.ts — R2 업로드 프록시 Worker
// 🚀 목적: 클라이언트에서 R2 API 키를 제거하고, Worker가 R2 바인딩으로 직접 업로드
// 인증: Firebase Auth ID Token 검증 (Google 공개키로 JWT 서명 확인)

export interface Env {
  UPLOADS_BUCKET: R2Bucket;
  AVATARS_BUCKET: R2Bucket;
  ALLOWED_ORIGIN: string;
  PUBLIC_URL_UPLOADS: string;
  PUBLIC_URL_AVATARS: string;
}

// Firebase Auth ID Token 검증 — Google 공개키로 RS256 서명 확인
// Why: 비로그인 사용자의 업로드 차단. 토큰에서 uid 추출해 경로 검증에도 사용
async function verifyFirebaseToken(token: string): Promise<{ uid: string } | null> {
  try {
    // JWT 파싱 (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const headerJson = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payloadJson = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // 만료 확인
    if (!payloadJson.exp || payloadJson.exp < Math.floor(Date.now() / 1000)) return null;
    // issuer 확인
    if (payloadJson.iss !== 'https://securetoken.google.com/halmal-itso') return null;

    // Google 공개키 가져오기
    const certsRes = await fetch(
      'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com',
      { cf: { cacheTtl: 3600 } as RequestInitCfProperties }
    );
    const certs = await certsRes.json() as Record<string, string>;
    const certPem = certs[headerJson.kid];
    if (!certPem) return null;

    // PEM → CryptoKey
    const pemBody = certPem.replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '').replace(/\s/g, '');
    const certDer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

    // x509 인증서에서 공개키 추출 (SubjectPublicKeyInfo)
    const spki = await extractPublicKeyFromCert(certDer);
    if (!spki) return null;

    const publicKey = await crypto.subtle.importKey(
      'spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']
    );

    // 서명 검증
    const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signedData);

    if (!valid) return null;
    return { uid: payloadJson.sub || payloadJson.user_id };
  } catch {
    return null;
  }
}

// x509 DER 인증서에서 SubjectPublicKeyInfo (공개키) 추출
// Why: Web Crypto API는 x509 인증서를 직접 import할 수 없어서 SPKI 부분만 파싱 필요
function extractPublicKeyFromCert(certDer: Uint8Array): Uint8Array | null {
  // ASN.1 DER에서 SubjectPublicKeyInfo 시퀀스를 찾는 간소화된 파서
  // RSA 공개키의 OID (1.2.840.113549.1.1.1)를 검색
  const rsaOid = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];

  for (let i = 0; i < certDer.length - rsaOid.length; i++) {
    let match = true;
    for (let j = 0; j < rsaOid.length; j++) {
      if (certDer[i + j] !== rsaOid[j]) { match = false; break; }
    }
    if (!match) continue;

    // OID 앞의 SEQUENCE 태그를 역추적하여 SubjectPublicKeyInfo 시작점 찾기
    // 구조: SEQUENCE { SEQUENCE { OID, NULL }, BIT STRING { ... } }
    // OID 앞: 06 09 (OID tag + length) → 그 앞: 30 0d (inner SEQUENCE) → 그 앞: 30 xx (outer SEQUENCE = SPKI)
    const oidTagPos = i - 2; // 06 09 위치
    if (oidTagPos < 2) continue;
    const innerSeqPos = oidTagPos - 2; // 30 0d 위치
    if (innerSeqPos < 2) continue;

    // outer SEQUENCE (SPKI) 시작 찾기: innerSeqPos 바로 앞
    // SPKI 길이는 가변이므로 역방향으로 SEQUENCE 태그 탐색
    for (let k = innerSeqPos - 1; k >= Math.max(0, innerSeqPos - 5); k--) {
      if (certDer[k] !== 0x30) continue;
      // 길이 파싱
      const lenByte = certDer[k + 1];
      let totalLen: number;
      let headerLen: number;
      if (lenByte < 0x80) {
        totalLen = lenByte;
        headerLen = 2;
      } else if (lenByte === 0x81) {
        totalLen = certDer[k + 2];
        headerLen = 3;
      } else if (lenByte === 0x82) {
        totalLen = (certDer[k + 3] | (certDer[k + 2] << 8));
        headerLen = 4;
      } else continue;

      const spkiEnd = k + headerLen + totalLen;
      // SPKI가 inner SEQUENCE와 BIT STRING을 포함하는지 확인
      if (spkiEnd > certDer.length) continue;
      if (spkiEnd < innerSeqPos + 20) continue; // 최소 크기 검증

      return certDer.slice(k, spkiEnd);
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = [
      env.ALLOWED_ORIGIN,
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Firebase Auth 토큰 검증
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '인증이 필요합니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const user = await verifyFirebaseToken(authHeader.slice(7));
    if (!user) {
      return new Response(JSON.stringify({ error: '유효하지 않은 인증 토큰입니다.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // multipart/form-data 파싱
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const filePath = formData.get('filePath') as string | null;

    if (!file || !filePath) {
      return new Response(JSON.stringify({ error: 'file과 filePath가 필요합니다.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 파일 크기 제한: 10MB
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: '파일이 너무 큽니다. 10MB 이하만 가능합니다.' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 🔒 경로 보안: uploads/, promo/ 경로는 본인 UID 폴더만 허용
    // Why: 타인의 파일을 덮어쓰는 공격 방지
    if (filePath.startsWith('uploads/') || filePath.startsWith('promo/')) {
      const pathUid = filePath.split('/')[1];
      if (pathUid !== user.uid) {
        return new Response(JSON.stringify({ error: '본인 폴더에만 업로드할 수 있습니다.' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 버킷 선택: avatars/ 경로 → AVATARS_BUCKET, 그 외 → UPLOADS_BUCKET
    const isAvatar = filePath.startsWith('avatars/');
    const bucket = isAvatar ? env.AVATARS_BUCKET : env.UPLOADS_BUCKET;
    const publicUrl = isAvatar ? env.PUBLIC_URL_AVATARS : env.PUBLIC_URL_UPLOADS;

    try {
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(filePath, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });

      return new Response(JSON.stringify({ url: `${publicUrl}/${filePath}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      return new Response(JSON.stringify({ error: `업로드 실패: ${message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
