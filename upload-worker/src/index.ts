// upload-worker/src/index.ts — R2 업로드 프록시 Worker
// 🚀 목적: 클라이언트에서 R2 API 키를 제거하고, Worker가 R2 바인딩으로 직접 업로드
// 인증: Firebase Auth ID Token 검증 (Google 공개키로 JWT 서명 확인)

export interface Env {
  UPLOADS_BUCKET: R2Bucket;
  AVATARS_BUCKET: R2Bucket;
  ALLOWED_ORIGIN: string;
  PUBLIC_URL_UPLOADS: string;
  PUBLIC_URL_AVATARS: string;
  // 🛡️ Codef API 연동 (Phase E)
  CODEF_CLIENT_ID?: string;
  CODEF_CLIENT_SECRET?: string;
  CODEF_PUBLIC_KEY?: string;
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
      'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const json = (data: unknown, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Firebase Auth 토큰 검증 (모든 엔드포인트 공통)
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: '인증이 필요합니다.' }, 401);
    }
    const user = await verifyFirebaseToken(authHeader.slice(7));
    if (!user) {
      return json({ error: '유효하지 않은 인증 토큰입니다.' }, 401);
    }

    // ═══════════════════════════════════════════════════════
    // 🗑️ DELETE /delete — R2 파일 삭제 (Cloud Function 스케줄러 + 관리자용)
    // ═══════════════════════════════════════════════════════
    if (request.method === 'DELETE' || (request.method === 'POST' && url.pathname === '/delete')) {
      const body = await request.json().catch(() => ({})) as { filePath?: string };
      const delPath = body.filePath || url.searchParams.get('path');
      if (!delPath) return json({ error: 'filePath가 필요합니다.' }, 400);

      const isAvatar = delPath.startsWith('avatars/');
      const bucket = isAvatar ? env.AVATARS_BUCKET : env.UPLOADS_BUCKET;

      try {
        await bucket.delete(delPath);
        return json({ success: true, deleted: delPath });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown';
        return json({ error: `삭제 실패: ${message}` }, 500);
      }
    }

    // ═══════════════════════════════════════════════════════
    // 📸 GET /api/screenshot — R2 파일 프록시 (인증 필수, 직접 URL 비노출)
    // ═══════════════════════════════════════════════════════
    if (request.method === 'GET' && url.pathname === '/api/screenshot') {
      const filePath = url.searchParams.get('path');
      if (!filePath) return json({ error: 'path 파라미터가 필요합니다.' }, 400);

      const bucket = filePath.startsWith('avatars/') ? env.AVATARS_BUCKET : env.UPLOADS_BUCKET;
      const object = await bucket.get(filePath);
      if (!object) return json({ error: '파일을 찾을 수 없습니다.' }, 404);

      const headers = new Headers(corsHeaders);
      headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
      headers.set('Cache-Control', 'private, max-age=300');
      return new Response(object.body, { headers });
    }

    // ═══════════════════════════════════════════════════════
    // 🛡️ POST /api/verify-shares — Codef 주식잔고 조회 (mock 모드)
    // Phase E: 실제 Codef 연동 시 환경변수 CODEF_CLIENT_ID 존재 여부로 분기
    // ═══════════════════════════════════════════════════════
    if (request.method === 'POST' && url.pathname === '/api/verify-shares') {
      const body = await request.json().catch(() => ({})) as {
        stockCode?: string;
        communityId?: string;
        connectedId?: string;   // Codef Connected ID (실제 연동 시 필요)
        organization?: string;  // 증권사 코드
      };

      if (!body.stockCode || !body.communityId) {
        return json({ error: 'stockCode와 communityId가 필요합니다.' }, 400);
      }

      const tierLabels: Record<string, string> = { shrimp: '새우', shark: '상어', whale: '고래', megawhale: '대왕고래' };
      const tierEmojis: Record<string, string> = { shrimp: '🐟', shark: '🦈', whale: '🐋', megawhale: '🐳' };
      const calcTier = (qty: number) => qty >= 100000 ? 'megawhale' : qty >= 10000 ? 'whale' : qty >= 1000 ? 'shark' : 'shrimp';

      // 🛡️ Codef 키 존재 시 → 샌드박스/실제 API 호출
      if (env.CODEF_CLIENT_ID && env.CODEF_CLIENT_SECRET) {
        try {
          // 1. OAuth 토큰 발급
          const tokenRes = await fetch('https://oauth.codef.io/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `grant_type=client_credentials&client_id=${env.CODEF_CLIENT_ID}&client_secret=${env.CODEF_CLIENT_SECRET}`,
          });
          const tokenData = await tokenRes.json() as { access_token?: string };
          if (!tokenData.access_token) {
            return json({ error: 'Codef OAuth 토큰 발급 실패', details: tokenData }, 502);
          }

          // 2. 주식잔고조회 API (샌드박스: development.codef.io / 실제: api.codef.io)
          const apiBase = 'https://development.codef.io'; // 샌드박스
          const balanceRes = await fetch(`${apiBase}/v1/kr/stock/a/account/stock-balance-inquiry`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
            },
            body: JSON.stringify({
              connectedId: body.connectedId || 'sandbox_connected_id',
              organization: body.organization || '0247', // 기본: 삼성증권
              account: '',
              accountPassword: '',
            }),
          });
          const balanceData = await balanceRes.json() as {
            result?: { code?: string; message?: string };
            data?: { resItemList?: Array<{ resItemCode?: string; resHoldingQty?: string; resItemName?: string }> };
          };

          // 샌드박스 응답 파싱
          const items = balanceData?.data?.resItemList || [];
          const matched = items.find((i: { resItemCode?: string }) => i.resItemCode === body.stockCode);
          const qty = parseInt(matched?.resHoldingQty || '0', 10);
          const tier = calcTier(qty);

          return json({
            success: true,
            mock: false,
            sandbox: true,
            tier,
            tierLabel: tierLabels[tier],
            tierEmoji: tierEmojis[tier],
            stockCode: body.stockCode,
            verifiedAt: new Date().toISOString(),
            message: `[Sandbox] ${body.stockCode} 종목 → ${tierEmojis[tier]} ${tierLabels[tier]}`,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown';
          return json({ error: `Codef API 호출 실패: ${msg}` }, 502);
        }
      }

      // 🔧 Mock 모드: Codef 키 없으면 고정 응답 반환
      const mockQuantities: Record<string, number> = {
        '005930': 15000, '000660': 3500, '035420': 500, '051910': 150000,
      };
      const qty = mockQuantities[body.stockCode] ?? 2000;
      const tier = calcTier(qty);
      return json({
        success: true, mock: true, tier,
        tierLabel: tierLabels[tier], tierEmoji: tierEmojis[tier],
        stockCode: body.stockCode, verifiedAt: new Date().toISOString(),
        message: `[Mock] ${body.stockCode} 종목 ${qty.toLocaleString()}주 보유 → ${tierEmojis[tier]} ${tierLabels[tier]}`,
      });
    }

    // ═══════════════════════════════════════════════════════
    // 📤 POST /upload — 기존 R2 업로드 (변경 없음)
    // ═══════════════════════════════════════════════════════
    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const filePath = formData.get('filePath') as string | null;

    if (!file || !filePath) {
      return json({ error: 'file과 filePath가 필요합니다.' }, 400);
    }

    if (file.size > 10 * 1024 * 1024) {
      return json({ error: '파일이 너무 큽니다. 10MB 이하만 가능합니다.' }, 413);
    }

    // 🔒 경로 보안: uploads/, promo/, avatars/ 경로는 본인 UID 폴더만 허용
    if (filePath.startsWith('uploads/') || filePath.startsWith('promo/') || filePath.startsWith('avatars/') || filePath.startsWith('ad-banners/')) {
      const pathUid = filePath.split('/')[1];
      if (pathUid !== user.uid) {
        return json({ error: '본인 폴더에만 업로드할 수 있습니다.' }, 403);
      }
    }

    const isAvatar = filePath.startsWith('avatars/');
    const bucket = isAvatar ? env.AVATARS_BUCKET : env.UPLOADS_BUCKET;
    const publicUrl = isAvatar ? env.PUBLIC_URL_AVATARS : env.PUBLIC_URL_UPLOADS;

    try {
      const arrayBuffer = await file.arrayBuffer();
      await bucket.put(filePath, arrayBuffer, {
        httpMetadata: { contentType: file.type },
      });
      return json({ url: `${publicUrl}/${filePath}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      return json({ error: `업로드 실패: ${message}` }, 500);
    }
  },
};
