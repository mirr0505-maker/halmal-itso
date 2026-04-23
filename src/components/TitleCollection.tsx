// src/components/TitleCollection.tsx — 🏷️ 칭호 도감 (Sprint 5 Stage 4)
//
// 14종 칭호 전체를 카테고리별 그리드로 표시.
// 보유: TitleBadge 정상 렌더. 미획득: 🔒 잠금 실루엣 + 달성 조건 설명.
//
// Why: PublicProfile/MyPage에서 수집 진행률·목표 조건을 한눈에 파악 — 게임화 요소.
//      타인 프로필에서는 본인 보유만 하이라이트(다른 사람 미획득 상세 힌트 X).
import type { UserTitle } from '../types';
import type { TitleCategory } from '../types';
import { TITLE_CATALOG } from '../constants';
import TitleBadge from './TitleBadge';

interface Props {
  titles?: UserTitle[];           // 보유 칭호 배열 (users.titles)
  isOwnProfile?: boolean;         // 본인 프로필이면 미획득 조건 상세 노출
}

// 카테고리별 한글 타이틀
const CATEGORY_HEADINGS: Record<TitleCategory, { label: string; description: string }> = {
  creator:   { label: '🖊️ 창작자',  description: '글쓰기·화제 기록으로 얻는 칭호' },
  community: { label: '🤝 관계',    description: '깐부·대화·후원으로 얻는 칭호' },
  loyalty:   { label: '🎖️ 충성',    description: '가입·활동 기간·레벨로 얻는 칭호' },
};

const CATEGORY_ORDER: TitleCategory[] = ['creator', 'community', 'loyalty'];

const TitleCollection = ({ titles = [], isOwnProfile = false }: Props) => {
  // 보유 칭호 id → UserTitle 맵 (tier·suspended 정보 포함)
  const ownedMap = new Map(titles.map((t) => [t.id, t]));
  const ownedCount = titles.filter((t) => !t.suspended).length;
  const total = TITLE_CATALOG.length;

  return (
    <div className="space-y-6">
      {/* 수집 진행률 헤더 */}
      <div className="flex items-end justify-between border-b border-slate-200 pb-2">
        <div>
          <h3 className="text-base font-bold text-slate-800">🏷️ 칭호 도감</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            전체 {total}종 중 {ownedCount}개 보유
            {ownedCount > 0 && titles.some((t) => t.suspended) && ' (일부 정지됨)'}
          </p>
        </div>
        <div className="text-xs text-slate-400">
          {Math.round((ownedCount / total) * 100)}%
        </div>
      </div>

      {/* 카테고리별 섹션 */}
      {CATEGORY_ORDER.map((cat) => {
        const catTitles = TITLE_CATALOG.filter((t) => t.category === cat);
        const heading = CATEGORY_HEADINGS[cat];
        return (
          <section key={cat}>
            <div className="flex items-baseline gap-2 mb-2">
              <h4 className="text-sm font-semibold text-slate-700">{heading.label}</h4>
              <span className="text-[11px] text-slate-400">{heading.description}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {catTitles.map((master) => {
                const owned = ownedMap.get(master.id);
                if (owned) {
                  // 보유 — TitleBadge + 달성 시점 보조 텍스트
                  return (
                    <div
                      key={master.id}
                      className="rounded-lg border border-slate-200 bg-white p-2.5 flex flex-col gap-1.5"
                    >
                      <TitleBadge userTitle={owned} size="sm" showTooltip={false} />
                      <p className="text-[10px] text-slate-500 line-clamp-2 leading-tight">
                        {master.description}
                      </p>
                    </div>
                  );
                }
                // 미획득 — 잠금 실루엣
                return (
                  <div
                    key={master.id}
                    className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2.5 flex flex-col gap-1.5 opacity-60"
                    title={isOwnProfile ? master.description : '미획득'}
                  >
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <span aria-hidden="true" className="grayscale">🔒</span>
                      <span className="truncate">{master.label}</span>
                    </span>
                    <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                      {isOwnProfile ? master.description : '아직 획득하지 못함'}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default TitleCollection;
