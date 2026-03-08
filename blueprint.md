# HALMAL-ITSO Project Blueprint

## Overview
HALMAL-ITSO is a modern React application integrated with Firebase and Cloudflare R2, designed for open discussion and community interaction.

## Project Progress & Current Features
- **Sidebar Menu Structure (Updated 2026-03-08)**:
  - **Home (홈)**: 메인 피드 및 전체 게시글 확인.
  - **나의 이야기**: 현재를 살아가는 내가 들려주는 이야기 (즐겁고 재밌는, 슬프고 힘든, 짜증나고 싫증나는 일상의 소식들).
  - **벌거벗은 임금님**: 사회 전반 퍼져 있는 거짓에 대한 진실 공개 및 팩트 체크.
  - **임금님 귀는 당나귀 귀**: 정치, 사회, 문화 등 전반 이슈에 대한 찬/반 토론의 장.
  - **지식 소매상**: 정치, 경제, 문학 등 다양한 분야의 지식 공유 및 판매.
  - **뼈때리는 글**: 이 시대 경종을 울리는 타골명언 및 띵언 수집.
  - **현지 소식**: 국내외 주민들이 전하는 생생한 지역 소식 및 뉴스 번역.
  - **유배·귀양지**: 격리된 사용자들이 소통하는 공간 (주제 자유).
  - **(Separator)**: 서비스 메뉴와 사용자 메뉴 구분.
  - **깐부맺기**: 사용자 간 네트워크 형성 및 홍보.
  - **내정보**: 개인 프로필 및 활동 내역 관리.

- **Deployment**: Successfully deployed to **Cloudflare Pages** via GitHub integration.
- **Security**: Environment variables (.env) are used for all sensitive keys (Firebase, R2).
- **Firebase Integration**: 
  - Firestore: Stores posts, comments, and user profiles.
  - Authentication: API keys secured with website restrictions.
- **Cloudflare R2 Integration**: 
  - Used for storing high-volume assets (images).
  - Configured via S3-compatible client in `src/s3Client.ts`.
- **Main Features**:
  - `AnyTalkList`, `LatestTalkList`, `BestTalkList`, `FriendTalkList` for exploring posts.
  - `DiscussionView` for detailed debate topics.
  - `MyPage` with profile management and activity tracking.
- **Recent Design Enhancements (2026-03-08)**:
  - **Sidebar Menu Overhaul**: Added 7 new category menus and redesigned the layout for better navigation.
  - **My Page Upgrade**: 
    - **Integrated Profile Editing**: Avatar, nickname, and bio are now edited in a single, unified mode activated by a pencil icon.
    - **Visual Design**: Matched the home screen's sophisticated atmosphere using `bg-[#F8FAFC]`, `shadow-xl`, and `rounded-[2.5rem]`.
    - **Typography**: Applied `font-black` and `font-[1000]` to match the home screen's bold typography.
    - **Avatar Collection**: Displayed user's avatar collection with lock states based on level.
    - **Phone Verification UI**: Improved the unverified phone UI with a clear rose-colored warning design and lock icon.
    - **Activity Milestones**: Redesigned experience and reputation bars with gradients and shadow effects.

## Proposed Step 5: Optimization & Real-world Testing
1. **R2 Public URL Mapping**:
   - Ensure `VITE_R2_PUBLIC_URL` is correctly mapped to the R2 dev domain or a custom domain.
2. **CORS Policy Check**:
   - Verify if client-side R2 uploads work without CORS errors on the production domain.
3. **Analytics & Monitoring**:
   - (Optional) Integrate Firebase Analytics or Cloudflare Web Analytics to monitor user engagement.

---
*Updated on 2026-03-08 (New Sidebar Menu Structure)*
