/* シナリオ「鐘の鳴らない村」— 1レベル用の短編（プレイ時間 40〜60分）。

   分岐の骨組み:
     街道 → 村（聞き込み3系統）→ 手がかり2つで洞窟へ
     洞窟は「正面」「裏道（隠密）」「取引」の3ルート
     結末は5種類。村人を救えたか、司祭の正体を暴けたか、で変わる。

   フラグ:
     knowsRitual  儀式の存在を知った
     knowsPriest  司祭ハルヴァの関与に気づいた
     hasKey       地下祭壇の鍵を持っている
     sparedGoblin ゴブリンのグリムを見逃した
     backdoor     裏道を教わった
   変数:
     trust        村人の信頼（-3 〜 +5）
     time         経過（3で夜になり、儀式が始まる）
*/

export const silentBell = {
  id: 'silent-bell',
  title: '鐘の鳴らない村',
  author: '灯火のテーブル',
  world: 'embers',
  blurb: '三日前から、ヴェルナ村の鐘が鳴らない。鐘楼には誰もいないのに、縄だけが揺れているという。',
  level: 1,
  length: '短編（40〜60分）',
  start: 'road',
  vars: { trust: 0, time: 0 },

  items: {
    ironKey: { id: 'ironKey', name: '錆びた鉄の鍵', desc: '礼拝堂の地下扉に合う。歯の形が新しく削られている。' },
    charm: { id: 'charm', name: '編み紐の護符', desc: '村の子どもの手作り。所持者は恐怖セーヴに有利。', keep: true },
    ritualDagger: { id: 'ritualDagger', name: '儀式の刃', damage: '1d4+1', type: '刺突', ability: 'dex', desc: '柄に見たことのない文字。' },
    silverBell: { id: 'silverBell', name: '銀の小鐘', desc: '振ると澄んだ音。不死の存在が嫌がる。' },
  },

  monsters: {
    grim: {
      name: 'グリム（ゴブリンの見張り）', kind: '人型', cr: 0.25, xp: 50,
      acOverride: 14, hp: '2d6+2', hpAvg: 9, speed: 9,
      abilities: { str: 8, dex: 14, con: 10, int: 11, wis: 9, cha: 10 },
      attacks: [{ name: '欠けた投げ槍', bonus: 4, damage: '1d6+2', type: '刺突' }],
      tactics: 'skirmish',
      blurb: '痩せた小柄なゴブリン。武器の持ち方がぎこちない。',
    },
    halva: {
      name: '司祭ハルヴァ', kind: '人型', cr: 2, xp: 450,
      acOverride: 13, hp: '6d8+8', hpAvg: 35, speed: 9,
      abilities: { str: 11, dex: 12, con: 13, int: 14, wis: 17, cha: 15 },
      attacks: [
        { name: '影の手', bonus: 5, damage: '2d8', type: '死', ranged: true },
        { name: '儀式の刃', bonus: 3, damage: '1d4+1', type: '刺突' },
      ],
      tactics: 'caster',
      traits: ['闇の加護：1度だけ受けたダメージを半減する'],
      blurb: '穏やかな声のまま、目だけが笑っていない。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 街道 */

    road: {
      id: 'road', title: '雨あがりの街道', art: '🌫️',
      text: [
        '轍にたまった水が、灰色の空をそのまま映している。ヴェルナ村まではあと半日。',
        '依頼はごく簡単なはずだった。「村の鐘が三日前から鳴らない。見てきてほしい」——報酬は銀貨十五枚。',
        '道の先、木立の切れ目に、荷車が横倒しになっているのが見える。車輪がまだ、ゆっくり回っている。',
      ],
      choices: [
        {
          text: '荷車に近づいて調べる',
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: [
                '積荷は麦。だが荷札は村のものではなく、二つ隣の町のものだ。奪われた側が運んでいたわけではない——奪った側が運んでいた。',
                '轍は道を外れ、北の森へ続いている。爪先の細い足跡が三人分。人間のものにしては小さい。',
              ],
              effects: [{ setFlag: 'sawTracks', note: '（森に続く足跡を覚えた）' }],
              to: 'ambush',
            },
            fail: {
              text: ['麦がこぼれ、泥にまみれている。それ以上のことは読み取れない。', '風向きが変わった。獣の匂いがする。'],
              to: 'ambush',
            },
          },
        },
        {
          text: '関わらず、足早に通り過ぎる',
          effects: [{ var: 'time', add: 1 }],
          to: 'gate',
        },
        {
          text: '周囲を警戒しながらゆっくり進む',
          check: {
            skill: 'perception', dc: 10,
            success: {
              text: ['茂みの奥、二対の目がこちらを見返している。狼だ。先に気づいた——不意を打てる。'],
              effects: [{ setFlag: 'spottedWolves' }],
              to: 'ambush',
            },
            fail: { text: ['何も見つからない。だが背筋の毛が立っている。'], to: 'ambush' },
          },
        },
      ],
    },

    ambush: {
      id: 'ambush', title: '空腹の二頭', art: '🐺',
      text: ['低い唸りが、両側から挟むように聞こえた。痩せた狼が二頭、下生えから出てくる。肋が浮いている。'],
      combat: {
        title: '狼との遭遇',
        enemies: ['wolf', 'wolf'],
        surprise: null,
        onVictory: {
          text: ['二頭は倒れた。腹の中はほとんど空だった。この森で、狼が食えるものを失っている。'],
          to: 'gate',
        },
        onDefeat: { to: 'rescued' },
        onFlee: { text: ['走った。狼は追ってこなかった——追う体力すら残っていないのかもしれない。'], to: 'gate' },
      },
    },

    rescued: {
      id: 'rescued', title: '藁の匂い', art: '🛏️',
      text: [
        '目を覚ますと、天井の梁が見えた。ヴェルナ村の宿の二階だ。',
        '「街道で倒れてたんだよ、あんたら」と、宿の女将が湯気の立つ椀を置く。「狼が食い散らかす前に、うちの息子が見つけた」',
        '荷物は無事だが、財布は軽くなっていた。',
      ],
      onEnter: [{ rest: 'long' }, { gold: -10 }, { var: 'trust', add: 1 }],
      choices: [{ text: '礼を言って起き上がる', to: 'square' }],
    },

    /* ------------------------------------------------------------ 村 */

    gate: {
      id: 'gate', title: 'ヴェルナ村の門', art: '🏘️',
      text: [
        '柵とも呼べない低い木の囲い。その手前に、長槍を持った男が一人立っている。防具は父親の代のものだろう、肩が合っていない。',
        '「止まれ。……ああ、いや。あんたたちが、町から来た連中か」',
        '男の視線が、村の中央——鐘楼へ向かう。石造りの塔。鐘は見える。だが縄が、風もないのに揺れている。',
      ],
      onEnter: [{ var: 'time', add: 1 }],
      choices: [
        {
          text: '「鐘のことを聞かせてくれ」と正直に切り出す',
          check: {
            skill: 'persuasion', dc: 10,
            success: {
              text: [
                '男は肩の力を抜いた。「三日前の夜からだ。鳴らそうとした奴が二人、塔に登った。……降りてきた時には、二人とも口をきかなくなってた」',
                '「今は礼拝堂に寝かせてる。ハルヴァ様が看てくださってる」',
              ],
              effects: [{ var: 'trust', add: 1 }, { setFlag: 'knowsVictims' }],
              to: 'square',
            },
            fail: {
              text: ['「俺の仕事は門番だ。中で聞いてくれ」男は目を合わせない。'],
              to: 'square',
            },
          },
        },
        {
          text: '槍を握る手の震えを見て、看破する',
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                'この男は鐘を恐れているのではない。村の中を——礼拝堂の方角を、見ないようにしている。',
                '「……早く入れ」と男は言う。「日が落ちる前にな」',
              ],
              effects: [{ setFlag: 'gateHint' }, { var: 'trust', add: 1 }],
              to: 'square',
            },
            fail: { text: ['疲れているだけだ、と自分に言い聞かせる。'], to: 'square' },
          },
        },
        { text: '黙って村へ入る', to: 'square' },
      ],
    },

    square: {
      id: 'square', title: '村の広場', art: '⛲',
      text: [
        '広場には人がいない。井戸端に桶が置きっぱなしになっていて、中の水に薄い膜が張っている。',
        '鐘楼の影が、この時間にしては長すぎる気がする。',
        '行ける場所は三つ——宿、礼拝堂、そして鐘楼そのもの。',
      ],
      choices: [
        { text: '宿「三本の麦」で聞き込みをする', to: 'inn' },
        { text: '礼拝堂へ行き、ハルヴァ司祭に会う', to: 'chapel' },
        { text: '鐘楼に登ってみる', to: 'tower' },
        { text: '井戸を覗き込む', once: true, to: 'well' },
        {
          text: '森へ続く足跡をたどる',
          if: { flag: 'sawTracks' },
          to: 'forest',
        },
        {
          text: '集めた手がかりを整理し、森の奥へ向かう',
          requires: { all: [{ flag: 'knowsRitual' }] },
          lockedText: '儀式について、まだ何も知らない',
          to: 'forest',
        },
      ],
    },

    well: {
      id: 'well', title: '井戸', art: '🪣',
      text: ['水面までは遠い。石を落とすと、返ってきたのは水音ではなく、乾いた音だった。'],
      choices: [
        {
          text: '縄を垂らして降りる',
          check: {
            skill: 'athletics', dc: 13,
            success: {
              text: [
                '底には水がない。代わりに、掘り返された土と、小さな麻袋。中身は銀の小鐘だった。',
                '「不死のものは澄んだ音を嫌う」——祖母の話を思い出す。',
              ],
              effects: [{ giveItem: 'silverBell' }, { setFlag: 'hasBell' }],
              to: 'square',
            },
            fail: {
              text: ['途中で縄が滑った。肩を打ちつけただけで済んだが、底までは降りられない。'],
              effects: [{ damage: '1d4', target: 'active', type: '打撃' }],
              to: 'square',
            },
          },
        },
        { text: '危険だ。やめておく', to: 'square' },
      ],
    },

    inn: {
      id: 'inn', title: '宿「三本の麦」', art: '🍺',
      text: [
        '暖炉に火は入っているが、客は二人だけ。どちらも喋らない。',
        'カウンターの女将が、こちらを見て手を止めた。「泊まりかい。それとも、鐘の話かい」',
      ],
      choices: [
        {
          text: '酒をおごって話を引き出す',
          once: true,
          effects: [{ gold: -3 }],
          check: {
            skill: 'persuasion', dc: 12,
            advantageIf: { var: 'trust', gte: 2 },
            success: {
              text: [
                '「ハルヴァ様が来たのは半年前さ。前の司祭が急に亡くなってね」女将は声を落とす。',
                '「悪い方じゃないよ。子どもらに読み書きも教えてくださる。……ただね、夜中に礼拝堂の地下から、人の声がするって子が言うんだ」',
                '「地下なんて、あそこには無いはずなんだけどねえ」',
              ],
              effects: [{ setFlag: 'knowsPriest' }, { var: 'trust', add: 1 }],
              to: 'innAfter',
            },
            fail: {
              text: ['「あたしは何も知らないよ」女将は布巾を絞る。手が止まらない。'],
              to: 'innAfter',
            },
          },
        },
        {
          text: '隅の男たちの会話に耳をすませる',
          once: true,
          check: {
            skill: 'perception', dc: 13,
            success: {
              text: [
                '「……三日だ。三日で足りるって言ってた」',
                '「黙れ。あの方に聞こえる」',
                '二人はそれきり口を閉ざした。だが「三日」という言葉が、鐘の止まった日数と重なる。',
              ],
              effects: [{ setFlag: 'knowsRitual', note: '（何かの儀式が三日で完成する——そう聞こえた）' }],
              to: 'innAfter',
            },
            fail: { text: ['薪のはぜる音が邪魔をして、聞き取れない。'], to: 'innAfter' },
          },
        },
        {
          text: '子どもたちの噂を聞く',
          once: true,
          check: {
            skill: 'insight', dc: 10,
            success: {
              text: [
                '階段の隙間から、五、六歳の女の子がこちらを見ている。目が合うと、手を出してきた。',
                '「これ、あげる。塔にのぼるなら、持ってて」',
                '編み紐の護符。掌に収まる大きさで、まだ温かい。',
              ],
              effects: [{ giveItem: 'charm' }, { var: 'trust', add: 1 }],
              to: 'innAfter',
            },
            fail: { text: ['子どもたちは奥へ引っ込んでしまった。'], to: 'innAfter' },
          },
        },
        { text: '広場に戻る', to: 'square' },
      ],
    },

    innAfter: {
      id: 'innAfter', title: '宿の中', art: '🍺',
      text: ['暖炉の火が一度、大きく揺れた。'],
      choices: [
        { text: 'もう少し粘る', to: 'inn' },
        { text: '広場に戻る', to: 'square' },
        { text: '部屋を取って休む（休憩）', once: true, effects: [{ gold: -2 }, { rest: 'short' }, { var: 'time', add: 1 }], to: 'square' },
      ],
    },

    chapel: {
      id: 'chapel', title: '礼拝堂', art: '⛪',
      text: [
        '蝋燭の数が多すぎる。祭壇の前に、二人の男が寝かされていた。目は開いている。瞬きをしない。',
        '「ようこそ。遠いところを」——奥から出てきたのは、痩せた中年の男。灰色の法衣。声は穏やかだ。',
        '「ハルヴァと申します。この村の司祭を預かっております」',
      ],
      onEnter: [{ var: 'time', add: 1 }],
      choices: [
        {
          text: '倒れた二人の容体を診る',
          check: {
            skill: 'medicine', dc: 12,
            success: {
              text: [
                '脈も呼吸もある。だが瞳孔が開ききっている。毒でも病でもない——魂の側が留守なのだ。',
                '首筋に、細い切り傷。刃物の角度が、自分でつけたものではない。',
              ],
              effects: [{ setFlag: 'knowsRitual' }, { setFlag: 'knowsPriest' }],
              to: 'chapelTalk',
            },
            fail: { text: ['見たことのない状態だ。眠っているようにも、死んでいるようにも見える。'], to: 'chapelTalk' },
          },
        },
        {
          text: '司祭の言葉と目を、注意深く観察する',
          check: {
            skill: 'insight', dc: 14,
            success: {
              text: [
                '一つだけ、噛み合わないものがあった。彼は「鐘が鳴らなくなって困っている」と言いながら、一度も鐘楼を見ない。',
                '窓のすぐ外に、その塔があるというのに。',
              ],
              effects: [{ setFlag: 'knowsPriest' }],
              to: 'chapelTalk',
            },
            fail: {
              text: ['疲れた聖職者にしか見えない。むしろ、こちらを気遣ってくれている。'],
              effects: [{ var: 'trust', add: -1 }],
              to: 'chapelTalk',
            },
          },
        },
        { text: '当たり障りなく挨拶し、外に出る', to: 'square' },
      ],
    },

    chapelTalk: {
      id: 'chapelTalk', title: 'ハルヴァ司祭', art: '🕯️',
      text: ['「何かお気づきになりましたか」司祭は微笑む。両手を法衣の袖に入れたまま。'],
      choices: [
        {
          text: '「地下に何がある」と単刀直入に訊く',
          if: { flag: 'knowsPriest' },
          check: {
            skill: 'intimidation', dc: 14,
            success: {
              text: [
                '司祭の笑みが、貼りついたまま固まった。',
                '「……あなた方は、思ったより早い」袖から抜いた手に、鍵が握られている。それを床に投げた。',
                '「地下です。どうぞご覧なさい。ただし——日が落ちるまでに終わらせることです」',
                '彼は礼拝堂の裏口から出ていった。追う間もなく、姿が影に溶けた。',
              ],
              effects: [{ giveItem: 'ironKey' }, { setFlag: 'hasKey' }, { setFlag: 'knowsRitual' }],
              to: 'square',
            },
            fail: {
              text: [
                '「地下、ですか」司祭は困ったように首をかしげる。「石の床の下は土ですよ」',
                '追及の言葉が続かない。こちらの根拠が薄いことを、彼は正確に見抜いている。',
              ],
              effects: [{ var: 'trust', add: -1 }],
              to: 'square',
            },
          },
        },
        {
          text: '協力を装い、鍵か情報を引き出す',
          check: {
            skill: 'deception', dc: 13,
            success: {
              text: [
                '「森の奥に、古い納骨堂があります」司祭は言った。「近ごろ、あそこに人が出入りしているようだ」',
                '嘘ではない。ただし、出入りしているのが誰なのかは言わなかった。',
              ],
              effects: [{ setFlag: 'knowsRitual' }, { setFlag: 'knowsCrypt' }],
              to: 'square',
            },
            fail: {
              text: ['「お若いのに、嘘が下手でいらっしゃる」司祭は静かに言った。それきり何も話さない。'],
              effects: [{ var: 'trust', add: -1 }],
              to: 'square',
            },
          },
        },
        { text: '礼を言って外に出る', to: 'square' },
      ],
    },

    tower: {
      id: 'tower', title: '鐘楼', art: '🔔',
      text: [
        '螺旋階段は狭く、蝋燭の煤が壁を黒くしている。上るほど空気が冷たくなる。',
        '最上階。鐘は確かにそこにあった。だが縄は——誰も触れていないのに、ゆっくりと揺れている。',
        '鐘の内側に、白墨で何かが描かれている。',
      ],
      onEnter: [{ var: 'time', add: 1 }],
      choices: [
        {
          text: '描かれた印を読み解く',
          check: {
            skill: 'arcana', dc: 13,
            success: {
              text: [
                '封じの印だ。ただし逆向きに描かれている——閉じ込めるのではなく、こちら側に「留めておく」ための細工。',
                '鐘が鳴らないのではない。鳴らせないようにされているのだ。音は、何かを追い払ってしまうから。',
              ],
              effects: [{ setFlag: 'knowsRitual' }, { setFlag: 'knowsSeal' }],
              to: 'towerShadow',
            },
            fail: {
              text: ['見たことのない文字だ。指でなぞると、白墨が指先で熱を持った。'],
              to: 'towerShadow',
            },
          },
        },
        {
          text: '力ずくで鐘を鳴らす',
          check: {
            skill: 'athletics', dc: 12,
            success: {
              text: [
                '縄を握り、全体重をかけた。鐘が一度だけ——ごとり、と鈍い音を立てた。鐘の音ではない。石が転がるような音。',
                'その瞬間、階段の下の暗がりで、何かが身をよじった。',
              ],
              effects: [{ setFlag: 'rangBell' }],
              to: 'towerShadow',
            },
            fail: {
              text: ['縄はぴくりとも動かない。見えない手が、反対側から引いている。'],
              to: 'towerShadow',
            },
          },
        },
        { text: '嫌な予感がする。降りる', to: 'square' },
      ],
    },

    towerShadow: {
      id: 'towerShadow', title: '塔の影', art: '👤',
      text: [
        '階段の壁の染みが、動いた。染みではなかった。',
        '人の形をした暗がりが、床を這うようにこちらへ来る。',
      ],
      combat: {
        title: '塔の影',
        enemies: ['shadow'],
        onVictory: {
          text: [
            '影は音もなく散った。あとには、乾いた土のような匂いだけが残る。',
            '床に、小さな鉄の鍵が落ちていた。歯の形が新しく削られている。',
          ],
          effects: [{ giveItem: 'ironKey' }, { setFlag: 'hasKey' }, { setFlag: 'knowsRitual' }],
          to: 'square',
        },
        onDefeat: { to: 'rescuedTower' },
        onFlee: { text: ['転がるように階段を降りた。背後で、何かが階段の途中で止まった。'], to: 'square' },
      },
    },

    rescuedTower: {
      id: 'rescuedTower', title: '目を覚ます', art: '🛏️',
      text: [
        '広場の石畳の上だった。村人が数人、遠巻きにこちらを見ている。誰も近づいてこない。',
        '塔の入口は、内側から板が打ちつけられていた。',
      ],
      onEnter: [{ rest: 'short' }, { var: 'time', add: 1 }, { var: 'trust', add: -1 }],
      choices: [{ text: '立ち上がる', to: 'square' }],
    },

    /* ---------------------------------------------------------- 森・洞窟 */

    forest: {
      id: 'forest', title: '北の森', art: '🌲',
      text: [
        '木の間隔が、村を離れるにつれて広くなる。人の手が入っていた森だ——今はもう、入っていない。',
        '足跡は下生えを踏み分け、岩がちな斜面へ続いている。斜面の下に、黒い口が開いている。古い納骨堂の入口だ。',
      ],
      onEnter: [{ var: 'time', add: 1 }],
      choices: [
        {
          text: '足跡を読み、何人いるか見極める',
          check: {
            skill: 'survival', dc: 12,
            success: {
              text: [
                'ゴブリンが四、五。それと、靴を履いた人間が一人。人間の足跡は、行きと帰りが何度もある。',
                '斜面の東側に、獣道がもう一本。裏口があるらしい。',
              ],
              effects: [{ setFlag: 'backdoor' }],
              to: 'entrance',
            },
            fail: { text: ['踏み荒らされていて、数までは読めない。'], to: 'entrance' },
          },
        },
        { text: 'まっすぐ入口へ向かう', to: 'entrance' },
        { text: '村へ引き返す', to: 'square' },
      ],
    },

    entrance: {
      id: 'entrance', title: '納骨堂の入口', art: '🕳️',
      text: [
        '崩れた石段の下に、扉の外れた入口。中から風が吹き出してくる。蝋と、それから甘すぎる香の匂い。',
        '入口の脇に、痩せたゴブリンが一匹。槍を抱えて座り込み、居眠りをしている。',
      ],
      choices: [
        {
          text: '気づかれる前に忍び寄る',
          check: {
            skill: 'stealth', dc: 12,
            success: {
              text: ['足音を殺して背後に立った。相手はまだ気づいていない。先手はこちらにある。'],
              effects: [{ setFlag: 'sneakedGrim' }],
              to: 'grimTalk',
            },
            fail: {
              text: ['小石を踏んだ。ゴブリンが飛び起き、槍を構える。「こ、来るな！」'],
              to: 'grimTalk',
            },
          },
        },
        {
          text: '正面から声をかける',
          to: 'grimTalk',
        },
        {
          text: '裏の獣道から回り込む',
          if: { flag: 'backdoor' },
          effects: [{ setFlag: 'usedBackdoor' }],
          to: 'backpassage',
        },
      ],
    },

    grimTalk: {
      id: 'grimTalk', title: '見張りのグリム', art: '👺',
      text: [
        'ゴブリンは槍を構えているが、切っ先が定まらない。よく見ると、片耳が裂けている。古い傷ではない。',
        '「おれは……おれは見張りだ。通さない」声が震えている。',
      ],
      choices: [
        {
          text: '「お前も逃げたいんだろう」と話しかける',
          check: {
            skill: 'persuasion', dc: 13,
            advantageIf: { flag: 'sneakedGrim' },
            success: {
              text: [
                'ゴブリンは長いこと黙っていた。それから槍を下ろした。',
                '「……あいつは、おれたちの仲間も使った。三人。もう戻ってこない」',
                '「灰色の服の人間だ。おれたちに掘らせて、村から人を運ばせて、それで——」',
                '「奥に行くなら、右の道だ。左は仕掛けがある。おれはもう、ここにいない」',
                'そう言うと、グリムは斜面を駆け上がり、森の中へ消えた。',
              ],
              effects: [
                { setFlag: 'sparedGoblin' }, { setFlag: 'knowsPriest' }, { setFlag: 'knowsRitual' },
                { var: 'trust', add: 1 },
              ],
              to: 'crypt',
            },
            fail: {
              text: ['「うそだ！ 話すな！ あいつが見てる！」ゴブリンは槍を突き出した。'],
              to: 'grimFight',
            },
          },
        },
        {
          text: '威圧して道を空けさせる',
          check: {
            skill: 'intimidation', dc: 11,
            success: {
              text: ['ゴブリンは槍を放り出して逃げ出した。「知らない！ おれは何も知らない！」'],
              effects: [{ setFlag: 'sparedGoblin' }],
              to: 'crypt',
            },
            fail: { text: ['追い詰められたゴブリンは、悲鳴のような声をあげて突きかかってきた。'], to: 'grimFight' },
          },
        },
        { text: '斬りかかる', to: 'grimFight' },
      ],
    },

    grimFight: {
      id: 'grimFight', title: '入口の戦い', art: '⚔️',
      text: ['狭い石段の上での戦いになる。'],
      combat: {
        title: '見張りとの戦い',
        enemies: ['grim'],
        surprise: null,
        onVictory: {
          text: ['ゴブリンは倒れた。懐から、村の子どもが作るような編み紐が出てきた。誰のものだったのか、もう聞けない。'],
          to: 'crypt',
        },
        onDefeat: { to: 'defeatOutside' },
        onFlee: { to: 'forest' },
      },
    },

    backpassage: {
      id: 'backpassage', title: '裏の通気口', art: '🕯️',
      text: [
        '岩の割れ目は、人ひとりがやっと通れる幅だった。中は狭く、天井から水が滴っている。',
        '奥から詠唱が聞こえる。同じ言葉の繰り返し。声は複数——だが、一人だけ明らかに指示を出している。',
      ],
      choices: [
        {
          text: '音を立てずに進む',
          check: {
            skill: 'stealth', dc: 13,
            success: {
              text: ['祭壇の間の真上、崩れた梁の陰に出た。下の様子が丸見えだ。不意を打てる。'],
              effects: [{ setFlag: 'surpriseRitual' }, { setFlag: 'knowsRitual' }],
              to: 'ritual',
            },
            fail: {
              text: ['落石が転がった。詠唱が止まる。「——誰かいるな」'],
              to: 'ritual',
            },
          },
        },
        {
          text: '天井の梁の強度を確かめてから進む',
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: [
                '梁の一本が、祭壇の真上で支えを失っている。切り落とせば落下する。',
                '使いどころは一度きりだろう。',
              ],
              effects: [{ setFlag: 'canDropBeam' }, { setFlag: 'surpriseRitual' }],
              to: 'ritual',
            },
            fail: { text: ['埃が目に入る。それ以上のことは分からない。'], to: 'ritual' },
          },
        },
      ],
    },

    crypt: {
      id: 'crypt', title: '納骨堂', art: '💀',
      text: [
        '壁の棚に骨が並んでいる。どれも古い。だが床の土は新しく掘り返されていて、その上を何度も歩いた跡がある。',
        '道は二つに分かれている。右は下りの階段。左は平らな通路で、床にうっすらと線が見える。',
      ],
      choices: [
        {
          text: 'グリムの言葉どおり、右の階段を下りる',
          if: { flag: 'sparedGoblin' },
          to: 'ritualApproach',
        },
        {
          text: '右の階段を下りる',
          if: { noFlag: 'sparedGoblin' },
          to: 'ritualApproach',
        },
        {
          text: '左の通路を調べる',
          check: {
            skill: 'investigation', dc: 13,
            success: {
              text: [
                '床の線は蓋だ。下に槍の束が仕込んである——落とし穴。だが、蓋の縁に布の繊維が引っかかっている。',
                '誰かがここに落ちて、引き上げられた。あるいは、引き上げられなかった。',
                '慎重に脇を通れば、その先には小部屋がある。盗品の山だ。',
              ],
              effects: [{ gold: 40 }, { giveItem: 'greaterPotion' }],
              to: 'ritualApproach',
            },
            fail: {
              text: ['一歩踏み出した瞬間、床が抜けた。'],
              effects: [{ damage: '2d6', target: 'active', type: '刺突', save: { ability: 'dex', dc: 12, half: true } }],
              to: 'ritualApproach',
            },
          },
        },
        { text: '外へ引き返す', to: 'forest' },
      ],
    },

    ritualApproach: {
      id: 'ritualApproach', title: '階段の下', art: '🔥',
      text: [
        '階段の下から、赤い光が漏れている。詠唱が聞こえる。同じ言葉の繰り返し。',
        '覗き込むと、円形の祭壇の間。中央に石の台。その上に、村の若者が横たえられている。まだ生きている。',
        '台を囲んで、信者が三人。そして灰色の法衣の男が、背を向けて立っている。',
      ],
      choices: [
        {
          text: '突入する',
          to: 'ritual',
        },
        {
          text: '銀の小鐘を鳴らしてから突入する',
          requires: { has: 'silverBell' },
          lockedText: '銀の小鐘を持っていない',
          effects: [
            { setFlag: 'rangSilver' },
            { log: '澄んだ音が石室に響いた。詠唱が乱れる。祭壇の赤い光が、一瞬だけ弱まった。', kind: 'good' },
          ],
          to: 'ritual',
        },
        {
          text: '合図を送って村に応援を呼びに戻る',
          requires: { var: 'trust', gte: 3 },
          lockedText: '村人はまだ、あなたを信用しきっていない',
          effects: [{ setFlag: 'villagersComing' }, { var: 'time', add: 1 }],
          to: 'ritual',
        },
        { text: 'いったん引く', to: 'crypt' },
      ],
    },

    ritual: {
      id: 'ritual', title: '祭壇の間', art: '🩸',
      text: [
        '灰色の法衣が振り返った。ハルヴァ司祭。手には儀式の刃。刃先はもう濡れている。',
        '「間に合ってしまいましたか」彼は困ったように言った。本当に困っているように見えるのが、いちばん恐ろしい。',
        '「あと一人なのです。あと一人で、この村は二度と飢えない」',
      ],
      onEnter: [{ setFlag: 'knowsRitual' }, { setFlag: 'knowsPriest' }],
      choices: [
        {
          text: '「その一人は、あんたでもいいはずだ」と言い返す',
          check: {
            skill: 'persuasion', dc: 15,
            advantageIf: { any: [{ flag: 'rangSilver' }, { flag: 'villagersComing' }] },
            success: {
              text: [
                '司祭の手が止まった。長い沈黙。刃の先から、血がひとしずく落ちた。',
                '「……そうですね」',
                '彼は刃を自分の喉に当て——そして、笑った。「いいえ。まだです」',
                'だが一瞬の躊躇が、こちらに先手を与えた。',
              ],
              effects: [{ setFlag: 'halvaHesitated' }],
              to: 'ritualFight',
            },
            fail: {
              text: ['「私が死んでも、契約は続くのですよ」司祭は刃を持ち直した。'],
              to: 'ritualFight',
            },
          },
        },
        {
          text: '梁を切り落として祭壇を潰す',
          requires: { flag: 'canDropBeam' },
          lockedText: '天井の仕掛けに気づいていない',
          effects: [
            { log: '梁が落ちた。石台が割れ、信者の一人が下敷きになる。詠唱が完全に途切れた。', kind: 'good' },
            { setFlag: 'brokeAltar' },
          ],
          to: 'ritualFight',
        },
        { text: '問答無用で斬りかかる', to: 'ritualFight' },
        {
          text: '生贄の若者を先に助け出す',
          check: {
            skill: 'acrobatics', dc: 14,
            success: {
              text: [
                '信者の間を抜け、縄を切った。若者を肩に担ぎ、壁際まで引く。',
                '儀式は完成しない。司祭の顔から、はじめて表情が消えた。',
              ],
              effects: [{ setFlag: 'savedVictim' }, { setFlag: 'brokeAltar' }],
              to: 'ritualFight',
            },
            fail: {
              text: ['信者に取り押さえられかけ、腕を切られた。若者にはまだ届かない。'],
              effects: [{ damage: '1d6', target: 'active', type: '斬撃' }],
              to: 'ritualFight',
            },
          },
        },
      ],
    },

    ritualFight: {
      id: 'ritualFight', title: '儀式を止める', art: '⚔️',
      text: ['赤い光が脈打つ。戦いになる。'],
      combat: {
        title: 'ハルヴァ司祭との戦い',
        enemies: ['halva', 'cultist', 'cultist'],
        surprise: null,
        onVictory: {
          text: [
            '司祭は祭壇の縁にもたれて倒れた。息はまだある。',
            '「……あなた方は、この村が去年、何人埋めたか知らない」',
            'それが最後の言葉だった。赤い光は、蝋燭が消えるように静かに消えた。',
          ],
          effects: [{ giveItem: 'ritualDagger' }, { gold: 30 }],
          to: 'aftermath',
        },
        onDefeat: { to: 'endBad' },
        onFlee: { to: 'endFled' },
      },
    },

    defeatOutside: {
      id: 'defeatOutside', title: '納骨堂の外', art: '🌒',
      text: [
        '目を覚ますと、森の外に投げ出されていた。武器はある。財布はない。',
        '空はもう暗い。村の方角で、細い煙が上がっている。',
      ],
      onEnter: [{ rest: 'short' }, { var: 'time', add: 2 }, { gold: -15 }],
      choices: [
        { text: 'もう一度、納骨堂へ向かう', to: 'entrance' },
        { text: '村へ引き返す', to: 'square' },
      ],
    },

    /* ---------------------------------------------------------- 結末 */

    aftermath: {
      id: 'aftermath', title: '夜が明ける', art: '🌅',
      text: [
        '祭壇の間の壁に、名前が彫られていた。三十七人分。いちばん新しいものは、まだ削り屑が残っている。',
        '外に出ると、東の空が白んでいた。',
      ],
      choices: [
        {
          text: '村に戻り、すべてを話す',
          requires: { var: 'trust', gte: 1 },
          lockedText: '村人はあなたの話を聞かないだろう',
          to: 'endGood',
        },
        {
          text: '村に戻り、すべてを話す（信用されないかもしれない）',
          if: { var: 'trust', lte: 0 },
          to: 'endCold',
        },
        { text: '何も言わず、報酬だけ受け取って村を出る', to: 'endQuiet' },
      ],
    },

    endGood: {
      id: 'endGood', title: '鐘が鳴る', art: '🔔',
      text: [
        '鐘楼の印を削り落とすと、縄は嘘のようにおとなしくなった。',
        '門番の男が縄を引いた。三日ぶりの鐘の音が、村の屋根を渡っていく。礼拝堂で寝ていた二人が、同時に瞬きをした。',
        '{name} たちが村を出るとき、見送りに出てきた人の中に、あの編み紐の子がいた。',
      ],
      ending: {
        type: 'good',
        title: '鐘が鳴る',
        text: [
          '村は生き延びた。三十七人は戻らないが、三十八人目はいない。',
          '報酬の銀貨十五枚に、麦の袋がひとつ添えられていた。',
        ],
      },
    },

    endCold: {
      id: 'endCold', title: '信じない村', art: '🌫️',
      text: [
        '村人たちは黙って話を聞いた。そして、誰も何も言わなかった。',
        '「ハルヴァ様は、いい方だった」——それだけが、繰り返し聞こえた。',
        '報酬は払われた。門は、出ていくときに閉められた。',
      ],
      ending: {
        type: 'neutral',
        title: '信じない村',
        text: ['儀式は止まった。だが、この村が何を埋めてきたのかは、村の外に出ることはない。'],
      },
    },

    endQuiet: {
      id: 'endQuiet', title: '黙って去る', art: '🚶',
      text: ['報酬を受け取り、何も言わずに村を出た。背後で、鐘は鳴らないままだった。'],
      ending: {
        type: 'neutral',
        title: '黙って去る',
        text: ['あの村がその後どうなったかを、{name} は知らない。知ろうともしなかった。'],
      },
    },

    endBad: {
      id: 'endBad', title: '儀式は完成する', art: '🩸',
      text: [
        '赤い光が、視界いっぱいに広がった。',
        '「ありがとうございます」という声が、遠くで聞こえた。「あと一人、足りなかったのです」',
      ],
      ending: {
        type: 'bad',
        title: '三十八人目',
        text: ['ヴェルナ村の鐘は、その後も鳴らなかった。壁の名前が、いくつか増えた。'],
      },
    },

    endFled: {
      id: 'endFled', title: '逃げ延びる', art: '🏃',
      text: ['石段を駆け上がり、森を抜け、街道に出たときには夜が明けていた。背後を振り返らなかった。'],
      ending: {
        type: 'bad',
        title: '逃げ延びる',
        text: ['命は残った。報酬は受け取れなかった。ヴェルナ村の名は、二度と地図に載らなかった。'],
      },
    },
  },
};

export default silentBell;
