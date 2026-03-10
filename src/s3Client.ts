import { S3Client } from "@aws-sdk/client-s3";

// 🚀 Cloudflare R2 클라이언트 최적화 설정
export const s3Client = new S3Client({
  region: "auto", // R2 공식 권장값
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  // R2는 버킷명이 도메인 앞에 붙는 서브도메인 방식을 더 선호합니다.
  forcePathStyle: false, 
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
export const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;
