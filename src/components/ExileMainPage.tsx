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
    <div className="w-full max-w-[800px] mx-auto px-4 py-6">
      {/* 제목 */}
      <div className="mb-5">
        <h1 className="text-[18px] font-[1000] text-slate-800 mb-1">🏚️ 놀부의 텅 빈 곳간</h1>
        <p className="text-[11px] font-bold text-slate-400">심술을 부린 대가로 이곳에 갇혔습니다. 반성하고 속죄금을 바쳐 나가시오.</p>
      </div>

      {/* 3탭 — 유배자는 본인 단계만, 일반 유저(관전자)는 모두 열람 가능 */}
      <div className="flex gap-1.5 mb-4">
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
              className={`flex-1 px-3 py-2.5 rounded-lg border transition-all ${
                isActive && canAccess
                  ? 'bg-slate-900 border-slate-900 text-white'
                  : canAccess
                    ? 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
                    : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
              }`}
            >
              <p className="text-[11px] font-[1000]">{canAccess ? '' : '🔒 '}{tab.label}</p>
              <p className="text-[9px] font-bold mt-0.5">{tab.days}일 · {tab.bail}볼</p>
            </button>
          );
        })}
      </div>

      {/* 내 상태 카드 — 유배자 본인에게만 */}
      {myLevel && <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest">내 상태</p>
            <p className="text-[14px] font-[1000] text-slate-800 mt-0.5">
              {myLevel && TABS[myLevel - 1]?.label} · {currentUserData.strikeCount || 0}범
            </p>
          </div>
          <span className="text-[10px] font-[1000] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
            {myLevel}차 유배 중
          </span>
        </div>

        {currentUserData.sanctionReason && (
          <div className="mb-3 p-3 bg-slate-50 rounded-lg">
            <p className="text-[10px] font-[1000] text-slate-400 mb-1">처분 사유</p>
            <p className="text-[12px] font-medium text-slate-600">{currentUserData.sanctionReason}</p>
          </div>
        )}

        {/* 반성 기간 카운트다운 */}
        <div className="mb-3 p-3 bg-amber-50 border border-amber-100 rounded-lg text-center">
          <p className="text-[10px] font-[1000] text-amber-700 mb-1">반성 기간</p>
          <p className="text-[16px] font-[1000] text-amber-900">{formatRemaining(remainingSec)}</p>
          <p className="text-[9px] font-bold text-amber-600 mt-1">
            {canPay ? '속죄금을 바치고 나갈 수 있습니다' : '이 시간이 지나야 속죄금 결제가 활성화됩니다'}
          </p>
        </div>

        {/* 속죄금 결제 */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-[1000] text-slate-400 uppercase tracking-widest">속죄금</p>
            <p className="text-[9px] font-bold text-slate-400">보유 {formatKoreanNumber(balance)}볼</p>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-[28px] font-[1000] text-slate-900">{bail}</span>
            <span className="text-[12px] font-bold text-slate-500">볼</span>
          </div>

          {error && <p className="text-[11px] font-bold text-red-500 mb-2">{error}</p>}

          <button
            onClick={handleRelease}
            disabled={!canPay || !hasEnoughBalance || processing}
            className={`w-full py-3 rounded-lg text-[13px] font-[1000] transition-all ${
              canPay && hasEnoughBalance && !processing
                ? 'bg-slate-900 text-white hover:bg-slate-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {processing ? '처리 중...' :
              !canPay ? '반성 기간 중' :
              !hasEnoughBalance ? `속죄금 부족 (${bail - balance}볼 더 필요)` :
              `🏀 ${bail}볼 바치고 나가기`}
          </button>

          <p className="text-[9px] font-bold text-slate-400 mt-2 text-center leading-relaxed">
            ⚠️ 곳간에서 나오는 자는 빈손으로 나와야 하는 법 —<br/>
            모든 깐부 관계가 초기화됩니다
          </p>
        </div>
      </div>}

      {/* 안내 — 유배자 본인만 */}
      {myLevel && <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 leading-relaxed mb-4">
        <p>• 반성 기간이 지나야 속죄금 결제가 활성화됩니다.</p>
        <p>• 속죄금을 내지 않으면 무기한 유배가 됩니다. (90일 경과 시 자동 사약)</p>
        <p>• 전과 기록(strikeCount)은 해금 후에도 영구 보존됩니다.</p>
        <p>• 4차 도달 시 사약 처분 (영구 밴, 휴대폰 번호 블랙리스트 등록)</p>
      </div>}

      {/* 관전자 안내 */}
      {!myLevel && <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-bold text-slate-500 leading-relaxed mb-4">
        <p>⚠️ 여기는 제재 유저의 반성 공간입니다. 거친 표현이 포함될 수 있습니다.</p>
        <p>• 유배자 닉네임은 자동으로 익명 처리됩니다 (곳간 거주자 #NNNN).</p>
        <p>• 외부 공유는 금지되어 있습니다.</p>
      </div>}

      {/* 🏚️ 이의 제기 (유배자 본인만) */}
      {myLevel && <AppealForm currentUserData={currentUserData} />}

      {/* 🏚️ 유배지 게시판 — 현재 탭 기준 */}
      <div className="mb-3">
        <p className="text-[11px] font-[1000] text-slate-600 mb-2">{activeTab}차 유배지 게시판</p>
      </div>
      <ExileBoard
        currentUserData={currentUserData}
        level={activeTab}
        isExiledHere={myLevel === activeTab}
      />
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
