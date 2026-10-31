---
title: API で呼び出す
description: APIキーを使って自社システムからエージェントを呼び出す
---

エージェントは API で自社システムから呼び出せます。2種類の API があり、どちらも [公開設定の「API」タブ](../../guides/publish/#api) で発行した APIキーを使います。

| API | ベースURL | 用途 |
| --- | --- | --- |
| Public API | `https://app.mentionme.jp/api/v1` | MentionMe 独自の API |
| OpenAI 互換 API | `https://app.mentionme.jp/v1` | OpenAI の Chat Completions API と同じ形式。Open WebUI などの OpenAI 互換クライアントからそのまま使えます |

### 認証

すべてのリクエストに `Authorization` ヘッダーを付けます。

```
Authorization: Bearer <APIキー>
```

- APIキーは**エージェントごと**に発行します。1つのキーで操作できるのは、そのキーを発行したエージェントだけです
- [個人アクセストークン](../../implementation/4-account/#個人アクセストークン) はこの API では使えません

### Public API

`POST /api/v1/chat/completions` でエージェントにメッセージを送り、回答を受け取ります。

```bash
curl https://app.mentionme.jp/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-001",
    "messages": [{"role": "user", "content": "出張の宿泊費の上限は？"}]
  }'
```

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `thread_id` | ○ | 会話の識別子。同じ値を送ると、続きの会話として扱われます |
| `messages` | ○ | メッセージの配列（`role` と `content`） |
| `stream` | | `true` でストリーミング応答 |
| `response_format` | | 出力形式の指定（JSON Schema による構造化出力など） |

### OpenAI 互換 API

| エンドポイント | 内容 |
| --- | --- |
| `GET /v1/models` | APIキーに紐づくエージェント（1件）を返します |
| `POST /v1/chat/completions` | `model` にエージェントIDを指定してメッセージを送ります |

```bash
curl https://app.mentionme.jp/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<エージェントID>",
    "messages": [{"role": "user", "content": "出張の宿泊費の上限は？"}]
  }'
```

エージェントIDは `GET /v1/models` のレスポンスの `id` で確認できます。

### 便利な機能

| 機能 | 内容 |
| --- | --- |
| 画像入力 | `content` に画像（URL または base64）を含めて送れます。画像に対応したモデルが必要です |
| 構造化出力 | `response_format` に JSON Schema を指定すると、その形式の JSON で回答を受け取れます。ストリーミングとも併用できます |
| 出典（citations） | 回答の根拠にした資料の情報（資料名・該当箇所・ページ番号・スコア）をレスポンスに含められます。プレイグラウンドの「引用情報を返す」をオンにしてバージョンを保存すると有効になります |

:::caution
APIキーはパスワードと同様に扱ってください。ブラウザで動くプログラム（JavaScript など）に埋め込むと第三者に読み取られます。必ずサーバー側から呼び出してください。
:::
