/* シナリオ「硝子の果樹園」— ネオンの雨・調査もの（30〜45分）。

   企業の垂直農場で、三ヶ月に四人。労働者だけが死んでいる。
   構成:
     依頼 → 温室ハブ（上層／地下／宿舎／事務所／接続）→ 結論を出す
   var:evidence が集めた証拠の数、var:heat が向こうに気づかれた度合い。
   heat が 3 を超えると清掃班が動き、5 で温室から追い出される。 */

export const glassOrchard = {
  id: 'glass-orchard',
  title: '硝子の果樹園',
  author: '灯火のテーブル',
  world: 'neon',
  blurb: '雨の降らない硝子の中で、三ヶ月に四人が死んだ。全員、下の階で働く人間だった。',
  level: 2,
  length: '中編（30〜45分）',
  start: 'brief',
  vars: { evidence: 0, heat: 0, fee: 250 },

  items: {
    maintTag: { id: 'maintTag', name: '保守作業タグ', desc: '首から下げていれば、誰も顔を見ない。' },
    sample: { id: 'sample', name: '培地のサンプル', desc: '透明な小瓶。振ると、底のほうだけが少し遅れて動く。' },
    sprayLog: { id: 'sprayLog', name: '散布記録の写し', desc: '夜間散布の時刻表。人がいる時間帯に線が引いてある。' },
    roster: { id: 'roster', name: '欠勤者名簿', desc: '四人の死者と、まだ生きている三人の名前。' },
    respirator: { id: 'respirator', name: '整備用の防塵マスク', desc: '本来は塗装用。それでも、何もないよりはいい。' },
  },

  monsters: {
    sprayDrone: {
      name: '散布ドローン', kind: '構造体', cr: 1, xp: 200,
      acOverride: 14, hp: '4d8+6', hpAvg: 24, speed: 12,
      abilities: { str: 12, dex: 14, con: 14, int: 3, wis: 10, cha: 1 },
      attacks: [{ name: '高圧ノズル', bonus: 4, damage: '1d8+2', type: '酸', ranged: true }],
      tactics: 'skirmish',
      traits: [{ id: 'justMachine', text: '作業機械：命令されて飛んでいるだけで、悪意はない' }],
      blurb: '農薬を撒くために作られた。撒くものが変わっても、飛び方は変わらない。',
    },
    foreman: {
      name: '第9温室の職長', kind: '人型', cr: 1, xp: 200,
      acOverride: 14, hp: '5d8+5', hpAvg: 27, speed: 9,
      abilities: { str: 14, dex: 12, con: 13, int: 11, wis: 12, cha: 13 },
      attacks: [{ name: '剪定鋏', bonus: 4, damage: '1d8+2', type: '斬撃' }],
      tactics: 'brute',
      traits: [{ id: 'standDown', text: '板挟み：HPが半分を切ると降参する' }],
      blurb: '十九年ここにいる。四人の葬式にも全部出た。それでも辞めない。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 依頼 */

    brief: {
      id: 'brief', title: '労組の詰め所', art: '🌱',
      text: [
        '雨漏りのする事務所に、女が四枚の写真を並べた。',
        '「三ヶ月で四人です。全員、第9温室の下層作業員。全員、死因は肺の疾患」',
        '「会社は“喫煙と居住環境”と言っています。この街では、それで通ってしまう」',
        '「証拠が要ります。数字でも、物でも、証言でも。何でもいい」',
      ],
      choices: [
        {
          text: '報酬の話をする',
          once: true,
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: ['「……€$400。組合の積立てを崩します。これ以上は本当にありません」'],
              effects: [{ setFlag: 'goodPay' }, { var: 'fee', set: 400 }],
              to: 'briefAfter',
            },
            fail: { text: ['「€$250。それが全部です」——嘘をついている顔ではなかった。'], to: 'briefAfter' },
          },
        },
        {
          text: '四人の共通点を聞く',
          once: true,
          check: {
            skill: 'investigation', dc: 11,
            success: {
              text: [
                '「四人とも夜勤でした。第9温室の夜勤は、下層の培養槽の見回りです」',
                '「昼勤の人は誰も死んでいません。同じ建物の、同じ空気を吸っているのに」',
              ],
              effects: [{ setFlag: 'knowsNight' }, { giveItem: 'roster' }],
              to: 'briefAfter',
            },
            fail: { text: ['「共通点なんて、貧乏なことくらいです」——それも一つの答えだった。'], to: 'briefAfter' },
          },
        },
        {
          text: '中に入る手段をもらう',
          once: true,
          effects: [{ giveItem: 'maintTag' }],
          to: 'briefAfter',
        },
        { text: 'すぐ第9温室へ向かう', to: 'gate' },
      ],
    },

    briefAfter: {
      id: 'briefAfter', title: '詰め所', art: '🌱',
      text: ['女は写真を伏せた。「行ってください。まだ夜勤の名簿に、三人残っています」'],
      choices: [
        { text: 'もう少し話を聞く', to: 'brief' },
        { text: '第9温室へ向かう', to: 'gate' },
      ],
    },

    /* ------------------------------------------------------ 入り口 */

    gate: {
      id: 'gate', title: 'メリディアン農政・第9温室', art: '🏭',
      text: [
        '三十階建ての硝子の塔。中では雨が降らず、季節もなく、灯りが二十四時間ついている。',
        '塔の下四層が作業区。人間がいるのはそこだけで、上は全部、機械と植物のものだ。',
        '通用口に警備が一人。退屈そうにしている。',
      ],
      choices: [
        {
          text: '保守作業タグを見せて通る',
          requires: { has: 'maintTag' },
          lockedText: '見せられる身分証がない',
          effects: [{ setFlag: 'cleanEntry' }],
          to: 'hub',
        },
        {
          text: '農政局の視察を名乗る',
          check: {
            skill: 'corpo', dc: 13,
            success: {
              text: ['肩書きを正しい順序で言った。警備は名簿を確認するふりをして、通した。'],
              effects: [{ setFlag: 'cleanEntry' }],
              to: 'hub',
            },
            fail: {
              text: ['「視察の予定は入っていませんが」——押し切ったが、記録は残った。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'hub',
            },
          },
        },
        {
          text: '搬出口から入る',
          check: {
            skill: 'stealth', dc: 12,
            success: { text: ['コンテナの陰を伝って、荷捌き場の奥へ滑り込んだ。'], to: 'hub' },
            fail: {
              text: ['センサーが一度鳴って、止まった。誤作動として処理されただろう。たぶん。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'hub',
            },
          },
        },
      ],
    },

    /* ---------------------------------------------------------- ハブ */

    hub: {
      id: 'hub', title: '第9温室・中央通路', art: '🌿',
      text: [
        '硝子越しに、どこまでも同じ緑が続いている。空気は湿っていて、甘い。',
        '通路の案内板は四つの方向を指している——上層の作業デッキ、地下の培養槽、作業員宿舎、管理事務所。',
        '壁際には保守用の接続端子もある。',
        '（調べるほど証拠は増えるが、動くたびに向こうも気づきはじめる）',
      ],
      choices: [
        { text: '上層の作業デッキへ', to: 'canopy' },
        { text: '地下の培養槽へ', to: 'roots' },
        { text: '作業員宿舎へ', to: 'bunks' },
        { text: '管理事務所へ', to: 'office' },
        { text: '端子から内部網に潜る', to: 'deckEntry' },
        { text: '調べるのをやめて、結論を出す', to: 'verdict' },
      ],
    },

    /* 引き上げる判断は hub にしか置かない。ここで毎回「やめる」を選べると、
       一度か二度調べただけで結末に着いてしまう。 */
    hubBack: {
      id: 'hubBack', title: '中央通路', art: '🌿',
      text: ['通路に戻る。硝子の向こうで、散水が始まった。'],
      onEnter: [
        { if: { var: 'heat', gte: 4 }, log: '館内放送が一度、意味のない案内を流した。呼び出しの符丁だ。', kind: 'bad' },
      ],
      choices: [
        { text: '中央の案内板まで戻る', if: { var: 'heat', lte: 4 }, to: 'hub' },
        { text: '（見つかった）通路の先から足音', if: { var: 'heat', gte: 5 }, to: 'sweep' },
      ],
    },

    /* -------------------------------------------------------- 上層 */

    canopy: {
      id: 'canopy', title: '上層・作業デッキ', art: '🪜',
      text: [
        '人の背丈の三倍ある棚が、天井まで積み上がっている。実がついているのは上のほうだけだ。',
        '天井近くを、丸い機械が音もなく行き来している。散布ドローンだ。',
      ],
      choices: [
        {
          text: 'ドローンの散布ノズルを調べる',
          once: true,
          effects: [{ var: 'heat', add: 1 }],
          check: {
            skill: 'tech', dc: 13,
            success: {
              text: [
                'ノズルの内側に、白い結晶が薄く固着している。農薬ではこうならない。',
                'タンクの銘板には型番だけ。中身の名前はどこにも書かれていない。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawNozzle' }],
              to: 'hubBack',
            },
            fail: {
              text: ['手を伸ばした瞬間、ドローンが高度を上げた。回避行動だ。誰かが見ている。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'hubBack',
            },
          },
        },
        {
          text: '棚のいちばん上まで登って葉を見る',
          once: true,
          check: {
            skill: 'athletics', dc: 12,
            success: {
              text: [
                '上層の葉は健康そのものだ。下に降りるほど、葉の縁が茶色く焼けている。',
                '重いものが、上から下へ落ちて溜まっている。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawLeaves' }],
              to: 'hubBack',
            },
            fail: {
              text: ['足場が鳴った。三メートル落ちて、腰を打った。'],
              effects: [{ damage: '1d6' }],
              to: 'hubBack',
            },
          },
        },
        {
          text: '整備棚から防塵マスクをくすねる',
          once: true,
          effects: [{ giveItem: 'respirator' }],
          to: 'hubBack',
        },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    /* -------------------------------------------------------- 地下 */

    roots: {
      id: 'roots', title: '地下・培養槽', art: '🧫',
      text: [
        '天井の低い、暖かい部屋。円い槽が二十基。表面をゆっくり泡が上がってくる。',
        '空気が甘い。上の階の甘さとは、少し種類が違う。',
        '夜勤の四人が毎晩、ここを見回っていた。',
      ],
      onEnter: [
        {
          if: { not: { has: 'respirator' } },
          log: 'マスクがない。喉の奥が、金属の味になる。',
          kind: 'bad',
        },
      ],
      choices: [
        {
          text: '培地を採取する',
          once: true,
          effects: [{ var: 'heat', add: 1 }],
          check: {
            skill: 'trauma', dc: 12,
            success: {
              text: [
                '小瓶に汲んだ。透明に見えるが、光に透かすと細かいものが無数に漂っている。',
                '培地というより、何かを溶かした水だ。',
              ],
              effects: [{ giveItem: 'sample' }, { var: 'evidence', add: 1 }],
              to: 'rootsAfter',
            },
            fail: {
              text: ['手を入れた瞬間、皮膚がひりついた。慌てて洗ったが、赤くなったままだ。'],
              effects: [{ damage: '1d4' }],
              to: 'rootsAfter',
            },
          },
        },
        {
          text: '換気系を調べる',
          once: true,
          check: {
            skill: 'investigation', dc: 13,
            success: {
              text: [
                '排気ダクトが二本。片方は屋上へ。もう片方は——四層の宿舎の給気に繋がっている。',
                '設計図ではそうなっていない。後から、誰かが繋いだ。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawDuct' }],
              to: 'rootsAfter',
            },
            fail: { text: ['配管が多すぎる。どれがどこへ行くのか追いきれない。'], to: 'rootsAfter' },
          },
        },
        {
          text: '槽の底に沈んでいるものを見る',
          once: true,
          effects: [{ var: 'heat', add: 1 }],
          check: {
            skill: 'perception', dc: 14,
            success: {
              text: [
                '底に、白い層が厚く積もっている。ノズルの結晶と同じものだ。',
                '沈殿するほど撒いている。植物のためではありえない量を。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawSediment' }],
              to: 'rootsAfter',
            },
            fail: { text: ['泡と照明で、底までは見えない。'], to: 'rootsAfter' },
          },
        },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    rootsAfter: {
      id: 'rootsAfter', title: '培養槽', art: '🧫',
      text: ['泡の音だけがしている。ここに毎晩、四人が立っていた。'],
      choices: [
        { text: 'まだ調べる', to: 'roots' },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    /* -------------------------------------------------------- 宿舎 */

    bunks: {
      id: 'bunks', title: '四層・作業員宿舎', art: '🛏️',
      text: [
        '二段寝台が壁一面に並んでいる。昼勤が寝ている時間で、いびきと咳が同じくらい聞こえる。',
        '咳のほうが多い。',
      ],
      choices: [
        {
          text: '夜勤の生き残りに話を聞く',
          once: true,
          check: {
            skill: 'persuasion', dc: 13,
            advantageIf: { has: 'roster' },
            success: {
              text: [
                '若い男が、寝台の上で膝を抱えたまま話した。',
                '「夜中の二時に、下で音がするんです。シャワーみたいな音。あれが始まると、朝まで喉が痛い」',
                '「言いました。職長にも、会社にも。“気のせいだ”って」',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'hasWitness' }],
              to: 'bunksAfter',
            },
            fail: {
              text: ['男は首を振り続けた。「辞めさせられたら、どこにも行くところがないんです」'],
              to: 'bunksAfter',
            },
          },
        },
        {
          text: '死んだ四人の私物を見せてもらう',
          once: true,
          check: {
            skill: 'insight', dc: 12,
            success: {
              text: [
                '段ボール一箱。作業服、写真、そして四人とも同じ市販の咳止めを買っていた。',
                'レシートの日付は、四人ばらばらに、しかし同じ「入社から七ヶ月目」に集中している。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawSeven' }],
              to: 'bunksAfter',
            },
            fail: { text: ['箱の中身はもう遺族に送られていた。残っていたのは作業靴だけだ。'], to: 'bunksAfter' },
          },
        },
        {
          text: '職長を探す',
          once: true,
          to: 'foremanTalk',
        },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    bunksAfter: {
      id: 'bunksAfter', title: '宿舎', art: '🛏️',
      text: ['誰かが寝返りを打って、また咳をした。'],
      choices: [
        { text: 'まだ聞き込む', to: 'bunks' },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    foremanTalk: {
      id: 'foremanTalk', title: '職長', art: '👷',
      text: [
        '通路の端に、剪定鋏を持った大柄な男。十九年ここにいる、と自分から言った。',
        '「四人の葬式には全部出たよ。花も出した。会社の金じゃなくて、俺の金でな」',
        '「それで、あんたは何を持って帰るつもりだ」',
      ],
      choices: [
        {
          text: '「あなたも知っているはずだ」と迫る',
          check: {
            skill: 'insight', dc: 13,
            success: {
              text: [
                '男は長いこと黙って、それから鋏を下ろした。',
                '「夜間散布の時刻表だ。人がいる時間に撒いてる。俺が三回、書き換えを命令された」',
                '「言っておくが、俺は辞めん。辞めたら次の職長が同じことをやるだけだ」',
              ],
              effects: [{ giveItem: 'sprayLog' }, { var: 'evidence', add: 1 }, { setFlag: 'foremanTalked' }],
              to: 'bunksAfter',
            },
            fail: {
              text: ['「知らんね」——男の手が、鋏を握り直した。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'foremanEdge',
            },
          },
        },
        {
          text: '金を渡す',
          effects: [{ gold: -150 }],
          check: {
            skill: 'streetwise', dc: 12,
            success: {
              text: ['札は受け取られた。「時刻表だ。俺から聞いたとは言うな。娘がいる」'],
              effects: [{ giveItem: 'sprayLog' }, { var: 'evidence', add: 1 }],
              to: 'bunksAfter',
            },
            fail: { text: ['男は札を見て、笑わなかった。「安いな、命が」'], to: 'foremanEdge' },
          },
        },
        { text: '何も言わずに離れる', to: 'bunksAfter' },
      ],
    },

    foremanEdge: {
      id: 'foremanEdge', title: '通路の端', art: '👷',
      text: ['鋏の刃が、一度だけ開いて閉じた。'],
      choices: [
        {
          text: '「四人だ」ともう一度言う',
          check: {
            skill: 'intimidation', dc: 13,
            success: {
              text: ['「……四人だ」男は繰り返した。それから時刻表の写しを、床に落とすように渡した。'],
              effects: [{ giveItem: 'sprayLog' }, { var: 'evidence', add: 1 }],
              to: 'bunksAfter',
            },
            fail: { text: ['「出ていけ」'], to: 'foremanFight' },
          },
        },
        { text: '引き下がる', to: 'bunksAfter' },
      ],
    },

    foremanFight: {
      id: 'foremanFight', title: '通路の端の諍い', art: '⚔️',
      text: ['男は自分でも止められなくなっている。十九年ぶんの何かが、鋏を握らせている。'],
      combat: {
        title: '第9温室の職長',
        enemies: ['foreman'],
        onVictory: {
          text: [
            '男は膝をついて、そのまま動かなくなった。息はある。',
            '作業服の胸ポケットから、折り畳んだ時刻表が出てきた。ずっと持ち歩いていたのだ。',
          ],
          effects: [{ giveItem: 'sprayLog' }, { var: 'evidence', add: 1 }, { var: 'heat', add: 1 }],
          to: 'hubBack',
        },
        onDefeat: { text: ['気がつくと、通用口の外の雨の中に転がされていた。'], to: 'endThrown' },
        onFlee: { text: ['通路を走って、中央まで戻った。'], effects: [{ var: 'heat', add: 1 }], to: 'hubBack' },
      },
    },

    /* ------------------------------------------------------ 事務所 */

    office: {
      id: 'office', title: '管理事務所', art: '🗄️',
      text: [
        '事務机が四つ。誰もいない。壁の掲示板に「安全操業 412日」と書かれた紙が貼ってある。',
        '数え直したのは、四人目が死んだ日だろう。',
      ],
      choices: [
        {
          text: '書類棚を漁る',
          once: true,
          effects: [{ var: 'heat', add: 1 }],
          check: {
            skill: 'investigation', dc: 12,
            success: {
              text: [
                '安全報告書の下に、別の綴りがあった。表題は「収量改善試験・第9温室」。',
                '試験開始は十四ヶ月前。散布量が三段階で増えている。四人目が死んだ月に、また増えていた。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawTrial' }],
              to: 'officeAfter',
            },
            fail: { text: ['棚の鍵は本物だった。こじ開ければ音がする。'], to: 'officeAfter' },
          },
        },
        {
          text: '端末に残ったセッションを使う',
          once: true,
          effects: [{ var: 'heat', add: 1 }],
          check: {
            skill: 'netops', dc: 13,
            success: {
              text: [
                '誰かがログアウトし忘れている。開けたのは購買記録だった。',
                '同じ薬品の発注が、月ごとに増えている。承認者は全部、本社の同じ名前だ。',
              ],
              effects: [{ var: 'evidence', add: 1 }, { setFlag: 'knowsApprover' }],
              to: 'officeAfter',
            },
            fail: {
              text: ['セッションは切れていた。ログイン失敗が三回、記録に残った。'],
              effects: [{ var: 'heat', add: 1 }],
              to: 'officeAfter',
            },
          },
        },
        {
          text: '掲示板の裏を見る',
          once: true,
          check: {
            skill: 'perception', dc: 11,
            success: {
              text: ['「安全操業」の紙の下に、剥がし忘れた古い紙。日数が四回、書き直されている。'],
              effects: [{ setFlag: 'sawBoard' }],
              to: 'officeAfter',
            },
            fail: { text: ['紙は一枚しかなかった。'], to: 'officeAfter' },
          },
        },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    officeAfter: {
      id: 'officeAfter', title: '事務所', art: '🗄️',
      text: ['空調が唸っている。この部屋の空気だけが、乾いていて、冷たい。'],
      choices: [
        { text: 'まだ漁る', to: 'office' },
        { text: '通路に戻る', to: 'hubBack' },
      ],
    },

    /* ------------------------------------------------------ 接続 */

    deckEntry: {
      id: 'deckEntry', title: '保守端子', art: '🕸️',
      text: [
        '通路の壁に、保守用のポートがむき出しで並んでいる。農業設備は防御が薄い。',
        'デッキを開く。壁は二枚。その奥に、散布制御がある。',
      ],
      netrun: {
        title: '第9温室 設備網',
        traceMax: 6,
        layers: [
          {
            name: '設備管理層', skill: 'netops', dc: 12,
            text: ['温度と湿度の数字が延々と流れている。農場の網は、農場のことしか考えていない。'],
            onFail: { damage: '1d4', text: ['弾かれた。こめかみが痛む。'] },
          },
          {
            name: '散布制御', skill: 'tech', dc: 14,
            text: ['夜間散布の設定。処方名は伏せ字だが、量と時刻は生の数字で残っている。'],
            onFail: { damage: '1d6', text: ['防壁が噛みついてきた。'] },
            effects: [{ var: 'evidence', add: 2 }, { setFlag: 'gotSprayData' }],
          },
        ],
        ice: ['ice'],
        onSuccess: {
          text: [
            '設定表を丸ごと吸い出した。散布は毎晩 02:00。夜勤の見回りと、分単位で重なっている。',
            '偶然ではありえない。人がいる時間を選んで撒いている——そのほうが、葉に長く留まるからだ。',
          ],
          to: 'hubBack',
        },
        onTraced: {
          text: ['接続が切られた。天井のスピーカーが、意味のない案内を流しはじめた。'],
          effects: [{ var: 'heat', add: 2 }],
          to: 'hubBack',
        },
      },
    },

    /* -------------------------------------------------------- 清掃班 */

    sweep: {
      id: 'sweep', title: '中央通路・封鎖', art: '🚨',
      text: [
        '硝子の通路の両端で、扉が同時に降りた。',
        '歩いてくるのは制服の警備が二人と、制服でない男が一人。制服でないほうが、たちが悪い。',
      ],
      choices: [
        {
          text: '持っているものを渡して見逃してもらう',
          if: { var: 'evidence', gte: 1 },
          check: {
            skill: 'corpo', dc: 14,
            success: {
              text: [
                '男は差し出したものを一瞥して、頷いた。「賢い。搬出口まで送ろう」',
                '手ぶらになった。だが生きて外に出た。',
              ],
              effects: [{ var: 'evidence', set: 0 }, { setFlag: 'handedOver' }],
              to: 'endBought',
            },
            fail: { text: ['「渡すのは、外に出てからでいい」——男の手が上着の内側に入った。'], to: 'sweepFight' },
          },
        },
        {
          text: '身分証を出して、素直に退去する',
          effects: [
            { var: 'evidence', set: 0 },
            { log: '持ち物は全部、通路の床に並べさせられた。返ってきたのは身分証だけだ。', kind: 'bad' },
          ],
          to: 'endThrown',
        },
        {
          text: '散水系を暴発させて煙に紛れる',
          check: {
            skill: 'tech', dc: 13,
            success: {
              text: ['天井のスプリンクラーが全開になった。視界が白く潰れた三十秒で、搬出口まで走った。'],
              effects: [{ setFlag: 'escaped' }],
              to: 'verdict',
            },
            fail: { text: ['バルブは手動だった。振り返ると、もう距離がない。'], to: 'sweepFight' },
          },
        },
        { text: '押し通る', to: 'sweepFight' },
      ],
    },

    sweepFight: {
      id: 'sweepFight', title: '硝子の通路', art: '⚔️',
      text: ['逃げ場のない一本道で、硝子が三方を囲んでいる。'],
      combat: {
        title: '封鎖班',
        enemies: ['corpTrooper', 'secGuard', 'sprayDrone'],
        onVictory: {
          text: [
            '最後に倒れたドローンが、床でノズルから中身を垂れ流している。',
            '硝子に飛んだそれが、白く曇って固まった。植物にかけるものではない。',
          ],
          effects: [{ var: 'evidence', add: 1 }, { setFlag: 'sawResidue' }],
          to: 'verdict',
        },
        onDefeat: { to: 'endDisposal' },
        onFlee: { text: ['硝子を蹴破って、隣の棟へ転がり込んだ。腕を切った。'], to: 'verdict' },
      },
    },

    /* ---------------------------------------------------------- 結論 */

    verdict: {
      id: 'verdict', title: '外・貨物通用口', art: '🌧️',
      text: [
        '硝子の外は、いつもどおり雨だった。塔の中には季節がなく、外にはこれしかない。',
        '手元にあるものが、これから起きることを全部決める。',
      ],
      choices: [
        {
          text: '労組に全部渡す',
          if: { var: 'evidence', gte: 3 },
          to: 'endUnion',
        },
        {
          text: '記者に流す',
          if: { var: 'evidence', gte: 2 },
          to: 'endPress',
        },
        {
          text: '会社に売る',
          if: { var: 'evidence', gte: 1 },
          to: 'endPayoff',
        },
        {
          text: '足りないものを、足りないまま渡す',
          to: 'endThin',
        },
        {
          text: '何も渡さずに消える',
          to: 'endQuiet',
        },
      ],
    },

    /* ---------------------------------------------------------- 結末 */

    endUnion: {
      id: 'endUnion', title: '証拠の束', art: '📑',
      onEnter: [{ gold: { var: 'fee' } }],
      text: [
        '女は書類と小瓶を、一つずつ確認してから箱にしまった。手が震えていた。',
        '「これで、労働審判が開けます」',
        '会社は争った。四ヶ月かかった。夜間散布は差し止められ、第9温室は操業を止めた。',
      ],
      ending: {
        type: 'good',
        title: '安全操業 0日',
        text: [
          '掲示板の数字はゼロに戻され、そのまま書き直されなくなった。',
          '死んだ四人は戻らない。まだ生きている三人は、咳をしながらまだ働いている。別の温室で。',
          '{party} の名は組合の議事録に一行だけ残った。それが、この街ではいちばん長く残る種類の記録だ。',
        ],
      },
    },

    endPress: {
      id: 'endPress', title: '朝刊の三段', art: '📰',
      onEnter: [{ gold: 300 }],
      text: [
        '記者は写真と数字を見て、たった一つだけ聞いた。「訴えられたとき、あなたは証言台に立ちますか」',
        '立つ、と答えた。',
        '記事は三日後に出た。三段。一面ではない。',
      ],
      ending: {
        type: 'good',
        title: '一度だけ点いた灯り',
        text: [
          '本社は「調査中」と発表し、二週間後に第9温室の責任者を交代させて終わらせた。散布は続いている。',
          'だが記事は残った。次の四人が死んだとき、それは「二度目」と呼ばれる。',
          'この街では、名前がつくことが、いちばん最初の変化だ。',
        ],
      },
    },

    endPayoff: {
      id: 'endPayoff', title: '本社の応接室', art: '💳',
      onEnter: [{ gold: 4000 }],
      text: [
        '応接室は静かで、乾いていて、甘い匂いがしなかった。',
        '相手は書類の束を数えもせず引き取り、金額を提示した。交渉の余地はないという顔で。',
      ],
      ending: {
        type: 'neutral',
        title: '買い取り価格',
        text: [
          '€$4,000。四人ぶんではなく、黙っている期間ぶんの値段だ。下層のひと月が €$400 の街で、十ヶ月ぶん。',
          '第9温室は今日も稼働している。夜勤の名簿には、新しい名前が三つ増えた。',
          '労組の女からの連絡は、しばらくして来なくなった。',
        ],
      },
    },

    endBought: {
      id: 'endBought', title: '搬出口まで', art: '🚚',
      text: [
        '制服でない男は、本当に搬出口まで送ってくれた。雨の中で、傘まで差し出してきた。',
        '「悪く思わないでくれ。俺も雇われだ」',
      ],
      ending: {
        type: 'neutral',
        title: '賢い判断',
        noPay: true,                       // 持っていたものを全部置いてきた
        text: [
          '生きて出た。持っていたものは全部、あの通路に置いてきた。',
          '三日後、労組の詰め所に行くと、鍵がかかっていた。移転の張り紙も出ていなかった。',
        ],
      },
    },

    endThin: {
      id: 'endThin', title: '足りない束', art: '📄',
      onEnter: [{ gold: 100 }],
      text: [
        '女は渡されたものを長いこと見て、それから丁寧に揃えて、机に置いた。',
        '「……ありがとうございます。使えるか、やってみます」',
        '使えないと分かっている顔だった。',
      ],
      ending: {
        type: 'bad',
        title: '疑わしきは',
        text: [
          '審判は開かれなかった。証拠不十分。会社は「根拠のない中傷」として労組に賠償を求め、勝った。',
          '第9温室の夜勤は、今も二時に見回りをしている。',
        ],
      },
    },

    endQuiet: {
      id: 'endQuiet', title: '雨の中', art: '🚶',
      text: ['塔を振り返らずに歩いた。硝子は雨に濡れず、上のほうだけが白く光っていた。'],
      ending: {
        type: 'neutral',
        title: '関わらなかった',
        noPay: true,                       // 受け取る理由がなかった、と本文で言っている
        text: [
          '報酬は受け取らなかった。受け取る理由がなかった。',
          '半年後、同じ温室の話をまた聞いた。今度は六人だった。',
        ],
      },
    },

    endThrown: {
      id: 'endThrown', title: '通用口の外', art: '🌧️',
      text: ['雨。濡れたアスファルト。背中で扉が閉まる音。'],
      ending: {
        type: 'bad',
        title: '出入り禁止',
        text: [
          '顔は記録された。第9温室にはもう二度と入れない。',
          '労組の女は何も言わなかった。責めないことが、いちばんこたえた。',
        ],
      },
    },

    endDisposal: {
      id: 'endDisposal', title: '硝子の床', art: '💀',
      text: ['天井の散水が始まった。血は水で流れる。硝子は、そのために磨かれている。'],
      ending: {
        type: 'bad',
        title: '安全操業 継続中',
        text: [
          '掲示板の数字は、その週も一つずつ増えていった。',
          '第9温室で死んだ人間の数え方に、{party} は含まれない。作業員ではなかったからだ。',
        ],
      },
    },
  },
};

export default glassOrchard;
