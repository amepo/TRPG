# 灯火のテーブル

ブラウザだけで遊べる **d20 系 TRPG**。ビルド不要・実行時の依存パッケージゼロ・**完全オフライン**。
データはすべて端末内（localStorage）で処理され、サーバーには何も送信されません。

```bash
npm start          # → http://localhost:5173/
```

> ES Modules を使っているため、`index.html` をダブルクリックして `file://` で開くと動きません。
> 上記のローカルサーバー（依存なしの Node 製、`tools/serve.js`）経由で開いてください。

スマホでは **ホーム画面に追加**すると全画面で起動し、オフラインでも全機能が使えます。

## 3つのモード

| モード | できること |
| --- | --- |
| **ソロプレイ** | シナリオを選び、一人で最初から最後まで遊ぶ。判定も戦闘も自動処理。 |
| **セッション支援** | 対面／オンラインの卓で使う道具。ダイス、キャラクターシート、イニシアチブ表。 |
| **シナリオ工房** | 自分の物語を書く。判定・戦闘・分岐・複数エンディング。書いたものはそのまま遊べる。 |

## ルール（d20 系）

- **能力値6種**（筋力・敏捷・耐久・知力・判断・魅力）、修正値は `floor((値−10)/2)`
- **判定**：`1d20 ＋ 能力修正 ＋ 習熟ボーナス` が DC 以上で成功。ナチュラル20は自動成功＋ダメージダイス倍、ナチュラル1は自動失敗
- **有利／不利**：2d20 の高い方／低い方。両方あると打ち消し合う
- **習熟ボーナス**：レベル1〜4で +2、以降4レベルごとに +1（最大10レベル）
- **戦闘**：イニシアチブ順のターン制。攻撃ロール vs AC、状態異常、死亡セーヴ（3回成功で安定／3回失敗で死亡）
- **休憩**：小休憩でヒットダイス消費＋能力回復、長休憩で全快
- **種族6／クラス5／経歴7**、呪文16種、モンスター15種

## ダイス式

`1d20` `2d6+3` `4d6kh3`（高い方3つ）`2d20kl1`（不利）`1d10!`（振り足し）`1d8+1d6-2`

## シナリオの形式

シナリオは素の JSON（プレーンオブジェクト）です。工房で書き出したファイルをそのまま共有できます。

```js
{
  id: 'my-scenario', title: 'タイトル', start: 'nodeA',
  vars: { trust: 0 },
  nodes: {
    nodeA: {
      title: '場面の見出し', art: '🌫️',
      text: ['本文。{name} で先頭の名前が入る。'],
      onEnter: [{ setFlag: 'met' }, { var: 'trust', add: 1 }],
      choices: [
        { text: '進む', to: 'nodeB' },
        { text: '調べる', check: {
            skill: 'investigation', dc: 12,
            success: { text: ['見つけた。'], to: 'nodeB', effects: [{ giveItem: 'potion' }] },
            fail:    { text: ['何も出てこない。'], to: 'nodeB' },
        } },
        { text: '鍵を使う', requires: { has: 'ironKey' }, lockedText: '鍵がない', to: 'nodeC' },
      ],
    },
    nodeB: {
      title: '戦闘',
      combat: { enemies: ['goblin', 'goblin'], onVictory: { to: 'nodeC' } },
    },
    nodeC: { title: '結末', ending: { type: 'good', title: '生還', text: ['帰り道は静かだった。'] } },
  },
}
```

**条件**：`{flag}` `{noFlag}` `{var,gte|lte|eq}` `{has}` `{classIn}` `{skillIn}` `{alive}` `{levelAtLeast}` `{all|any|not}`
**効果**：`{setFlag}` `{clearFlag}` `{var,add|set}` `{giveItem}` `{takeItem}` `{gold}` `{xp}` `{damage}` `{heal}` `{rest}` `{log}`

## 収録シナリオ

- **はじめての依頼**（10〜15分）— 操作を覚えるための導入編
- **鐘の鳴らない村**（40〜60分）— 27場面／戦闘4／判定20／結末5。村の聞き込みから儀式の阻止まで

## 構成

```
index.html                     画面の骨組み
manifest.webmanifest / sw.js   PWA（ホーム画面に追加・オフライン動作）
css/trpg.css                   見た目（ダーク、モバイル優先）
js/core/                       ゲームロジック（DOM に触れない・Node でテストできる）
  rng.js                       シード付き乱数（同じ種なら同じ展開を再現）
  dice.js                      ダイス式の解析と判定
  rules.js                     d20 ルール（判定・攻撃・ダメージ・状態・休憩・成長）
  content.js                   種族・クラス・経歴・装備・呪文・モンスター
  character.js                 キャラクター生成と派生値
  combat.js                    ターン制戦闘と敵AI
  scenario.js                  シナリオ形式・条件・効果・点検
  engine.js                    ソロプレイの進行（セーブ／ロード込み）
  store.js                     localStorage 保存
js/ui/                         画面（DOM のみ）
js/scenarios/                  収録シナリオ
tools/                         ローカルサーバー、配信ビルド、アイコン生成、ブラウザ検証
```

ゲームロジックは DOM も `Math.random` も直接触らず、乱数はシード付き `Rng` を経由します。
同じ種なら同じ展開を再現でき、Node のテストから素で動かせます。

## 開発

```bash
npm start          # ローカルサーバー
npm test           # ユニットテスト（ダイス・ルール・戦闘・シナリオ／エンジン）
npm run smoke      # 実ブラウザで3モードを通しで操作（要 npm install）
npm run build      # www/ に配信用ファイルを出力
npm run icons      # アイコンを再生成
```

`main` に push すると GitHub Pages へ自動デプロイされます（`.github/workflows/deploy-pages.yml`）。
