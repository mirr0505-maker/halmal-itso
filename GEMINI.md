# 현재 프로젝트 현황 (2026-03-19)

> 이 섹션은 AI가 새 세션을 시작할 때 컨텍스트를 빠르게 파악하기 위한 요약입니다.
> 상세 설계는 **blueprint.md**를 참조하세요.

## 프로젝트 식별
- **이름**: 할말있소 (HALMAL-ITSO) — 한국어 소셜 토론 플랫폼
- **스택**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Firebase + Cloudflare R2 + Tiptap 에디터
- **브랜치**: `main`

## 구현 완료 기능
- Google OAuth + 테스트 계정 (깐부1/2/3)
- Tiptap 리치 에디터 (스티키 툴바 + 이미지 R2 업로드 + 드래그&드롭)
- 상세 뷰 리뉴얼 (콤팩트 2컬럼 레이아웃, 카테고리별 맞춤 탭 UI)
- 리스트 뷰 최적화 (가변 그리드, 본문 이미지 자동 추출 썸네일)
- 한컷 시스템 고도화 (9:16 상세 뷰, 추천 사이드바, 일반 게시글 연동)
- 실시간 상호작용 (좋아요, 팔로우, 차단, 댓글 카운트)
- Firebase Hosting 배포 완료

## 현재 수정 및 개선 필요 사항
- **에디터 보완**: `bubble-menu` 활성화 (텍스트 선택 시 서식 도구).
- **리팩토링**: 200라인 초과 파일(`App.tsx`, `DiscussionView.tsx`) 분리.
- **마켓 메뉴**: 기능 정의 및 UI 구현.

---

# **AI Development Guidelines for React in Firebase Studio**
... (이하 기존 가이드라인 유지)
