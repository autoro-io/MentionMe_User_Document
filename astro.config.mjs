// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'MentionMe',
			defaultLocale: 'root',
			locales: { root: { label: '日本語', lang: 'ja' } },
			customCss: ['./src/styles/custom.css'],
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/autoro-io/MentionMe_User_Document' }],
			sidebar: [
				{
					label: '1. はじめに',
					items: [{ label: '全体像と用語', slug: 'introduction/overview' }],
				},
				{
					label: '2. 導入する',
					items: [
						{ label: 'アカウント登録・ログイン', slug: 'implementation/1-sign-in' },
						{ label: 'ワークスペースを作成する', slug: 'implementation/2-workspace' },
						{ label: 'メンバーを管理する', slug: 'implementation/3-members' },
						{ label: 'アカウント設定', slug: 'implementation/4-account' },
					],
				},
				{
					label: '3. 使ってみる',
					items: [
						{ label: '③-1 エージェントを作る', slug: 'guides/create-agent' },
						{ label: '③-2 エージェントを設定する', slug: 'guides/agent-settings' },
						{ label: '③-3 社内資料を登録する', slug: 'guides/knowledge' },
						{ label: '③-4 プレイグラウンドで試す', slug: 'guides/playground' },
						{ label: '③-5 公開する（Web・埋め込み・API）', slug: 'guides/publish' },
						{ label: '③-6 チャットツールと連携する', slug: 'guides/integration' },
					],
				},
				{
					label: '4. もっと活用する',
					items: [
						{ label: 'ツールを使わせる', slug: 'advanced/tools' },
						{ label: 'テストで品質を確認する', slug: 'advanced/testing' },
						{ label: 'バージョン管理・比較', slug: 'advanced/versions' },
						{ label: '記憶の設定', slug: 'advanced/memory' },
						{ label: '利用状況を確認する', slug: 'advanced/monitoring' },
						{ label: '利用量（クレジット）', slug: 'advanced/credits' },
						{ label: 'API で呼び出す', slug: 'advanced/api' },
						{ label: 'ワークスペースの詳細設定', slug: 'advanced/workspace-settings' },
					],
				},
				{
					label: '5. 利用者の方へ',
					items: [{ label: 'エージェントに質問する', slug: 'users/ask' }],
				},
				{
					label: 'サポート・付録',
					items: [
						{ label: 'お問い合わせ窓口', slug: 'reference/contact-us' },
						{ label: 'よくある質問', slug: 'reference/faq' },
						{ label: '用語集', slug: 'reference/glossary' },
						{ label: 'トラブルシューティング', slug: 'reference/troubleshooting' },
						{ label: 'リリースノート', slug: 'reference/release-notes' },
					],
				},
			],
		}),
	],
});
