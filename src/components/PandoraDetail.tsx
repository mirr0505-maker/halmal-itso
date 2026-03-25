// src/components/PandoraDetail.tsx — 판도라의 상자 상세글 전용 섹션
import type { Post } from '../types';

interface Props {
  post: Post;
}

const VERDICT_MAP = {
  fact:      { label: '✅ 사실 확인', className: 'text-emerald-700 bg-emerald-50 border-emerald-300' },
  false:     { label: '❌ 허위 판명', className: 'text-rose-600    bg-rose-50    border-rose-300' },
  uncertain: { label: '🔍 미정.보류', className: 'text-slate-500   bg-slate-50   border-slate-300' },
} as const;

const PandoraDetail = ({ post }: Props) => {
  const hasClaimInfo = post.claimSource || post.claimLinkUrl;
  const hasFactCheck = post.verdict || post.factCheckResult || (post.factCheckSources?.length ?? 0) > 0;

  if (!hasClaimInfo && !hasFactCheck) return null;

  return (
    <div className="flex flex-col gap-4 mb-6">

      {/* 출처 정보 */}
      {hasClaimInfo && (
        <div className="flex flex-col gap-1.5 px-4 py-3 bg-slate-50 rounded-xl border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">출처</span>
          {post.claimSource && (
            <span className="text-[13px] font-bold text-slate-700">{post.claimSource}</span>
          )}
          {post.claimLinkUrl && (
            <a
              href={post.claimLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[12px] font-bold text-blue-500 hover:underline break-all"
            >
              {post.claimLinkUrl}
            </a>
          )}
        </div>
      )}

      {/* 구분선 */}
      {hasFactCheck && <hr className="border-slate-200" />}

      {/* 팩트체크 결과 */}
      {hasFactCheck && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="w-1 h-4 bg-amber-400 rounded-full" />
            <span className="text-[14px] font-black text-amber-600 uppercase tracking-widest">팩트체크 결과</span>
            {post.verdict && (
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${VERDICT_MAP[post.verdict].className}`}>
                {VERDICT_MAP[post.verdict].label}
              </span>
            )}
          </div>

          {post.factCheckResult && (
            <p className="text-[14px] text-slate-700 font-medium leading-[1.8] whitespace-pre-wrap">
              {post.factCheckResult}
            </p>
          )}

          {(post.factCheckSources?.filter(s => s.trim()) ?? []).length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">팩트체크 출처</span>
              {post.factCheckSources!.filter(s => s.trim()).map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={e => e.stopPropagation()}
                  className="text-[12px] font-bold text-blue-500 hover:underline break-all"
                >
                  {src}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PandoraDetail;
