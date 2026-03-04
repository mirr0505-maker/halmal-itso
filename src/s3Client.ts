import { S3Client } from "@aws-sdk/client-s3";

// 🚀 Cloudflare R2를 위한 S3 클라이언트 설정
export const s3Client = new S3Client({
  region: "auto", // R2는 auto 권장
  endpoint: import.meta.env.VITE_R2_ENDPOINT,
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
export const PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL; // 이미지 조회용 URL
