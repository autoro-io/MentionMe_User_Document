# MentionMe ドキュメント

MentionMe の公式ドキュメントサイトのリポジトリです。
静的サイトジェネレーター [Astro](https://astro.build/) とドキュメントテーマ [Starlight](https://starlight.astro.build/) を使用して構築されています。

## ローカルでの実行方法

```bash
git clone https://github.com/autoro-io/MentionMe_User_Document.git
cd MentionMe_User_Document
npm install
npm run dev     # http://localhost:4321 でプレビュー
npm run build   # dist/ に静的ファイルを出力
```

## 公開

`main` に push すると GitHub Actions（`.github/workflows/astro.yml`）でビルドされ、GitHub Pages に公開されます。

## 編集・追加について

- ページは `src/content/docs/` 内に `.md` または `.mdx` で作成します。
- 画像は `public/` に置きます。
- サイドバーのメニュー構成は `astro.config.mjs` で管理しています。
