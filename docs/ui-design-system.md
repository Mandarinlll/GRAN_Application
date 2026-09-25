# 共通UI・デザインシステム定義書 (UI Design System Specification)

本書は、本Webアプリケーション（モバイルWeb / SPA / PC管理画面）におけるUI・UXの一貫性を担保し、AIコード生成およびバイブコーディングにおいてデザインの破綻やツギハギを防ぐための厳格な共通UI・デザインシステム定義書です。
AIエージェントおよび開発者は、すべての画面・コンポーネント実装において本定義書のデザイントークン、クラス名、コンポーネント規約に厳密に従ってください。

---

## 1. テーマカラー & カラーモード定義 (Theme & Color Tokens)

Tailwind CSS の標準セマンティックカラーにマッピングされたデザイントークンです。
テニス大会運営アプリとしての清潔感、屋外・屋内での高視認性、管理画面での信頼性を両立する**エメラルド・スレート・インディゴ**を基調とし、ユーザビリティ向上のための**ダークモードおよびカラーモード切り替え**に完全対応します。

### 1.1 カラーモード対応方針（ライト / ダーク / 端末連動）
* 屋外（テニスコート）での視認性向上のための**ライトモード**に加え、屋内での利用・夜間閲覧・バッテリー消費低減のための**ダークモード**、およびOS設定に追従する**端末連動モード**を標準サポートします。
* また、ユーザーの個性に合わせた12色のテーマカラー選択にも対応します。

### 1.2 カラーパレット & セマンティックマッピング

| トークン名 / 役割 | ライトモード (Tailwind) | ダークモード (Tailwind) | HEX値 (参考) | 用途・適用対象 |
| :--- | :--- | :--- | :--- | :--- |
| **Primary (メイン)** | `emerald-600` | `emerald-500` | `#059669` / `#10b981` | 主要CTAボタン、アクティブタブ、主要ハイライト |
| **Primary Hover** | `emerald-700` | `emerald-600` | `#047857` / `#059669` | プライマリボタンのホバー/アクティブ状態 |
| **Primary Light** | `emerald-50` | `emerald-950/40` | `#ecfdf5` / `#022c22` | プライマリアクティブ背景、カテゴリバッジ背景 |
| **Secondary (補助)** | `indigo-600` | `indigo-500` | `#4f46e5` / `#6366f1` | 管理者アクション、カレンダー連携、GRANレベル強調 |
| **Secondary Hover** | `indigo-700` | `indigo-600` | `#4338ca` / `#4f46e5` | セカンダリボタンホバー |
| **Background (全体背景)** | `slate-50` | `slate-950` / `slate-900` | `#f8fafc` / `#020617` | アプリ全体のベース背景色 |
| **Surface (カード/面)** | `white` | `slate-900` / `slate-800` | `#ffffff` / `#0f172a` | コンポーネントカード、ダイアログ、ボトムナビ背景 |
| **Text Primary (主要文字)** | `slate-900` | `white` / `slate-100` | `#0f172a` / `#f8fafc` | 見出し、メインテキスト、重要数値 |
| **Text Secondary (副次文字)** | `slate-600` | `slate-400` | `#475569` / `#94a3b8` | ラベル、説明文、メタデータ、プレースホルダー |
| **Text Muted (注釈/薄文字)** | `slate-400` | `slate-500` | `#94a3b8` / `#64748b` | 無効化テキスト、補助アイコン、非活性要素 |
| **Border / Divider (境界線)** | `slate-200` | `slate-800` / `slate-700` | `#e2e8f0` / `#1e293b` | カード枠線、リスト区切り線、インプット枠線 |
| **Success (成功/空き枠あり)** | `emerald-500` | `emerald-400` | `#10b981` / `#34d399` | エントリー完了、空き枠十分、正常ステータス |
| **Warning (警告/残りわずか)** | `amber-500` | `amber-400` | `#f59e0b` / `#fbbf24` | 残り枠わずか、有償キャンセル注意(50%)、同日重複警告 |
| **Danger (エラー/満員/危険)** | `rose-600` | `rose-500` | `#e11d48` / `#f43f5e` | 満員(キャンセル待ち)、有償キャンセル(100%)、削除ボタン |
| **Info (情報)** | `sky-500` | `sky-400` | `#0ea5e9` / `#38bdf8` | 一般お知らせ、キャンセル待ち順位バッジ |

### 1.3 `tailwind.config.js` 設定例
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
        },
        admin: {
          50: '#eef2ff',
          100: '#e0e7ff',
          600: '#4f46e5',
          700: '#4338ca',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
      },
    },
  },
};
```

---

## 2. コンポーネントライブラリ & スタイリング方針

### 2.1 採用スタック
* **Base Framework**: Tailwind CSS
* **UI Component Library**: **shadcn/ui** (Radix UI ベース、Tailwind完全統合)
* **Icons**: **Lucide Icons** (統一サイズ: 16px / 20px / 24px)
  * **バージョン固定の義務化**: CDN読み込み時は `lucide@latest` などの浮動バージョン指定を**禁止**し、必ず特定バージョン（例: `https://unpkg.com/lucide@0.344.0`）に固定すること。npm管理時もバージョンをロックする。
  * **絵文字の直接ハードコード禁止**: 大会要項・登録画面・リスト等で絵文字（📅⏰📍👥等）を直接記述することを**禁止**する。必ず Lucide アイコン（`<Calendar>`, `<Clock>`, `<MapPin>`, `<Users>` 等）を使用し、視覚的な統一感とアクセシビリティを担保する。
* **Class Utilities**: `clsx`, `tailwind-merge` (`cn` ヘルパー関数を使用)

### 2.2 クラス統合ユーティリティ (`src/lib/utils.ts`)
```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 2.3 カスタマイズ・設計方針
1. **カラーモード対応**: ライトモード（`bg-slate-50` / `bg-white`）を標準とし、ダークモード設定時は `dark:bg-slate-950` / `dark:bg-slate-900` / `dark:text-slate-100` で高コントラストな視認性を維持する。
2. **ハードコードカラーの制限**: 任意カラーのインラインスタイルは避け、Tailwindセマンティックトークンクラスを使用する。
3. **角丸（Border Radius）の体系化**:
   * **特大コンテナ / データレポート外枠 / 大型モーダル外枠**: `rounded-3xl` (24px)
   * **標準カード / ダイアログ / 詳細パネル**: `rounded-2xl` (16px)
   * **ボタン / 入力フォーム / コンパクトカード / リストアイテム**: `rounded-xl` (12px) または `rounded-lg` (8px)
   * **バッジ / ピルタグ / アバター / インジケーター**: `rounded-full` (9999px)
4. **シャドウ・境界線の統一**:
   * カード / リストアイテム: `shadow-xs border border-slate-200 dark:border-slate-800`
   * モーダル / フローティングバー / ボトムシート: `shadow-xl border border-slate-200 dark:border-slate-700`
5. **装飾抑制ルール（屋外視認性・機能性最優先）**:
   * 屋外テニスコートや直射日光下での可読性を最優先するため、**過度なグラデーション、多重のぼかし（`backdrop-blur` の乱用）、左端アクセント線、点滅アニメーションなどの過剰装飾は抑制・禁止**する。
   * クリーンで明瞭なコントラスト重視のフラット＋適度なシャドウ・枠線（`border border-slate-200 dark:border-slate-800`）に統一する。
6. **共通部品化とコンテンツ最大幅（Container Max Width）の統一**:
   * ヘッダー、ボトムナビ、PCナビ、マイページモーダル、トーストなどの共通部品は各画面ファイルに複製せず、共通コンポーネントとして一元管理する。
   * 画面ごとの最大幅のバラつき（896px vs 672px等）を解消し、以下の2分類に統一する：
     * **基本アプリ画面（モバイルファースト最適幅）**: `max-w-2xl mx-auto` (672px)（ホーム、大会日程、設定、通知、エントリー）
     * **データ・統計画面（横幅を要するグラフ・表展開）**: `max-w-4xl mx-auto` (896px)

---

## 3. ボタン共通スタイル (Button Variants & States)

### 3.1 タップターゲット（Tap Target）原則【厳格遵守】
* **最小44pxの絶対確保**:
  * モバイル操作時の誤タップ防止および屋外での操作性確保のため、すべてのボタン・リンク・セレクトボックス・チェックボックス等のクリック／タップ可能要素は、**最小44px × 44px（`min-h-[44px] min-w-[44px]`）** のタッチターゲットを確保することを必須とする。
  * **32px〜40px の低背ボタンは原則禁止**とする。
  * 見た目をコンパクトに見せたいアイコンボタン（例: 24px や 32px の見た目）であっても、パディング（`p-2.5` 等）や親要素のサイズ確保により、実際のタップ可能領域は必ず 44px 以上を確保すること。
* **キーボード操作性とフォーカスリング**:
  * クリック・タップ可能な要素には `<div>` や `<span>` ではなく、意味的に正しい `<button>` または `<a>` 要素を使用する。
  * キーボード操作（Tab移動、Enter / Space での発火）に対応し、全画面で統一された明確なフォーカスリング（`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2`）を適用する。

### 3.2 ボタンスタイル仕様表

| バリアント | 基本クラス | ホバー / アクティブ | 無効化 (Disabled) |
| :--- | :--- | :--- | :--- |
| **Primary (主要CTA)** | `min-h-[44px] bg-emerald-600 text-white font-medium shadow-sm` | `hover:bg-emerald-700 active:bg-emerald-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none` |
| **Secondary (副次)** | `min-h-[44px] bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700` | `hover:bg-slate-200 dark:hover:bg-slate-700` | `disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Outline (枠線)** | `min-h-[44px] bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-600 font-medium` | `hover:bg-emerald-50 dark:hover:bg-emerald-950/30` | `disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Destructive (危険/キャンセル)** | `min-h-[44px] bg-rose-600 text-white font-medium shadow-sm` | `hover:bg-rose-700 active:bg-rose-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed` |
| **Ghost (テキストのみ)** | `min-h-[44px] bg-transparent text-slate-700 dark:text-slate-300 font-medium` | `hover:bg-slate-100 dark:hover:bg-slate-800` | `disabled:text-slate-400 disabled:cursor-not-allowed` |

### 3.3 実装コンポーネントコード (`src/components/ui/button.tsx`)
```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none select-none min-h-[44px]',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none',
        secondary:
          'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 active:bg-slate-300 disabled:bg-slate-50 disabled:text-slate-400',
        outline:
          'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-600 hover:bg-emerald-50 active:bg-emerald-100 disabled:border-slate-200 disabled:text-slate-400',
        destructive:
          'bg-rose-600 text-white shadow-sm hover:bg-rose-700 active:bg-rose-800 disabled:bg-slate-300 disabled:text-slate-500',
        ghost:
          'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:text-slate-400',
      },
      size: {
        sm: 'min-h-[44px] px-3.5 text-xs rounded-lg',
        md: 'min-h-[44px] h-11 px-4 py-2 text-sm',
        lg: 'min-h-[48px] h-12 px-6 text-base font-medium',
        full: 'w-full min-h-[48px] h-12 px-6 text-base font-medium',
        icon: 'min-h-[44px] min-w-[44px] w-11 h-11 p-2.5',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
```

---

## 4. タイポグラフィとフォント規則 (Typography)

日本語環境で最も明瞭かつ美しい可読性を発揮するため、**`Noto Sans JP` に完全固定**します。
また、屋外のテニスコートや直射日光下での視認性を最優先し、過度な太字や極小文字を排した厳格なタイポグラフィ規約を適用します。

### 4.1 フォントファミリー定義
```css
font-family: 'Noto Sans JP', sans-serif;
```
HTMLヘッダーでのWebフォント読み込み（ウェイトは 400, 500, 700 の3種のみ読み込む）:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet">
```

### 4.2 フォントウェイト（太さ）の厳格制限【3種のみ】
* 見出しの強弱を明確にし、視覚的ノイズを低減するため、太さは以下の**3種類に限定**します。
  1. **標準（Normal）**: `font-normal` (400) - 本文、説明文、注釈
  2. **やや太字（Medium）**: `font-medium` (500) - ボタンラベル、リストヘッダー、補助的な強調
  3. **太字（Bold）**: `font-bold` (700) - ページタイトル、セクション見出し、重要数値
* **極太（`font-black` / `font-extrabold`）の使用は原則禁止**とします。強調したい箇所は、太さではなく「フォントサイズ」「カラーコントラスト」「周囲の余白」によって表現します。

### 4.3 文字サイズ基準【3段階体系・最小12px遵守】
屋外利用（スマホ画面）での可読性を担保するため、文字サイズ体系を整理し、**最小サイズを12px（`text-xs`）に制限**します。
* **10px・11px・9px などの極小フォントは原則禁止**とします。
* 情報量が多いエリアであっても、文字サイズを縮小して詰め込むのではなく、**「掲載情報の厳選」「アコーディオン（折りたたみ）」「モーダル展開」** によって対応します。

| 階層 | フォントサイズ | Tailwind クラス | 太さ | 用途・適用ルール |
| :--- | :--- | :--- | :--- | :--- |
| **Page Title (H1)** | 20px / 24px | `text-xl sm:text-2xl` | `font-bold` | 画面最上部タイトル、ヘッダーロゴ横 |
| **Section Title (H2)** | 18px / 20px | `text-lg sm:text-xl` | `font-bold` | カード見出し、ブロック区切り |
| **Card / Sub Title (H3)** | 16px | `text-base` | `font-bold` | 大会名、チーム名、モーダル題名 |
| **本文 (Body)** | **14〜16px** | `text-sm` (14px) / `text-base` (16px) | `font-normal` / `font-medium` | 一般説明文、大会詳細要項、フォーム入力値、主要ラベル |
| **補足 (Subtext)** | **13px** | `text-[13px]` | `font-normal` | 補助説明、メタデータ、プレースホルダー、入力ヒント |
| **注釈・バッジ (Caption/Badge)** | **12px (最小)** | `text-xs` | `font-normal` / `font-bold` | 日時注釈、残り枠数、ステータスバッジ、免責事項（※これより小さくしない） |

### 4.4 数値・日時の等幅表示（`tabular-nums`）【必須】
レート（GRANレベル）、大会開催日時、試合スコア、エントリー金額、順位、カウントダウン等の数値表示には、必ず **`tabular-nums`（CSS: `font-variant-numeric: tabular-nums;`）** を付与します。
数字の表示幅が均一になることで、リストや表での桁揃えや、動的更新時のレイアウトのガタつきを防止します。
```html
<!-- 例: GRANレベルおよびスコア表示 -->
<span class="font-bold tabular-nums text-emerald-600">750</span> pt
<span class="font-medium tabular-nums text-slate-800">2026/04/15 09:00</span>
```

---

## 5. レイアウト・余白規則 (Spacing & Layout Grid)

8px（`p-2` / `m-2` = 0.5rem）を基本スケールとする **8pxグリッドシステム**を適用します。

### 5.1 余白スケール基準表

| トークン | サイズ | Tailwind クラス | 適用対象の標準ルール |
| :--- | :--- | :--- | :--- |
| **3xs** | 2px | `gap-0.5`, `p-0.5` | 微細ボーダー調整、極小アイコン余白 |
| **2xs** | 4px | `gap-1`, `p-1`, `space-y-1` | バッジ内パディング、インライン要素間 |
| **xs** | 8px | `gap-2`, `p-2`, `space-y-2` | フォームラベルとインプットの間、アイコンとテキスト間 |
| **sm** | 12px | `gap-3`, `p-3`, `space-y-3` | コンパクトカード内パディング、リスト行間 |
| **md** | 16px | `gap-4`, `p-4`, `space-y-4` | **標準カード内パディング**、フォームフィールド間隔 |
| **lg** | 24px | `gap-6`, `p-6`, `space-y-6` | セクション間の余白、モーダル内パディング |
| **xl** | 32px | `gap-8`, `py-8`, `space-y-8` | ページメインブロック間の余白 |

### 5.2 モバイル下部セーフエリア & トースト配置規約
* **iPhone ホームバー（セーフエリア）対応**:
  * モバイルボトムナビのコンテナには、必ずセーフエリアを考慮した `pb-[env(safe-area-inset-bottom)]` を付与し、ホームバーとの干渉を防ぎます。
  * メインコンテンツの最下部（mainエリアまたはページラッパー）には、ナビゲーションの高さ（14 = 3.5rem）＋セーフエリア＋余裕を持たせた余白として **`pb-24`（または `pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)]`）** を必ず確保します。
* **完了通知（トースト）の表示位置**:
  * スマホ画面での横幅不足や見切れを防ぐため、トースト通知は右下固定ではなく、**下部ナビのすぐ上・画面中央（`bottom-[calc(3.5rem+env(safe-area-inset-bottom)+12px)] inset-x-4 max-w-sm mx-auto`）** に表示します。
  * PC画面（`md:` 768px以上）では右下表示（`md:bottom-6 md:right-6 md:left-auto md:mx-0`）へレスポンシブに切り替えます。

---

## 6. レスポンシブ対応・画面遷移ナビゲーション基準

本システムは **モバイルファースト（Mobile-First）** を原則としつつ、PC・タブレット環境でも快適に利用できるよう設計します。

### 6.1 ブレークポイント基準

| 接頭辞 | 最小幅 | 主なターゲット | レイアウト指針 |
| :--- | :--- | :--- | :--- |
| *(None)* | `0px` | スマートフォン (iOS / Android) | 1カラム構成、フルワイドCTAボタン、下部固定5項目ボトムナビ |
| `sm:` | `640px` | 大型スマホ / 小型タブレット | カードパディング拡張 (`p-6`)、ボタン幅の自動調整 |
| `md:` | `768px` | タブレット / PCブラウザ | 2カラムグリッド (`grid-cols-2`)、**ヘッダーナビまたは固定サイドバー表示** |
| `lg:` | `1024px` | デスクトップ PC | 3〜4カラムグリッド、テーブル全列表示 |

### 6.2 PC・タブレットでの画面遷移ナビゲーション【必須要件】
下部ボトムナビゲーションはスマホ幅専用（`md:hidden`）であるため、**PCやタブレット幅（`md:` 768px以上）で開いた際にユーザーが画面を移動できる手段を常時提供することを必須**とします。
以下のいずれかのアプローチを必ず実装します：
1. **ヘッダー統合型ナビゲーション（推奨標準）**:
   * 共通ヘッダー内に「ホーム」「大会日程」「データ」「通知」「設定」のナビゲーションリンク/タブを常時表示（`hidden md:flex items-center gap-1`）。
   * アクティブ画面のタブには下線または背景ハイライトを付与。
2. **固定サイドバー型ナビゲーション（管理画面・大画面向け）**:
   * 左側に幅60（240px）の固定サイドバー（`SidebarNav`）を配置し、メインコンテンツは `md:pl-60` でオフセット。

---

## 7. 実装コードサンプル集 (標準コンポーネント)

### 7.1 共通ボトムナビゲーション (モバイル専用: 5項目・セーフエリア対応 `BottomNav.tsx`)
iPhoneホームバーとの干渉を防ぐセーフエリア対応（`pb-[env(safe-area-inset-bottom)]`）と、最小12px文字・44pxタッチターゲットを担保した標準コンポーネントです。

```tsx
import React from 'react';
import { Home, Calendar, Database, Bell, Settings } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  badgeCount?: number;
  active: boolean;
}

export const BottomNav: React.FC<{ activeId: string }> = ({ activeId }) => {
  const navItems: NavItem[] = [
    { id: 'home', label: 'ホーム', href: 'home.html', icon: Home, active: activeId === 'home' },
    { id: 'schedule', label: '大会日程', href: 'schedule.html', icon: Calendar, active: activeId === 'schedule' },
    { id: 'data', label: 'データ', href: 'data.html', icon: Database, active: activeId === 'data' },
    { id: 'notifications', label: '通知', href: 'notifications.html', icon: Bell, badgeCount: 3, active: activeId === 'notifications' },
    { id: 'settings', label: '設定', href: 'settings.html', icon: Settings, active: activeId === 'settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 md:hidden pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-14 text-xs font-medium text-slate-500 dark:text-slate-400">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { window.location.href = item.href; }}
              className={`flex flex-col items-center justify-center min-h-[44px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                item.active
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${item.active ? 'stroke-[2.25px]' : 'stroke-[1.75px]'}`} />
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 bg-rose-500 text-white rounded-full text-xs flex items-center justify-center font-bold tabular-nums">
                    {item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className="leading-none text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
```

### 7.2 PC用 ヘッダー統合型ナビゲーション (`HeaderNav.tsx` - 推奨標準)
大画面（`md:` 768px以上）でユーザーが迷わず画面遷移できるよう、共通ヘッダーに配置するナビゲーションです。

```tsx
import React from 'react';
import { Trophy, Home, Calendar, Database, Bell, Settings } from 'lucide-react';

export const HeaderNav: React.FC<{ activeId: string; user: { name: string; avatarUrl?: string } }> = ({ activeId, user }) => {
  const navItems = [
    { id: 'home', label: 'ホーム', href: 'home.html', icon: Home },
    { id: 'schedule', label: '大会日程', href: 'schedule.html', icon: Calendar },
    { id: 'data', label: 'データ', href: 'data.html', icon: Database },
    { id: 'notifications', label: '通知', href: 'notifications.html', icon: Bell, badge: 3 },
    { id: 'settings', label: '設定', href: 'settings.html', icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* ブランドロゴ */}
        <a href="home.html" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-lg">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
            <Trophy className="w-4 h-4" />
          </div>
          <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">GRAN TENNIS</span>
        </a>

        {/* PC向けメニュータブ (md以上で表示) */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.badge ? (
                  <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white rounded-full text-xs font-bold tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>

        {/* ユーザープロフィールボタン（キーボード操作対応） */}
        <button
          type="button"
          onClick={() => { /* マイページモーダル開く */ }}
          className="flex items-center gap-2 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 min-h-[44px] min-w-[44px]"
          aria-label="マイページを開く"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
            {user.name.charAt(0)}
          </div>
        </button>
      </div>
    </header>
  );
};
```

### 7.3 トースト通知コンポーネント (`ToastNotification.tsx`)
モバイルでは下部ナビの直上・画面中央に配置し、幅不足や見切れを防止します。

```tsx
import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  visible: boolean;
}

export const ToastNotification: React.FC<ToastProps> = ({ message, type = 'success', visible }) => {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 pointer-events-none transition-all duration-300
        bottom-[calc(3.5rem+env(safe-area-inset-bottom)+12px)] inset-x-4 max-w-sm mx-auto
        md:bottom-6 md:right-6 md:left-auto md:mx-0
        flex items-center gap-2.5 bg-slate-900 dark:bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg border border-slate-700"
    >
      {type === 'success' ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
      )}
      <span className="font-medium text-xs leading-snug">{message}</span>
    </div>
  );
};
```

---

## 8. 内部ツール・計算シミュレーターの分離方針

* **`rate_calculate.html` の位置づけ**:
  * 本画面は、イロレーティングおよびGRANレベルの計算変動ロジックを開発者・運営者が検証するための**「内部シミュレーションツール」**です。
  * 一般ユーザー向けの公式動線（ボトムナビ・共通ヘッダー・デザインシステム）とは明確に分離し、一般ユーザーの利用画面には含めません。
  * 本番運用フェーズでは、`tests/tools/` または管理画面（PC専用）配下のデバッグ・検証機能へと移管します。

---

## 9. 大会要項情報のテキスト化ルール【重要】

* **画像内文字依存の完全撤廃**:
  * 大会要項ポスター画像の中に開催日・会場・参加料・種目・募集枠数・ステータス等の重要情報を埋め込む運用は行いません。
  * スマホ画面での縮小による判読不能、音声読み上げ（スクリーンリーダー）不可、検索やコピーの不可能性を防ぐため、**すべての重要情報は必ずカードおよび詳細画面内にHTMLテキストとして明記**します。
  * 要項画像はあくまで視覚的な補足（チラシ/ポスターイメージのプレビュー）として扱い、画像が表示されない・読み込めない環境であっても、エントリーに必要なすべての情報がテキストで把握できるようにUIを設計します。

---

## 10. AIバイブコーディング時の厳格チェックリスト

AIが画面やコンポーネントコードを出力・改修する際、以下の項目を必ず自己検証してください。

* [ ] **文字サイズの最小基準**: `text-[10px]`、`text-[11px]`、`text-[9px]` を使用していないか？ 最小サイズは 12px (`text-xs`) を厳守しているか？
* [ ] **タッチターゲットの確保**: すべてのボタン・リンク・セレクトボックスは `min-h-[44px]` (44px以上) を確保しているか？
* [ ] **フォントウェイトの制限**: `font-black` (900) や `font-extrabold` (800) を使わず、`font-normal` (400) / `font-medium` (500) / `font-bold` (700) の3種に抑えているか？
* [ ] **数値の等幅表示**: レート・日時・金額・スコア表示に `tabular-nums` を付与しているか？
* [ ] **フォントの指定**: フォントファミリーに `'Noto Sans JP', sans-serif` を適用しているか？
* [ ] **PCナビゲーションの提供**: `md:` (768px以上) で開いた際に画面遷移できるヘッダーナビまたはサイドバーが常時表示されているか？
* [ ] **iPhoneセーフエリアの確保**: ボトムナビに `pb-[env(safe-area-inset-bottom)]`、ページ最下部に `pb-24` を付与しているか？
* [ ] **トースト通知の配置**: モバイルで下部ナビの直上中央（`bottom-[calc(3.5rem+env(safe-area-inset-bottom)+12px)] inset-x-4 max-w-sm mx-auto`）になっているか？
* [ ] **アイコンのバージョン固定 & 絵文字禁止**: LucideのCDN読み込みはバージョン固定されているか？ 絵文字をアイコン代わりにハードコードしていないか？
* [ ] **要項情報のテキスト化**: 大会開催日・会場・料金などの重要情報が画像内テキストだけでなくHTMLテキストで明記されているか？
* [ ] **コンテンツ最大幅の統一**: 標準画面は `max-w-2xl` (672px)、データ統計画面は `max-w-4xl` (896px) に統一されているか？
* [ ] **過剰装飾の抑制**: 過度なグラデーション、多重のぼかし（backdrop-blur乱用）、点滅アニメーション等を排し、高コントラストな視認性を維持しているか？