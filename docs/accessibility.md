# アクセシビリティガイドライン

## 概要

本ドキュメントは、WCAG 2.1 AA準拠を目指すアクセシビリティガイドラインを定義する。
すべてのユーザーが使いやすいインターフェースを実現する。

## 基本原則（POUR）

| 原則                       | 説明                         | 例                     |
| -------------------------- | ---------------------------- | ---------------------- |
| Perceivable（知覚可能）    | 情報を認識できる             | 画像に代替テキスト     |
| Operable（操作可能）       | インターフェースを操作できる | キーボード操作対応     |
| Understandable（理解可能） | 内容を理解できる             | 明確なエラーメッセージ |
| Robust（堅牢）             | 支援技術と互換性がある       | セマンティックHTML     |

## セマンティックHTML

### 適切な要素の使用

```tsx
// Bad: divの乱用
<div onClick={handleClick}>Submit</div>
<div className="heading">Page Title</div>

// Good: セマンティックな要素
<button onClick={handleClick}>Submit</button>
<h1>Page Title</h1>

// ナビゲーション
<nav aria-label="メインナビゲーション">
  <ul>
    <li><a href="/">ホーム</a></li>
    <li><a href="/about">会社概要</a></li>
  </ul>
</nav>

// メインコンテンツ
<main>
  <article>
    <header>
      <h1>記事タイトル</h1>
      <time dateTime="2024-01-01">2024年1月1日</time>
    </header>
    <section>
      <h2>セクション見出し</h2>
      <p>本文...</p>
    </section>
  </article>
</main>

// フッター
<footer>
  <p>&copy; 2024 My Company</p>
</footer>
```

### 見出し階層

```tsx
// Good: 正しい見出し階層
<h1>ページタイトル</h1>
  <h2>セクション1</h2>
    <h3>サブセクション1.1</h3>
    <h3>サブセクション1.2</h3>
  <h2>セクション2</h2>

// Bad: 見出しレベルのスキップ
<h1>ページタイトル</h1>
  <h3>セクション</h3>  // h2をスキップ
```

## キーボードアクセシビリティ

### フォーカス管理

```tsx
// フォーカス可能な要素の順序
<div>
  <input tabIndex={0} />        {/* 自然な順序 */}
  <button tabIndex={0} />       {/* 自然な順序 */}
  <div tabIndex={-1} />         {/* プログラムでのみフォーカス可能 */}
</div>

// フォーカスの視覚的表示
// packages/ui-core/src/styles/global.css
:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}

// カスタムフォーカススタイル
const buttonVariants = cva(
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
  // ...
)
```

### キーボード操作

```tsx
// キーボードイベントの処理
function Menu({ items, onSelect }: MenuProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, items.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        onSelect(items[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        closeMenu();
        break;
    }
  };

  return (
    <ul role="menu" onKeyDown={handleKeyDown}>
      {items.map((item, index) => (
        <li
          key={item.id}
          role="menuitem"
          tabIndex={index === activeIndex ? 0 : -1}
          aria-selected={index === activeIndex}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

// スキップリンク
function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:px-4 focus:py-2"
    >
      メインコンテンツにスキップ
    </a>
  );
}
```

## ARIAの使用

### ランドマーク

```tsx
<header role="banner">
  <nav role="navigation" aria-label="メイン">...</nav>
</header>
<main role="main" id="main-content">
  <section role="region" aria-labelledby="section-title">
    <h2 id="section-title">セクションタイトル</h2>
  </section>
</main>
<aside role="complementary">...</aside>
<footer role="contentinfo">...</footer>
```

### 状態と属性

```tsx
// 展開/折りたたみ
function Accordion({ title, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();

  return (
    <div>
      <button
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen(!isOpen)}
      >
        {title}
      </button>
      <div
        id={contentId}
        hidden={!isOpen}
        role="region"
        aria-labelledby={/* ボタンのid */}
      >
        {children}
      </div>
    </div>
  );
}

// タブ
function Tabs({ tabs }: TabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      <div role="tablist" aria-label="タブナビゲーション">
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={index === activeTab}
            aria-controls={`panel-${tab.id}`}
            tabIndex={index === activeTab ? 0 : -1}
            onClick={() => setActiveTab(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, index) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={index !== activeTab}
          tabIndex={0}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

// モーダル
function Modal({ isOpen, onClose, title, children }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      // フォーカストラップ
      const previousFocus = document.activeElement as HTMLElement;
      return () => previousFocus?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
      <button onClick={onClose}>閉じる</button>
    </div>
  );
}
```

### ライブリージョン

```tsx
// 動的コンテンツの通知
function Notification({ message, type }: NotificationProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      aria-atomic="true"
      className={type === "error" ? "text-red-600" : "text-green-600"}
    >
      {message}
    </div>
  );
}

// ローディング状態
function LoadingIndicator({ isLoading }: { isLoading: boolean }) {
  return (
    <div aria-live="polite" aria-busy={isLoading}>
      {isLoading && <span>読み込み中...</span>}
    </div>
  );
}
```

## フォームアクセシビリティ

### ラベルとエラー

```tsx
function FormField({ id, label, error, required, children }: FormFieldProps) {
  const errorId = `${id}-error`;
  const describedBy = error ? errorId : undefined;

  return (
    <div>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
        {required && <span className="sr-only">（必須）</span>}
      </label>
      {React.cloneElement(children, {
        id,
        "aria-describedby": describedBy,
        "aria-invalid": !!error,
        "aria-required": required,
      })}
      {error && (
        <p id={errorId} role="alert" className="text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// 使用例
<FormField id="email" label="メールアドレス" error={errors.email} required>
  <input type="email" name="email" />
</FormField>;
```

### フォームの説明

```tsx
function PasswordField() {
  const [showPassword, setShowPassword] = useState(false);
  const hintId = useId();

  return (
    <div>
      <label htmlFor="password">パスワード</label>
      <input
        type={showPassword ? "text" : "password"}
        id="password"
        aria-describedby={hintId}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        aria-pressed={showPassword}
      >
        {showPassword ? "パスワードを隠す" : "パスワードを表示"}
      </button>
      <p id={hintId} className="text-sm text-gray-600">
        8文字以上、英大文字・小文字・数字を含む
      </p>
    </div>
  );
}
```

## 画像とメディア

### 代替テキスト

```tsx
// 情報を伝える画像
<img src="/chart.png" alt="2024年の売上推移グラフ：1月100万円から12月150万円へ増加" />

// 装飾的な画像
<img src="/decorative.png" alt="" aria-hidden="true" />

// リンク内のアイコン
<a href="/settings">
  <img src="/gear.svg" alt="" aria-hidden="true" />
  <span>設定</span>
</a>

// アイコンのみのボタン
<button aria-label="メニューを開く">
  <MenuIcon aria-hidden="true" />
</button>
```

### 動画とオーディオ

```tsx
<video controls>
  <source src="/video.mp4" type="video/mp4" />
  <track kind="captions" src="/captions.vtt" srcLang="ja" label="日本語" />
  <track
    kind="descriptions"
    src="/descriptions.vtt"
    srcLang="ja"
    label="音声ガイド"
  />
</video>
```

## カラーとコントラスト

### コントラスト比

```css
/* WCAG AA: 4.5:1以上（通常テキスト）、3:1以上（大きなテキスト） */
:root {
  /* 背景白(#ffffff)に対して */
  --color-text: #1f2937; /* コントラスト比 12.6:1 */
  --color-text-secondary: #6b7280; /* コントラスト比 5.4:1 */
  --color-link: #2563eb; /* コントラスト比 4.5:1 */
}
```

### 色だけに依存しない

```tsx
// Bad: 色だけでエラーを示す
<input className={hasError ? 'border-red-500' : 'border-gray-300'} />

// Good: 色＋アイコン＋テキスト
<div>
  <input
    className={hasError ? 'border-red-500' : 'border-gray-300'}
    aria-invalid={hasError}
  />
  {hasError && (
    <p className="flex items-center text-red-600">
      <ErrorIcon aria-hidden="true" />
      <span>入力内容に誤りがあります</span>
    </p>
  )}
</div>
```

## テスト

### 自動テスト

```typescript
// packages/ui-core/src/components/button/button.test.tsx
import { render, screen } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('Button accessibility', () => {
  it('アクセシビリティ違反がない', async () => {
    const { container } = render(<Button>Click me</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('適切なロールを持つ', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('disabled時にaria-disabledが設定される', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })
})
```

### 手動テスト

- [ ] キーボードのみで操作可能か
- [ ] スクリーンリーダーで内容が理解できるか
- [ ] 色の区別なしで情報が伝わるか
- [ ] 200%ズームでレイアウトが崩れないか

## チェックリスト

### 開発時

- [ ] セマンティックHTMLを使用
- [ ] すべてのインタラクティブ要素がキーボード操作可能
- [ ] 適切なARIA属性を設定
- [ ] フォームにラベルとエラーメッセージ
- [ ] 画像に代替テキスト
- [ ] 十分なコントラスト比

### レビュー時

- [ ] 見出し階層が正しい
- [ ] フォーカス順序が論理的
- [ ] 色だけに依存していない
- [ ] axe等の自動テストをパス

## 関連ドキュメント

- [コーディング規約](./coding-standards.md)
- [テスト戦略](./testing-strategy.md)
