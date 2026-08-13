/* シナリオ「三つの峠」— 灯火のテーブル・route 型（30〜45分）。

   薬を積んだ荷馬車を、雪が閉ざす前に山向こうの町へ。
   峠は三つ。どれを通っても二区間ぶんかかる。
   var:cold が寒さの蓄積、var:trust が同行の荷主との距離。 */

export const threePasses = {
  id: 'three-passes',
  title: '三つの峠',
  author: '灯火のテーブル',
  world: 'embers',
  blurb: '峠が雪で閉じるまであと二日。薬を積んだ荷馬車を、山向こうのケルンまで。',
  level: 2,
  length: '中編（30〜45分）',
  start: 'depot',
  vars: { cold: 0, trust: 0, legs: 0 },

  items: {
    medicine: { id: 'medicine', name: '薬箱', desc: '山向こうの町で流行っている熱病の薬。冷やしても凍らせてもいけない。' },
    furs: { id: 'furs', name: '毛皮の外套', desc: '重いが、峠の夜には命の値段がつく。' },
    charmBell: { id: 'charmBell', name: '山神の鈴', desc: '荷馬の首につける。鳴らしておくと獣が寄らないという。' },
  },

  monsters: {
    hedgeWitch: {
      name: '峠の隠者', kind: '人型', cr: 1, xp: 200,
      acOverride: 12, hp: '4d8+4', hpAvg: 22, speed: 9,
      abilities: { str: 10, dex: 12, con: 12, int: 13, wis: 16, cha: 12 },
      attacks: [{ name: '凍える指先', bonus: 4, damage: '2d6', type: '氷', ranged: true }],
      tactics: 'caster',
      blurb: '峠に一人で住んでいる。追い剥ぎではないが、通行料は取る。',
    },
  },

  nodes: {

    depot: {
      id: 'depot', title: '麓の宿場', art: '🏔️',
      text: [
        '荷馬車に積むのは木箱が六つ。ケルンでは熱病が出ていて、この薬を待っている。',
        '荷主のヤナは自分も行くと言って聞かない。「積んだ責任は積んだ者にあります」',
        '峠は三つ。どれも二日はかかる。雪はもう降りはじめている。',
      ],
      onEnter: [{ giveItem: 'medicine' }],
      choices: [
        {
          text: 'ヤナに残るよう説得する',
          check: {
            skill: 'persuasion', dc: 13,
            success: {
              text: [
                '「……分かりました。でも」彼女は毛皮の外套を押しつけてきた。「これは持っていってください」',
                '荷は軽くなった。守るものも一つ減った。',
              ],
              effects: [{ giveItem: 'furs' }, { setFlag: 'aloneRun' }],
              to: 'route',
            },
            fail: {
              text: ['「わたしが行かないと、あの町では誰も受け取ってくれません」——事実だった。'],
              effects: [{ var: 'trust', add: 1 }],
              to: 'route',
            },
          },
        },
        {
          text: '装備を整えてから出る',
          once: true,
          effects: [{ gold: -20 }, { giveItem: 'furs' }, { giveItem: 'charmBell' }],
          to: 'route',
        },
        { text: 'すぐに出発する', to: 'route' },
      ],
    },

    route: {
      id: 'route', title: '峠を選ぶ', art: '🗺️',
      text: [
        '**鉄砲水の峠** — 最短。だが谷が深く、天気が崩れると逃げ場がない。',
        '**古い巡礼路** — 遠回り。石畳が残っていて馬車が通しやすい。人も通る。',
        '**狼の背** — 稜線沿い。風が強く、獣が多い。だが雪に埋もれるのが一番遅い。',
      ],
      choices: [
        { text: '鉄砲水の峠へ', to: 'gorge' },
        { text: '古い巡礼路へ', to: 'pilgrim' },
        { text: '狼の背へ', to: 'ridge' },
      ],
    },

    gorge: {
      id: 'gorge', title: '鉄砲水の峠', art: '🏞️',
      text: ['谷底の道。両側の壁が高く、空が細い帯にしか見えない。上流で雨の音がする。'],
      choices: [
        {
          text: '速度を上げて谷を抜ける',
          check: {
            skill: 'athletics', dc: 12,
            success: { text: ['水が来る前に、馬車ごと高い岩棚へ上げた。'], to: 'camp' },
            fail: {
              text: ['濁流が足元を舐めた。木箱が一つ、流れていくのが見えた。追えなかった。'],
              effects: [
                { var: 'cold', add: 2 },
                { damage: '1d6', target: 'party', type: '打撃' },
                { setFlag: 'shortLoad' },
              ],
              to: 'camp',
            },
          },
        },
        {
          text: '空模様を読んでから進む',
          check: {
            skill: 'nature', dc: 12,
            success: {
              text: ['雨雲の流れから、水が来るのは半刻後と読めた。その前に抜けられる。'],
              effects: [{ setFlag: 'readSky' }],
              to: 'camp',
            },
            fail: { text: ['読み違えた。谷の途中で、足首まで水が来た。'], effects: [{ var: 'cold', add: 1 }], to: 'camp' },
          },
        },
      ],
    },

    pilgrim: {
      id: 'pilgrim', title: '古い巡礼路', art: '⛪',
      text: [
        '石畳は割れているが、まだ馬車が通る。道端に、風雨に削れた石像が等間隔で並ぶ。',
        '一体の前に、火の消えていない焚き火があった。',
      ],
      choices: [
        {
          text: '焚き火の主に声をかける',
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                '岩陰から出てきたのは、痩せた隠者だった。「通ってよい。ただし荷を一つ置いていけ」',
                '目を見れば分かる。この人は奪う気ではなく、冬を越す食料が要るだけだ。',
              ],
              effects: [{ setFlag: 'metHermit' }],
              to: 'hermitTalk',
            },
            fail: { text: ['返事はない。かわりに、道の先の岩陰で何かが動いた。'], to: 'hermitFight' },
          },
        },
        {
          text: '関わらずに通り過ぎる',
          check: {
            skill: 'stealth', dc: 13,
            success: { text: ['馬の口を押さえ、石畳の端を選んで通り抜けた。'], to: 'camp' },
            fail: { text: ['車輪が石を鳴らした。岩陰から声がかかる。'], to: 'hermitFight' },
          },
        },
      ],
    },

    hermitTalk: {
      id: 'hermitTalk', title: '隠者', art: '🕯️',
      text: ['「薬だな」と隠者は荷を見ずに言った。「ケルンの熱病か。……なら一つでいい」'],
      choices: [
        {
          text: '食料を分けて、荷は渡さない',
          effects: [{ gold: -15 }, { var: 'trust', add: 1 }, { setFlag: 'sparedHermit' }],
          to: 'camp',
        },
        {
          text: '薬を一箱渡す',
          effects: [{ setFlag: 'shortLoad' }, { log: '薬が一箱減った。ケルンで足りるかは分からない。', kind: 'bad' }],
          to: 'camp',
        },
        { text: '断って押し通る', to: 'hermitFight' },
      ],
    },

    hermitFight: {
      id: 'hermitFight', title: '石像の道', art: '⚔️',
      text: ['石像の影から、白い息が二つ。'],
      combat: {
        title: '峠の通行料',
        enemies: ['hedgeWitch', 'bandit'],
        onVictory: {
          text: ['隠者の懐から出てきたのは、干した木の実がひと握りだけだった。'],
          effects: [{ var: 'cold', add: 1 }],
          to: 'camp',
        },
        onDefeat: { to: 'endLost' },
        onFlee: { text: ['馬に鞭を入れ、石畳を駆け抜けた。'], effects: [{ var: 'cold', add: 1 }], to: 'camp' },
      },
    },

    ridge: {
      id: 'ridge', title: '狼の背', art: '🐺',
      text: [
        '稜線の道。風が横から絶え間なく叩いてくる。',
        '雪の上に足跡。四つ足で、数は五。まだ新しい。',
      ],
      choices: [
        {
          text: '鈴を鳴らしながら進む',
          requires: { has: 'charmBell' },
          lockedText: '獣除けを持っていない',
          effects: [{ setFlag: 'usedBell' }],
          to: 'camp',
        },
        {
          text: '足跡を追わないよう迂回する',
          check: {
            skill: 'survival', dc: 12,
            success: { text: ['風下を選び、群れの寝床を大きく避けた。'], to: 'camp' },
            fail: { text: ['風向きが変わった。低い唸りが、風の下から聞こえる。'], to: 'wolfFight' },
          },
        },
        {
          text: '押し通る',
          effects: [{ var: 'cold', add: 1 }],
          to: 'wolfFight',
        },
      ],
    },

    wolfFight: {
      id: 'wolfFight', title: '稜線の群れ', art: '⚔️',
      text: ['雪の斜面に、灰色が三つ。痩せている。'],
      combat: {
        title: '狼の群れ',
        enemies: ['wolf', 'wolf', 'wolf'],
        onVictory: {
          text: ['群れは残りを連れて退いた。馬は無事だ。'],
          effects: [{ var: 'cold', add: 1 }],
          to: 'camp',
        },
        onDefeat: { to: 'endLost' },
        onFlee: { text: ['馬車を捨てずに走った。それだけが幸運だった。'], effects: [{ var: 'cold', add: 2 }], to: 'camp' },
      },
    },

    camp: {
      id: 'camp', title: '峠の夜', art: '🔥',
      text: [
        '日が落ちた。岩陰に火を熾す。手が思うように動かない。',
        'ケルンまでは、まだ一区間ある。',
      ],
      onEnter: [{ var: 'legs', add: 1 }, { var: 'cold', add: 1 }],
      repeatEffects: true,
      choices: [
        {
          text: '次の峠へ——別の道を選ぶ',
          if: { var: 'legs', lte: 1 },
          to: 'route',
        },
        {
          text: 'ヤナと話す',
          if: { all: [{ noFlag: 'talkedAtFire' }, { noFlag: 'aloneRun' }] },
          effects: [{ setFlag: 'talkedAtFire' }],
          to: 'fireTalk',
        },
        {
          text: '外套にくるまって暖を取る',
          requires: { has: 'furs' },
          lockedText: '暖を取るものがない',
          once: true,
          effects: [{ var: 'cold', add: -2 }, { rest: 'short' }],
          to: 'camp',
        },
        {
          text: 'ケルンへ下る',
          requires: { var: 'legs', gte: 2 },
          lockedText: 'まだ一区間ある',
          to: 'arrival',
        },
      ],
    },

    fireTalk: {
      id: 'fireTalk', title: '火のそば', art: '💬',
      text: [
        'ヤナは薬箱を膝に抱えたまま、火を見ている。',
        '「この薬、去年は間に合わなかったんです」',
      ],
      choices: [
        {
          text: '続きを聞く',
          check: {
            skill: 'insight', dc: 11,
            success: {
              text: [
                '「弟が待っていました。峠が閉じて、春に開いたときには、もう」',
                '彼女は薬箱を抱え直した。「今年は間に合わせます」',
                'この人が同行を譲らなかった理由が、やっと分かった。',
              ],
              effects: [{ var: 'trust', add: 2 }, { setFlag: 'knowsYana' }],
              to: 'camp',
            },
            fail: { text: ['彼女はそれ以上言わなかった。火が爆ぜる音だけが続いた。'], to: 'camp' },
          },
        },
        {
          text: '黙って毛皮をかけてやる',
          effects: [{ var: 'trust', add: 1 }],
          to: 'camp',
        },
      ],
    },

    arrival: {
      id: 'arrival', title: 'ケルンの門', art: '🏘️',
      text: [
        '谷を下りきると、町の灯が見えた。門の前に人だかりがある。',
        '待っていたのだ。二日前から、ずっと。',
      ],
      choices: [
        {
          text: '薬をすべて引き渡す',
          requires: { noFlag: 'shortLoad' },
          lockedText: '荷は欠けている',
          to: 'endFull',
        },
        {
          text: '欠けた荷を、事情ごと説明する',
          requires: { flag: 'shortLoad' },
          lockedText: '荷は欠けていない',
          to: 'endShort',
        },
        { text: '荷を置いて、名乗らずに発つ', to: 'endQuiet' },
      ],
    },

    endFull: {
      id: 'endFull', title: '間に合った', art: '🌅',
      text: [
        '木箱が六つ、門の内側へ運ばれていく。ヤナは最後の一つを自分で抱えて入っていった。',
        '三日後、熱病の死者は出なくなった。',
      ],
      ending: {
        type: 'good',
        title: '峠が閉じる前に',
        text: [
          '報酬は満額。それとは別に、春に一度だけ、ケルンから干した果物が届いた。',
          '差出人の名は書かれていなかったが、字は女のものだった。',
        ],
      },
    },

    endShort: {
      id: 'endShort', title: '五箱', art: '🌤️',
      text: [
        '事情は聞き入れられた。誰も責めなかった。それがかえって重かった。',
        '薬は五箱ぶんしか行き渡らず、順番は町が決めた。',
      ],
      ending: {
        type: 'neutral',
        title: '順番を決める側',
        text: [
          '足りない一箱ぶんの順番を、町の年寄りが三人で決めた。ヤナはその席に呼ばれなかった。',
          '誰かが生きるために、誰かの順番が後ろになる。それを決めるのは、峠を越えてきた側ではない。',
        ],
      },
    },

    endQuiet: {
      id: 'endQuiet', title: '名乗らず', art: '🚶',
      text: ['門の前に荷を置いて、そのまま来た道を戻った。'],
      ending: {
        type: 'neutral',
        title: '運んだだけ',
        text: ['薬は届いた。届けたのが誰かは、ケルンの誰も知らない。'],
      },
    },

    endLost: {
      id: 'endLost', title: '雪', art: '❄️',
      text: ['馬車は峠に残った。荷も、荷主も。'],
      ending: {
        type: 'bad',
        title: '春まで',
        text: ['峠が開いたのは四月だった。木箱は六つとも、雪の下から出てきた。'],
      },
    },
  },
};

export default threePasses;
