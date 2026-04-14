// src/components/ExileMainPage.tsx — 🏚️ 놀부의 텅 빈 곳간 (유배자 메인 화면)
// 3탭 (놀부곳간 / 무인도 / 절해고도) + 상태 카드 + 속죄금 결제 버튼
// 차분한 톤 (이모지 최소화, slate/amber 계열)
import { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { addDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import type { UserData, SanctionStatus } from '../types';
import { formatKoreanNumber } from '../utils';
import ExileBoard from './ExileBoard';

interface Props {
  currentUserData: UserData;
  onReleased?: () => void;
}

// 상태 → 단계 번호
const statusToLevel = (status?: SanctionStatus): 1 | 2 | 3 | null => {
  if (status === 'exiled_lv1') return 1;
  if (status === 'exiled_lv2') return 2;
  if (status === 'exiled_lv3') return 3;
  return null;
};

// 탭 정의
const TABS = [
  { level: 1 as const, label: '놀부의 곳간',  days: 3,  bail: 10 },
  { level: 2 as const, label: '무인도 귀양지', days: 7,  bail: 50 },
  { level: 3 as const, label: '절해고도',     days: 30, bail: 300 },
];

const ExileMainPage = ({ currentUserData, onReleased }: Props) => {
  const myLevel = statusToLevel(currentUserData.sanctionStatus);
  const [activeTab, setActiveTab] = useState<1 | 2 | 3>(myLevel || 1);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);

  // 반성 기간 카운트다운
  useEffect(() => {
    const expiresAt = currentUserData.sanctionExpiresAt;
    if (!expiresAt) return;
    const expiresMs = (expiresAt as unknown as { toMillis?: () => number }).toMillis?.()
      || (expiresAt as unknown as { seconds: number }).seconds * 1000;
    const update = () => setRemainingSec(Math.max(0, Math.floor((expiresMs - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [currentUserData.sanctionExpiresAt]);

  const canPay = remainingSec === 0;
  const balance = currentUserData.ballBalance || 0;
  const bail = currentUserData.requiredBail || 0;
  const hasEnoughBalance = balance >= bail;

  const handleRelease = async () => {
    if (!canPay) { setError('반성 기간이 아직 끝나지 않았습니다.'); return; }
    if (!hasEnoughBalance) { setError(`속죄금이 부족합니다. (필요: ${bail}볼, 보유: ${balance}볼)`); return; }

    if (!window.confirm(
      `🏀 ${bail}볼을 속죄금으로 바치고 곳간에서 나가시겠습니까?\n\n` +
      `⚠️ 주의: 모든 깐부 관계가 초기화됩니다.\n` +
      `전과 기록(strikeCount ${currentUserData.strikeCount || 0}범)은 영구 보존됩니다.`
    )) return;

    setProcessing(true);
    setError(null);
    try {
      const fn = httpsCallable(functions, 'releaseFromExile');
      const result = await fn({});
      const data = result.data as { success: boolean; atonementFeePaid: number; kkanbusRemovedCount: number };
      alert(
        `곳간 문이 열렸습니다.\n\n` +
        `속죄금 ${data.atonementFeePaid}볼을 바치고 유배에서 풀려났습니다.\n` +
        `깐부 관계 ${data.kkanbusRemovedCount}명이 초기화되었습니다.\n\n` +
        `다시 좋은 사람으로 살아가시오.`
      );
      onReleased?.();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '해금 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  // 반성 기간 표시
  const formatRemaining = (sec: number) => {
    if (sec === 0) return '반성 완료';
    const days = Math.floor(sec / 86400);
    const hours = Math.floor((sec % 86400) / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (days > 0) return `${days}일 ${hours}시간 남음`;
    if (hours > 0) return `${hours}시간 ${mins}분 남음`;
    if (mins > 0) return `${mins}분 ${s}초 남음`;
    return `${s}초 남음`;
  };

  return (
    <div className="w-full pb-4 animate-in fade-in">
      {/* 🏚️ 헤더 — 우리들의 장갑 패턴: #제목 + 설명 | 탭 3개 */}
      <div className="sticky top-0 z-30 bg-[#F8FAFC]/80 backdrop-blur-md pt-2">
        <div className="flex items-center justify-between border-b border-slate-200 h-[44px] gap-3">
          {/* 좌: 타이틀 */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-slate-600 font-black text-[15px]">#</span>
            <h2 className="text-[14px] font-[1000] text-slate-900 tracking-tighter whitespace-nowrap">놀부의 텅 빈 곳간</h2>
            <div className="w-px h-3 bg-slate-200 mx-1.5 hidden md:block" />
            <p className="text-[11px] font-bold text-slate-400 hidden md:block whitespace-nowrap">심술을 부린 대가로 이곳에 갇혔습니다 — 반성하고 속죄금을 바쳐 나가시오</p>
          </div>
          {/* 우: 3탭 */}
          <div className="flex items-center gap-1 shrink-0">
            {TABS.map(tab => {
              const isMyLevel = tab.level === myLevel;
              const isActive = tab.level === activeTab;
              const isSpectator = !myLevel;
              const canAccess = isMyLevel || isSpectator;
              return (
                <button
                  key={tab.level}
                  onClick={() => canAccess && setActiveTab(tab.level)}
                  disabled={!canAccess}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border transition-all ${
                    isActive && canAccess
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : canAccess
                        ? 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span className="text-[11px] font-[1000] whitespace-nowrap">{canAccess ? '' : '🔒 '}{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2컬럼 레이아웃 — 메인(게시판) + 우측 사이드바(유저 정보) */}
      <div className="flex gap-4 items-start mt-4">
        {/* 메인 컨텐츠 영역 */}
        <div className="flex-1 min-w-0">
          {/* 관전자 안내 */}
          {!myLevel && <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 leading-relaxed mb-3">
            <p>⚠️ 여기는 제재 유저의 반성 공간입니다. 거친 표현이 포함될 수 있습니다.</p>
            <p>• 유배자 닉네임은 자동으로 익명 처리됩니다 (곳간 거주자 #NNNN).</p>
            <p>• 외부 공유는 금지되어 있습니다.</p>
          </div>}

          {/* 🏚️ 이의 제기 (유배자 본인만) */}
          {myLevel && <AppealForm currentUserData={currentUserData} />}

          {/* 🏚️ 유배지 게시판 — 현재 탭 기준 */}
          <ExileBoard
            currentUserData={currentUserData}
            level={activeTab}
            isExiledHere={myLevel === activeTab}
          />
        </div>

        {/* 우측 사이드바 — 유배자 본인 정보 (데스크톱만) */}
        {myLevel && (
          <div className="hidden md:block w-64 shrink-0">
            <div className="sticky top-[60px]">
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                  <span className="text-[13px] font-[1000] text-slate-900">🏚️ 내 상태</span>
                </div>
                <div className="p-4 space-y-3">
                  {/* 프로필 */}
                  <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-slate-50 overflow-hidden border border-slate-200">
                      <img src={currentUserData.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${currentUserData.nickname}`} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-[1000] text-slate-800 truncate">{currentUserData.nickname}</p>
                      <p className="text-[9px] font-bold text-rose-600">
                        {TABS[myLevel - 1]?.label} · {currentUserData.strikeCount || 0}범
                      </p>
                    </div>
                  </div>

                  {/* 처분 사유 */}
                  {currentUserData.sanctionReason && (
                    <div>
                      <p className="text-[9px] font-[1000] text-slate-400 uppercase tracking-widest mb-1">처분 사유</p>
                      <p className="text-[11px] font-medium text-slate-600">{currentUserData.sanctionReason}</p>
                    </div>
                  )}

                  {/* 반성 기간 */}
                  <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-center">
                    <p className="text-[9px] font-[1000] text-amber-700 mb-0.5">반성 기간</p>
                    <p className="text-[12px] font-[1000] text-amber-900">{formatRemaining(remainingSec)}</p>
                  </div>

                  {/* 속죄금 */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[9px] font-[1000] text-slate-400 uppercase tracking-widest">속죄금</p>
                      <p className="text-[9px] font-bold text-slate-400">{formatKoreanNumber(balance)}볼 보유</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-[20px] font-[1000] text-slate-900">{bail}</span>
                      <span className="text-[10px] font-bold text-slate-500">볼</span>
                    </div>
                    {error && <p className="text-[10px] font-bold text-red-500 mb-1">{error}</p>}
                    <button
                      onClick={handleRelease}
                      disabled={!canPay || !hasEnoughBalance || processing}
                      className={`w-full py-2 rounded-lg text-[11px] font-[1000] transition-all ${
                        canPay && hasEnoughBalance && !processing
                          ? 'bg-slate-900 text-white hover:bg-slate-700'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {processing ? '처리 중...' :
                        !canPay ? '반성 기간 중' :
                        !hasEnoughBalance ? `${bail - balance}볼 부족` :
                        `🏀 ${bail}볼 내기`}
                    </button>
                  </div>

                  {/* 안내 */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 leading-relaxed">
                      곳간에서 나오면 모든 깐부 관계가 초기화됩니다. 전과는 영구 보존. 90일 미납 시 자동 사약.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// 🏚️ 이의 제기 폼 — 유배자 본인만, 1회 제출 후 검토 대기
interface Appeal { id: string; uid: string; content: string; status: 'pending' | 'accepted' | 'rejected'; adminReply?: string; createdAt?: { toDate?: () => Date; seconds: number } }

function AppealForm({ currentUserData }: { currentUserData: UserData }) {
  const [existing, setExisting] = useState<Appeal | null>(null);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 내 최근 이의 제기 조회
    getDocs(query(
      collection(db, 'appeals'),
      where('uid', '==', currentUserData.uid),
      orderBy('createdAt', 'desc')
    )).then(snap => {
      if (!snap.empty) setExisting({ id: snap.docs[0].id, ...snap.docs[0].data() } as Appeal);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [currentUserData.uid]);

  const handleSubmit = async () => {
    if (!content.trim()) { setError('이의 제기 내용을 입력해주세요.'); return; }
    if (content.length > 1000) { setError('1000자 이하로 작성해주세요.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(db, 'appeals'), {
        uid: currentUserData.uid,
        nickname: currentUserData.nickname,
        content: content.trim(),
        status: 'pending',
        sanctionStatus: currentUserData.sanctionStatus,
        strikeCount: currentUserData.strikeCount || 0,
        sanctionReason: currentUserData.sanctionReason || null,
        createdAt: serverTimestamp(),
      });
      setExisting({ id: 'temp', uid: currentUserData.uid, content: content.trim(), status: 'pending', createdAt: { seconds: Date.now() / 1000 } });
      setContent('');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || '제출에 실패했습니다.');
    } finally { setSubmitting(false); }
  };

  if (loading) return null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-4">
      <p className="text-[11px] font-[1000] text-slate-700 mb-2">⚖️ 이의 제기</p>
      <p className="text-[10px] font-bold text-slate-400 mb-3">억울하다면 관리자에게 소명할 수 있습니다. (검토 결과는 알림으로 도착)</p>
      {existing ? (
        <div className="p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[9px] font-[1000] px-1.5 py-0.5 rounded-full ${
              existing.status === 'pending' ? 'bg-amber-100 text-amber-700' :
              existing.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' :
              'bg-slate-200 text-slate-500'
            }`}>
              {existing.status === 'pending' ? '검토 중' : existing.status === 'accepted' ? '인용' : '기각'}
            </span>
            <span className="text-[9px] font-bold text-slate-300">{existing.createdAt?.toDate?.().toLocaleDateString('ko-KR') || ''}</span>
          </div>
          <p className="text-[11px] font-medium text-slate-600 whitespace-pre-wrap">{existing.content}</p>
          {existing.adminReply && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-[9px] font-[1000] text-slate-500 mb-1">관리자 답변</p>
              <p className="text-[10px] font-medium text-slate-600">{existing.adminReply}</p>
            </div>
          )}
        </div>
      ) : (
        <>
          <textarea value={content} onChange={(e) => { setContent(e.target.value); if (error) setError(null); }}
            maxLength={1000} rows={4}
            placeholder="유배가 부당하다고 생각하는 이유를 상세히 적어주세요."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-[12px] focus:outline-none focus:border-slate-400 resize-none placeholder:text-[11px]" />
          {error && <p className="text-[11px] font-bold text-red-500 mt-1">{error}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-bold text-slate-300">{content.length}/1000</span>
            <button onClick={handleSubmit} disabled={submitting || !content.trim()}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-[1000] transition-colors">
              {submitting ? '제출 중...' : '이의 제기 제출'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default ExileMainPage;
