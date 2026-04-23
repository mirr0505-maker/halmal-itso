# 글러브 GeuLove — 로고 & SNS 공유(OG) 적용 가이드

## 📦 포함된 파일

| 파일명 | 크기 | 용도 |
|--------|------|------|
| `og-image.png` | 1200×630 | **SNS 공유용 (최우선)** — 카카오톡, 페이스북, 트위터, LinkedIn 공유 시 노출 |
| `logo-square.png` | 1024×1024 | 앱 아이콘, 파비콘 원본 (한글 위/영문 아래 레이아웃) |
| `logo-wide.png` | 1200×400 | 홈페이지 헤더, 로딩 화면 |
| `logo-transparent.png` | 1200×400 | 투명 배경 — 컬러 배경 위에 얹을 때 |

**컬러 체계**: **G**(빨강) + **eu**(검정) + **L**(파랑) + **ove**(검정) / **글**(빨강) + **러브**(파랑)
모두 PNG 100KB 이하 (카카오톡 미리보기 안전 범위).

---

## 🚀 적용 순서 (halmal-itso 프로젝트)

### 1단계: 파일 배치

```
halmal-itso/
├── public/
│   ├── og-image.png           ← 여기 복사
│   ├── favicon.png            ← logo-square.png를 리네임해서 복사
│   ├── apple-touch-icon.png   ← logo-square.png를 512×512로 리사이즈
│   └── index.html
└── src/
    └── assets/
        └── logo.png           ← logo-wide.png (헤더 컴포넌트에서 import)
```

`public/` 폴더에 두면 빌드 후 `https://geulove.com/파일명`으로 접근 가능합니다.

---

### 2단계: `public/index.html` 메타 태그 추가

`<head>` 태그 안, 기존 `<title>` 아래에 다음을 붙여넣으세요:

```html
<!-- ============================ -->
<!-- Open Graph (카카오톡/페이스북/LinkedIn) -->
<!-- ============================ -->
<meta property="og:type" content="website" />
<meta property="og:site_name" content="글러브 GeuLove" />
<meta property="og:title" content="글러브 GeuLove — 할말있소" />
<meta property="og:description" content="당신의 이야기를 나누는 커뮤니티, 글러브" />
<meta property="og:image" content="https://geulove.com/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="글러브 GeuLove 로고" />
<meta property="og:url" content="https://geulove.com" />
<meta property="og:locale" content="ko_KR" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="글러브 GeuLove — 할말있소" />
<meta name="twitter:description" content="당신의 이야기를 나누는 커뮤니티, 글러브" />
<meta name="twitter:image" content="https://geulove.com/og-image.png" />

<!-- 파비콘 -->
<link rel="icon" type="image/png" href="/favicon.png" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- 테마 컬러 (모바일 브라우저 상단바 색) -->
<meta name="theme-color" content="#E63946" />
```

> **중요한 3가지**
> 1. `og:image`는 반드시 **절대 URL** (`https://...`) — 상대경로 쓰면 크롤러가 못 찾음
> 2. `og:image:width`, `og:image:height` 명시하면 카카오톡에서 큰 이미지로 표시됨
> 3. React SPA라서 JS로 동적으로 바꿔도 SNS 크롤러는 못 읽음 — **반드시 `index.html`의 정적 태그** 사용

---

### 3단계: 동적 OG 이미지 (선택 — 게시글별 다른 이미지)

게시글마다 본문 첫 이미지를 OG로 쓰고, 없으면 기본 로고로 fallback 하는 구조를 원하신다면, 이미 쓰시는 `halmal-upload-worker`처럼 Worker 하나를 더 두는 게 깔끔합니다.

간단한 패턴:

```javascript
// og-worker.js (Cloudflare Worker)
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';

    // SNS 크롤러만 감지해서 OG 태그 주입
    const isCrawler = /facebookexternalhit|twitterbot|kakaotalk-scrap|slackbot|linkedinbot|discordbot/i.test(userAgent);

    const postMatch = url.pathname.match(/^\/post\/([^\/]+)$/);

    if (isCrawler && postMatch) {
      const postId = postMatch[1];
      const post = await fetchPostFromFirestore(postId, env);

      // 본문에 이미지 있으면 그거 쓰고, 없으면 기본 로고
      const ogImage = post.firstImage || 'https://geulove.com/og-image.png';

      return new Response(renderOgHtml({
        title: post.title,
        description: post.summary,
        image: ogImage,
        url: request.url,
      }), { headers: { 'content-type': 'text/html; charset=utf-8' }});
    }

    // 일반 사용자는 Firebase Hosting으로 통과
    return fetch(request);
  }
}
```

wrangler.toml route 추가:
```toml
routes = [
  { pattern = "geulove.com/post/*", zone_name = "geulove.com" }
]
```

---

## 🧪 배포 후 테스트

| 플랫폼 | 검증 도구 |
|--------|----------|
| **카카오톡** | [kakao Dev OG 디버거](https://developers.kakao.com/tool/debugger/sharing) — 가장 중요 |
| **페이스북** | [Sharing Debugger](https://developers.facebook.com/tools/debug/) |
| **트위터** | [Card Validator](https://cards-dev.twitter.com/validator) |
| **LinkedIn** | [Post Inspector](https://www.linkedin.com/post-inspector/) |

### ⚠️ 카카오톡 캐시 주의

카카오톡은 OG 이미지를 **적극적으로 캐시**합니다. 이미지 바꿨는데 반영 안 되면:
1. 위 kakao 디버거에서 "초기화" 버튼 클릭
2. URL 뒤에 `?v=2` 같은 쿼리 추가해서 새 URL처럼 인식시키기

예: `<meta property="og:image" content="https://geulove.com/og-image.png?v=2026041901" />`

---

## 💡 추가 팁

- **Firebase Hosting 캐시**: `firebase.json`에서 `/og-image.png`의 cache-control을 짧게 (1시간) 두면 수정이 빠르게 반영됩니다
- **파비콘 안 바뀔 때**: 브라우저 캐시가 강해서 Ctrl+Shift+R 강제 새로고침 또는 시크릿 탭에서 확인
- **PWA 앱 아이콘**: `manifest.json`에도 `logo-square.png`를 192×192, 512×512 사이즈로 각각 넣어주세요
