export type Topic = {
  id: string;
  title: string;
  imageSrc: string;
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
  sortOrder: number;
  isPublished: boolean;
  publishFrom: string | null;
  publishUntil: string | null;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
};
