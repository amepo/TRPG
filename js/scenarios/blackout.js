/* シナリオ「三分間の停電」— ネオンの雨・強盗もの（30〜45分）。

   毎週火曜、区画の電力が三分だけ落ちる。その三分で金庫室に入り、出る。
   構成:
     下見（3系統）→ 停電開始 → 侵入（3ルート）→ 金庫室 → 脱出
   時間そのものが敵で、var:clock が 9 に達すると三分が終わり、非常電源が戻る。
   下見を丁寧にやるほど、本番で消費する時間が減る。 */

export const blackout = {
  id: 'blackout',
  title: '三分間の停電',
  author: '灯火のテーブル',
  world: 'neon',
  blurb: '毎週火曜の午前二時、第4区画の電力が三分だけ落ちる。その三分で入って、出る。',
  level: 2,
  length: '中編（30〜45分）',
  start: 'plan',
  vars: { clock: 0, prep: 0 },

  items: {
    schematic: { id: 'schematic', name: '配電図の写し', desc: 'どこが落ちて、どこが落ちないかが分かる。' },
    maintKey: { id: 'maintKey', name: '保守用カードキー', desc: '掃除係の落とし物。持ち主はまだ気づいていない。' },
    ledger: { id: 'ledger', name: '紙の台帳', desc: 'この時代に紙。だから電子的には存在しない。' },
    bearer: { id: 'bearer', name: '無記名債券', desc: '持っている人間のもの。それがすべて。' },
  },

  monsters: {
    nightShift: {
      name: '夜勤の警備長', kind: '人型', cr: 1, xp: 200,
      acOverride: 15, hp: '5d8+5', hpAvg: 27, speed: 9,
      abilities: { str: 13, dex: 14, con: 13, int: 11, wis: 14, cha: 11 },
      attacks: [{ name: '支給拳銃', bonus: 4, damage: '1d8+2', type: '実弾', ranged: true }],
      tactics: 'skirmish', backupId: 'secGuard',
      /* 「戦うより通報を選ぶ」と書いてあったが、素の文字列だったので何も
         起きていなかった。書いてある通り、応援を呼ぶようにする。 */
      traits: [{ id: 'callBackup', text: '報告優先：3ラウンド生き残ると応援を1人呼ぶ' }],
      blurb: '定年まであと三年。誰よりも死にたくない側の人間だ。',
    },
  },

  nodes: {

    /* ---------------------------------------------------------- 下見 */

    plan: {
      id: 'plan', title: '向かいの屋上', art: '🔭',
      text: [
        '第4区画・アズマ信託の裏口が見える。雨で光がにじんで、警備の輪郭だけが分かる。',
        '停電は火曜の二時。あと二日ある。',
        '下見でやれることは三つ——配電の確認、内部の人間、そして裏口そのもの。',
        '（下見を重ねるほど、本番で消費する時間が減る）',
      ],
      choices: [
        { text: '配電系統を調べる', to: 'power' },
        { text: '内部の人間に当たる', to: 'insider' },
        { text: '裏口を実際に見に行く', to: 'backdoor' },
        {
          text: '準備は十分だ。火曜の夜へ',
          to: 'tuesday',
        },
      ],
    },

    power: {
      id: 'power', title: '区画変電所', art: '⚡',
      text: ['金網の向こうに古い変電設備。三十年ものだ。停電が毎週起きるのも無理はない。'],
      choices: [
        {
          text: '配電図を抜く',
          once: true,
          check: {
            skill: 'netops', dc: 13,
            success: {
              text: [
                '管理端末は Windows のように古い OS で動いていた。図面はそのまま出てきた。',
                '落ちるのは照明と電子錠。落ちないのは——非常灯と、金庫室の機械錠。',
              ],
              effects: [{ giveItem: 'schematic' }, { setFlag: 'knowsPower' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: { text: ['端末はログを取っていた。触った記録が残ったかもしれない。'], to: 'planAfter' },
          },
        },
        {
          text: '停電の時刻を実測する',
          once: true,
          check: {
            skill: 'tech', dc: 11,
            success: {
              text: ['計測器を仕掛けた。停電は正確に 02:00:00 から 02:03:00。誤差は二秒。'],
              effects: [{ setFlag: 'knowsTiming' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: { text: ['雨で機器が濡れた。時刻はおおよそしか分からない。'], to: 'planAfter' },
          },
        },
        { text: '戻る', to: 'plan' },
      ],
    },

    insider: {
      id: 'insider', title: '深夜の食堂', art: '🍜',
      text: [
        'アズマの職員が使う二十四時間営業の店。カウンターに一人、社員証を首から下げた男が突っ伏している。',
      ],
      choices: [
        {
          text: '酒に付き合って話を聞く',
          once: true,
          effects: [{ gold: -30 }],
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: [
                '「金庫室？ ありゃ機械錠だよ。停電しても開かない。逆に言えば……停電中は電子的な記録も残らん」',
                '「あと、夜勤の警備長。あの人は真面目だ。真面目すぎて、決まった時刻に決まった場所を回る」',
              ],
              effects: [{ setFlag: 'knowsPatrol' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: { text: ['男は途中で寝た。財布だけが軽くなった。'], to: 'planAfter' },
          },
        },
        {
          text: '掃除係からカードを掏る',
          once: true,
          check: {
            skill: 'sleight', dc: 14,
            success: {
              text: ['交代で出てきた掃除係の腰から、保守用カードが一枚。三日は気づかれない。'],
              effects: [{ giveItem: 'maintKey' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: {
              text: ['指が触れた瞬間、相手が振り返った。何も取れなかった。顔は見られた。'],
              effects: [{ setFlag: 'seenFace' }],
              to: 'planAfter',
            },
          },
        },
        { text: '戻る', to: 'plan' },
      ],
    },

    backdoor: {
      id: 'backdoor', title: '裏口', art: '🚪',
      text: ['搬入用のシャッターと、その脇の通用口。カメラは二台。角度は固定だ。'],
      choices: [
        {
          text: 'カメラの死角を測る',
          once: true,
          check: {
            skill: 'perception', dc: 12,
            success: {
              text: ['壁沿いに幅六十センチ、どちらのカメラにも映らない帯がある。使える。'],
              effects: [{ setFlag: 'knowsBlindspot' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: { text: ['雨で視界が悪い。角度までは読めなかった。'], to: 'planAfter' },
          },
        },
        {
          text: '通用口の錠前を下見する',
          once: true,
          check: {
            skill: 'tech', dc: 12,
            success: {
              text: ['電子錠だ。停電中はただの金属になる。開けるのに三十秒。'],
              effects: [{ setFlag: 'knowsLock' }, { var: 'prep', add: 1 }],
              to: 'planAfter',
            },
            fail: { text: ['近づきすぎた。カメラが一度こちらを向いた気がする。'], to: 'planAfter' },
          },
        },
        { text: '戻る', to: 'plan' },
      ],
    },

    planAfter: {
      id: 'planAfter', title: '下見', art: '🔭',
      text: ['時計を見る。火曜まで、まだ時間はある。'],
      choices: [
        { text: '下見を続ける', to: 'plan' },
        { text: '火曜の夜へ', to: 'tuesday' },
      ],
    },

    /* ------------------------------------------------------ 停電開始 */

    tuesday: {
      id: 'tuesday', title: '火曜 01:58', art: '🕑',
      text: [
        '裏口の陰。雨。二分前。',
        '準備の分だけ、動きは速くなる。足りない分は、その場で取り返すしかない。',
        '（ここから時計が進む。9 で三分が終わり、電気が戻る）',
      ],
      onEnter: [
        { log: '——02:00:00。街区の灯りが、一斉に消えた。', kind: 'good' },
      ],
      choices: [
        {
          text: '壁沿いの死角から通用口へ',
          requires: { flag: 'knowsBlindspot' },
          lockedText: '死角の位置を知らない',
          effects: [{ var: 'clock', add: 1 }],
          to: 'inside',
        },
        {
          text: '保守用カードでシャッターを開ける',
          requires: { has: 'maintKey' },
          lockedText: 'カードがない',
          effects: [{ var: 'clock', add: 1 }, { setFlag: 'quietEntry' }],
          to: 'inside',
        },
        {
          text: '通用口をこじ開ける',
          effects: [{ var: 'clock', add: 2 }],
          check: {
            skill: 'tech', dc: 13,
            advantageIf: { flag: 'knowsLock' },
            success: { text: ['錠は停電で死んでいた。押すだけで開いた。'], to: 'inside' },
            fail: {
              text: ['蝶番が鳴った。中で、懐中電灯の光が動いた。'],
              effects: [{ var: 'clock', add: 1 }, { setFlag: 'alerted' }],
              to: 'inside',
            },
          },
        },
      ],
    },

    inside: {
      id: 'inside', title: '館内・非常灯', art: '🔦',
      text: [
        '緑の非常灯だけが点いている。空調が止まっていて、耳が痛いほど静かだ。',
        '金庫室は地下一階。階段は二つ——正面と、清掃用。',
      ],
      choices: [
        {
          text: '清掃用の階段を降りる',
          effects: [{ var: 'clock', add: 1 }],
          check: {
            skill: 'stealth', dc: 12,
            advantageIf: { flag: 'knowsPatrol' },
            success: { text: ['モップの匂いのする階段を、足音を殺して降りた。'], to: 'vault' },
            fail: { text: ['踊り場で、上ってくる足音と鉢合わせた。'], to: 'guardMeet' },
          },
        },
        {
          text: '正面階段を走って降りる',
          effects: [{ var: 'clock', add: 1 }],
          to: 'guardMeet',
        },
        {
          text: '警備室の記録装置を先に潰す',
          once: true,
          effects: [{ var: 'clock', add: 2 }],
          check: {
            skill: 'netops', dc: 13,
            success: {
              text: ['予備電源で動いていた記録装置を落とした。今夜の映像は最初から存在しない。'],
              effects: [{ setFlag: 'noFootage' }],
              to: 'inside',
            },
            fail: { text: ['配線が違った。時間だけが減った。'], to: 'inside' },
          },
        },
      ],
    },

    guardMeet: {
      id: 'guardMeet', title: '踊り場', art: '👮',
      text: [
        '懐中電灯がこちらを照らした。制服。銃はまだホルスターの中。',
        '「……停電で見回りに来ただけだ」と男は言った。自分に言い聞かせるように。',
      ],
      choices: [
        {
          text: '「見なかったことにしろ」と圧をかける',
          effects: [{ var: 'clock', add: 1 }],
          check: {
            skill: 'intimidation', dc: 13,
            success: {
              text: [
                '男は懐中電灯を下ろした。「……三年だ。定年まで三年なんだ」',
                'そう言って、来た道を戻っていった。',
              ],
              effects: [{ setFlag: 'sparedGuard' }],
              to: 'vault',
            },
            fail: { text: ['男の手が無線に伸びた。'], to: 'guardFight' },
          },
        },
        {
          text: '金を握らせる',
          effects: [{ var: 'clock', add: 1 }, { gold: -200 }],
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: ['札束は受け取られた。「三分だけだ。三分経ったら、俺は見たと言う」'],
              effects: [{ setFlag: 'sparedGuard' }],
              to: 'vault',
            },
            fail: { text: ['「そういうのは、もう受け取らないことにしてる」'], to: 'guardFight' },
          },
        },
        { text: '無力化する', to: 'guardFight' },
      ],
    },

    guardFight: {
      id: 'guardFight', title: '踊り場の戦闘', art: '⚔️',
      text: ['狭い階段で、光が乱れた。'],
      combat: {
        title: '夜勤の警備',
        enemies: ['nightShift', 'secGuard'],
        onVictory: {
          text: ['二人を階段下に寝かせた。時計は容赦なく進んでいる。'],
          effects: [{ var: 'clock', add: 2 }],
          to: 'vault',
        },
        onDefeat: { to: 'endCaught' },
        onFlee: { text: ['階段を駆け上がり、そのまま外へ出た。'], to: 'endEmpty' },
      },
    },

    /* ---------------------------------------------------------- 金庫室 */

    vault: {
      id: 'vault', title: '地下一階・金庫室', art: '🔐',
      text: [
        '扉は機械式のダイヤル錠。停電も電子的な小細工も効かない、という意味で、いちばん新しい技術だ。',
        '中に何があるかは聞いていない。「持てるだけ」とだけ言われた。',
      ],
      choices: [
        {
          text: 'ダイヤルの音を聞いて開ける',
          effects: [{ var: 'clock', add: 2 }],
          check: {
            skill: 'perception', dc: 15,
            advantageIf: { var: 'prep', gte: 3 },
            success: {
              text: ['三つ目の数字で、内部の歯が落ちる音がした。扉が、驚くほど静かに開いた。'],
              to: 'haul',
            },
            fail: {
              text: ['指が滑った。もう一度、最初から。'],
              effects: [{ var: 'clock', add: 1 }],
              to: 'vaultRetry',
            },
          },
        },
        {
          text: '蝶番を切断する',
          effects: [{ var: 'clock', add: 3 }, { setFlag: 'loudVault' }],
          check: {
            skill: 'tech', dc: 12,
            success: { text: ['火花が非常灯より明るい。扉が内側に倒れた。音は、上まで届いただろう。'], to: 'haul' },
            fail: { text: ['刃が折れた。時間だけが溶けていく。'], to: 'vaultRetry' },
          },
        },
        {
          text: '配電図から機械錠の弱点を突く',
          requires: { has: 'schematic' },
          lockedText: '配電図がない',
          effects: [{ var: 'clock', add: 1 }],
          check: {
            skill: 'datalore', dc: 12,
            success: {
              text: [
                '図面の隅に、施工時のメモ。「非常解錠：床下点検口より手動」',
                '床のパネルを外し、手を突っ込んで、内側から開けた。三十秒。',
              ],
              to: 'haul',
            },
            fail: { text: ['点検口は塞がれていた。図面より現物が新しい。'], to: 'vaultRetry' },
          },
        },
      ],
    },

    vaultRetry: {
      id: 'vaultRetry', title: '扉の前', art: '⏱️',
      text: ['時計の音だけが聞こえる。'],
      choices: [
        {
          text: 'もう一度やる',
          if: { var: 'clock', lte: 7 },
          to: 'vault',
        },
        {
          text: '諦めて引き上げる',
          to: 'escape',
        },
        {
          text: '（時間切れ）非常電源が戻る',
          if: { var: 'clock', gte: 8 },
          to: 'powerBack',
        },
      ],
    },

    haul: {
      id: 'haul', title: '金庫室の中', art: '💼',
      text: [
        '現金の束。無記名債券。そして、いちばん奥の棚に、紙の台帳が一冊。',
        '紙だ。この時代に。つまり——電子的には、この取引はどこにも存在しない。',
      ],
      choices: [
        {
          text: '現金と債券だけ持って出る',
          effects: [{ gold: 1200 }, { giveItem: 'bearer' }, { var: 'clock', add: 1 }],
          to: 'escape',
        },
        {
          text: '台帳も持っていく',
          effects: [{ gold: 800 }, { giveItem: 'ledger' }, { setFlag: 'tookLedger' }, { var: 'clock', add: 2 }],
          to: 'escape',
        },
        {
          text: '台帳を読んでから決める',
          effects: [{ var: 'clock', add: 2 }],
          check: {
            skill: 'datalore', dc: 12,
            success: {
              text: [
                '見開きに並んでいるのは、市議三人と警察の幹部、そして支払日。',
                'これは金ではない。金より重い。持ち出せば、誰かが必ず取り返しに来る。',
              ],
              effects: [{ setFlag: 'knowsLedger' }],
              to: 'ledgerChoice',
            },
            fail: { text: ['数字の羅列にしか見えない。読んでいる時間はない。'], to: 'ledgerChoice' },
          },
        },
      ],
    },

    ledgerChoice: {
      id: 'ledgerChoice', title: '選ぶ', art: '📓',
      text: ['非常灯が一度、瞬いた。時間が近い。'],
      choices: [
        {
          text: '台帳を持つ',
          effects: [{ gold: 800 }, { giveItem: 'ledger' }, { setFlag: 'tookLedger' }, { var: 'clock', add: 1 }],
          to: 'escape',
        },
        {
          text: '台帳は置いていく',
          effects: [{ gold: 1200 }, { giveItem: 'bearer' }, { var: 'clock', add: 1 }],
          to: 'escape',
        },
        {
          text: '台帳を撮って、現物は戻す',
          requires: { flag: 'knowsLedger' },
          lockedText: '何が書いてあるか分かっていない',
          effects: [{ gold: 1200 }, { giveItem: 'bearer' }, { setFlag: 'copiedLedger' }, { var: 'clock', add: 2 }],
          to: 'escape',
        },
      ],
    },

    /* ---------------------------------------------------------- 脱出 */

    escape: {
      id: 'escape', title: '戻り道', art: '🏃',
      text: ['階段を上る。非常灯の緑が、来たときより暗く見える。'],
      choices: [
        {
          text: '来た道を戻る',
          if: { var: 'clock', lte: 7 },
          effects: [{ var: 'clock', add: 1 }],
          to: 'out',
        },
        {
          text: '走る（時間がない）',
          if: { var: 'clock', gte: 8 },
          to: 'powerBack',
        },
        {
          text: '搬入口から出る',
          if: { var: 'clock', lte: 7 },
          effects: [{ var: 'clock', add: 1 }],
          check: {
            skill: 'athletics', dc: 11,
            success: { text: ['シャッターの隙間を潜り、雨の中へ転がり出た。'], to: 'out' },
            fail: { text: ['シャッターが途中で止まった。時間を食った。'], effects: [{ var: 'clock', add: 2 }], to: 'escape' },
          },
        },
      ],
    },

    powerBack: {
      id: 'powerBack', title: '02:03:00', art: '💡',
      text: [
        '天井の照明が、一斉に戻った。',
        '空調が唸りはじめ、電子錠が次々にロックされる音が、廊下の奥から順番に聞こえてくる。',
        'まだ建物の中にいる。',
      ],
      choices: [
        {
          text: 'ガラスを割って外へ',
          check: {
            skill: 'athletics', dc: 13,
            success: {
              text: ['一階の窓を椅子で破り、雨の中へ飛び出した。警報が背中で鳴っている。'],
              effects: [{ setFlag: 'loudExit' }],
              to: 'out',
            },
            fail: { text: ['強化ガラスだった。振り返ると、廊下の端に人影が三つ。'], to: 'lastStand' },
          },
        },
        {
          text: '通気口に隠れてやり過ごす',
          check: {
            skill: 'stealth', dc: 15,
            advantageIf: { flag: 'noFootage' },
            success: {
              text: [
                '天井裏で二時間。捜索が引き上げてから、明るくなった街へ出た。',
                '誰も、何も見ていない。記録もない。',
              ],
              effects: [{ setFlag: 'cleanExit' }],
              to: 'out',
            },
            fail: { text: ['埃でくしゃみが出た。それだけで十分だった。'], to: 'lastStand' },
          },
        },
      ],
    },

    lastStand: {
      id: 'lastStand', title: '一階ロビー', art: '⚔️',
      text: ['明るい。どこにも影がない。それがいちばん困る。'],
      combat: {
        title: '応援到着',
        enemies: ['corpTrooper', 'secGuard', 'secGuard'],
        onVictory: {
          text: ['正面扉を蹴り開けて、雨の中へ出た。この街で、これ以上静かにやる方法はもうない。'],
          effects: [{ setFlag: 'loudExit' }],
          to: 'out',
        },
        onDefeat: { to: 'endCaught' },
        onFlee: { to: 'endEmpty' },
      },
    },

    out: {
      id: 'out', title: '雨の路地', art: '🌧️',
      text: ['三区画走って、路地の陰で息を整えた。サイレンは、まだ遠い。'],
      choices: [
        {
          text: '台帳を情報屋に流す',
          requires: { any: [{ has: 'ledger' }, { flag: 'copiedLedger' }] },
          lockedText: '流せるものがない',
          to: 'endLedger',
        },
        {
          text: '金だけ数えて、街を出る',
          to: 'endClean',
        },
        {
          text: '台帳を持ったまま、何もしない',
          requires: { has: 'ledger' },
          lockedText: '台帳は持っていない',
          to: 'endSitting',
        },
      ],
    },

    /* ---------------------------------------------------------- 結末 */

    endLedger: {
      id: 'endLedger', title: '紙の重さ', art: '📰',
      text: [
        '三日後、市議が一人辞任した。一週間後、警察の幹部が二人異動になった。',
        '誰も逮捕されなかった。この街ではそれが「効いた」ということだ。',
        'アズマ信託は強盗の被害届を出さなかった。出せなかった。',
      ],
      ending: {
        type: 'good',
        title: '被害届の出ない強盗',
        text: [
          '報酬は現金だけになったが、追われることもなくなった。',
          '{party} の名は、この街の一部の人間にとって、しばらく縁起の悪い響きになる。',
        ],
      },
    },

    endClean: {
      id: 'endClean', title: '数える', art: '💰',
      text: ['路地裏で札を数えた。指が濡れていて、うまく数えられなかった。'],
      ending: {
        type: 'neutral',
        title: '三分の仕事',
        text: [
          '金は入った。名前は残らなかった。それが強盗の正しい終わり方だ。',
          'アズマ信託は、その週のうちに金庫室の錠前を電子式に替えた。改悪だ。',
        ],
      },
    },

    endSitting: {
      id: 'endSitting', title: '抱えたまま', art: '📓',
      text: [
        '台帳は部屋の床下に隠した。使う気にも、捨てる気にもなれなかった。',
        '二週間後、部屋の前に車が停まるようになった。',
      ],
      ending: {
        type: 'bad',
        title: '座っている爆弾',
        text: ['持っているだけでは、ただの紙だ。持っていると知られた時点で、ただの標的になる。'],
      },
    },

    endCaught: {
      id: 'endCaught', title: '明るい部屋', art: '💡',
      text: ['手錠は使われなかった。この街の企業は、警察に渡すより安く済ませる方法を知っている。'],
      ending: {
        type: 'bad',
        title: '損金処理',
        text: ['アズマ信託の帳簿に、その夜の損失は計上されなかった。処理済みだったからだ。'],
      },
    },

    endEmpty: {
      id: 'endEmpty', title: '手ぶら', art: '🚶',
      text: ['雨の中を歩いた。濡れた服の重さだけが、今夜の収穫だった。'],
      ending: {
        type: 'neutral',
        title: '次の火曜',
        text: ['停電は毎週ある。錠前が替わるまでの間なら、まだ機会はある。'],
      },
    },
  },
};

export default blackout;
