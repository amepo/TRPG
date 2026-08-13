/* シナリオ「雨の領収書」— ネオンの雨・1レベル用（40〜60分）。

   構成:
     依頼 → 街での聞き込み3系統 → タワーへの侵入（3ルート）→ 真相 → 結末5種
   侵入ルート:
     正面（社員証を使う）／搬入口（潜入）／ネットラン（電脳侵入）
   フラグ:
     hasBadge   社員証を手に入れた
     knowsFloor 37階のことを知った
     knowsTruth 兄が何をしたか知った
     sparedDrone ドローンを壊さずに黙らせた
     gotFiles   証拠ファイルを抜いた
   変数:
     heat  企業に目をつけられた度合い（3以上で掃除屋が動く）
     cred  街での信用
*/

export const rainCheck = {
  id: 'rain-check',
  title: '雨の領収書',
  author: '灯火のテーブル',
  world: 'neon',
  blurb: '「弟が消えた。会社は“退職した”と言っている。退職届の日付が、消えた三日後なんだ」',
  level: 1,
  length: '短編（40〜60分）',
  start: 'bar',
  vars: { heat: 0, cred: 0 },

  items: {
    badge: { id: 'badge', name: 'ハヤシの社員証', desc: '写真は別人。だがゲートは通る。あと何回かは。' },
    dataChip: { id: 'dataChip', name: '暗号化チップ', desc: '中身は開けていない。開ける度胸がまだない。' },
    painkiller: { id: 'painkiller', name: '強い鎮痛剤', use: 'heal', amount: '1d8+2', desc: '効くが、あとで来る。', consumable: true },
    evidence: { id: 'evidence', name: '第37階層の記録', desc: '人の名前が並んでいる。日付は、全員そろって同じ日。' },
  },

  monsters: {
    kessler: {
      name: 'ケスラー主任', kind: '人型', cr: 2, xp: 450,
      acOverride: 16, hp: '7d8+14', hpAvg: 45, speed: 9,
      abilities: { str: 14, dex: 14, con: 15, int: 16, wis: 14, cha: 13 },
      attacks: [
        { name: '企業支給の拳銃', bonus: 6, damage: '2d6+3', type: '実弾', ranged: true },
        { name: '強化義手', bonus: 6, damage: '1d8+4', type: '打撃' },
      ],
      resistances: ['実弾'],
      tactics: 'caster',
      traits: ['非常時プロトコル：HPが半分を切ると警備を1体呼ぶ'],
      blurb: '疲れた顔をしている。二十年、この階で同じ仕事をしてきた顔だ。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 依頼 */

    bar: {
      id: 'bar', title: '雨の下のバー「アンカー」', art: '🌧️',
      text: [
        '看板の光が水たまりで割れている。店の中は乾いているが、匂いは外と同じだ。',
        '向かいの席の男は、三杯目を頼まなかった。手が震えているのを見られたくないらしい。',
        '「弟のミハイルが消えた。ゲンテック・タワーの保守部にいた」',
        '「会社は“自己都合退職”だと言う。だが退職届の日付は、あいつが消えた三日後なんだ」',
        'テーブルに現金の束と、一枚のカードが置かれる。',
      ],
      choices: [
        {
          text: '「なぜ警察じゃなく、俺たちなんだ」と訊く',
          check: {
            skill: 'insight', dc: 11,
            success: {
              text: [
                '男は答えない。答えないという答えだった。',
                'この街で企業タワー相手に警察が動くのは、企業が動けと言ったときだけだ。それを知っている顔をしている。',
                '「……三日前から、家の前に車が停まってる」',
              ],
              effects: [{ setFlag: 'knowsWatched' }, { var: 'cred', add: 1 }],
              to: 'offer',
            },
            fail: { text: ['「あんたたちのほうが早いからだ」それ以上は言わない。'], to: 'offer' },
          },
        },
        { text: '報酬の話に進む', to: 'offer' },
      ],
    },

    offer: {
      id: 'offer', title: '条件', art: '💳',
      text: [
        '「前金で €$300。弟が生きていたら倍。……死んでいたなら、誰がやったか教えてくれ」',
        'カードはミハイルの社員証だった。ゲンテック・タワー、保守部、第12階層まで。',
      ],
      onEnter: [{ giveItem: 'badge' }, { setFlag: 'hasBadge' }, { gold: 300 }],
      choices: [
        { text: '受ける', to: 'street' },
        {
          text: '前金の上乗せを交渉する',
          once: true,
          check: {
            skill: 'persuasion', dc: 13,
            success: {
              text: ['「……あと100だ。それで全部だ」男は財布の中身を全部出した。本当に全部だった。'],
              effects: [{ gold: 100 }, { var: 'cred', add: -1 }],
              to: 'street',
            },
            fail: { text: ['「これ以上はない。本当にないんだ」その顔を見て、それ以上は言えなくなった。'], to: 'street' },
          },
        },
      ],
    },

    /* ---------------------------------------------------------- 街 */

    street: {
      id: 'street', title: '第9地区・夜', art: '🏙️',
      text: [
        '雨は止まない。屋台の湯気と、看板のマゼンタが混ざって、道の先が見えない。',
        'ゲンテック・タワーは北。ここからでも見える——上のほうの階だけ、雲の上に出ている。',
        '調べる先は三つ。ミハイルの部屋、行きつけの闇医者、そして情報屋のノヴァ。',
      ],
      choices: [
        { text: 'ミハイルの部屋へ行く', to: 'flat' },
        { text: '闇医者のところへ寄る', to: 'clinic' },
        { text: '情報屋のノヴァに会う', to: 'nova' },
        {
          text: 'タワーへ向かう',
          requires: { any: [{ flag: 'knowsFloor' }, { var: 'cred', gte: 2 }] },
          lockedText: 'まだ、どこを探せばいいのか分かっていない',
          to: 'towerApproach',
        },
      ],
    },

    flat: {
      id: 'flat', title: 'ミハイルの部屋', art: '🚪',
      text: [
        '電子錠は壊れていない。壊す必要がなかったからだ——誰かが鍵を持っていた。',
        '中は片付きすぎている。生活していた人間の部屋ではなく、片付けられた部屋の匂いがする。',
      ],
      onEnter: [{ var: 'heat', add: 1 }],
      choices: [
        {
          text: '部屋を丹念に調べる',
          once: true,
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: [
                '冷蔵庫の裏、マグネットの下にチップが一枚。暗号化されている。',
                '机の引き出しには、保守作業の記録。第37階層——社員証では入れない階だ。',
                '記録の最後の行だけ、他と筆圧が違う。「あそこには人がいる」',
              ],
              effects: [{ giveItem: 'dataChip' }, { setFlag: 'knowsFloor' }],
              to: 'flatAfter',
            },
            fail: { text: ['何も出てこない。徹底的に持っていかれたあとだ。'], to: 'flatAfter' },
          },
        },
        {
          text: '隣人に話を聞く',
          once: true,
          check: {
            skill: 'persuasion', dc: 12,
            advantageIf: { var: 'cred', gte: 1 },
            success: {
              text: [
                'ドアチェーン越しに、老人が答えた。「二週間前の夜、スーツが三人来た。物音はしなかったよ」',
                '「ミハイルは前の日から様子がおかしかった。“見ちゃいけないものを見た”って」',
              ],
              effects: [{ var: 'cred', add: 1 }, { setFlag: 'knowsWatched' }],
              to: 'flatAfter',
            },
            fail: { text: ['どのドアも開かない。この街の隣人とはそういうものだ。'], to: 'flatAfter' },
          },
        },
        { text: '街に戻る', to: 'street' },
      ],
    },

    flatAfter: {
      id: 'flatAfter', title: '部屋の中', art: '🚪',
      text: ['窓の外、向かいのビルの屋上で、何かが光を反射した。'],
      choices: [
        { text: 'もう少し調べる', to: 'flat' },
        { text: '急いで出る', to: 'street' },
      ],
    },

    clinic: {
      id: 'clinic', title: '闇医者の診療所', art: '💉',
      text: [
        '地下一階、元は精肉店。天井のフックがそのまま残っている。',
        '医者は手を止めずに言った。「ミハイル？ ああ、来たよ。三週間前だ」',
      ],
      choices: [
        {
          text: '何をしに来たのか訊く',
          once: true,
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                '「ポートを抜いてくれと言われた。後頭部のやつを、まるごと」',
                '医者は初めて手を止めた。「あんな怯え方をする客は久しぶりだった。“中に何か入れられた”ってな」',
                '「抜いたよ。抜いたら、中から社製の記録装置が出てきた」',
              ],
              effects: [{ setFlag: 'knowsFloor' }, { var: 'cred', add: 1 }],
              to: 'clinicAfter',
            },
            fail: { text: ['「客のことは話さない。ここはそういう店だ」'], to: 'clinicAfter' },
          },
        },
        {
          text: '改造を入れてもらう（€$ が要る）',
          to: 'ripperdoc',
        },
        {
          text: '傷の手当てを受ける',
          once: true,
          effects: [{ gold: -20 }, { rest: 'short' }],
          to: 'clinicAfter',
        },
        { text: '街に戻る', to: 'street' },
      ],
    },

    ripperdoc: {
      id: 'ripperdoc', title: '手術台', art: '🦾',
      text: [
        '「入れるのは構わない。ただし体が受け入れる量には限りがある」',
        '「入れすぎた奴は、手が震えて、狙いが逸れて、そのうち自分の名前も忘れる」',
        '（改造はキャラクターシートの「適合度」から入れられる。超過するとすべての判定に不利がつく）',
      ],
      choices: [
        { text: '考えておく、と言って出る', to: 'clinicAfter' },
      ],
    },

    clinicAfter: {
      id: 'clinicAfter', title: '診療所', art: '💉',
      text: ['換気扇が回っている。血の匂いは消えない。'],
      choices: [
        { text: 'もう少し話す', to: 'clinic' },
        { text: '街に戻る', to: 'street' },
      ],
    },

    nova: {
      id: 'nova', title: '情報屋ノヴァ', art: '📡',
      text: [
        'ランドリーの奥、乾燥機の熱気の中に、モニタが七枚。',
        'ノヴァは振り向かずに言った。「ゲンテックだろ。今週三人目だよ、その名前を持ってくるのは」',
      ],
      choices: [
        {
          text: 'チップの中身を解析してもらう',
          requires: { has: 'dataChip' },
          lockedText: '見せられるものがない',
          once: true,
          check: {
            skill: 'netops', dc: 13,
            success: {
              text: [
                'ノヴァの指が止まった。「……これ、どこで拾った」',
                '画面には作業ログ。第37階層、生体廃棄物処理。ただし処理量の単位が「体」になっている。',
                '「入るなら裏だ。搬入口のセキュリティは古い。あとは——ネットから開ける手もある」',
              ],
              effects: [{ setFlag: 'knowsFloor' }, { setFlag: 'knowsTruth' }, { var: 'cred', add: 1 }],
              to: 'novaAfter',
            },
            fail: {
              text: ['「暗号が固い。時間をくれ」——時間はない。'],
              to: 'novaAfter',
            },
          },
        },
        {
          text: '金を払って情報を買う',
          once: true,
          effects: [{ gold: -150 }],
          check: {
            skill: 'streetwise', dc: 10,
            success: {
              text: [
                '「搬入口。深夜2時から3時、警備の交代がある。ドローンは一機だけ残る」',
                '「それと、37階に行きたいなら管理者権限が要る。ケスラーって主任が持ってる」',
              ],
              effects: [{ setFlag: 'knowsFloor' }, { setFlag: 'knowsBackdoor' }],
              to: 'novaAfter',
            },
            fail: { text: ['「その金額だと、これくらいだね」——誰でも知っている話が返ってきた。'], to: 'novaAfter' },
          },
        },
        {
          text: '鎮痛剤を分けてもらう',
          once: true,
          effects: [{ gold: -30 }, { giveItem: 'painkiller', count: 2 }],
          to: 'novaAfter',
        },
        { text: '街に戻る', to: 'street' },
      ],
    },

    novaAfter: {
      id: 'novaAfter', title: 'ランドリーの奥', art: '📡',
      text: ['乾燥機が一台、止まった。誰も取りに来ない。'],
      choices: [
        { text: 'もう少し粘る', to: 'nova' },
        { text: '街に戻る', to: 'street' },
      ],
    },

    /* ---------------------------------------------------- タワー侵入 */

    towerApproach: {
      id: 'towerApproach', title: 'ゲンテック・タワー', art: '🏢',
      text: [
        '下から見上げると、雨が上に向かって降っているように見える。ビルの明かりのせいだ。',
        '正面は社員証。裏は搬入口。あるいは、ここに立たずに中へ入る手もある。',
      ],
      onEnter: [{ var: 'heat', add: 1 }],
      choices: [
        {
          text: '社員証で正面から入る',
          requires: { has: 'badge' },
          lockedText: '社員証がない',
          to: 'frontDesk',
        },
        {
          text: '搬入口から潜り込む',
          to: 'loadingBay',
        },
        {
          text: '路地からネットランで内部網に入る',
          to: 'netrunEntry',
        },
        { text: '準備が足りない。街に戻る', to: 'street' },
      ],
    },

    frontDesk: {
      id: 'frontDesk', title: '正面ロビー', art: '🛗',
      text: [
        '大理石と、消毒された空気。受付の向こうで、警備が二人こちらを見ている。',
        'ゲートに社員証をかざす。緑。もう一歩。',
      ],
      choices: [
        {
          text: '堂々と社員のふりをする',
          check: {
            skill: 'deception', dc: 13,
            advantageIf: { classIn: ['fixer', 'runner'] },
            success: {
              text: ['警備は目を戻した。エレベーターは12階まで。そこから上は、別の鍵が要る。'],
              to: 'floor12',
            },
            fail: {
              text: ['「失礼、社員番号を」——警備が近づいてくる。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'lobbyFight',
            },
          },
        },
        {
          text: '企業の作法で押し切る',
          check: {
            skill: 'corpo', dc: 12,
            success: {
              text: [
                '肩書きと部署名を、正しい順序で、正しい速度で言った。それだけで警備の姿勢が変わる。',
                '「失礼しました。12階までどうぞ」',
              ],
              effects: [{ setFlag: 'cleanEntry' }],
              to: 'floor12',
            },
            fail: { text: ['言い回しが古い。二年前に廃止された部署名だった。'], to: 'lobbyFight' },
          },
        },
        { text: '引き返す', to: 'towerApproach' },
      ],
    },

    lobbyFight: {
      id: 'lobbyFight', title: 'ロビーの警備', art: '⚔️',
      text: ['受付の女性が机の下に手を伸ばした。警報ではない——もっと静かな何かだ。'],
      combat: {
        title: 'ロビーの警備',
        enemies: ['secGuard', 'secGuard'],
        onVictory: {
          text: ['二人を物陰に押し込んだ。数分は持つ。数分しか持たない。'],
          effects: [{ var: 'heat', add: 1 }],
          to: 'floor12',
        },
        onDefeat: { to: 'endCaptured' },
        onFlee: { to: 'towerApproach' },
      },
    },

    loadingBay: {
      id: 'loadingBay', title: '搬入口', art: '🚛',
      text: [
        'コンテナの間に雨が溜まっている。監視ドローンが一機、決まった軌道で回っている。',
        '交代の時間まで、あと何分かは分からない。',
      ],
      choices: [
        {
          text: 'ドローンの死角を読んで潜り込む',
          check: {
            skill: 'stealth', dc: 13,
            advantageIf: { flag: 'knowsBackdoor' },
            success: {
              text: ['軌道の切れ目を通り抜けた。誰にも見られていない。'],
              effects: [{ setFlag: 'cleanEntry' }],
              to: 'floor12',
            },
            fail: {
              text: ['レンズがこちらを向いた。回転が止まる。'],
              to: 'droneChoice',
            },
          },
        },
        {
          text: 'ドローンの制御に割り込む',
          check: {
            skill: 'tech', dc: 12,
            success: {
              text: [
                '外装の点検ポートは工具なしで開いた。この機体、五年は交換されていない。',
                'ログを書き換え、軌道を一つずらす。ドローンは何も見なかったことになる。',
              ],
              effects: [{ setFlag: 'sparedDrone' }, { setFlag: 'cleanEntry' }],
              to: 'floor12',
            },
            fail: { text: ['配線に触れた瞬間、警告音。'], to: 'droneChoice' },
          },
        },
        { text: '引き返す', to: 'towerApproach' },
      ],
    },

    droneChoice: {
      id: 'droneChoice', title: '見つかった', art: '🤖',
      text: ['ドローンのレンズが赤く変わった。送信まで数秒。'],
      choices: [
        { text: '撃ち落とす', to: 'droneFight' },
        {
          text: 'アンテナだけを潰す',
          check: {
            skill: 'sleight', dc: 14,
            success: {
              text: ['機体には触れず、背の細い棒だけを折った。ドローンは回り続けている——誰にも届かない報告を送りながら。'],
              effects: [{ setFlag: 'sparedDrone' }],
              to: 'floor12',
            },
            fail: { text: ['棒は折れた。だが送信は間に合っていた。'], effects: [{ var: 'heat', add: 1 }], to: 'droneFight' },
          },
        },
      ],
    },

    droneFight: {
      id: 'droneFight', title: '搬入口の戦闘', art: '⚔️',
      text: ['コンテナの陰から、もう一機が上がってきた。'],
      combat: {
        title: '監視ドローン',
        enemies: ['surveillanceDrone', 'surveillanceDrone'],
        onVictory: {
          text: ['残骸を雨水の中へ蹴り込んだ。中で何かがまだ点滅している。'],
          effects: [{ var: 'heat', add: 2 }],
          to: 'floor12',
        },
        onDefeat: { to: 'endCaptured' },
        onFlee: { to: 'towerApproach' },
      },
    },

    netrunEntry: {
      id: 'netrunEntry', title: '路地からの接続', art: '🕸️',
      text: [
        '非常階段の踊り場、雨の当たらない角。ここなら十五分は誰も来ない。',
        'デッキを開く。タワーの内部網は、外から見ると一枚の白い壁のように見える。',
        '実際には三枚ある。',
      ],
      netrun: {
        title: 'ゲンテック内部網',
        traceMax: 6,
        layers: [
          {
            name: '外周ファイアウォール', skill: 'netops', dc: 12,
            text: ['市販品を改造しただけの壁。設置は四年前。'],
            onFail: { damage: '1d4', text: ['弾かれた。こめかみの奥が痛む。'] },
          },
          {
            name: '認証ゲート', skill: 'tech', dc: 13,
            text: ['社員IDを要求してくる。ミハイルの番号は、まだ削除されていない。'],
            onFail: { damage: '1d6' },
            effects: [{ setFlag: 'hasBadge' }],
          },
          {
            name: '第37階層・区画記録', skill: 'netops', dc: 14,
            text: ['この階層だけ、名前が「保守区画」ではなく「保管区画」になっている。'],
            onFail: { damage: '1d6', text: ['防壁が噛みついてきた。'] },
            effects: [{ setFlag: 'gotFiles' }, { setFlag: 'knowsTruth' }, { giveItem: 'evidence' }],
          },
        ],
        ice: ['ice'],
        onSuccess: {
          text: [
            '記録を吸い出した。名簿だ。三十一人。全員の退職日が、同じ日付になっている。',
            'そして最後の行——ミハイル・ヴァレン。退職日は、まだ空欄だった。',
          ],
          to: 'floor12',
        },
        onTraced: {
          text: ['逆探知が完了した。接続の向こうから、こちらへ何かが降りてくる。'],
          effects: [{ var: 'heat', add: 2 }],
          to: 'floor12',
        },
      },
    },

    /* ---------------------------------------------------- タワー内部 */

    floor12: {
      id: 'floor12', title: '第12階層・保守部', art: '🛗',
      text: [
        '蛍光灯が一本、切れかけて点滅している。机が二十、そのうち十九に埃がない。',
        '一つだけ、埃が積もっている机がある。名札は外されているが、跡は残っている。',
        'エレベーターの階数表示に 37 はない。だが階数ボタンの並びには、不自然な隙間がある。',
      ],
      choices: [
        {
          text: 'ミハイルの机を調べる',
          once: true,
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: [
                '引き出しの底が二重になっていた。中に手書きのメモ。',
                '「37階の廃棄記録。数が合わない。搬入された分より、出ていく分が少ない」',
                '「ケスラー主任に報告した。“気にするな”と言われた。三度目だ」',
              ],
              effects: [{ setFlag: 'knowsTruth' }, { setFlag: 'knowsKessler' }],
              to: 'floor12b',
            },
            fail: { text: ['引き出しは空だった。鍵穴に真新しい傷がある。'], to: 'floor12b' },
          },
        },
        {
          text: '残業している社員に話しかける',
          once: true,
          check: {
            skill: 'insight', dc: 13,
            success: {
              text: [
                '女性社員はモニタから目を離さずに答えた。「ミハイルさん？ 異動されましたよ」',
                'その手が、キーボードの上で止まっている。何も打っていない。',
                '「……37階の話は、しないほうがいいです。あそこに行った人は、戻ってこないので」',
                '小声で付け足す。「ケスラー主任が権限を持ってます。今夜も上にいます」',
              ],
              effects: [{ setFlag: 'knowsKessler' }, { setFlag: 'knowsFloor' }, { var: 'cred', add: 1 }],
              to: 'floor12b',
            },
            fail: {
              text: ['「知りません」——それだけ言って、彼女は席を立った。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'floor12b',
            },
          },
        },
        { text: '37階を目指す', to: 'ascent' },
      ],
    },

    floor12b: {
      id: 'floor12b', title: '第12階層', art: '🛗',
      text: ['点滅していた蛍光灯が、ついに消えた。'],
      choices: [
        { text: 'もう少し調べる', to: 'floor12' },
        { text: '37階を目指す', to: 'ascent' },
      ],
    },

    ascent: {
      id: 'ascent', title: '上へ', art: '🔺',
      text: [
        'エレベーターは36階までしか止まらない。そこから先は保守用の梯子だ。',
        '梯子の途中、37階の高さに扉がある。管理者権限がなければ開かない扉。',
      ],
      choices: [
        {
          text: '扉の錠を電子的にこじ開ける',
          check: {
            skill: 'netops', dc: 15,
            advantageIf: { flag: 'gotFiles' },
            success: {
              text: ['認証ログに偽の記録を差し込んだ。扉は、正規の手続きで開いたことになった。'],
              to: 'floor37',
            },
            fail: {
              text: ['三度目の失敗で、扉の脇のランプが赤くなった。'],
              effects: [{ var: 'heat', add: 2 }],
              to: 'ascentSpotted',
            },
          },
        },
        {
          text: '力ずくで抉じ開ける',
          check: {
            skill: 'athletics', dc: 14,
            success: {
              text: ['蝶番が悲鳴を上げ、扉は内側へ倒れた。静かにやる方法ではなかった。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'floor37',
            },
            fail: { text: ['扉はびくともしない。かわりに、下の階で足音が増えた。'], to: 'ascentSpotted' },
          },
        },
        {
          text: 'ケスラー主任を待ち伏せて権限を奪う',
          requires: { flag: 'knowsKessler' },
          lockedText: '誰が鍵を持っているのか知らない',
          effects: [{ setFlag: 'ambushKessler' }],
          to: 'floor37',
        },
      ],
    },

    ascentSpotted: {
      id: 'ascentSpotted', title: '梯子の途中', art: '🚨',
      text: ['下から光が上がってくる。懐中電灯ではない。銃につけるタイプの光だ。'],
      combat: {
        title: '保守区画の警備',
        enemies: ['corpTrooper', 'secGuard'],
        onVictory: {
          text: ['一人の腰から、赤いカードキーを外した。37階、と印字されている。'],
          effects: [{ var: 'heat', add: 1 }],
          to: 'floor37',
        },
        onDefeat: { to: 'endCaptured' },
        onFlee: { to: 'endFled' },
      },
    },

    /* ---------------------------------------------------- 第37階層 */

    floor37: {
      id: 'floor37', title: '第37階層', art: '🧊',
      text: [
        '寒い。息が白い。廊下の両側に、扉のない部屋が並んでいる。',
        '部屋の中には、透明な保管槽。中は液体で満たされ、人が浮いている。',
        '槽の側面に番号と日付。日付は全部、同じ日だ。',
        '奥から二つ目の槽の前で、足が止まった。名札に「M. ヴァレン」とある。',
        '——胸が、ゆっくり動いている。',
      ],
      onEnter: [{ setFlag: 'knowsTruth' }, { setFlag: 'foundMikhail' }],
      choices: [
        {
          text: '槽を開ける方法を探す',
          check: {
            skill: 'tech', dc: 13,
            success: {
              text: [
                '制御盤は生きている。排水と覚醒の手順は、思ったより単純だった。',
                'ただし、開ければ警報が鳴る。それも単純な話だ。',
              ],
              effects: [{ setFlag: 'canRelease' }],
              to: 'kesslerArrives',
            },
            fail: { text: ['制御は上位からロックされている。ここでは開けられない。'], to: 'kesslerArrives' },
          },
        },
        {
          text: '記録を撮って、まず出る',
          effects: [{ giveItem: 'evidence' }, { setFlag: 'gotFiles' }],
          to: 'kesslerArrives',
        },
        {
          text: '他の槽の名前を全部読む',
          check: {
            skill: 'datalore', dc: 12,
            success: {
              text: [
                '三十一人。全員が保守部か清掃部。全員が「気づいた側」の人間だ。',
                '生かしてある理由は、記録の最後の欄に書いてあった。「素体状態良好・再利用可」',
              ],
              effects: [{ giveItem: 'evidence' }, { setFlag: 'gotFiles' }, { setFlag: 'knowsWhy' }],
              to: 'kesslerArrives',
            },
            fail: { text: ['数が多すぎる。読んでいる時間はない。'], to: 'kesslerArrives' },
          },
        },
      ],
    },

    kesslerArrives: {
      id: 'kesslerArrives', title: '足音', art: '👞',
      text: [
        '廊下の端に、人影。スーツ。手には何も持っていない。',
        '「困りますね」——疲れた声だった。「ここは見学の場所ではない」',
        'ケスラー主任。ミハイルが三度報告し、三度“気にするな”と言われた相手だ。',
      ],
      choices: [
        {
          text: '「三十一人だ。あんたは何度これを見た」と問い詰める',
          check: {
            skill: 'intimidation', dc: 14,
            advantageIf: { flag: 'knowsWhy' },
            success: {
              text: [
                '男の肩が落ちた。ほんの少しだけ。',
                '「……三十一回です。数えていますよ。私だけが数えている」',
                '「上には報告しました。四度。四度目で、私の名前が候補に入りました」',
                '彼は義手を上げた。震えている。「だから、あなた方を通すわけにはいかない」',
              ],
              effects: [{ setFlag: 'kesslerBroken' }],
              to: 'kesslerChoice',
            },
            fail: {
              text: ['「感情論ですね」男は静かに言った。「私は手続きの話をしています」'],
              to: 'kesslerFight',
            },
          },
        },
        {
          text: '「一緒に出よう。証言してくれ」と持ちかける',
          requires: { any: [{ flag: 'gotFiles' }, { flag: 'knowsWhy' }] },
          lockedText: '交渉の材料がない',
          check: {
            skill: 'persuasion', dc: 15,
            advantageIf: { var: 'cred', gte: 2 },
            success: {
              text: [
                '長い沈黙。空調の音だけが続く。',
                '「……私の家族も、この会社の住宅にいます」',
                '「それでも、ですか」——彼は自分に訊いていた。',
                'ケスラーは端末を差し出した。管理者権限。「三分あります。それ以上は無理だ」',
              ],
              effects: [{ setFlag: 'kesslerAlly' }, { setFlag: 'canRelease' }],
              to: 'release',
            },
            fail: {
              text: ['「二十年勤めました」男は拳銃を抜いた。「今さら、どこへも行けない」'],
              to: 'kesslerFight',
            },
          },
        },
        { text: '問答無用で撃つ', to: 'kesslerFight' },
      ],
    },

    kesslerChoice: {
      id: 'kesslerChoice', title: '震える義手', art: '🦾',
      text: ['彼は撃たない。撃てないのだ。だが道は塞いだままだ。'],
      choices: [
        {
          text: '「なら数えるのをやめろ」と手を差し出す',
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: ['ケスラーは端末を床に置いて、後ろへ下がった。「……三分です」'],
              effects: [{ setFlag: 'kesslerAlly' }, { setFlag: 'canRelease' }],
              to: 'release',
            },
            fail: { text: ['手は取られなかった。かわりに、非常ボタンが押された。'], to: 'kesslerFight' },
          },
        },
        { text: '押し通る', to: 'kesslerFight' },
      ],
    },

    kesslerFight: {
      id: 'kesslerFight', title: '第37階層の戦闘', art: '⚔️',
      text: ['保管槽の青い光の中で、影が二つに割れた。'],
      combat: {
        title: 'ケスラー主任',
        enemies: ['kessler', 'corpTrooper'],
        onVictory: {
          text: [
            'ケスラーは槽にもたれて座り込んだ。手に握っていたのは端末だけだった。',
            '「……数えるのを、やめたかった」',
          ],
          effects: [{ setFlag: 'canRelease' }, { var: 'heat', add: 2 }],
          to: 'release',
        },
        onDefeat: { to: 'endCaptured' },
        onFlee: { to: 'endFled' },
      },
    },

    release: {
      id: 'release', title: '排水', art: '💧',
      text: [
        '制御盤の手順は単純だった。排水、加温、覚醒。三分。',
        '槽の液体が抜けていく。ミハイルの体が、ゆっくりと床に降りる。',
        'まぶたが動いた。',
      ],
      choices: [
        {
          text: 'ミハイルだけを連れて出る',
          to: 'escape',
        },
        {
          text: '三十一人全員の槽を開ける',
          requires: { flag: 'canRelease' },
          lockedText: '全部を開ける権限がない',
          effects: [{ setFlag: 'freedAll' }, { var: 'heat', add: 2 }],
          to: 'escape',
        },
        {
          text: '証拠だけ持って、静かに引き上げる',
          requires: { flag: 'gotFiles' },
          lockedText: '持ち出せる証拠がない',
          effects: [{ setFlag: 'leftThem' }],
          to: 'escape',
        },
      ],
    },

    escape: {
      id: 'escape', title: '降下', art: '🪜',
      text: [
        '非常階段は三十七階ぶんある。下から足音が上がってくる。',
        '窓の外は雨。地上の光が、下のほうでにじんでいる。',
      ],
      choices: [
        {
          text: '階段を駆け下りる',
          check: {
            skill: 'athletics', dc: 12,
            success: { text: ['途中の階で通用口に折れた。誰ともすれ違わなかった。'], to: 'aftermath' },
            fail: {
              text: ['十二階の踊り場で、正面から鉢合わせた。'],
              to: 'escapeFight',
            },
          },
        },
        {
          text: 'ワイヤーで外壁を降りる',
          requires: { any: [{ has: 'ropegun' }, { skillIn: ['acrobatics'] }] },
          lockedText: '外壁を降りる手段がない',
          check: {
            skill: 'acrobatics', dc: 13,
            success: { text: ['雨の中、外壁を三十階ぶん滑り降りた。誰も上を見ていなかった。'], to: 'aftermath' },
            fail: { text: ['途中でワイヤーが引っかかり、五階ぶん落ちた。'], effects: [{ damage: '2d6', target: 'active', type: '打撃' }], to: 'aftermath' },
          },
        },
        {
          text: '掃除屋が来る前に急ぐ',
          if: { var: 'heat', gte: 3 },
          to: 'escapeFight',
        },
      ],
    },

    escapeFight: {
      id: 'escapeFight', title: '踊り場', art: '⚔️',
      text: ['光学迷彩の輪郭が、雨に濡れた窓の反射でだけ見えた。掃除屋だ。'],
      combat: {
        title: '掃除屋',
        enemies: ['cleaner'],
        onVictory: {
          text: ['迷彩が切れ、ただのスーツの人間が倒れていた。名札はない。'],
          to: 'aftermath',
        },
        onDefeat: { to: 'endCaptured' },
        onFlee: { text: ['非常口から転がり出た。追ってはこなかった——追う必要がないからだ。'], to: 'aftermath' },
      },
    },

    /* ---------------------------------------------------------- 結末 */

    aftermath: {
      id: 'aftermath', title: '地上', art: '🌧️',
      text: [
        '雨はまだ降っている。タワーの上のほうは、あいかわらず雲の上だ。',
        'バーの前で、依頼人が傘も差さずに立っていた。',
      ],
      choices: [
        {
          text: '弟を引き渡し、記録も渡す',
          requires: { all: [{ flag: 'foundMikhail' }, { flag: 'gotFiles' }] },
          lockedText: '両方は揃っていない',
          to: 'endBest',
        },
        {
          text: '弟を引き渡す',
          requires: { flag: 'foundMikhail' },
          lockedText: '連れ出せなかった',
          to: 'endGood',
        },
        {
          text: '記録だけを渡し、事実を話す',
          requires: { flag: 'gotFiles' },
          lockedText: '渡せるものがない',
          to: 'endCold',
        },
        { text: '何も持たずに、事実だけを伝える', to: 'endEmpty' },
      ],
    },

    endBest: {
      id: 'endBest', title: '領収書', art: '📄',
      text: [
        '男は弟を抱きしめなかった。ただ、肩に手を置いて、そのまま長いこと動かなかった。',
        '記録は三日後、匿名で七つの媒体に届いた。六つは黙殺した。一つが載せた。',
        'ゲンテックの株価は 2% 下がって、翌週には戻った。',
        'だが第37階層は空になった。それは戻らなかった。',
      ],
      ending: {
        type: 'good',
        title: '2%',
        text: [
          '報酬は満額支払われた。領収書はもらわなかった。',
          '{party} の名前は、この街でしばらく通るようになる。良い意味でも、そうでない意味でも。',
        ],
      },
    },

    endGood: {
      id: 'endGood', title: '弟', art: '🌃',
      text: [
        '男は弟を連れて、その夜のうちに街を出た。行き先は聞かなかった。',
        '記録は残らなかった。三十人は、まだあの階にいる。',
      ],
      ending: {
        type: 'neutral',
        title: '一人',
        text: ['一人は助かった。その事実は、他の三十人を助けなかった事実と、同じ重さで残る。'],
      },
    },

    endCold: {
      id: 'endCold', title: '記録', art: '📄',
      text: [
        '「弟は」と男は訊いた。答える前に、答えが伝わってしまった。',
        '記録は渡した。男は受け取り、金も払った。それから何も言わずに雨の中へ歩いていった。',
      ],
      ending: {
        type: 'neutral',
        title: '数えられる側',
        text: ['三十一という数字は、三十二になるかもしれない。誰かがまた数えはじめる。'],
      },
    },

    endEmpty: {
      id: 'endEmpty', title: '手ぶら', art: '🌧️',
      text: ['話は信じてもらえた。それだけだった。前金は返さなくてよかった。'],
      ending: {
        type: 'bad',
        title: '雨は止まない',
        text: ['翌週、依頼人の家の前から車が消えた。依頼人も消えた。'],
      },
    },

    endCaptured: {
      id: 'endCaptured', title: '意識が戻る', art: '🧊',
      text: [
        '寒い。息が白い。',
        '目の前は透明な壁で、その向こうに廊下が見える。',
        '壁の側面に、番号と日付が印字されていく音がする。',
      ],
      ending: {
        type: 'bad',
        title: '三十二人目',
        text: ['ゲンテック・タワー第37階層。素体状態良好・再利用可。'],
      },
    },

    endFled: {
      id: 'endFled', title: '逃走', art: '🏃',
      text: ['非常階段を三十七階ぶん降りて、雨の中に転がり出た。振り返らなかった。'],
      ending: {
        type: 'bad',
        title: '受け取らなかった仕事',
        text: ['前金は返した。依頼人からの連絡は、それきり途絶えた。'],
      },
    },
  },
};

export default rainCheck;
