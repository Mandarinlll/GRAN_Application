// 運営からのお知らせ・緊急連絡の画面表示用の型。
export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string;
  isUrgent: boolean;
  tournamentId: string | null;
  tournamentTitle: string | null; // 全体宛ては null
  recipientCount: number;
  createdByLoginId: string | null;
  createdAt: string; // "YYYY-MM-DD HH:MM:SS"（JST）
}

export interface AnnouncementTournamentOption {
  id: string;
  title: string;
  eventDate: string;
  status: string;
}