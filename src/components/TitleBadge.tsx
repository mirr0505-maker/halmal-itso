// src/components/TitleBadge.tsx — 🏷️ 단일 칭호 배지 (Sprint 5 Stage 4)
//
// 단일 칭호 1개를 이모지+라벨 배지 형태로 렌더. suspended면 회색 톤 + 오프닝 명시.
// 사이즈: sm / md / lg (MapaeBadge 톤 맞춤)
//
// Why: TITLE_CATALOG의 label/labelByTier를 resolve해 일관 표시 — 대소문자/오타 방지.
//      상세 뷰 전용(MapaeBadge 규칙 동일: 리스트·피드 금지, feedback_reputation_avatar_scope).
import type { TitleTier, UserTitle } from '../types';
import { TITLE_CATALOG } from '../constants';

interface Props {
  userTitle: UserTitle;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  onClick?: () => void;
}

// 🚀 사이즈별 스타일 — MapaeBadge 톤 (px·gap·폰트 단계 동일)
const SIZE_MAP: Record<NonNullable<Props['size']>, { wrap: string; text: string; emoji: string }> = {
  sm: { wrap: 'px-2 py-0.5',  text: 'text-[10px]', emoji: 'text-xs' },
  md: { wrap: 'px-2.5 py-1',  text: 'text-[11px]', emoji: 'text-sm' },
  lg: { wrap: 'px-3 py-1.5',  text: 'text-[13px]', emoji: 'text-base' },
};

// 카테고리별 컬러 — creator=amber / community=teal / loyalty=violet
// Why: 한눈에 성격 구분(작가·관계·충성). 배경은 연한 색, 보더+텍스트는 진한 색.
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  creator:   { bg: 'bg-amber-50',  text: 'text-amber-800',  border: 'border-amber-300'  },
  community: { bg: 'bg-teal-50',   text: 'text-teal-800',   border: 'border-teal-300'   },
  loyalty:   { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-300' },
};

// suspended 상태 공통 톤 — 채도 죽이고 살짝 반투명
const SUSPENDED_COLORS = { bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-300' };

// tier → 로마자 (Sprint 5 V1 범위: I / II / III)
function tierText(tier?: TitleTier): string {
  return tier ? ` ${tier}` : '';
}

const TitleBadge = ({ userTitle, size = 'md', showTooltip = true, onClick }: Props) => {
  const master = TITLE_CATALOG.find((t) => t.id === userTitle.id);
  if (!master) return null; // 마스터 누락 시 조용히 숨김 (시드 전 상태 대비)

  const label = userTitle.tier && master.labelByTier?.[userTitle.tier]
    ? master.labelByTier[userTitle.tier]
    : master.label;
  const isSuspended = userTitle.suspended === true;
  const color = isSuspended ? SUSPENDED_COLORS : (CATEGORY_COLORS[master.category] || CATEGORY_COLORS.loyalty);
  const { wrap, text, emoji } = SIZE_MAP[size];

  const tooltip = showTooltip
    ? (isSuspended
        ? `${label}${tierText(userTitle.tier)} — 유배 중 일시정지`
        : `${label}${tierText(userTitle.tier)} · ${master.description}`)
    : undefined;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border font-semibold ${color.bg} ${color.text} ${color.border} ${wrap} ${text} ${isSuspended ? 'opacity-70' : ''} ${onClick ? 'cursor-pointer hover:brightness-95' : ''}`}
      title={tooltip}
      aria-label={tooltip}
      onClick={onClick}
    >
      <span className={emoji} aria-hidden="true">{master.emoji}</span>
      <span>{label}{tierText(userTitle.tier)}</span>
      {isSuspended && <span className="text-[9px] opacity-75">(정지)</span>}
    </span>
  );
};

export default TitleBadge;
