// 利用ガイド・利用規約・プライバシーポリシー等の掲載。
// ※規約/ポリシーは暫定文面。公開前に運営側で内容の確認・差し替えを行うこと。
import { BookOpen, FileText, ShieldCheck, ChevronDown } from "lucide-react";
import { SectionCard } from "@/features/settings/components/fields";
import {
  GUIDE_DOCS,
  type GuideBlock,
  type GuideDoc,
} from "@/features/settings/content/guideContent";

const ICONS = {
  guide: BookOpen,
  terms: FileText,
  privacy: ShieldCheck,
} as const;

export function GuideSection() {
  return (
    <SectionCard
      title="ご利用案内"
      description="アプリの使い方、利用規約、プライバシーポリシーを確認できます。"
      icon={<BookOpen className="w-4 h-4" />}
    >
      <div className="space-y-2">
        {GUIDE_DOCS.map((doc) => (
          <DocAccordion key={doc.id} doc={doc} />
        ))}
      </div>
    </SectionCard>
  );
}

function DocAccordion({ doc }: { doc: GuideDoc }) {
  const Icon = ICONS[doc.id];
  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex items-center justify-between gap-3 px-4 min-h-[48px] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2.5 text-sm font-bold text-slate-800">
          <Icon className="w-4 h-4 text-emerald-600" />
          {doc.title}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 pt-1 space-y-4 border-t border-slate-100">
        <p className="text-xs text-slate-500 pt-3">{doc.updated}</p>
        {doc.blocks.map((b, i) => (
          <Block key={i} block={b} />
        ))}
      </div>
    </details>
  );
}

function Block({ block }: { block: GuideBlock }) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-bold text-slate-800">{block.heading}</h3>
      {block.paragraphs?.map((p, i) => (
        <p key={i} className="text-sm text-slate-600 leading-relaxed">
          {p}
        </p>
      ))}
      {block.items ? (
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600 leading-relaxed">
          {block.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
