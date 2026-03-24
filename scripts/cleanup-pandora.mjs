// scripts/cleanup-pandora.mjs
// 판도라의 상자 구 데이터 일괄 삭제 스크립트
// 실행: node scripts/cleanup-pandora.mjs
// 삭제 대상:
//   1. posts 컬렉션 — category가 '판도라의 상자' 또는 '벌거벗은 임금님'인 루트 글
//   2. posts 컬렉션 — parentId가 존재하는 모든 구 댓글

import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, query, where,
  getDocs, writeBatch, doc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyCqzzvISYI_1lSFuO2oDjgAn2FweWfJKZg',
  authDomain:        'halmal-itso.firebaseapp.com',
  projectId:         'halmal-itso',
  storageBucket:     'halmal-itso.firebasestorage.app',
  messagingSenderId: '424838560225',
  appId:             '1:424838560225:web:e44934708f1c5470fe7aa0',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// Firestore writeBatch 최대 500건 제한 → 청크 분할 삭제
async function deleteDocs(docs) {
  let total = 0;
  for (let i = 0; i < docs.length; i += 500) {
    const chunk = docs.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach(d => batch.delete(doc(db, 'posts', d.id)));
    await batch.commit();
    total += chunk.length;
    console.log(`  삭제 완료: ${total} / ${docs.length}`);
  }
}

async function main() {
  console.log('=== 판도라의 상자 구 데이터 삭제 시작 ===\n');

  // 1. 판도라의 상자 루트 글 삭제
  const pandoraCategories = ['판도라의 상자', '벌거벗은 임금님'];
  let pandoraDocs = [];
  for (const cat of pandoraCategories) {
    const snap = await getDocs(query(collection(db, 'posts'), where('category', '==', cat)));
    pandoraDocs = pandoraDocs.concat(snap.docs);
    console.log(`[${cat}] 루트 글: ${snap.docs.length}건`);
  }
  if (pandoraDocs.length > 0) {
    console.log(`\n루트 글 ${pandoraDocs.length}건 삭제 중...`);
    await deleteDocs(pandoraDocs);
  } else {
    console.log('삭제할 루트 글 없음');
  }

  // 2. posts 컬렉션의 구 댓글 (parentId 있는 것) 삭제
  console.log('\n구 댓글(posts 컬렉션 내 parentId 있는 문서) 조회 중...');
  const allPostsSnap = await getDocs(collection(db, 'posts'));
  const oldComments = allPostsSnap.docs.filter(d => {
    const parentId = d.data().parentId;
    return parentId && parentId !== '';
  });
  console.log(`구 댓글: ${oldComments.length}건`);
  if (oldComments.length > 0) {
    console.log(`삭제 중...`);
    await deleteDocs(oldComments);
  } else {
    console.log('삭제할 구 댓글 없음');
  }

  console.log('\n=== 완료 ===');
  process.exit(0);
}

main().catch(err => {
  console.error('오류 발생:', err);
  process.exit(1);
});
