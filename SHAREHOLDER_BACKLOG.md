# 📋 주주방 인증 — 미룬 작업 레지스트리 (SHAREHOLDER_BACKLOG)

> `SHAREHOLDER_TIER.md` 설계서에서 Sprint 1(Phase A~C + H)에 포함되지 않은 숙제 목록.
> 각 항목에 선행 조건과 착수 시점 기준을 명시.

최종 갱신: 2026-04-16

---

## 🔵 Phase E — Codef Worker 엔드포인트

| 항목 | 내용 |
|------|------|
| **작업** | `halmal-upload-worker`에 `POST /api/verify-shares` 엔드포인트 추가 |
| **기능** | Firebase Auth 토큰 검증 → Codef API 주식잔고조회 호출 → 해당 종목 보유수 추출 → tier 산정 → tier만 반환 (보유수 미반환) |
| **선행 조건** | Phase A~C 완료 + Codef 데모 계정 발급 (무료, 일 100회) |
| **착수 시점** | 서비스 안정화 후 (사용자 10+명 수준) |
| **환경변수** | `CODEF_CLIENT_ID`, `CODEF_CLIENT_SECRET`, `CODEF_PUBLIC_KEY` (Worker Secrets) |
| **Rate Limit** | 사용자당 일 3회 |
| **비용** | 개발/테스트: 0원 (Codef 샌드박스), 초기 운영: 0원 (데모 3개월) |
| **설계 상세** | [SHAREHOLDER_TIER.md](./SHAREHOLDER_TIER.md) §3-2~3-5 (원본 기획서 §3) 참조 |

---

## 🔵 Phase F — 클라이언트 마이데이터 UI

| 항목 | 내용 |
|------|------|
| **작업** | 주주방 멤버가 "📊 주식 보유 인증" 버튼으로 Codef 인증 → Worker 호출 → tier 자동 산정 요청 |
| **기능** | 증권사 선택 드롭다운 → Codef 인증서 팝업 → Worker 호출 → "🐋 고래 등급으로 인증 요청" 표시 → 방장 승인 대기 |
| **선행 조건** | Phase E Worker 완성 + Codef SDK 통합 |
| **착수 시점** | Phase E 안정화 후 |
| **위치** | 커뮤니티 설정 또는 멤버 프로필 영역 |
| **비용** | 0원 (Worker 비용은 Phase E에 포함) |

---

## 🟡 Codef 사업자 등록

| 항목 | 내용 |
|------|------|
| **작업** | Codef 정식 버전 전환을 위한 사업자등록증 제출 |
| **선행 조건** | 서비스 성장 + Codef 데모(일 100회) 한도 소진 시점 |
| **착수 시점** | Phase E 데모 운영 → 트래픽 증가 시 |
| **비용** | 월 구독 (codef.io에서 확인) |
| **참고** | Codef 데모는 3개월 무료 + 일 100회 → 초기 서비스에 충분 |

---

## 🟡 증거 이미지 presigned URL 시스템

| 항목 | 내용 |
|------|------|
| **작업** | 주주방 가입 시 증거 이미지(증권사 캡처 등)를 R2 업로드 → 현재 공개 URL 기반을 **presigned URL 5분 만료**로 강화 |
| **이유** | SHAREHOLDER_TIER.md §10 보안: 증거 이미지 직접 접근 차단, 열람 후 자동 만료 |
| **선행 조건** | 없음 (독립 작업 가능, 기존 R2 Worker 확장) |
| **착수 시점** | Sprint 1 이후 별도 작업으로 |
| **영향** | `halmal-upload-worker` + `JoinCommunityModal`(증거 업로드 UI) + `JoinAnswersDisplay`(이미지 조회 시 presigned URL 요청) |
| **비용** | 0원 (Cloudflare R2 무료 tier 내) |

---

## 🗑️ 완전 제거 항목 (숙제 아님, 아예 미추진)

| 항목 | 사유 |
|------|------|
| ~~가중치 투표 (Phase D)~~ | 기획에서 완전 제거. 투표 기능 자체 미구현 + MVP 단순화 |
| ~~TIER_VOTE_WEIGHT 타입~~ | Phase D 제거에 따라 삭제 |
| ~~투표 기능 신규 개발~~ | 별도 기획 필요, 주주 인증과 무관하게 진행 여부 판단 |

---

## ✅ 완료 항목

| 항목 | 완료일 | 커밋 |
|------|--------|------|
| *(Sprint 1 완료 후 여기에 기록)* | | |
