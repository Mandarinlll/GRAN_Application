// チームアイコン。画像未設定ならチーム名の頭文字を表示する。
import { cn } from "@/lib/utils";
import { teamAvatarSrc } from "@/features/teams/utils/avatarImage";

const SIZE = { sm: "w-12 h-12 text-base", lg: "w-20 h-20 text-2xl" } as const;

export function TeamAvatar({
  teamId,
  name,
  avatarKey,
  size = "sm",
}: {
  teamId: string;
  name: string;
  avatarKey: string | null;
  size?: keyof typeof SIZE;
}) {
  const src = teamAvatarSrc(teamId, avatarKey);
  const cls = cn("rounded-full shrink-0 object-cover", SIZE[size]);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`${name}のアイコン`} className={cls} />;
  }
  return (
    <div
      aria-hidden="true"
      className={cn(
        cls,
        "bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center",
      )}
    >
      {name.trim().charAt(0) || "?"}
    </div>
  );
}
