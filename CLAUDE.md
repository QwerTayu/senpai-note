# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Gitに関する重要なルール

**コミットは必ずユーザーに許可を求めてから実行すること。** ユーザーが差分を目で確認して許可を出すまで、`git commit` を勝手に実行してはいけない。これは毎回のことで、一度許可されたからといって次回以降は省略できない。`git push` も同じ。

コミットの前に、差分に次のものが入っていないことを確かめる。入っていたらコミットせず、ユーザーに伝える。
- 実在の組織の情報: 本物の Slack のダンプの文面・個人名・メールアドレス・Slack のトークン（`xoxe-` など）・ファイル URL、実在の大学名・学園祭名・委員会名・内製アプリ名
- 鍵: `.env.local` の値（`sk-ant-`、Firebase のサービスアカウント、合言葉）
- `.claude/handoff.md`（経緯のメモ。`.gitignore` 済み）

push と本番へのデプロイ（`vercel deploy --prod`）は、Claude Code の安全チェックで止められるので、ユーザーに `!` で打ってもらう。

## プロジェクトの状態

Built with Claude: Japan 2026 ハッカソンの作品。2026/11/08(日) 13:00 に提出する。期間中に新しく書いたコードだけを使う（既存のプロジェクトからコードをコピーしない）。

- `.claude/requirements.md` — 正式な要件定義書。データモデル・エージェントのツール・画面・スケジュールの「正」はここにある。仕様を変えたら必ずここも一緒に更新すること。
- 本番: https://senpai-note.vercel.app （合言葉が必要）。GitHub: `QwerTayu/senpai-note`（公開）。`v1` タグは、登録・計画を足す前の版。

## このアプリについて

毎年メンバーが入れ替わる組織のための「1代上の先輩」ノート。前の代（B4）が実務訓練でいなくても、現役の代（B3）が回せるように、アプリが先輩の代わりをする。

1. **ためる**: Slack・Drive・Notion と、現役の代が計画に残した記録から、エージェントが知識カードを作る
2. **確かめる**: 前の代は ✅ を押すか、知識カードごとにエージェントと話して直すだけ
3. **先輩の代わりに導く**: 本番の日から今年の年間計画を作り、項目ごとに昨年の記録（📘）とエージェントの提案（💡、前の代が ✅ する）を付ける。現役は日付・完了・メモを直し、それが次の代の知識になる
4. **答える**: 確認済みの知識カードだけを根拠に、元の投稿を示して答える
5. **抜けだけ聞く**: 記録にない質問は「先輩への質問」にまとめ、前の代の答えが知識カードになる

用語は「知識カード」にそろえる（画面・ツアー・エージェントの指示文とも。ただの「カード」と書かない）。
代は「担当する本番の年」で数える（2027年度の代＝2027年の本番を担当する代。9/25 を境に切り替わる。`generationOf()`）。

## アーキテクチャ上の重要な決定事項（requirements.md を確認せずに蒸し返さないこと）

- **Claude API はサーバー側（Route Handler）からだけ呼ぶ**。`ANTHROPIC_API_KEY` をクライアントに出さない。Claude API を使うコードを書く前に claude-api skill を読み、モデル ID とパラメータを確かめる。モデルは `claude-opus-5-5`（adaptive thinking、effort は `medium`。画面の待ち時間に響くので上げない）。
- **Managed Agents は取り込みだけに使う**（`src/lib/ingest.ts`、カスタムツール `create_card` / `update_card` をサーバーで受ける）。修正の会話・質問への回答・先輩の回答・計画づくりは Messages API のツール使用（`src/lib/agents.ts`、`src/lib/planAgent.ts`）。取り込みの定期実行（scheduled deployments）はまだ作っていない。
- **取り込みエージェントの指示文（`src/lib/ingestAgent.ts`）やツールのスキーマ（`src/lib/cardTools.ts`）を変えたら**、`scripts/setup-agent.ts` を流してエージェントを新しいバージョンにする（ID は変わらない）。
- **ベクトル検索は使わない**。確認済みの知識カードをすべてコンテキストに入れ、プロンプトキャッシュを使う。
- **ただの RAG にしない**（ハッカソンの禁止例）。知識カードを作って育てる流れ、先輩のほうから今やることとアドバイスを示す流れ、記録にないことを先輩への質問にまとめる流れが作品の中心。
- **知識カードには必ず根拠を付ける**（`sourceIds` か `answerIds`）。回答・計画・アドバイスには確認済みの知識カードだけを使い、ツールの側で id を確かめる。アドバイスの「記録」は知識カードに書かれていることだけ、「提案」は記録と区別して出す。
- **ログインは作らない**。最初に `/register` で役・代・部門・名前（現役は本番の日も）を登録し、cookie に持つ。現役は `/kouhai`、前の代は `/senpai` だけを使う（`src/middleware.ts`）。デプロイ先は `DEMO_PASSCODE` の合言葉で守る。運用時は Cloudflare Zero Trust のメール認証を置く予定（作らない）。
- **実際の技大祭のデータはリポジトリに入れない**。デモは `data/demo/` の架空のデータで行う（リポジトリは公開する）。実際の Slack のダンプには個人名、メールアドレス、Slack のアクセストークンが入っているので、文面も名前も写さない。

## よく使うコマンド

```sh
npm run dev -- -p 3001          # 3000 は別のアプリが使っている
npx tsc --noEmit && npx eslint src
npm run build

# 取り込みエージェント（Managed Agents）を作る・新しいバージョンにする
npx tsx --env-file=.env.local scripts/setup-agent.ts

# デモデータを入れ直す（--reset で知識カード・質問・計画・代も消す）
npx tsx --env-file=.env.local scripts/seed.ts --reset
```

環境変数（`.env.local`、Vercel の Production にも同じものを入れてある）: `ANTHROPIC_API_KEY`、`FIREBASE_SERVICE_ACCOUNT_BASE64`、`INGEST_ENVIRONMENT_ID`、`INGEST_AGENT_ID`、`DEMO_PASSCODE`。値を画面やチャットに出さない。

API を curl で確かめるときは、`/api/login`（合言葉）と `/api/profile`（登録）の cookie を cookie jar に入れてから呼ぶ。取り込みは約1分40秒、計画づくりは約2分かかる。

開発サーバーを動かしたまま `npm run build` しない（同じ `.next` を上書きして、開発サーバーが 500 になる）。ビルドを確かめるなら、開発サーバーを止めてから。

Next.js は脆弱性の修正版にしておく（15.5.4 は Vercel にデプロイを拒否された）。
