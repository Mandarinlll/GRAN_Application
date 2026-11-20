// ホーム画面のトピックス。横スワイプ（CSS scroll-snap）で画像を切り替える。
// JS 不要のためサーバーコンポーネントのまま使える。0件のときは何も描画しない。
import Link from "next/link";
import { topicHasDetail, type Topic } from "@/features/topics/types/topic";

type Props = { topics: Topic[] };

// 内部パス（/ 始まり、// は除く）か https のみ許可（不正な遷移先を防ぐ）。
export function isSafeLink(url: string | null): url is string {
  return !!url && (/^\/(?!\/)/.test(url) || /^https:\/\//.test(url));
}

function Slide({ topic }: { topic: Topic }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={topic.imageSrc} alt={topic.title} className="w-full h-full object-cover" draggable={false} />;
  const cls =
    "block w-full aspect-video rounded-xl overflow-hidden bg-slate-100 shadow-sm ring-1 ring-slate-200";
  // 本文または複数画像があるときは詳細画面へ。なければ従来どおり linkUrl へ直接遷移する。
  if (topicHasDetail(topic)) {
    return (
      <Link href={`/topics/${topic.id}`} className={cls}>
        {img}
      </Link>
    );
  }
  if (!isSafeLink(topic.linkUrl)) return <div className={cls}>{img}</div>;
  const external = topic.linkUrl.startsWith("https://");
  return external ? (
    <a href={topic.linkUrl} target="_blank" rel="noopener noreferrer" className={cls}>
      {img}
    </a>
  ) : (
    <Link href={topic.linkUrl} className={cls}>
      {img}
    </Link>
  );
}

export function TopicsCarousel({ topics }: Props) {
  if (topics.length === 0) return null;
  return (
    <section aria-label="トピックス" className="space-y-2">
      <h2 className="text-sm font-bold text-slate-700">トピックス</h2>
      <ul
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 [scrollbar-width:thin]"
        tabIndex={0}
        aria-label="トピックス一覧（横にスクロール）"
      >
        {topics.map((t) => (
          <li key={t.id} className="snap-center shrink-0 w-[85%] sm:w-[60%] md:w-[48%]">
            <Slide topic={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}
