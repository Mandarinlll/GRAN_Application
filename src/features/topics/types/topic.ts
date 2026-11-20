export type Topic = {
  id: string;
  title: string;
  imageSrc: string; // カバー画像（先頭の画像）のURL
  imageCount: number;
  // 本文（任意・プレーンテキスト）。
  body: string | null;
  // 設定されていればタップで遷移する。内部パス（/ 始まり）または https URL のみ。
  linkUrl: string | null;
};

// 管理画面での公開状態。
//  PUBLISHED   : 公開中（フラグON かつ 公開期間内）
//  UNPUBLISHED : 非公開（フラグOFF）
//  SCHEDULED   : 公開前（フラグONだが公開開始前）
//  EXPIRED     : 期間外（フラグONだが公開終了後）
export type TopicStatus = "PUBLISHED" | "UNPUBLISHED" | "SCHEDULED" | "EXPIRED";

// 管理画面向けのトピックス。日時は JST の "YYYY-MM-DD HH:MM:SS"。
export type AdminTopic = {
  id: string;
  title: string;
  imageSrc: string; // 管理者用プレビュー画像URL
  linkUrl: string | null;
  body: string | null;
  images: TopicImage[]; // 表示順
  sortOrder: number;
  isPublished: boolean;
  publishFrom: string | null;
  publishUntil: string | null;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
};

export type TopicImage = { id: string; src: string };

// 詳細画面（/topics/[id]）向け。
export type TopicDetail = {
  id: string;
  title: string;
  body: string | null;
  images: TopicImage[];
  linkUrl: string | null;
};

// 本文があるか画像が2枚以上なら、タップで詳細画面へ遷移する。
export function topicHasDetail(t: { body: string | null; imageCount: number }): boolean {
  return !!t.body || t.imageCount > 1;
}

export const MAX_TOPIC_IMAGES = 10;
export const MAX_TOPIC_BODY_LENGTH = 1000;
