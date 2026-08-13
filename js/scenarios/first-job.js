/* シナリオ「はじめての依頼」— 遊び方を覚えるための導入編（10〜15分）。
   技能判定・戦闘・休憩・アイテムの4つを一度ずつ通す。 */

export const firstJob = {
  id: 'first-job',
  title: 'はじめての依頼',
  author: '灯火のテーブル',
  world: 'embers',
  blurb: '納屋に何かが住み着いた。追い出してくれれば銀貨五枚。——遊び方を覚えるための、小さな仕事。',
  level: 1,
  length: '導入（10〜15分）',
  start: 'board',
  vars: { pay: 5 },
  tutorial: true,

  nodes: {
    board: {
      id: 'board', title: '依頼板の前', art: '📋',
      text: [
        '町の広場、掲示板の隅に画鋲でとめられた紙切れ。',
        '「納屋に何かが住みついた。追い出してくれれば銀貨五枚。日暮れまでに」',
        '報酬は安い。だが、はじめの一歩とはそういうものだ。',
        '',
        '——ここから先は、選択肢を選ぶだけで話が進む。技能で解決したいときは、判定つきの選択肢を選ぶといい。',
      ],
      choices: [
        { text: '依頼を受ける', to: 'barn' },
        {
          text: '依頼主に報酬の値上げを交渉する',
          once: true,
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: ['「……八枚だ。それ以上は出せん」商人は渋い顔をした。交渉成立。'],
              effects: [{ var: 'pay', set: 8 }, { log: '報酬が銀貨8枚になった。', kind: 'good' }],
              to: 'barn',
            },
            fail: {
              text: ['「嫌なら他を当たる」取りつく島もない。'],
              to: 'barn',
            },
          },
        },
      ],
    },

    barn: {
      id: 'barn', title: '納屋の前', art: '🚪',
      text: [
        '傾いた木の扉。内側から、爪で床を掻くような音がする。一匹ではない。',
        '扉には隙間がある。覗くこともできるし、いきなり開けることもできる。',
      ],
      choices: [
        {
          text: '隙間から中を覗く（知覚）',
          check: {
            skill: 'perception', dc: 10,
            success: {
              text: [
                '暗がりに、光る目が四つ。鼠だ——ただし、犬ほどの大きさの群れ。',
                '奥の梁に、古い麻袋が引っかかっているのも見えた。',
              ],
              effects: [{ setFlag: 'scouted' }],
              to: 'barnDoor',
            },
            fail: { text: ['暗くて何も見えない。物音だけが大きくなる。'], to: 'barnDoor' },
          },
        },
        { text: '扉を蹴り開ける', to: 'fight' },
      ],
    },

    barnDoor: {
      id: 'barnDoor', title: '扉の前', art: '🚪',
      text: ['手はまだ、扉にかかっていない。'],
      choices: [
        {
          text: '松明に火をつけてから踏み込む',
          once: true,
          effects: [{ log: '灯りを確保した。暗がりの不利がなくなる。', kind: 'good' }, { setFlag: 'lit' }],
          to: 'fight',
        },
        { text: '静かに扉を開ける', to: 'fight' },
      ],
    },

    fight: {
      id: 'fight', title: '納屋の中', art: '🐀',
      text: ['床が波打った。床ではない。鼠の群れが、こちらへ雪崩を打って向かってくる。'],
      combat: {
        title: '納屋の主',
        enemies: ['ratSwarm'],
        surprise: null,
        onVictory: {
          text: ['最後の一匹が壁の穴へ消えた。納屋は静かになった。'],
          to: 'loot',
        },
        onDefeat: {
          text: ['ぼろぼろになって外に転がり出た。日はまだ高い。もう一度やるか、諦めるか。'],
          to: 'retry',
        },
        onFlee: { to: 'retry' },
      },
    },

    retry: {
      id: 'retry', title: '納屋の外', art: '🩹',
      text: ['傷は浅い。休めば動ける。'],
      onEnter: [{ rest: 'short' }],
      choices: [
        { text: 'もう一度挑む', to: 'fight' },
        { text: '諦めて町へ戻る', to: 'endFail' },
      ],
    },

    loot: {
      id: 'loot', title: '梁の上の麻袋', art: '💰',
      text: ['埃の匂い。奥の梁に、古い麻袋が引っかかっている。'],
      choices: [
        {
          text: '梁によじ登って麻袋を取る（運動）',
          check: {
            skill: 'athletics', dc: 11,
            success: {
              text: ['袋の中身は、前の持ち主の隠し金だった。銀貨が十二枚と、治癒の薬が一本。'],
              effects: [{ gold: 12 }, { giveItem: 'potion' }],
              to: 'tell',
            },
            fail: {
              text: ['手が滑って落ちた。袋は取れたが、背中を打った。'],
              effects: [{ damage: '1d4', target: 'active', type: '打撃' }, { gold: 12 }],
              to: 'tell',
            },
          },
        },
        { text: '放っておいて依頼主のところへ戻る', to: 'endGood' },
      ],
    },

    tell: {
      id: 'tell', title: '帰り道', art: '🌇',
      text: [
        '袋の重みが、歩くたびに腰に当たる。',
        '依頼主は納屋の中身までは知らない。言わなければ、それで終わる話だ。',
      ],
      choices: [
        { text: '隠し金のことも正直に話す', to: 'endGood' },
        {
          text: '黙っておく',
          effects: [{ setFlag: 'keptSilent' }],
          to: 'endKeep',
        },
      ],
    },

    endGood: {
      id: 'endGood', title: '報酬', art: '🪙',
      text: [
        '依頼主は納屋を覗き込み、鼻を鳴らして銀貨を数えた。',
        '「……次はもう少し、大きな仕事もある。腕がいいなら、また来い」',
      ],
      onEnter: [{ xp: 100 }],
      ending: {
        type: 'good',
        title: 'はじめの一歩',
        text: [
          '報酬 銀貨{var:pay}枚。腕試しとしては上出来だ。',
          '——基本は以上。次は「鐘の鳴らない村」で、本物の依頼を受けてみよう。',
        ],
      },
    },

    endKeep: {
      id: 'endKeep', title: '黙っていた', art: '🪙',
      text: [
        '銀貨{var:pay}枚を受け取り、袋のことは言わずに店を出た。',
        '依頼主は最後まで機嫌がよかった。それが少しだけ、後ろめたい。',
      ],
      ending: {
        type: 'neutral',
        title: '言わなかったこと',
        text: [
          '報酬 銀貨{var:pay}枚と、誰も知らない銀貨十二枚。',
          '——嘘はついていない。訊かれなかっただけだ。この街ではそれで通る。',
        ],
      },
    },

    endFail: {
      id: 'endFail', title: '手ぶらで帰る', art: '🌇',
      text: ['依頼主は何も言わなかった。それがいちばん応えた。'],
      ending: {
        type: 'neutral',
        title: '出直し',
        text: ['報酬はなし。だが、覚えたことはある。次はうまくやろう。'],
      },
    },
  },
};

export default firstJob;
