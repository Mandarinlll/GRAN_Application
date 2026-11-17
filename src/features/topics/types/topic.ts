export type Topic = {
  id: string;
  title: string;
  imageSrc: string;
  // 設定されていればタップで遷移する。内部パス（/ 始まり）または https URL のみ。
  linkUrl: string | null;
};
