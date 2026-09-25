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
* **Icons**: **Lucide React** (Lucide Icons、統一サイズ: 16px / 20px / 24px)
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
   * **特大コンテナ / データレポート / 大型モーダル外枠**: `rounded-3xl` (24px)
   * **標準カード / ダイアログ / モーダルパネル**: `rounded-2xl` (16px)
   * **コンパクトカード / リストアイテム / ボタン / 入力フォーム**: `rounded-xl` (12px) または `rounded-lg` (8px)
   * **バッジ / ピルタグ / アバター / インジケーター**: `rounded-full` (9999px)
4. **シャドウ・境界線の統一**:
   * カード / リストアイテム: `shadow-xs border border-slate-200 dark:border-slate-800`
   * モーダル / フローティングバー / ボトムシート: `shadow-xl border border-slate-200 dark:border-slate-700`

---

## 3. ボタン共通スタイル (Button Variants & States)

モバイルでのタップミスを防ぐため、高さ44px以上（`h-11` または `h-12`）を基本とし、明示的なホバー・アクティブ・フォーカス・無効化状態を定義します。

### 3.1 ボタンスタイル仕様表

| バリアント | 基本クラス | ホバー / アクティブ | 無効化 (Disabled) |
| :--- | :--- | :--- | :--- |
| **Primary (主要CTA)** | `bg-emerald-600 text-white font-medium shadow-sm` | `hover:bg-emerald-700 active:bg-emerald-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed disabled:shadow-none` |
| **Secondary (副次)** | `bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium border border-slate-200 dark:border-slate-700` | `hover:bg-slate-200 dark:hover:bg-slate-700` | `disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Outline (枠線)** | `bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 border border-emerald-600 font-medium` | `hover:bg-emerald-50 dark:hover:bg-emerald-950/30` | `disabled:border-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed` |
| **Destructive (危険/キャンセル)** | `bg-rose-600 text-white font-medium shadow-sm` | `hover:bg-rose-700 active:bg-rose-800` | `disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed` |
| **Ghost (テキストのみ)** | `bg-transparent text-slate-700 dark:text-slate-300 font-medium` | `hover:bg-slate-100 dark:hover:bg-slate-800` | `disabled:text-slate-400 disabled:cursor-not-allowed` |

### 3.2 実装コンポーネントコード (`src/components/ui/button.tsx`)
```tsx
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none select-none',
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
        sm: 'h-9 px-3 text-xs rounded-lg',
        md: 'h-11 px-4 py-2 text-sm',
        lg: 'h-12 px-6 text-base font-semibold',
        full: 'w-full h-12 px-6 text-base font-semibold',
        icon: 'h-10 w-10 p-0',
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

### 4.1 フォントファミリー定義
```css
font-family: 'Noto Sans JP', sans-serif;
```
HTMLヘッダーでのWebフォント読み込み例:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
```

### 4.2 タイポグラフィ階層定義表

| 要素 | Tailwind クラス群 | サイズ / 太さ | 用途 |
| :--- | :--- | :--- | :--- |
| **Page Title (H1)** | `text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight` | 20px / 24px Bold | 画面最上部タイトル、ヘッダー |
| **Section Title (H2)** | `text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug` | 18px / 20px Bold | カード見出し、ブロック区切り |
| **Card / Sub Title (H3)** | `text-base font-bold text-slate-800 dark:text-slate-100 leading-normal` | 16px Bold | 大会名、チーム名、モーダル題名 |
| **Body (本文)** | `text-sm font-normal text-slate-700 dark:text-slate-300 leading-relaxed` | 14px Normal | 一般説明文、要項本文、フォームラベル |
| **Body Medium (強調本文)** | `text-sm font-medium text-slate-900 dark:text-white leading-relaxed` | 14px Medium | 項目名、強調データ、テーブルヘッダー |
| **Caption (注釈/補足)** | `text-xs font-normal text-slate-500 dark:text-slate-400 leading-normal` | 12px Normal | 日時補足、残り枠数注釈、免責事項 |
| **Badge / Stat (数値強調)** | `text-xs font-bold font-mono uppercase tracking-wider` | 12px Bold / 等幅 | GRANレベル数値、ステータスタグ、受付番号 |

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

### 5.2 画面コンテナ & ページ構造ルール
* **モバイル画面**:
  * ルートラッパー: `min-h-screen bg-slate-50 dark:bg-slate-950 pb-20` (※ボトムナビの被りを防ぐため `pb-20` 必須)
  * 水平パディング: `px-4` (16px)
  * PC表示時のサイドバー対応: `md:pl-60 md:pb-8`
* **管理者 Web 画面**:
  * ルートラッパー: `min-h-screen bg-slate-50 dark:bg-slate-950`
  * メインコンテンツ幅: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8`

---

## 6. レスポンシブ対応基準 (Responsive Breakpoints)

本システムは **モバイルファースト（Mobile-First）** を原則とします。

| 接頭辞 | 最小幅 | 主なターゲットデバイス | レイアウト指針 |
| :--- | :--- | :--- | :--- |
| *(None)* | `0px` | スマートフォン (iOS / Android) | 1カラム構成、フルワイドボタン、下部固定5項目ボトムナビ |
| `sm:` | `640px` | 大型スマホ / 小型タブレット | カードパディング拡張 (`p-6`)、ボタン幅の自動調整 |
| `md:` | `768px` | タブレット / PCブラウザ | 2カラムグリッド (`grid-cols-2`)、左側固定サイドバー（w-60）表示 |
| `lg:` | `1024px` | デスクトップ PC | 3〜4カラムグリッド、テーブル全列表示 |

---

## 7. 実装コードサンプル集 (標準コンポーネント)

### 7.1 共通ボトムナビゲーション (モバイル専用: 5項目 `BottomNav.tsx`)
実装画面（全主要画面）と完全整合する5項目の下部固定ナビゲーションです。

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
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 md:hidden">
      <div className="grid grid-cols-5 h-14 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => { window.location.href = item.href; }}
              className={`flex flex-col items-center justify-center transition-colors ${
                item.active
                  ? 'text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 mb-0.5 ${item.active ? 'stroke-[2.25px]' : 'stroke-[1.75px]'}`} />
                {item.badgeCount && item.badgeCount > 0 ? (
                  <span className="absolute -top-1 -right-2 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                    {item.badgeCount}
                  </span>
                ) : null}
              </div>
              <span className="leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
```

### 7.2 PC用 左側固定サイドバーナビゲーション (`SidebarNav.tsx`)
```tsx
import React from 'react';
import { Trophy, Home, Calendar, Database, Bell, Settings, ChevronRight } from 'lucide-react';

export const SidebarNav: React.FC<{ activeId: string; user: { name: string; rate: number; tier: string } }> = ({ activeId, user }) => {
  const items = [
    { id: 'home', label: 'ホーム', href: 'home.html', icon: Home },
    { id: 'schedule', label: '大会日程', href: 'schedule.html', icon: Calendar },
    { id: 'data', label: 'データ', href: 'data.html', icon: Database },
    { id: 'notifications', label: '通知', href: 'notifications.html', icon: Bell, badge: 3 },
    { id: 'settings', label: '設定', href: 'settings.html', icon: Settings },
  ];

  return (
    <aside className="hidden md:flex flex-col fixed top-0 bottom-0 left-0 w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-40 shadow-xs">
      <div className="h-14 px-4 flex items-center border-b border-slate-100 dark:border-slate-800">
        <a href="home.html" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">GRAN TENNIS</span>
            <span className="text-[10px] text-emerald-600 font-bold ml-1 px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/50 rounded">2026</span>
          </div>
        </a>
      </div>
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive = it.id === activeId;
          return (
            <a
              key={it.id}
              href={it.href}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                <span>{it.label}</span>
              </div>
              {it.badge && (
                <span className="w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold font-mono">
                  {it.badge}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 cursor-pointer">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{user.name}</div>
            <div className="text-[10px] text-slate-500 truncate">Rate: <span className="font-bold text-emerald-600 font-mono">{user.rate}</span> ({user.tier}級)</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
};
```

---

## 8. AIバイブコーディング時の厳格チェックリスト

AIが画面やコンポーネントコードを出力する際、以下の項目を必ず自己検証してください。

* [ ] **開発規約の順守**：docsファイルは以下にある要件定義書・コーティング規約・デザイン指示等を鑑みて問題点はないか
* [ ] **フォントの指定**: フォントファミリーに `'Noto Sans JP', sans-serif` を適用しているか？
* [ ] **カラーモードの配慮**: ダークモード対応スタイル（`dark:` プレフィックス）またはダークテーマ用クラスが正しく考慮されているか？
* [ ] **タッチ領域の確保**: モバイル操作用ボタン・入力欄の高さが `h-11` (44px) または `h-12` (48px) に設定されているか？
* [ ] **ボトムナビの整合性**: モバイル下部ナビゲーションは「ホーム」「大会日程」「データ」「通知」「設定」の5項目（`h-14`）で統一されているか？
* [ ] **角丸の規則遵守**: 特大コンテナは `rounded-3xl`、カード・ダイアログは `rounded-2xl`、コンパクト部品・ボタンは `rounded-xl` / `rounded-lg`、バッジは `rounded-full` になっているか？
* [ ] **下部余白の確保**: モバイル画面の最下部にボトムナビゲーション用の `pb-20` が付与されているか？