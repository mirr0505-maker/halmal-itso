// src/utils/reportHandler.ts — 🚨 공용 신고 핸들러 (Sprint 4 Phase C + 2026-04-24 Phase 1 개편)
// Why: 8곳(Root/Post/FormalBoard/DebateBoard/OneCutDetail/OneCutComment/EpisodeReader/CommunityPostDetail)
//      에서 동일 패턴 반복. 2026-04-24: window.prompt → ReportModal(커스텀 이벤트 기반 글로벌 모달)
//      + 신고자 본인 localStorage 블라인드
// 검색어: reportHandler

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';
import { REPORT_REASON_META, type ReportReasonKey } from '../components/ReportModal';

export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'community_post'
  | 'community_post_comment'
  | 'episode';

// 🔒 신고자 본인 localStorage 블라인드 (UI 체감 개선, 서버 상태 무관)
const HIDDEN_BY_ME_KEY = 'report_hiddenByMe_v1';

export function getHiddenByMe(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_BY_ME_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

function addHiddenByMe(targetId: string): void {
  try {
    const set = getHiddenByMe();
    set.add(targetId);
    localStorage.setItem(HIDDEN_BY_ME_KEY, JSON.stringify([...set]));
  } catch { /* noop */ }
}

// 🚀 커스텀 이벤트 — handleReport 호출 시 ReportModalHost가 감지해 모달 오픈
// Why: 기존 8곳 호출부 서명 유지하면서 UI만 교체. 전역 모달 1개로 단순화
const REPORT_EVENT = 'halmal:open-report-modal';

interface ReportModalEventDetail {
  targetType: ReportTargetType;
  targetId: string;
}

/**
 * 신고하기 트리거 — 커스텀 이벤트 발송 → ReportModalHost가 모달 오픈
 * 기존 호출부(`handleReport('post', id)`)는 그대로 동작
 */
export function handleReport(targetType: ReportTargetType, targetId: string): void {
  window.dispatchEvent(new CustomEvent<ReportModalEventDetail>(REPORT_EVENT, {
    detail: { targetType, targetId },
  }));
}

/**
 * ReportModalHost가 사용 — 이벤트 리스너 등록/해제 헬퍼
 */
export function subscribeReportRequests(
  handler: (detail: ReportModalEventDetail) => void,
): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<ReportModalEventDetail>).detail);
  window.addEventListener(REPORT_EVENT, listener);
  return () => window.removeEventListener(REPORT_EVENT, listener);
}

/**
 * 실제 CF 호출 — ReportModalHost가 유저 제출 시 호출
 */
export async function submitReportCall(
  targetType: ReportTargetType,
  targetId: string,
  reasonKey: ReportReasonKey,
  detail: string,
): Promise<{ success: boolean; alreadyReported: boolean }> {
  const reasonLabel = REPORT_REASON_META[reasonKey]?.label || '기타';
  const reason = detail ? `[${reasonLabel}] ${detail}` : `[${reasonLabel}]`;
  const fn = httpsCallable<
    { targetType: ReportTargetType; targetId: string; reasonKey: ReportReasonKey; reason: string },
    { success: boolean; alreadyReported: boolean }
  >(functions, 'submitReport');
  const { data } = await fn({ targetType, targetId, reasonKey, reason });
  if (data.success && !data.alreadyReported) addHiddenByMe(targetId);
  return data;
}
