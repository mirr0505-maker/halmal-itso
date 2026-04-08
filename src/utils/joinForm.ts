// src/utils/joinForm.ts — 가입 폼 빌더 유틸 함수
import type { JoinForm, StandardField, StandardFieldKey, JoinAnswers, SharesUnit, VerifiedBadge } from '../types';

// 표준 필드 5개의 기본값 (커뮤니티 생성 시 초기 상태)
export const DEFAULT_STANDARD_FIELDS: StandardField[] = [
  { key: 'name',   enabled: true,  required: true },
  { key: 'region', enabled: true,  required: true },
  { key: 'phone',  enabled: true,  required: true },
  { key: 'email',  enabled: true,  required: true },
  { key: 'shares', enabled: true,  required: true, sharesUnit: '100', sharesLabel: '' },
];

// 표준 필드 한글 라벨
export const STANDARD_FIELD_LABELS: Record<StandardFieldKey, string> = {
  name:   '이름',
  region: '거주 지역',
  phone:  '연락처',
  email:  '이메일',
  shares: '보유 수량',
};

// 기본 가입 폼 (커뮤니티 생성 시)
export const getDefaultJoinForm = (): JoinForm => ({
  standardFields: DEFAULT_STANDARD_FIELDS.map(f => ({ ...f })),
  customQuestions: [],
});

// 남은 슬롯 수 (총 5개 제한)
export const getRemainingSlots = (joinForm?: JoinForm): number => {
  if (!joinForm) return 5;
  const enabledStd = joinForm.standardFields.filter(f => f.enabled).length;
  const customCount = joinForm.customQuestions.length;
  return Math.max(0, 5 - enabledStd - customCount);
};

// 사용 중인 총 항목 수
export const getTotalActiveItems = (joinForm?: JoinForm): number => {
  if (!joinForm) return 0;
  return joinForm.standardFields.filter(f => f.enabled).length + joinForm.customQuestions.length;
};

// 신청자 답변 검증 (제출 전 필수 항목 체크)
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export const validateJoinAnswers = (joinForm: JoinForm, answers: JoinAnswers): ValidationResult => {
  const errors: string[] = [];

  // 표준 필드 검증
  for (const field of joinForm.standardFields) {
    if (!field.enabled || !field.required) continue;
    const std = answers.standard ?? {};
    switch (field.key) {
      case 'name':
        if (!std.name?.trim()) errors.push(`${STANDARD_FIELD_LABELS.name}을(를) 입력해주세요`);
        break;
      case 'region':
        if (!std.region?.sido || !std.region?.sigungu) {
          errors.push(`${STANDARD_FIELD_LABELS.region}을(를) 선택해주세요`);
        }
        break;
      case 'phone':
        if (!std.phone?.trim()) errors.push(`${STANDARD_FIELD_LABELS.phone}을(를) 입력해주세요`);
        else if (!/^[0-9\-\s]{9,15}$/.test(std.phone.trim())) errors.push('연락처 형식이 올바르지 않습니다');
        break;
      case 'email':
        if (!std.email?.trim()) errors.push(`${STANDARD_FIELD_LABELS.email}을(를) 입력해주세요`);
        else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(std.email.trim())) errors.push('이메일 형식이 올바르지 않습니다');
        break;
      case 'shares':
        if (std.shares?.value == null || std.shares.value <= 0) {
          errors.push(`${STANDARD_FIELD_LABELS.shares}을(를) 입력해주세요`);
        }
        break;
    }
  }

  // 커스텀 질문 검증
  for (const q of joinForm.customQuestions) {
    if (!q.required) continue;
    const found = answers.custom?.find(a => a.questionId === q.id);
    if (!found || !found.answer.trim()) {
      errors.push(`"${q.label}"에 답변해주세요`);
    }
  }

  return { valid: errors.length === 0, errors };
};

// 주식수 표시 (단위 적용해서 사람이 읽기 좋게)
export const formatShares = (shares?: { value: number; unit: SharesUnit; label?: string }): string => {
  if (!shares) return '';
  const multiplier = parseInt(shares.unit, 10);
  const totalShares = shares.value * multiplier;
  const formatted = totalShares.toLocaleString('ko-KR');
  const labelPart = shares.label ? `${shares.label} ` : '';
  return `${labelPart}${formatted}주`;
};

// 인증 마킹 표시 ("🛡️ 주주 인증 (25.4.8)")
export const formatVerifiedBadge = (verified?: VerifiedBadge): string => {
  if (!verified) return '';
  const label = verified.label?.trim() || '인증';
  const ts = verified.verifiedAt;
  let dateStr = '';
  if (ts) {
    const date = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    const yy = String(date.getFullYear()).slice(2);
    const m = date.getMonth() + 1;
    const d = date.getDate();
    dateStr = `${yy}.${m}.${d}`;
  }
  return dateStr ? `🛡️ ${label} 인증 (${dateStr})` : `🛡️ ${label} 인증`;
};

// 커스텀 질문 ID 생성기
export const generateCustomQuestionId = (): string => {
  return `cq_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
};
