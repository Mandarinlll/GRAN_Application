export interface TrendPoint {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface TournamentEntryStatus {
  id: string;
  title: string;
  eventDate: string;
  capacity: number;
  entries: number; // エントリー数（参加確定・参加済。キャンセル／待ちは除く）
}

export interface DashboardData {
  todayEntries: number;
  monthlySales: number;
  openTournaments: number;
  pendingTasks: number;
  trend: TrendPoint[];
  tournaments: TournamentEntryStatus[];
}
