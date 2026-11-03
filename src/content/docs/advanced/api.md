---
title: API で呼び出す
description: APIキーを使って自社システムからエージェントを呼び出す
---

エージェントは API で自社システムから呼び出せます。どの API も [公開設定の「API」タブ](../../guides/publish/#api) で発行した APIキーを使います。

| API | エンドポイント | 用途 |
| --- | --- | --- |
| [Public API](#public-api) | `POST /api/v1/chat/completions` | MentionMe 独自の形式でメッセージを送り、回答を受け取ります |
| [非同期 API](#非同期-api) | `POST /api/v1/async/chat/completions`<br />`GET /api/v1/async/jobs/{job_id}` | 時間のかかる処理を受け付けだけ先に済ませ、結果は Webhook かジョブ取得で受け取ります |
| [フィードバック API](#フィードバック-api) | `POST /api/v1/feedback` | 自社システムで集めた回答の評価を MentionMe に登録します |
| [Responses API](#responses-api) | `POST /api/v1/responses` | Open Responses 形式でメッセージを送ります |
| [OpenAI 互換 API](#openai-互換-api) | `GET /v1/models`<br />`POST /v1/chat/completions` | OpenAI の Chat Completions API と同じ形式。Open WebUI などの OpenAI 互換クライアントからそのまま使えます |

ベースURLは `https://app.mentionme.jp` です。

### 認証

すべてのリクエストに `Authorization` ヘッダーを付けます。

```
Authorization: Bearer <APIキー>
```

- APIキーは**エージェントごと**に発行します。1つのキーで操作できるのは、そのキーを発行したエージェントだけです
- [個人アクセストークン](../../implementation/4-account/#個人アクセストークン) はこの API では使えません

## 共通のパラメータ

### messages

会話のメッセージを配列で送ります（1件以上）。

| フィールド | 説明 |
| --- | --- |
| `role` | `system`（指示）/ `user`（利用者の発言）/ `assistant`（エージェントの過去の回答）のいずれか |
| `content` | 本文。文字列、または画像を含める場合は配列（[画像入力](#画像入力)） |

### response_format

回答の形式を指定します。省略時は `text` です。Public API と OpenAI 互換 API で使えます。

| `type` | 回答の形式 |
| --- | --- |
| `text` | 通常の文章 |
| `json_schema` | 指定した JSON Schema に沿った JSON |
| `json_object` | 形を指定しない任意の JSON |

`json_schema` の指定例：

```json
{
  "type": "json_schema",
  "json_schema": {
    "name": "answer",
    "strict": true,
    "schema": {
      "type": "object",
      "properties": {
        "answer": { "type": "string" },
        "needs_followup": { "type": "boolean" }
      },
      "required": ["answer", "needs_followup"],
      "additionalProperties": false
    }
  }
}
```

モデルの出力がスキーマに合わなかった場合は、`400`（`code: "structured_output_validation_failed"`）を返します。

## Public API

`POST /api/v1/chat/completions` でエージェントにメッセージを送り、回答を受け取ります。

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `thread_id` | ○ | 会話の識別子。同じ値を送ると、続きの会話として扱われます |
| `messages` | ○ | [messages](#messages) |
| `stream` | | `true` でストリーミング応答（既定は `false`） |
| `response_format` | | [response_format](#response_format) |

```bash
curl https://app.mentionme.jp/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-001",
    "messages": [{"role": "user", "content": "出張の宿泊費の上限は？"}]
  }'
```

**レスポンス（文章）：**

```json
{
  "messages": [
    {
      "role": "assistant",
      "content": [{ "type": "text", "text": "国内出張の宿泊費は1泊12,000円までです。（出典: 出張旅費規程）" }]
    }
  ],
  "citations": []
}
```

**レスポンス（`response_format` に `json_schema` / `json_object` を指定したとき）：**

```json
{
  "object": { "answer": "国内出張の宿泊費は1泊12,000円までです。", "needs_followup": false },
  "citations": []
}
```

`citations` は回答の根拠にした資料の情報です（[出典](#出典citations)）。出典を返す設定がオフのときは空の配列です。

**レスポンスヘッダー：**

| ヘッダー | 内容 |
| --- | --- |
| `X-MentionMe-Agent-Version` | 回答に使ったエージェントのバージョンID |
| `X-MentionMe-Model` | 回答に使ったモデル名 |
| `X-MentionMe-RAG-Sources-Count` | 根拠にした資料の件数（ストリーミング時は常に `0`） |
| `X-MentionMe-Trace-Id` | このリクエストのトレースID。[フィードバック API](#フィードバック-api) の `trace_id` に渡せます |

## 非同期 API

回答の生成に時間がかかる処理向けです。リクエストはすぐに受け付けられ、結果は Webhook（指定した URL への通知）か、ジョブの取得で受け取ります。

### ジョブを登録する

`POST /api/v1/async/chat/completions`

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `thread_id` | ○ | 会話の識別子 |
| `messages` | ○ | [messages](#messages) |
| `callback_url` | | 完了・失敗時に結果を POST する URL（インターネットから到達できる URL のみ） |
| `callback_secret` | | 通知に署名を付けるためのシークレット。`callback_url` とあわせて指定します |

```bash
curl https://app.mentionme.jp/api/v1/async/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-002",
    "messages": [{"role": "user", "content": "就業規則の変更点を要約して"}],
    "callback_url": "https://example.com/hooks/mentionme",
    "callback_secret": "YOUR_SECRET"
  }'
```

`202` で次のように返ります。

```json
{ "job_id": "8f3c2a1e-0b6d-4c1f-9a7e-2d5b8c9e4f10", "status": "pending" }
```

### 結果を取得する

`GET /api/v1/async/jobs/{job_id}`

```json
{
  "job_id": "8f3c2a1e-0b6d-4c1f-9a7e-2d5b8c9e4f10",
  "status": "completed",
  "created_at": 1793500000,
  "completed_at": 1793500042,
  "result": "主な変更点は次の3つです。…",
  "error": null,
  "callback_status": "delivered",
  "callback_attempts": 1
}
```

| フィールド | 値 |
| --- | --- |
| `status` | `pending`（受付済み）/ `running`（実行中）/ `completed`（完了）/ `failed`（失敗。理由は `error`） |
| `callback_status` | `pending`（通知前）/ `delivered`（通知済み）/ `failed`（通知失敗・再送待ち）/ `dead`（再送を打ち切り）。`callback_url` を指定していないジョブでは `null` |

通知が `dead` になった場合も、結果はこの API で取得できます。

### Webhook で受け取る

ジョブが完了または失敗すると、`callback_url` に次の JSON を POST します。

```json
{
  "job_id": "8f3c2a1e-0b6d-4c1f-9a7e-2d5b8c9e4f10",
  "agent_id": "<エージェントID>",
  "signed_at": 1793500042,
  "status": "completed",
  "result": "主な変更点は次の3つです。…"
}
```

失敗時は `"status": "failed"` と `"error": "<理由>"` が入ります。

**署名の検証：** `callback_secret` を指定した場合、リクエストボディ全体の HMAC-SHA256 が `X-MentionMe-Signature` ヘッダーに付きます。

```
X-MentionMe-Signature: sha256=<16進数の署名>
```

受信側では次の2点を確認してください。

1. 受け取ったボディ（加工前の文字列）から `callback_secret` で HMAC-SHA256 を計算し、ヘッダーの値と一致すること
2. `signed_at`（Unix 秒）が現在時刻に十分近いこと（例：5分以内）。古いものは再送の悪用（リプレイ）の可能性があるため拒否します

Node.js での例：

```js
const crypto = require("crypto");

function verifyCallback(rawBody, signatureHeader, secret) {
  const expected = "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signatureHeader);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  const { signed_at } = JSON.parse(rawBody);
  return Math.abs(Date.now() / 1000 - signed_at) < 300;
}
```

**再送：** 受信側が 2xx 以外を返した場合や接続できなかった場合は、間隔をあけて自動で再送します。合計9回失敗すると再送を打ち切ります（`callback_status` が `dead`）。同じジョブの通知が複数回届くことがあるため、受信処理は同じ `job_id` を2回処理しないようにしてください。

## フィードバック API

`POST /api/v1/feedback`

API 経由で提供している回答に対して、利用者の評価を登録します。登録した評価は、管理画面の [フィードバック](../../advanced/monitoring/#フィードバック) に表示されます。

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `thread_id` | ○ | 評価する会話の `thread_id`。このエージェントで実際に会話したものに限ります |
| `message_id` | ○ | 評価する回答メッセージのID |
| `session_id` | ○ | 評価した人の識別子。呼び出し側で利用者ごとに決めた値を送ります |
| `trace_id` | | Public API のレスポンスヘッダー `X-MentionMe-Trace-Id` の値 |
| `version_id` | | Public API のレスポンスヘッダー `X-MentionMe-Agent-Version` の値 |
| `rating` | ※ | `positive`（👍）/ `negative`（👎） |
| `reason_codes` | | 👎 の理由（複数可）：`wrong`（誤り）/ `outdated`（情報が古い）/ `irrelevant`（質問と関係ない）/ `insufficient`（情報が足りない）/ `other`（その他） |
| `comment` | | 評価のコメント（2,000文字まで） |
| `resolution` | ※ | 会話で疑問が解決したか：`resolved` / `unresolved` |
| `resolution_comment` | | 解決可否のコメント（2,000文字まで） |

※ `rating` と `resolution` の少なくとも一方が必要です。片方だけ送った場合、もう片方の登録内容は変わりません。

```bash
curl https://app.mentionme.jp/api/v1/feedback \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "thread_id": "thread-001",
    "message_id": "<回答メッセージのID>",
    "session_id": "user-123",
    "rating": "negative",
    "reason_codes": ["outdated"],
    "comment": "2026年度の規程に更新されていない"
  }'
```

成功すると `{"ok": true}` が返ります。

## Responses API

`POST /api/v1/responses`

[Open Responses](https://www.openresponses.org/) 形式でメッセージを送ります。

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `model` | ○ | エージェントID（APIキーのエージェントと一致している必要があります） |
| `input` | ○ | 質問の文字列、またはメッセージの配列（`role` は `user` / `assistant` / `system`） |
| `instructions` | | 追加の指示（system メッセージとして先頭に入ります） |
| `previous_response_id` | | 前回のレスポンスの `id`。指定すると続きの会話として扱われます |
| `stream` | | `true` でストリーミング応答（既定は `false`） |

```bash
curl https://app.mentionme.jp/api/v1/responses \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<エージェントID>",
    "input": "出張の宿泊費の上限は？"
  }'
```

```json
{
  "id": "resp_...",
  "object": "response",
  "created_at": 1793500000,
  "model": "<エージェントID>",
  "status": "completed",
  "incomplete_details": null,
  "output": [
    {
      "type": "message",
      "id": "msg_...",
      "status": "completed",
      "role": "assistant",
      "content": [{ "type": "output_text", "text": "国内出張の宿泊費は1泊12,000円までです。" }]
    }
  ],
  "usage": { "input_tokens": 1520, "output_tokens": 48, "total_tokens": 1568 }
}
```

- 回答が出力の上限で途中までになった場合、`status` は `incomplete` になります
- Responses API はテキストのみに対応しています。画像入力・`response_format`・出典は使えません

## OpenAI 互換 API

| エンドポイント | 内容 |
| --- | --- |
| `GET /v1/models` | APIキーに紐づくエージェント（1件）を返します |
| `POST /v1/chat/completions` | `model` にエージェントIDを指定してメッセージを送ります |

エージェントIDは `GET /v1/models` のレスポンスの `id` で確認できます。

| パラメータ | 必須 | 説明 |
| --- | --- | --- |
| `model` | ○ | エージェントID |
| `messages` | ○ | [messages](#messages) |
| `stream` | | `true` でストリーミング応答（既定は `false`） |
| `stream_options` | | `{"include_usage": true}` でストリーミングの最後にトークン数を返します（`stream: true` のときのみ） |
| `response_format` | | [response_format](#response_format) |
| `temperature` / `max_tokens` / `top_p` / `frequency_penalty` / `presence_penalty` / `user` | | OpenAI と同じ意味です |

```bash
curl https://app.mentionme.jp/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "<エージェントID>",
    "messages": [{"role": "user", "content": "出張の宿泊費の上限は？"}]
  }'
```

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1793500000,
  "model": "<エージェントID>",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "国内出張の宿泊費は1泊12,000円までです。" },
      "finish_reason": "stop"
    }
  ],
  "usage": { "prompt_tokens": 1520, "completion_tokens": 48, "total_tokens": 1568 },
  "citations": []
}
```

`citations` は MentionMe 独自の項目です。OpenAI の SDK では無視されます。

**会話の続き：** OpenAI 互換 API はリクエストごとに新しい会話として扱います。続きの会話として扱わせたいときは、`X-OpenWebUI-Chat-Id` ヘッダーに会話ごとの任意の値を付けてください（Open WebUI では `ENABLE_FORWARD_USER_INFO_HEADERS=true` で自動送信されます）。

## エラー

エラー時は次の形の JSON を返します。`type`・`code`・`param` は場合によって付きます。

```json
{ "error": { "message": "エラーの内容", "code": "credit_exhausted" } }
```

| ステータス | `code` | 意味・対処 |
| --- | --- | --- |
| 400 | | リクエストの内容が不正です（`model` がエージェントIDと一致しない、別のエージェントの `thread_id` を指定した、など） |
| 400 | `structured_output_validation_failed` | モデルの出力が `response_format` のスキーマに合いませんでした |
| 401 | | APIキーが未指定、または無効です |
| 402 | `credit_exhausted` | クレジットの残高がありません。[利用量（クレジット）](../../advanced/credits/) を確認してください |
| 403 | `trial_expired` | 無料トライアルの期間が終了しています |
| 403 | `account_suspended` | アカウントの利用が停止されています |
| 404 | | 指定したエージェント・会話・ジョブが見つかりません |
| 429 | | AI モデルの提供元の利用制限に達しました。時間をおいて再試行してください |
| 500 | | MentionMe 内部のエラーです |
| 502 | | 画像 URL から画像を取得できませんでした |
| 503 | `credit_maintenance` | メンテナンス中のため一時的に受け付けていません。時間をおいて再試行してください |

- AI モデルの提供元が返したエラーは、そのステータスとメッセージをそのまま返します（429・503 など）。再試行は 429 と 503 を対象にしてください
- 必須項目の不足や値の誤り（`role` に対応していない値を指定した、など）の場合、400 の本文は次の形になり、`error.message` は含まれません。`error.issues` に不正な項目が入ります

```json
{
  "success": false,
  "error": {
    "name": "ZodError",
    "issues": [{ "code": "invalid_type", "path": ["thread_id"], "message": "Required" }]
  }
}
```

- 非同期 API では、受け付けた後に実行できなかった場合（クレジット切れ・利用停止など）もジョブ登録は `202` で返り、ジョブの `status` が `failed`、`error` に理由が入ります

## 便利な機能

### 画像入力

`content` を配列にすると、文字と画像を一緒に送れます。画像に対応したモデルが必要です。

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "この領収書の金額は？" },
    { "type": "image_url", "image_url": { "url": "https://example.com/receipt.png" } }
  ]
}
```

`url` には `https://` の URL のほか、`data:image/png;base64,...` 形式のデータも指定できます。画像は `role` が `user` のメッセージでのみ使えます。

### 出典（citations）

回答の根拠にした資料の情報（資料名・該当箇所・ページ番号・スコア）をレスポンスの `citations` に含められます。プレイグラウンドの「引用情報を返す」をオンにしてバージョンを保存すると有効になります。

:::caution
APIキーはパスワードと同様に扱ってください。ブラウザで動くプログラム（JavaScript など）に埋め込むと第三者に読み取られます。必ずサーバー側から呼び出してください。
:::
