/* シナリオ「最終便」— ネオンの雨・逃走もの（30〜45分）。

   証人を一人、朝までに街の外へ。追跡は止まらない。
   構成:
     受領 → 三つの経路（高速／下層／地上）→ 検問 → 最後の直線 → 結末
   var:pursuit が追跡度。上がるほど遭遇が重くなり、6 で掃除屋が追いつく。
   var:trust は証人との距離。会話の選択で動き、結末を分ける。 */

export const lastRide = {
  id: 'last-ride',
  title: '最終便',
  author: '灯火のテーブル',
  world: 'neon',
  blurb: '証人を一人、朝までに街の外へ。誰が追ってくるかは聞かされていない。',
  level: 2,
  length: '中編（30〜45分）',
  start: 'pickup',
  vars: { pursuit: 0, trust: 0, legs: 0 },

  items: {
    testimony: { id: 'testimony', name: '証言記録', desc: '本人の声で四十分。裁判ではなく、報道のために録られたもの。' },
    plates: { id: 'plates', name: '差し替えナンバー', desc: '三枚ある。使い捨てだ。' },
    stim: { id: 'stim', name: '覚醒剤（軍用）', use: 'heal', amount: '2d6', desc: '眠気が消える。あとで倍返しが来る。', consumable: true },
  },

  monsters: {
    lena: {
      name: 'レナ・ヴォス', kind: '人型', cr: 0.125, xp: 25,
      acOverride: 11, hp: '2d8', hpAvg: 9, speed: 9,
      abilities: { str: 9, dex: 11, con: 10, int: 16, wis: 14, cha: 13 },
      attacks: [{ name: '護身用スプレー', bonus: 2, damage: '1d4', type: '毒' }],
      tactics: 'skirmish',
      traits: ['非戦闘員：守る対象'],
      blurb: '会計士。四十一歳。数字を読むのが仕事で、読みすぎた。',
    },
    interceptor: {
      name: '追跡車の射手', kind: '人型', cr: 1, xp: 200,
      acOverride: 14, hp: '4d8+4', hpAvg: 22, speed: 9,
      abilities: { str: 13, dex: 16, con: 13, int: 10, wis: 12, cha: 9 },
      attacks: [{ name: '車載マシンガン', bonus: 5, damage: '2d6+3', type: '実弾', ranged: true }],
      tactics: 'caster',
      blurb: '窓から身を乗り出している。雨で狙いが甘い。それでも当たる。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 受領 */

    pickup: {
      id: 'pickup', title: '立体駐車場 7階', art: '🚗',
      text: [
        'コンクリートの匂いと、下の階から上がってくる排気。車は暖まっている。',
        '助手席の女は荷物を持っていない。上着すら着ていない。着る時間がなかったのだ。',
        '「レナ・ヴォスです」と彼女は言った。「……その、どこまで聞いていますか」',
        '聞いているのは一つだけだ。朝までに街の外へ。',
      ],
      onEnter: [{ giveItem: 'testimony' }, { giveItem: 'plates' }],
      choices: [
        {
          text: '「何を持ち出した」と訊く',
          check: {
            skill: 'insight', dc: 11,
            success: {
              text: [
                '「四年ぶんの支払記録です。……宛先が全部、実在しない会社なんです」',
                '彼女は自分の膝を見たまま話し続けた。「気づいたのは去年。黙っていられたのは、先月まで」',
                '嘘はない。恐怖もある。だが後悔だけがない。',
              ],
              effects: [{ var: 'trust', add: 1 }, { setFlag: 'knowsWhy' }],
              to: 'route',
            },
            fail: { text: ['「……話さないほうがいいと言われました」彼女は窓の外を見た。'], to: 'route' },
          },
        },
        {
          text: '「何も話すな。仕事に集中させろ」',
          effects: [{ var: 'trust', add: -1 }],
          to: 'route',
        },
        { text: '黙って車を出す', to: 'route' },
      ],
    },

    route: {
      id: 'route', title: '経路を選ぶ', art: '🗺️',
      text: [
        '街の外に出る道は三つ。どれも塞がれていないが、どれも安全ではない。',
        '**高速道路** — 速い。カメラが多い。',
        '**下層道路** — 遅い。カメラはない。ギャングの縄張りを通る。',
        '**旧地上線** — 廃線跡。車一台がやっと。誰も使わない理由がある。',
      ],
      choices: [
        { text: '高速道路へ乗る', effects: [{ var: 'pursuit', add: 1 }], to: 'highway' },
        { text: '下層道路へ降りる', to: 'undercity' },
        {
          text: '旧地上線を行く',
          requires: { skillIn: ['drive', 'streetwise'] },
          lockedText: '廃線跡を走れる自信がない',
          to: 'oldline',
        },
        {
          text: 'ナンバーを差し替えてから出る',
          once: true,
          effects: [{ takeItem: 'plates' }, { var: 'pursuit', add: -1 }, { log: 'ナンバーを差し替えた。追跡が一段遅れる。', kind: 'good' }],
          to: 'route',
        },
      ],
    },

    /* ---------------------------------------------------------- 経路 */

    highway: {
      id: 'highway', title: '高架三号線', art: '🛣️',
      text: [
        '雨の高速は速い。速いということは、こちらの位置が一定の速度で分かるということでもある。',
        '三分に一度、料金所のカメラを通過する。',
      ],
      choices: [
        {
          text: '車列に紛れて流す',
          check: {
            skill: 'drive', dc: 12,
            success: {
              text: ['大型トラックの陰に入り、そのまま二区画。カメラは車体の側面しか撮っていない。'],
              to: 'waypoint',
            },
            fail: { text: ['車間が空いた。後方の照明が、一台だけ同じ速度で追ってくる。'], effects: [{ var: 'pursuit', add: 1 }], to: 'chase' },
          },
        },
        {
          text: 'カメラの系統に割り込む',
          once: true,
          check: {
            skill: 'netops', dc: 13,
            success: {
              text: ['料金所の記録に、こちらの車体だけが写らない三十秒を作った。'],
              effects: [{ var: 'pursuit', add: -1 }],
              to: 'waypoint',
            },
            fail: { text: ['系統が新しい。触った痕跡だけが残った。'], effects: [{ var: 'pursuit', add: 1 }], to: 'chase' },
          },
        },
        { text: '会話する', to: 'talk' },
      ],
    },

    undercity: {
      id: 'undercity', title: '下層道路', art: '🌉',
      text: [
        '高架の下、雨の当たらない道。街灯は三本に一本しか点いていない。',
        '前方の交差点に、バイクが横向きに停めてある。人影は五つ。通行料を取る側の連中だ。',
      ],
      choices: [
        {
          text: '金を払って通す',
          effects: [{ gold: -150 }],
          check: {
            skill: 'streetwise', dc: 11,
            success: {
              text: ['札を渡すと、バイクが一台ぶんだけ退いた。「あんた、追われてるな。北はやめとけ」'],
              effects: [{ setFlag: 'gangTip' }],
              to: 'waypoint',
            },
            fail: { text: ['金額が足りないと言われた。話が終わる前に、後ろの一人が窓に手をかけた。'], to: 'gangFight' },
          },
        },
        {
          text: '止まらずに突っ切る',
          check: {
            skill: 'drive', dc: 13,
            success: {
              text: ['バイクの間を、ミラーを一つ犠牲にして抜けた。背後で怒鳴り声。'],
              effects: [{ var: 'pursuit', add: 1 }],
              to: 'waypoint',
            },
            fail: { text: ['一台に引っかけた。車体が滑って、止まった。'], to: 'gangFight' },
          },
        },
        { text: '会話する', to: 'talk' },
      ],
    },

    gangFight: {
      id: 'gangFight', title: '交差点', art: '⚔️',
      text: ['助手席のレナが身をかがめた。この人は、こういう場面を知らない。'],
      combat: {
        title: '通行料',
        enemies: ['punk', 'punk', 'scav'],
        onVictory: {
          text: ['三人が路上に残った。車は動く。それで十分だ。'],
          effects: [{ var: 'pursuit', add: 1 }],
          to: 'waypoint',
        },
        onDefeat: { to: 'endTaken' },
        onFlee: { text: ['アクセルを踏み込んだ。何かを踏んだ感触があった。'], effects: [{ var: 'pursuit', add: 1 }], to: 'waypoint' },
      },
    },

    oldline: {
      id: 'oldline', title: '旧地上線', art: '🛤️',
      text: [
        '線路を剥がした跡が、そのまま砂利道になっている。両側は廃屋。人の気配はない。',
        '——人の気配は。',
      ],
      choices: [
        {
          text: '慎重に進む',
          check: {
            skill: 'perception', dc: 12,
            success: {
              text: [
                '前方の路面が不自然に平らだ。掘り返して埋め戻した跡——スパイクだ。',
                '手前で停めて、外して、また走った。三分の損。追跡には気づかれていない。',
              ],
              to: 'waypoint',
            },
            fail: {
              text: ['前輪が破裂した。車体が斜めに滑って、廃屋の壁で止まった。'],
              effects: [{ damage: '1d6', target: 'party', type: '打撃' }, { var: 'pursuit', add: 2 }],
              to: 'ambush',
            },
          },
        },
        {
          text: '速度を上げて一気に抜ける',
          effects: [{ var: 'pursuit', add: -1 }],
          check: {
            skill: 'drive', dc: 14,
            success: { text: ['砂利を跳ね上げながら、廃線跡を走り抜けた。追跡は完全に振り切った。'], to: 'waypoint' },
            fail: { text: ['何かを踏んだ。タイヤが鳴って、車が止まった。'], effects: [{ var: 'pursuit', add: 2 }], to: 'ambush' },
          },
        },
        { text: '会話する', to: 'talk' },
      ],
    },

    ambush: {
      id: 'ambush', title: '廃屋の間', art: '⚔️',
      text: ['廃屋の窓という窓から、光が向けられた。待っていたのだ。ここを通ることを知っていて。'],
      combat: {
        title: '待ち伏せ',
        enemies: ['scav', 'scav', 'ripper'],
        onVictory: {
          text: ['スペアタイヤは一本ある。レナが黙って工具箱を差し出した。'],
          effects: [{ var: 'trust', add: 1 }],
          to: 'checkpoint',
        },
        onDefeat: { to: 'endTaken' },
        onFlee: { to: 'endAbandon' },
      },
    },

    /* ---------------------------------------------------------- 会話 */

    talk: {
      id: 'talk', title: '車内', art: '💬',
      text: [
        'ワイパーの音が一定の間隔で入る。レナは窓に額をつけて外を見ている。',
        '「……娘がいるんです。十二歳。今夜は友達の家に泊まってる」',
      ],
      choices: [
        {
          text: '「迎えに行くか」と訊く',
          once: true,
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                '彼女は首を振った。長い時間をかけて、はっきりと。',
                '「私が近づいたら、あの子も“関係者”になります。……離れているのが、いちばん安全なんです」',
                'それを自分で決めた顔をしていた。',
              ],
              effects: [{ var: 'trust', add: 2 }, { setFlag: 'knowsDaughter' }],
              to: 'talkBack',
            },
            fail: {
              text: ['「……いえ。何でもありません」彼女は口を閉じた。'],
              to: 'talkBack',
            },
          },
        },
        {
          text: '「余計なことは考えるな」',
          effects: [{ var: 'trust', add: -1 }],
          to: 'talkBack',
        },
        {
          text: '自分の話をする',
          once: true,
          check: {
            skill: 'persuasion', dc: 10,
            success: {
              text: ['何でもない話をした。彼女は笑わなかったが、肩の力が少し抜けた。'],
              effects: [{ var: 'trust', add: 1 }],
              to: 'talkBack',
            },
            fail: { text: ['話は続かなかった。ワイパーの音だけが残った。'], to: 'talkBack' },
          },
        },
        { text: '黙って運転に戻る', to: 'talkBack' },
      ],
    },

    talkBack: {
      id: 'talkBack', title: '道の上', art: '🚗',
      text: ['前方の信号が、青のまま点滅している。'],
      choices: [
        { text: 'もう少し話す', to: 'talk' },
        { text: '検問へ向かう', to: 'waypoint' },
      ],
    },

    /* -------------------------------------------------------- 追跡・検問 */

    chase: {
      id: 'chase', title: 'バックミラー', art: '🚨',
      text: ['後方の一台が、車間を詰めてくる。屋根の上で何かが起き上がった。'],
      choices: [
        {
          text: '振り切る',
          check: {
            skill: 'drive', dc: 14,
            success: {
              text: ['出口を二つ飛ばし、側道へ落とした。追跡灯が高架の上を通り過ぎていく。'],
              effects: [{ var: 'pursuit', add: -1 }],
              to: 'waypoint',
            },
            fail: { text: ['タイヤが滑った。相手が横に並んだ。'], to: 'chaseFight' },
          },
        },
        {
          text: '撃ち返す',
          to: 'chaseFight',
        },
        {
          text: 'レナに運転を代わってもらって応戦する',
          requires: { var: 'trust', gte: 2 },
          lockedText: '彼女はまだ、あなたに車を任せられない',
          effects: [{ setFlag: 'lenaDrove' }, { log: '「……やります」レナがハンドルを握った。手は震えていない。', kind: 'good' }],
          to: 'chaseFight',
        },
      ],
    },

    chaseFight: {
      id: 'chaseFight', title: '並走', art: '⚔️',
      text: ['雨と風。窓の外に、もう一台ぶんの世界がある。'],
      combat: {
        title: '追跡車',
        enemies: ['interceptor', 'interceptor'],
        onVictory: {
          text: ['相手の車が中央分離帯に乗り上げ、視界から消えた。'],
          effects: [{ var: 'pursuit', add: 1 }],
          to: 'waypoint',
        },
        onDefeat: { to: 'endTaken' },
        onFlee: { text: ['出口へ滑り込んだ。追跡は続いている。'], effects: [{ var: 'pursuit', add: 2 }], to: 'checkpoint' },
      },
    },

    waypoint: {
      id: 'waypoint', title: '路肩で一度止まる', art: '🚙',
      text: [
        'エンジンを切ると、雨の音だけになった。市境までは、まだ一区間ある。',
        '追われている以上、同じ道を走り続けるのが正解とは限らない。',
      ],
      onEnter: [{ var: 'legs', add: 1 }],
      repeatEffects: true,
      choices: [
        {
          text: '次の区間へ——別の道に乗り換える',
          if: { var: 'legs', lte: 1 },
          effects: [{ log: 'ここまでの轍を捨て、別の経路に乗り換えた。', kind: 'system' }],
          to: 'route',
        },
        {
          text: '車内で話す',
          if: { noFlag: 'talkedOnce' },
          effects: [{ setFlag: 'talkedOnce' }],
          to: 'talk',
        },
        {
          text: 'このまま市境の検問へ',
          requires: { var: 'legs', gte: 2 },
          lockedText: '市境まではまだ一区間ある',
          to: 'checkpoint',
        },
      ],
    },

    checkpoint: {
      id: 'checkpoint', title: '市境検問所', art: '🚧',
      text: [
        '街の出口は一つしかない。コンクリートの壁に開いた穴と、その両脇のブース。',
        '通常の検問だ。だが車列の三台先に、企業のロゴのない黒い車が停まっている。',
        '停まっているだけで、誰も降りてこない。',
      ],
      choices: [
        {
          text: '普通の車として並ぶ',
          check: {
            skill: 'deception', dc: 13,
            advantageIf: { var: 'pursuit', lte: 1 },
            success: {
              text: ['係官は端末を見て、こちらを見て、また端末を見た。それからバーを上げた。'],
              to: 'lastStretch',
            },
            fail: {
              text: ['「同乗者の身分証を」——レナの手が、シートベルトを握りしめた。'],
              to: 'checkpointBreak',
            },
          },
        },
        {
          text: '検問の照合系に偽の記録を入れる',
          check: {
            skill: 'netops', dc: 14,
            advantageIf: { classIn: ['netrunner'] },
            success: {
              text: ['二人ぶんの通行記録が、三十秒前に作られた。係官の端末では、こちらはもう通過済みだ。'],
              effects: [{ setFlag: 'cleanPass' }],
              to: 'lastStretch',
            },
            fail: { text: ['照合系は隔離されていた。触った瞬間、黒い車のライトが点いた。'], to: 'checkpointBreak' },
          },
        },
        {
          text: 'ゲートを突破する',
          effects: [{ var: 'pursuit', add: 2 }],
          to: 'checkpointBreak',
        },
      ],
    },

    checkpointBreak: {
      id: 'checkpointBreak', title: 'ゲート', art: '⚔️',
      text: ['黒い車のドアが、四枚同時に開いた。'],
      combat: {
        title: '市境の掃除屋',
        enemies: ['cleaner'],
        onVictory: {
          text: ['バーを折って外へ出た。背後で警報が鳴っている。もう関係ない。'],
          effects: [{ var: 'pursuit', add: 1 }],
          to: 'lastStretch',
        },
        onDefeat: { to: 'endTaken' },
        onFlee: { to: 'endAbandon' },
      },
    },

    lastStretch: {
      id: 'lastStretch', title: '最後の直線', art: '🌅',
      text: [
        '街の光が背中で小さくなっていく。前方の空が、わずかに白い。',
        '受け渡し地点まで、あと二十分。',
      ],
      choices: [
        {
          text: 'そのまま走る',
          if: { var: 'pursuit', lte: 4 },
          to: 'handoff',
        },
        {
          text: '追跡がまだ来ている。迎え撃つ',
          if: { var: 'pursuit', gte: 5 },
          to: 'finalFight',
        },
        {
          text: '車を捨てて、徒歩で行く',
          check: {
            skill: 'streetwise', dc: 12,
            success: {
              text: ['車を側溝に落とし、灌木の中を歩いた。追跡は、空の車を追っていった。'],
              effects: [{ var: 'pursuit', set: 0 }],
              to: 'handoff',
            },
            fail: { text: ['開けた場所に出てしまった。隠れる場所がない。'], to: 'finalFight' },
          },
        },
      ],
    },

    finalFight: {
      id: 'finalFight', title: '路肩', art: '⚔️',
      text: ['夜明け前のいちばん暗い時間に、ヘッドライトが三対。'],
      combat: {
        title: '最後の追跡',
        enemies: ['interceptor', 'interceptor'],
        onVictory: {
          text: ['朝日が出るころには、路肩に三台の車と、動かない人間が残っていた。'],
          to: 'handoff',
        },
        onDefeat: { to: 'endTaken' },
        onFlee: { to: 'endAbandon' },
      },
    },

    /* ---------------------------------------------------------- 結末 */

    handoff: {
      id: 'handoff', title: '受け渡し地点', art: '🌄',
      text: [
        '廃業したドライブインの駐車場。もう一台の車が待っていた。運転席の男が手を上げる。',
        'レナは降りる前に、こちらを見た。何か言おうとして、やめた。',
      ],
      choices: [
        {
          text: '証言記録も一緒に渡す',
          requires: { has: 'testimony' },
          lockedText: '渡せるものがない',
          to: 'endBest',
        },
        {
          text: '彼女だけを渡し、記録は自分で持つ',
          requires: { has: 'testimony' },
          lockedText: '記録はもう手元にない',
          to: 'endLeverage',
        },
        {
          text: '「娘のことは、こちらで手を打つ」と伝える',
          requires: { flag: 'knowsDaughter' },
          lockedText: '彼女の事情を知らない',
          to: 'endDaughter',
        },
        { text: '何も言わずに送り出す', to: 'endQuiet' },
      ],
    },

    endBest: {
      id: 'endBest', title: '朝', art: '📰',
      text: [
        '記録は三日後に出た。四年ぶんの支払先が、一社も実在しなかったという話だ。',
        '会社は否定し、否定しきれず、四人が辞めた。',
        'レナ・ヴォスの名前はどこにも出なかった。それが条件だった。',
      ],
      ending: {
        type: 'good',
        title: '実在しない会社',
        text: [
          '報酬は満額。それとは別に、半年後、差出人のない小包が届いた。',
          '中身は、十二歳の子どもが描いた車の絵だった。',
        ],
      },
    },

    endLeverage: {
      id: 'endLeverage', title: '持っておく', art: '💾',
      text: [
        'レナは黙って頷いた。「……使わないでいてくれるなら」',
        '記録は誰にも渡さなかった。持っているという事実だけが、静かに効いた。',
      ],
      ending: {
        type: 'neutral',
        title: '保険',
        text: [
          '追手は来なくなった。来られないからだ。',
          '{party} は安全になり、そして、その安全は誰かの沈黙の上に立っている。',
        ],
      },
    },

    endDaughter: {
      id: 'endDaughter', title: '約束', art: '🧸',
      text: [
        'レナは初めて泣いた。声を立てずに、短く。',
        '「……ありがとう」それだけ言って、車に乗った。',
        '娘は二週間後、別の街の学校に転入した。書類上は別人として。',
      ],
      ending: {
        type: 'good',
        title: '別人として',
        text: [
          '報酬は減った。手間は増えた。それでも、この仕事にはそういう終わり方がある。',
          '街の外の話は、街の中には届かない。届かないほうがいい話もある。',
        ],
      },
    },

    endQuiet: {
      id: 'endQuiet', title: '送り出す', art: '🚙',
      text: ['もう一台の車が出ていくのを、エンジンをかけたまま見送った。'],
      ending: {
        type: 'neutral',
        title: '運び終えた',
        text: ['契約は果たした。彼女がその後どうなったかは、こちらの契約範囲ではない。'],
      },
    },

    endTaken: {
      id: 'endTaken', title: '雨の路肩', art: '🌧️',
      text: [
        '意識が戻ったとき、助手席は空だった。ドアは開いたままで、雨が座席を濡らしている。',
        '三日後、レナ・ヴォスの自宅で「自殺」が報じられた。遺書はよくできていた。',
      ],
      ending: {
        type: 'bad',
        title: 'よくできた遺書',
        text: ['報酬は支払われなかった。依頼人からの連絡も、それきり途絶えた。'],
      },
    },

    endAbandon: {
      id: 'endAbandon', title: '置いていく', art: '🏃',
      text: ['走った。後ろは振り返らなかった。振り返らなくても、何が起きるかは分かっていた。'],
      ending: {
        type: 'bad',
        title: '積荷',
        text: ['命は残った。この街で運び屋を続けるのに必要な、別のものが残らなかった。'],
      },
    },
  },
};

export default lastRide;
