# 📜 HALMAL-ITSO 프로젝트 블루프린트 (설계 계약서)

이 문서는 "할말있소(HALMAL-ITSO)" 프로젝트의 모든 디자인, 로직, 그리고 AI 개발자의 **절대적 행동 지침**입니다. AI 개발자는 이 문서를 헌법처럼 준수해야 합니다.

## 0. AI 개발자 절대 수칙 (from GEMINI.md)

1. **Strict Focus & Code Protection**: 사용자 요구사항과 관련 없는 기존 코드(특히 Tailwind 레이아웃, 마진, 패딩)는 단 1픽셀도 임의로 수정하거나 삭제할 수 없다.
2. **Surgical Edit (`replace` Only)**: 파일 전체를 덮어쓰는 `write_file` 사용을 원칙적으로 금지하며, 오직 `replace` 도구를 사용하여 필요한 라인만 정밀하게 수술한다.
3. **Strategy Approval (선 보고 후 실행)**: 코드를 수정하기 전, 반드시 "어느 부분을 어떻게 고칠 것인지(AS-IS / TO-BE)"를 **한국어로** 보고하고 사용자의 확정 승인을 받은 후에만 도구를 실행한다.
4. **Component Decomposition**: 단일 파일 코드가 200라인을 초과하면 UI/로직/타입별로 파일을 분리하여 가독성과 AI 수정 정확도를 보장한다.

---

## 1. 뼈대 및 공통 레이아웃 (Global Layout)

### 1.1 헤더 (Header)
- **높이**: `h-[64px]`, 배경색 `white`, 하단 경계선 `slate-100`.
- **테스트 버튼**: 로고 옆 `Dev: 깐부1,2,3` 버튼 상시 배치. 
  - 클릭 시 자동 로그아웃 후 해당 계정으로 즉시 전환 (`handleTestLogin`).
  - 현재 로그인된 계정은 `bg-blue-600 text-white`로 강조.

### 1.2 사이드바 (Sidebar)
- **간격**: 항목당 `py-1.5`, 항목 간 `space-y-0.5`. (매우 촘촘한 디자인)
- **폰트**: `text-[12px]` 또는 `text-xs`, 굵은 폰트(`font-bold` 또는 `font-black`) 선호.

## 2. 화면별 상세 설계

### 2.1 홈 화면 (Home View)
- **필터링 로직 (절대 규칙)**: 
  - **아무말 (any)**: 게시 후 **1시간 이내** 모든 글.
  - **주목말 (recent)**: 시간 무관, 좋아요 **3개 이상**.
  - **대세말/명예말**: 좋아요 **10개/30개 이상**.
- **상단 탭**: `SubNavbar` 노출.

### 2.2 카테고리 화면 (Category View)
- **상단 헤더**: `CategoryHeader`. `SubNavbar`와 수직 위치(여백 `pt-5`, 높이 `h-[42px]`) 완벽 일치 필수.
- **필터링 로직**: 카테고리 진입 시 작성 시간과 무관하게 **좋아요 3개 이상**을 획득하여 살아남은 글만 노출.

### 2.3 한컷 시스템 (OneCut)
- **설명 바**: "긴 글을 짧고 강렬하게 파악하는 한컷 소식" (`CategoryHeader` 적용).
- **리스트**: 9:16 세로형 카드 그리드.
- **상세 뷰**: 3컬럼 구조, 이미지 외부 제목 배치, '연결된 할말' 버튼 중앙 배치.

### 2.4 새 할말 작성 (`CreatePostBox`)
- **컴팩트 레이아웃**: 섹션 간 간격 축소(`space-y-4`), 입력창 패딩 `py-2.5` 적용.
- **헤더**: 제목 "새 할말", 제출 버튼 패딩 `py-2`.
- **카테고리**: 주제 선택 목록에서 **"한컷" 제외** (일반 게시글 전용).
- **리치 에디터 (Rich Editor)**: 
  - **방식**: `contentEditable` 기반.
  - **커서 기억(Selection Memory)**: `prompt`나 `input file` 동작 시 커서 위치가 유실되지 않도록 `saveSelection`, `restoreSelection` 로직 필수 적용.
  - **이미지 업로드**: 복사-붙여넣기(`Paste`) 및 파일 선택 시 Cloudflare R2 자동 업로드 후 `insertImage` 실행.
  - **툴바 버튼**: H1, H2, P 텍스트를 "B" 버튼과 동일한 13px, `font-black` 스타일로 일치.

## 3. 데이터 및 기술 규칙

### 3.1 렌더링 규칙 (HTML Rendering)
- **보안 렌더링**: 상세 뷰 및 모달에서 `dangerouslySetInnerHTML={{ __html: post.content }}`을 사용하여 에디터의 서식을 출력.
- **스타일 안정화**: Tailwind **`prose`** 클래스를 사용하여 제목, 굵게, 이미지(모서리 둥글기 1rem, 그림자) 자동 스타일링.
- **목록 뷰 요약**: `PostCard`에서는 `line-clamp-3` 및 `prose-compact` 커스텀 CSS를 통해 글만 보여주고 **이미지는 숨김(`display: none`) 처리**하여 목록 가독성 유지.

### 3.2 Cloudflare R2
- **업로드**: 브라우저 환경 지원을 위해 `File` 객체를 `Uint8Array`로 변환 후 `PutObjectCommand` 전송.
- **메타데이터**: 한국어 등 비ASCII 문자 사용 금지.
