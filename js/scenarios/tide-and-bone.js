/* シナリオ「潮の骨」— 灯火のテーブル・clock 型（30〜45分）。

   干潮の三時間だけ現れる沈没船。潮が満ちる前に入って、出る。
   var:tide が 9 に達すると水が戻り、船内は水没する。
   下見（浜での聞き込み）を重ねるほど、本番で消費する潮位が減る。 */

export const tideAndBone = {
  id: 'tide-and-bone',
  title: '潮の骨',
  author: '灯火のテーブル',
  world: 'embers',
  blurb: '月に一度の大干潮の日だけ、湾の底から船が現れる。三時間で沈む。中には二十年ぶんの積荷がある。',
  level: 2,
  length: '中編（30〜45分）',
  start: 'shore',
  vars: { tide: 0, prep: 0 },

  items: {
    chart: { id: 'chart', name: '古い海図', desc: '沈没地点に赤い印。裏に「船倉は左舷から」と走り書き。' },
    oilskin: { id: 'oilskin', name: '油紙の包み', desc: '水に濡らしたくないものを入れる。' },
    seal: { id: 'seal', name: '商会の印章', desc: '二十年前に潰れた商会のもの。まだ効力があると言う者がいる。' },
    pearl: { id: 'pearl', name: '黒真珠の首飾り', desc: '船長室の金庫にあった。値がつかないほど古い。' },
  },

  monsters: {
    drowned: {
      name: '水底の船員', kind: '不死', cr: 0.5, xp: 100,
      acOverride: 12, hp: '3d8+3', hpAvg: 16, speed: 6,
      abilities: { str: 14, dex: 8, con: 14, int: 4, wis: 8, cha: 5 },
      attacks: [{ name: '膨れた手', bonus: 4, damage: '1d8+2', type: '打撃' }],
      resistances: ['刺突'],
      tactics: 'brute',
      traits: ['水を吐く：倒れるとき周囲に海水を撒く'],
      blurb: '制服の名残がまだ肩に張りついている。二十年、ここで待っていた。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 下見 */

    shore: {
      id: 'shore', title: '干潟の集落', art: '🌊',
      text: [
        '潮が引ききるのは明日の夜明け。それまでは、この村で待つしかない。',
        '桟橋の男たちは、沈んだ船の話をすると急に手元を見る。',
        '（聞き込みを重ねるほど、本番で失う時間が減る）',
      ],
      choices: [
        { text: '網元に話を聞く', to: 'netman' },
        { text: '灯台守を訪ねる', to: 'keeper' },
        { text: '浜に流れ着いたものを漁る', to: 'beach' },
        { text: '準備は十分だ。夜明けを待つ', to: 'lowTide' },
      ],
    },

    netman: {
      id: 'netman', title: '網元の小屋', art: '🪢',
      text: ['網を繕う手が止まらない。「あの船に潜った者は、四人が戻らなかった」'],
      choices: [
        {
          text: '酒を持ち込んで長く話す',
          once: true,
          effects: [{ gold: -5 }],
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: [
                '「船倉に入るなら左舷だ。右は梁が落ちてる」',
                '「それと、中にはまだ乗っていた連中がいる。……沈んだまま、まだ乗ってる」',
              ],
              effects: [{ setFlag: 'knowsPort' }, { var: 'prep', add: 1 }],
              to: 'shoreAfter',
            },
            fail: { text: ['「話すことはない」網を繕う手が速くなった。'], to: 'shoreAfter' },
          },
        },
        {
          text: '嘘を混ぜて探りを入れる',
          once: true,
          check: {
            skill: 'deception', dc: 13,
            success: {
              text: ['「商会の使いか。……なら印章を持ってるはずだな」——鎌をかけられた。逆に情報が取れた。'],
              effects: [{ setFlag: 'knowsCompany' }, { var: 'prep', add: 1 }],
              to: 'shoreAfter',
            },
            fail: { text: ['「あんた、商会の人間じゃないな」それきり口を閉ざした。'], to: 'shoreAfter' },
          },
        },
        { text: '戻る', to: 'shore' },
      ],
    },

    keeper: {
      id: 'keeper', title: '灯台', art: '🗼',
      text: ['老いた灯台守は、二十年前のあの夜、灯を落としていたと言う。'],
      choices: [
        {
          text: '海図を見せてもらう',
          once: true,
          check: {
            skill: 'history', dc: 12,
            success: {
              text: [
                '棚の奥から出てきたのは、沈没地点に赤い印の入った海図だった。',
                '「わしが灯を落としたわけじゃない。油が切れたんだ。……そういうことになっている」',
              ],
              effects: [{ giveItem: 'chart' }, { setFlag: 'knowsWreck' }, { var: 'prep', add: 1 }],
              to: 'shoreAfter',
            },
            fail: { text: ['海図はどれも新しいものばかりだった。'], to: 'shoreAfter' },
          },
        },
        {
          text: '当時の様子を推し量る',
          once: true,
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                '油が切れたのではない。この男は、灯を「消した」。',
                '誰かに金を積まれて。そして今も、その金には手をつけていない。',
              ],
              effects: [{ setFlag: 'knowsTruth' }, { var: 'prep', add: 1 }],
              to: 'shoreAfter',
            },
            fail: { text: ['老人は同じ話を三度繰り返した。'], to: 'shoreAfter' },
          },
        },
        { text: '戻る', to: 'shore' },
      ],
    },

    beach: {
      id: 'beach', title: '打ち上げ場', art: '🐚',
      text: ['流木と海藻と、割れた樽。二十年ぶんの漂着物が層になっている。'],
      choices: [
        {
          text: '丹念に探す',
          once: true,
          check: {
            skill: 'investigation', dc: 11,
            success: {
              text: ['油紙の包みが一つ。中身は空だが、これがあれば濡らしたくないものを持ち帰れる。'],
              effects: [{ giveItem: 'oilskin' }, { var: 'prep', add: 1 }],
              to: 'shoreAfter',
            },
            fail: { text: ['貝殻ばかりだった。'], to: 'shoreAfter' },
          },
        },
        { text: '戻る', to: 'shore' },
      ],
    },

    shoreAfter: {
      id: 'shoreAfter', title: '干潟', art: '🌊',
      text: ['潮の匂いが強くなってきた。夜明けは近い。'],
      choices: [
        { text: '聞き込みを続ける', to: 'shore' },
        { text: '夜明けを待つ', to: 'lowTide' },
      ],
    },

    /* -------------------------------------------------------- 干潮 */

    lowTide: {
      id: 'lowTide', title: '夜明け・大干潮', art: '🌅',
      text: [
        '海が退いた。泥の平野の真ん中に、黒い船が横倒しに突き出している。',
        '藤壺に覆われた船腹。折れた帆柱。二十年ぶんの静けさ。',
        '（ここから潮が満ちはじめる。9 で水が戻る）',
      ],
      onEnter: [{ log: '——潮が変わった。三時間。', kind: 'good' }],
      choices: [
        {
          text: '左舷の裂け目から入る',
          requires: { flag: 'knowsPort' },
          lockedText: 'どこから入ればいいのか分からない',
          effects: [{ var: 'tide', add: 1 }],
          to: 'hold',
        },
        {
          text: '甲板から降りる',
          effects: [{ var: 'tide', add: 2 }],
          check: {
            skill: 'athletics', dc: 12,
            success: { text: ['傾いた甲板を伝い、昇降口から船内へ降りた。'], to: 'hold' },
            fail: {
              text: ['足を滑らせ、藤壺で腕を切った。'],
              effects: [{ damage: '1d6', target: 'active', type: '斬撃' }, { var: 'tide', add: 1 }],
              to: 'hold',
            },
          },
        },
      ],
    },

    hold: {
      id: 'hold', title: '船倉', art: '🕯️',
      text: [
        '膝まで水がある。松明の火が、天井の水滴を一つずつ光らせる。',
        '積荷はほとんど腐っていた。だが奥の隔壁の向こうに、まだ手つかずの区画がある。',
        '——水面が、さっきより指一本ぶん高い。',
      ],
      choices: [
        {
          text: '静かに隔壁へ向かう',
          effects: [{ var: 'tide', add: 1 }],
          check: {
            skill: 'stealth', dc: 12,
            advantageIf: { flag: 'knowsTruth' },
            success: { text: ['水を波立てずに進んだ。何も起きなかった。'], to: 'captain' },
            fail: { text: ['水面が揺れた。揺らしたのは、こちらではない。'], to: 'drownedFight' },
          },
        },
        {
          text: '積荷を漁ってから進む',
          once: true,
          effects: [{ var: 'tide', add: 2 }],
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: ['腐った木箱の底から、商会の印章が出てきた。金にはなる。'],
              effects: [{ giveItem: 'seal' }, { gold: 60 }],
              to: 'hold',
            },
            fail: { text: ['腐臭と水だけだった。'], to: 'hold' },
          },
        },
      ],
    },

    drownedFight: {
      id: 'drownedFight', title: '水底の船員', art: '⚔️',
      text: ['水の中から、二十年ぶんの重さがゆっくり立ち上がった。'],
      combat: {
        title: '沈んだ乗組員',
        enemies: ['drowned', 'drowned'],
        onVictory: {
          text: ['二体はまた水に沈んだ。今度は動かない。'],
          effects: [{ var: 'tide', add: 2 }],
          to: 'captain',
        },
        onDefeat: { to: 'endDrowned' },
        onFlee: { text: ['水をかき分けて奥へ逃げた。'], effects: [{ var: 'tide', add: 2 }], to: 'captain' },
      },
    },

    captain: {
      id: 'captain', title: '船長室', art: '🚪',
      text: [
        '扉は水圧で歪んでいる。中は思ったより乾いていた。',
        '机に向かって座ったままの骨がある。手には羽根ペン。書きかけの航海日誌。',
      ],
      choices: [
        {
          text: '金庫を開ける',
          effects: [{ var: 'tide', add: 2 }],
          check: {
            skill: 'sleight', dc: 14,
            advantageIf: { var: 'prep', gte: 3 },
            success: {
              text: ['錠は錆びていて、かえって脆かった。中に黒真珠の首飾りが一連。'],
              effects: [{ giveItem: 'pearl' }, { gold: 200 }],
              to: 'escape',
            },
            fail: {
              text: ['鍵前が固い。水位は上がり続けている。'],
              effects: [{ var: 'tide', add: 1 }],
              to: 'captainRetry',
            },
          },
        },
        {
          text: '航海日誌を読む',
          effects: [{ var: 'tide', add: 1 }],
          check: {
            skill: 'history', dc: 11,
            success: {
              text: [
                '最後の行はこう書かれている。「灯が消えた。消されたのだと思う」',
                '「積荷は保険のために沈められる。私も一緒に。それが契約だ」',
                '沈没ではない。始末だ。',
              ],
              effects: [{ setFlag: 'knowsLog' }, { giveItem: 'oilskin' }],
              to: 'captain',
            },
            fail: { text: ['紙は水を吸って、触れると崩れた。'], to: 'captain' },
          },
        },
        {
          text: '長居は危険だ。引き上げる',
          effects: [{ var: 'tide', add: 1 }],
          to: 'escape',
        },
      ],
    },

    captainRetry: {
      id: 'captainRetry', title: '金庫の前', art: '⏳',
      text: ['足首まで来ていた水が、膝に届いた。'],
      choices: [
        { text: 'もう一度やる', if: { var: 'tide', lte: 6 }, to: 'captain' },
        { text: '諦めて引き上げる', to: 'escape' },
        { text: '（水が来る）', if: { var: 'tide', gte: 7 }, to: 'flood' },
      ],
    },

    escape: {
      id: 'escape', title: '戻り道', art: '🪜',
      text: ['来た道を戻る。水位は、入ったときより確実に高い。'],
      choices: [
        { text: '走る', if: { var: 'tide', lte: 7 }, effects: [{ var: 'tide', add: 1 }], to: 'ashore' },
        { text: '（間に合わない）', if: { var: 'tide', gte: 8 }, to: 'flood' },
      ],
    },

    flood: {
      id: 'flood', title: '満ち潮', art: '🌊',
      text: [
        '船体が軋み、傾きが変わった。水が一気に膝から胸へ来る。',
        '松明が消えた。方向が分からない。',
      ],
      choices: [
        {
          text: '泳いで昇降口を探す',
          check: {
            skill: 'athletics', dc: 14,
            success: { text: ['指先が空を掴んだ。頭が水面を割る。'], to: 'ashore' },
            fail: {
              text: ['壁にぶつかった。息が続かない。'],
              effects: [{ damage: '2d6', target: 'party', type: '打撃' }],
              to: 'lastGasp',
            },
          },
        },
        {
          text: '海図を頼りに構造から出口を割り出す',
          requires: { has: 'chart' },
          lockedText: '船の造りが分からない',
          check: {
            skill: 'nature', dc: 12,
            success: { text: ['左舷の裂け目は、たしかこの方向だ。——正しかった。'], to: 'ashore' },
            fail: { text: ['方角を見失った。'], to: 'lastGasp' },
          },
        },
      ],
    },

    lastGasp: {
      id: 'lastGasp', title: '暗い水', art: '💧',
      text: ['天井と水面の間に、あと指三本ぶんの空気が残っている。'],
      choices: [
        {
          text: '最後の一息で潜る',
          check: {
            skill: 'survival', dc: 13,
            success: { text: ['泥を蹴り、外の光へ出た。'], to: 'ashore' },
            fail: { text: ['光は遠かった。'], to: 'endDrowned' },
          },
        },
      ],
    },

    /* ---------------------------------------------------------- 結末 */

    ashore: {
      id: 'ashore', title: '干潟の上', art: '🏝️',
      text: [
        '泥の上に這い上がった。背後で、船がゆっくり水に隠れていく。',
        '次に現れるのは、また一月後だ。',
      ],
      choices: [
        {
          text: '日誌のことを村に伝える',
          requires: { flag: 'knowsLog' },
          lockedText: '伝えられることがない',
          to: 'endTruth',
        },
        {
          text: '真珠を持って、黙って発つ',
          requires: { has: 'pearl' },
          lockedText: '持ち帰れたものがない',
          to: 'endRich',
        },
        { text: '何も言わず村を出る', to: 'endQuiet' },
      ],
    },

    endTruth: {
      id: 'endTruth', title: '灯を消した男', art: '🗼',
      text: [
        '日誌は村の寄合で読み上げられた。灯台守は否定せず、ただ座っていた。',
        '翌朝、灯台の油は満たされていた。二十年ぶりに、あの灯は一晩中ついていた。',
      ],
      ending: {
        type: 'good',
        title: '二十年ぶりの灯',
        text: [
          '積荷の取り分は減った。かわりに、この湾では名前で通るようになる。',
          '沈んだ十七人の名が、桟橋の板に彫られた。',
        ],
      },
    },

    endRich: {
      id: 'endRich', title: '黒真珠', art: '💰',
      text: ['首飾りは都で売れた。買い手は出所を訊かなかった。'],
      ending: {
        type: 'neutral',
        title: '値のつかないもの',
        text: ['金は入った。あの船が沈んだ理由は、まだ水の底にある。'],
      },
    },

    endQuiet: {
      id: 'endQuiet', title: '潮が満ちる', art: '🌊',
      text: ['村を出るとき、誰も見送らなかった。'],
      ending: {
        type: 'neutral',
        title: 'また一月後',
        text: ['船はまた沈んだ。次の干潮に、また誰かが潜るのだろう。'],
      },
    },

    endDrowned: {
      id: 'endDrowned', title: '水の底', art: '💧',
      text: ['冷たさはすぐに感じなくなった。'],
      ending: {
        type: 'bad',
        title: '二十一人目',
        text: ['次の大干潮に船が現れたとき、乗組員が一人増えていた。'],
      },
    },
  },
};

export default tideAndBone;
