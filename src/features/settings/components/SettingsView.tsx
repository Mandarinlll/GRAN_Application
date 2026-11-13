// 設定画面本体。「ユーザー情報 / アプリ設定 / ご利用案内」をタブで切り替える。
// 入力途中の状態を保つため、非表示パネルもマウントしたまま hidden で隠す。
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ProfileForm,
  type ProfileDefaults,
} from "@/features/settings/components/ProfileForm";
import { PasswordForm } from "@/features/settings/components/PasswordForm";
import { AppSettingsForm } from "@/features/settings/components/AppSettingsForm";
import { GuideSection } from "@/features/settings/components/GuideSection";
import type { AppSettings } from "@/features/settings/types/settings";

type TabId = "profile" | "app" | "guide";

const TABS: { id: TabId; label: string }[] = [
  { id: "profile", label: "ユーザー情報" },
  { id: "app", label: "アプリ設定" },
  { id: "guide", label: "ご利用案内" },
];

export function SettingsView({
  profile,
  settings,
}: {
  profile: ProfileDefaults;
  settings: AppSettings;
}) {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="設定の種類"
        className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200"
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              id={`settings-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`settings-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "min-h-[44px] rounded-lg text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                selected
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-900",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id="settings-panel-profile"
        role="tabpanel"
        aria-labelledby="settings-tab-profile"
        hidden={tab !== "profile"}
        className="space-y-4"
      >
        <ProfileForm defaults={profile} />
        <PasswordForm />
      </div>
      <div
        id="settings-panel-app"
        role="tabpanel"
        aria-labelledby="settings-tab-app"
        hidden={tab !== "app"}
      >
        <AppSettingsForm initial={settings} />
      </div>
      <div
        id="settings-panel-guide"
        role="tabpanel"
        aria-labelledby="settings-tab-guide"
        hidden={tab !== "guide"}
      >
        <GuideSection />
      </div>
    </div>
  );
}
