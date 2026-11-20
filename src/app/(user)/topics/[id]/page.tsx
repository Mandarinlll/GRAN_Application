// トピックス詳細（URL: /topics/{id}）。画像（複数枚は横スワイプ）・タイトル・本文を表示する。
// 公開中でないトピックス（非公開・期間外・削除済み）は 404。
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { isSafeLink } from "@/components/home/TopicsCarousel";
import { getCurrentUser } from "@/features/auth/server/currentUser";
import { getUnreadCountSynced } from "@/features/notifications/server/inboxService";
import { getPublishedTopicDetail } from "@/features/topics/server/topicRepository";
import { getSession } from "@/lib/session";

type Props = { params: Promise<{ id: string }> };

export default async function TopicDetailPage({ params }: Props) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;
  const topic = getPublishedTopicDetail(id);
  if (!topic) notFound();

  const shellUser = {
    realName: currentUser.realName,
    nickname: currentUser.nickname,
    granLevel: currentUser.granLevel,
    avatarText: currentUser.avatarText,
    teamName: currentUser.teamName || null,
    unreadNotifications: getUnreadCountSynced((await getSession())!.sub),
  };

  const external = topic.linkUrl?.startsWith("https://") ?? false;
  const linkCls =
    "inline-flex items-center justify-center px-4 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700";

  return (
    <AppShell activeId="home" user={shellUser}>
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
        <Link href="/home" className="inline-flex items-center gap-1 min-h-[44px] text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" />
          ホームへ戻る
        </Link>

        <article className="space-y-4">
          <h1 className="text-lg font-bold text-slate-900 break-words">{topic.title}</h1>

          <ul
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:thin]"
            tabIndex={0}
            aria-label={topic.images.length > 1 ? "画像（横にスクロール）" : "画像"}
          >
            {topic.images.map((img, i) => (
              <li key={img.id} className={topic.images.length > 1 ? "snap-center shrink-0 w-[90%]" : "w-full"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={topic.images.length > 1 ? `${topic.title}（${i + 1}/${topic.images.length}）` : topic.title}
                  className="w-full rounded-xl bg-slate-100 ring-1 ring-slate-200"
                  draggable={false}
                />
              </li>
            ))}
          </ul>

          {/* 本文はテキストとして表示する（HTML として解釈しない）。改行のみ反映。 */}
          {topic.body ? (
            <p className="text-sm text-slate-800 whitespace-pre-wrap break-words leading-relaxed">{topic.body}</p>
          ) : null}

          {isSafeLink(topic.linkUrl) ? (
            external ? (
              <a href={topic.linkUrl} target="_blank" rel="noopener noreferrer" className={linkCls}>
                詳しく見る
              </a>
            ) : (
              <Link href={topic.linkUrl} className={linkCls}>
                詳しく見る
              </Link>
            )
          ) : null}
        </article>
      </main>
    </AppShell>
  );
}
