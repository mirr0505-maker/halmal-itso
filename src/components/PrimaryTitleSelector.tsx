// src/components/PrimaryTitleSelector.tsx — 🏷️ 대표 칭호 선택 (Sprint 5 Stage 4)
//
// 보유 중 활성 칭호 목록을 토글 체크박스로 표시. 최대 MAX_PRIMARY_TITLES(=3)개 선택.
// 저장 시 users.primaryTitles 배열 updateDoc.
//
// Why: Rules가 size ≤ 3으로 강제 — 초과 저장 시도 차단. 클라에서도 사전 가드하여 UX 부드럽게.
//      suspended 칭호는 선택 불가(유배 기간 동안 대표 지정 금지).
import { useState, useMemo, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { UserTitle } from '../types';
import { TITLE_CATALOG, MAX_PRIMARY_TITLES } from '../constants';
import TitleBadge from './TitleBadge';

interface Props {
  uid: string;
  titles?: UserTitle[];              // 보유 칭호 배열
  currentPrimary?: string[];         // 현재 대표 선택 id 목록
  onSaved?: (selected: string[]) => void;
}

const PrimaryTitleSelector = ({ uid, titles = [], currentPrimary = [], onSaved }: Props) => {
  // 초기 선택 상태
  const [selected, setSelected] = useState<string[]>(() => [...currentPrimary]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 보유 & 활성(suspended 아님)만 후보
  const activeTitles = useMemo(
    () => titles.filter((t) => !t.suspended),
    [titles],
  );

  // 초기값 대비 변경 여부
  const isDirty = useMemo(() => {
    const a = [...selected].sort().join(',');
    const b = [...currentPrimary].sort().join(',');
    return a !== b;
  }, [selected, currentPrimary]);

  const toggle = useCallback((id: string) => {
    setError(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_PRIMARY_TITLES) {
        setError(`대표 칭호는 최대 ${MAX_PRIMARY_TITLES}개까지 선택할 수 있습니다.`);
        return prev;
      }
      return [...prev, id];
    });
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', uid), { primaryTitles: selected });
      if (onSaved) onSaved(selected);
    } catch (err) {
      console.error('[PrimaryTitleSelector] 저장 실패', err);
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [uid, selected, onSaved]);

  if (activeTitles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <p className="text-sm text-slate-500">아직 보유한 칭호가 없습니다.</p>
        <p className="text-xs text-slate-400 mt-1">글·댓글·땡스볼·깐부 활동으로 칭호를 획득해 보세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-800">대표 칭호 선택</h4>
          <p className="text-[11px] text-slate-500">
            최대 {MAX_PRIMARY_TITLES}개 · 프로필·게시글 작성자 카드에 노출됩니다
          </p>
        </div>
        <span className="text-xs font-medium text-slate-600">
          {selected.length} / {MAX_PRIMARY_TITLES}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {activeTitles.map((t) => {
          const master = TITLE_CATALOG.find((m) => m.id === t.id);
          if (!master) return null;
          const isSelected = selected.includes(t.id);
          const disabled = !isSelected && selected.length >= MAX_PRIMARY_TITLES;
          return (
            <button
              key={t.id + (t.tier || '')}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled}
              className={`relative rounded-md ring-2 transition ${isSelected ? 'ring-amber-500' : 'ring-transparent'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:brightness-95'}`}
              aria-pressed={isSelected}
            >
              <TitleBadge userTitle={t} size="md" showTooltip />
              {isSelected && (
                <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => { setSelected([...currentPrimary]); setError(null); }}
          disabled={!isDirty || saving}
          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-md hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          되돌리기
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  );
};

export default PrimaryTitleSelector;
