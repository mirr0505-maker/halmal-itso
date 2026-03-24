// src/components/LinkPreviewCard.tsx — 링크 OG 미리보기 카드
interface OgData {
  title: string;
  description: string;
  image: string;
  siteName: string;
  url: string;
}

interface Props {
  data: OgData | null;
  loading: boolean;
  onClose: () => void;
}

const LinkPreviewCard = ({ data, loading, onClose }: Props) => {
  if (loading) {
    return (
      <div className="mx-4 my-2 rounded-lg border border-slate-200 bg-slate-50 p-3 animate-pulse">
        <div className="h-3 bg-slate-200 rounded w-1/4 mb-2" />
        <div className="h-4 bg-slate-200 rounded w-3/4 mb-1.5" />
        <div className="h-3 bg-slate-200 rounded w-full" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-4 my-2 rounded-lg border border-slate-200 bg-white overflow-hidden flex group relative">
      {data.image && (
        <img
          src={data.image}
          alt=""
          className="w-24 h-20 object-cover flex-shrink-0"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div className="flex-1 p-3 min-w-0">
        <p className="text-[10px] text-slate-400 font-medium mb-0.5 truncate">{data.siteName}</p>
        <a
          href={data.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-bold text-slate-800 hover:text-blue-600 line-clamp-1 block"
        >
          {data.title || data.url}
        </a>
        {data.description && (
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mt-0.5">
            {data.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default LinkPreviewCard;
export type { OgData };
