# Git運用ガイドライン

## 概要

本ドキュメントは、Gitを使用したバージョン管理のガイドラインを定義する。
チーム開発における一貫性と効率性を確保する。

## ブランチ戦略

### GitHub Flow（推奨）

```
main ─────●─────●─────●─────●─────●─────●─────►
           \   /       \   /       \   /
feature     ●─●         ●─●         ●─●
             PR          PR          PR
```

### ブランチの種類

| ブランチ | 用途 | 命名規則 |
|----------|------|----------|
| main | 本番リリース可能な状態 | `main` |
| feature | 機能開発 | `feature/issue-123-add-login` |
| fix | バグ修正 | `fix/issue-456-fix-validation` |
| hotfix | 緊急修正 | `hotfix/issue-789-security-patch` |
| chore | 雑務（依存更新等） | `chore/update-dependencies` |
| docs | ドキュメント | `docs/add-api-documentation` |

### ブランチ命名規則

```bash
# 形式: {type}/{issue-number}-{short-description}

# Good
feature/123-add-user-authentication
fix/456-fix-login-validation
chore/update-react-to-19

# Bad
feature/login           # Issue番号なし
fix-bug                 # 形式が不正
my-changes              # 説明不足
```

## コミットメッセージ

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Type一覧

| Type | 説明 | 例 |
|------|------|-----|
| feat | 新機能 | `feat(auth): add login with Google` |
| fix | バグ修正 | `fix(form): fix validation error display` |
| docs | ドキュメント | `docs: update API documentation` |
| style | コードスタイル | `style: format with prettier` |
| refactor | リファクタリング | `refactor(user): simplify user service` |
| perf | パフォーマンス改善 | `perf(query): optimize database query` |
| test | テスト | `test(user): add unit tests for user service` |
| build | ビルド関連 | `build: update tsconfig settings` |
| ci | CI/CD | `ci: add deployment workflow` |
| chore | 雑務 | `chore: update dependencies` |
| revert | リバート | `revert: revert "feat(auth): add login"` |

### コミットメッセージ例

```bash
# 良い例
feat(user): add email verification functionality

Add email verification for new user registration:
- Send verification email on signup
- Add verification token validation
- Update user status after verification

Closes #123

# 悪い例
fix bug                    # 詳細不足
update code                # 何を更新したか不明
WIP                        # コミットすべきでない
fixed                      # 形式が不正
```

### 破壊的変更

```bash
feat(api)!: change user endpoint response format

BREAKING CHANGE: The user endpoint now returns `userId` instead of `id`.
Migration: Update client code to use `userId` field.
```

## プルリクエスト

### PR作成ガイドライン

```markdown
## 概要
<!-- 変更内容を簡潔に説明 -->

## 変更種別
- [ ] 新機能
- [ ] バグ修正
- [ ] リファクタリング
- [ ] ドキュメント
- [ ] その他

## 関連Issue
Closes #123

## 変更内容
<!-- 詳細な変更内容をリストで記載 -->
- ユーザー認証機能を追加
- ログインフォームを実装
- セッション管理を追加

## テスト方法
<!-- テスト手順を記載 -->
1. ログインページにアクセス
2. メールアドレスとパスワードを入力
3. ログインボタンをクリック
4. ダッシュボードに遷移することを確認

## スクリーンショット
<!-- UI変更がある場合はスクリーンショットを添付 -->

## チェックリスト
- [ ] テストを追加/更新した
- [ ] ドキュメントを更新した
- [ ] セルフレビューを行った
- [ ] 型チェック・リントが通る
```

### PRテンプレート

```markdown
<!-- .github/pull_request_template.md -->
## 概要


## 変更種別
- [ ] feat: 新機能
- [ ] fix: バグ修正
- [ ] refactor: リファクタリング
- [ ] docs: ドキュメント
- [ ] test: テスト
- [ ] chore: その他

## 関連Issue
Closes #

## 変更内容
-
-
-

## チェックリスト
- [ ] 型チェックが通る (`npm run typecheck`)
- [ ] リントが通る (`npm run lint`)
- [ ] テストが通る (`npm run test`)
- [ ] セルフレビューを行った
```

## コードレビュー

### レビュアーのチェックリスト

- [ ] コードの目的が明確か
- [ ] 設計・アーキテクチャが適切か
- [ ] エラーハンドリングが適切か
- [ ] セキュリティ上の問題がないか
- [ ] パフォーマンスへの影響を考慮しているか
- [ ] テストが十分か
- [ ] ドキュメントが更新されているか

### レビューコメントの書き方

```markdown
# 必須の修正
[must] ここはセキュリティ上の問題があります。
ユーザー入力を直接使用せず、サニタイズしてください。

# 提案（任意）
[nit] ここは `const` の方が適切かもしれません。

# 質問
[question] このロジックの意図を教えてください。

# 称賛
[praise] このリファクタリングはとても良いですね！
```

## Gitワークフロー

### 日常の作業フロー

```bash
# 1. mainを最新に更新
git checkout main
git pull origin main

# 2. 作業ブランチを作成
git checkout -b feature/123-add-login

# 3. 変更を加えてコミット
git add .
git commit -m "feat(auth): add login form"

# 4. 追加の変更
git add .
git commit -m "feat(auth): add form validation"

# 5. リモートにプッシュ
git push origin feature/123-add-login

# 6. PRを作成（GitHub上で）

# 7. レビュー後、Squash and Mergeでmainにマージ
```

### コンフリクト解決

```bash
# mainの最新を取得してリベース
git checkout main
git pull origin main
git checkout feature/123-add-login
git rebase main

# コンフリクトを解決
# ファイルを編集してコンフリクトマーカーを削除
git add .
git rebase --continue

# 強制プッシュ（リベース後）
git push origin feature/123-add-login --force-with-lease
```

### コミットの整理

```bash
# 直近のコミットを修正
git commit --amend -m "新しいメッセージ"

# 直近の3コミットをまとめる（インタラクティブリベース）
git rebase -i HEAD~3

# エディタで pick を squash に変更
pick abc1234 feat: first commit
squash def5678 feat: second commit
squash ghi9012 feat: third commit
```

## Git設定

### 推奨設定

```bash
# ユーザー設定
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# デフォルトブランチ
git config --global init.defaultBranch main

# プル時のリベース
git config --global pull.rebase true

# プッシュ時の設定
git config --global push.default current
git config --global push.autoSetupRemote true

# エディタ
git config --global core.editor "code --wait"

# エイリアス
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.ci commit
git config --global alias.st status
git config --global alias.lg "log --oneline --graph --all"
```

### .gitignore（グローバル）

```gitignore
# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo

# 環境
.env
.env.local
```

## タグとリリース

### セマンティックバージョニング

```
MAJOR.MINOR.PATCH

1.0.0 → 1.0.1  (バグ修正)
1.0.0 → 1.1.0  (後方互換性のある機能追加)
1.0.0 → 2.0.0  (破壊的変更)
```

### タグの作成

```bash
# タグを作成
git tag -a v1.0.0 -m "Release version 1.0.0"

# タグをプッシュ
git push origin v1.0.0

# すべてのタグをプッシュ
git push origin --tags
```

## トラブルシューティング

### よくある問題

```bash
# 直前のコミットを取り消し（ファイルは保持）
git reset --soft HEAD~1

# 直前のコミットを完全に取り消し
git reset --hard HEAD~1

# 特定のコミットに戻る
git reset --hard <commit-hash>

# 変更を一時退避
git stash
git stash pop

# 別ブランチのコミットを取り込む
git cherry-pick <commit-hash>

# リモートブランチを削除
git push origin --delete feature/old-branch

# ローカルブランチを削除
git branch -d feature/old-branch
```

## 関連ドキュメント

- [コーディング規約](./coding-standards.md)
- [デプロイメント](./deployment.md)
