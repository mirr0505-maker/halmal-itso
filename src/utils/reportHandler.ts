// src/utils/reportHandler.ts — 🚨 공용 신고 핸들러 (Sprint 4 Phase C)
// Why: 8곳(Root/Post/FormalBoard/DebateBoard/OneCutDetail/OneCutComment/EpisodeReader/CommunityPostDetail)
//      에서 동일 패턴 반복 — submitReport CF 호출 + 사유 입력 + 결과 알림을 한 곳에 모음
// 검색어: reportHandler

import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

export type ReportTargetType =
  | 'post'
  | 'comment'
  | 'community_post'
  | 'community_post_comment'
  | 'episode';

/**
 * 신고 제출 — 사유 prompt → submitReport CF 호출 → 결과 알림
 * 로그인 유저만 호출 가능 (사전 체크 필요)
 */
export async function handleReport(
  targetType: ReportTargetType,
  targetId: string,
): Promise<void> {
  const reason = window.prompt(
    '신고 사유를 간단히 적어주세요. (선택, 300자 이내)\n\n예: 스팸 / 욕설 / 도배 / 저작권 침해 등',
    '',
  );
  // 사용자가 취소를 누르면 중단
  if (reason === null) return;

  try {
    const fn = httpsCallable<
      { targetType: ReportTargetType; targetId: string; reason: string },
      { success: boolean; alreadyReported: boolean }
    >(functions, 'submitReport');
    const { data } = await fn({ targetType, targetId, reason: reason.trim() });
    if (data.alreadyReported) {
      alert('이미 신고하신 내용입니다.');
    } else {
      alert('신고가 접수되었습니다. 운영진 검토 후 처리됩니다.');
    }
  } catch (err: unknown) {
    console.error('[submitReport]', err);
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    alert(`신고 처리에 실패했습니다.\n${msg}`);
  }
}
