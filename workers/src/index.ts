export interface Env {
  ALLOWED_ORIGIN: string;
}

interface OgData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

// 내부 IP 대역 차단
function isPrivateUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === 'localhost' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0'
    );
  } catch {
    return true;
  }
}

function getMeta(html: string, property: string): string {
  // og: / twitter: property
  const ogMatch = html.match(
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i')
  );
  if (ogMatch) return ogMatch[1];

  // name= 방식 (description 등)
  const nameMatch = html.match(
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i')
  );
  if (nameMatch) return nameMatch[1];

  return '';
}

function getTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const allowedOrigins = [
      env.ALLOWED_ORIGIN,
      'https://geulove.com',          // 🎨 2026-04-20 브랜드 도메인 전환
      'https://halmal-itso.web.app',  // Firebase 기본 도메인 (폴백)
      'http://localhost:5173',
      'http://localhost:4173',
    ];
    const origin = request.headers.get('Origin') || '';
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    const reqUrl = new URL(request.url);
    const { pathname, searchParams } = reqUrl;

    // 🌏 /region — Cloudflare cf.* 기반 IP 지역 추정 (광고 viewerRegion 타겟팅용)
    //   cf.region: 영문 시/도명 (예: "Seoul", "Gyeonggi-do") — ipapi.co와 동일 형식
    //   cf.country: ISO 3166-1 alpha-2 (예: "KR")
    //   기존 ipapi.co 우회 — CORS·rate limit 0, Cloudflare Workers 무료 무제한
    if (pathname === '/region') {
      const cf = (request as unknown as { cf?: Record<string, unknown> }).cf || {};
      return new Response(JSON.stringify({
        region: (cf.region as string) || '',
        country: (cf.country as string) || '',
        city: (cf.city as string) || '',
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=1800', // 30분 — 클라이언트와 동일 캐시
        },
      });
    }

    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'url 파라미터가 필요합니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 프로토콜 검증
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return new Response(JSON.stringify({ error: '유효하지 않은 URL입니다.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 내부 IP 차단
    if (isPrivateUrl(targetUrl)) {
      return new Response(JSON.stringify({ error: '접근할 수 없는 URL입니다.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HalmalBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'ko,en;q=0.9',
        },
        signal: AbortSignal.timeout(6000),
        redirect: 'follow',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // HTML만 처리 (이미지·PDF 등 제외)
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        return new Response(JSON.stringify({ error: '미리보기를 지원하지 않는 URL입니다.' }), {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 메모리 절약: 최대 100KB만 읽음
      const reader = response.body?.getReader();
      let html = '';
      let bytesRead = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (bytesRead < 100_000) {
          const { done, value } = await reader.read();
          if (done) break;
          html += decoder.decode(value, { stream: true });
          bytesRead += value.length;
          // <head> 닫힌 이후면 파싱 충분
          if (html.includes('</head>')) break;
        }
        reader.cancel();
      }

      // 🚀 HTML 엔티티 디코딩 — OG 태그에 &#034; &#039; &amp; 등이 포함된 경우 처리
      const decodeEntities = (str: string): string =>
        str.replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
          .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
          .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

      const data: OgData = {
        title: decodeEntities(
          getMeta(html, 'og:title') ||
          getMeta(html, 'twitter:title') ||
          getTitle(html)),
        description: decodeEntities(
          getMeta(html, 'og:description') ||
          getMeta(html, 'twitter:description') ||
          getMeta(html, 'description')),
        image:
          getMeta(html, 'og:image') ||
          getMeta(html, 'twitter:image'),
        siteName:
          getMeta(html, 'og:site_name') ||
          new URL(targetUrl).hostname,
        url: targetUrl,
      };

      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      return new Response(JSON.stringify({ error: `미리보기 로딩 실패: ${message}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
