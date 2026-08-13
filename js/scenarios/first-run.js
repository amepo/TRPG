/* シナリオ「初日の運び屋」— ネオンの雨・導入編（10〜15分）。
   技能判定・戦闘・ネットラン・改造の4つを一度ずつ通す。 */

export const firstRun = {
  id: 'first-run',
  title: '初日の運び屋',
  author: '灯火のテーブル',
  world: 'neon',
  blurb: '荷物を一つ、上の階まで。中身は聞くな。——この街の遊び方を覚えるための、小さな仕事。',
  level: 1,
  length: '導入（10〜15分）',
  start: 'brief',
  vars: { fee: 200 },
  tutorial: true,

  items: {
    parcel: { id: 'parcel', name: '封をした小箱', desc: '軽い。振っても音がしない。それが少し怖い。' },
  },

  nodes: {
    brief: {
      id: 'brief', title: '雨の下の受け渡し', art: '📦',
      text: [
        '路地の奥、自販機の光だけが青い。フードの男が小箱を差し出す。',
        '「メリディアン・タワー、22階。受取人は“ハン”。三十分以内」',
        '「開けるな。止まるな。聞くな。€$200だ」',
        '',
        '——ここから先は選択肢を選ぶだけで進む。【技能】と DC が書かれた選択肢は 1d20 の判定になる。',
      ],
      onEnter: [{ giveItem: 'parcel' }],
      choices: [
        { text: '受け取って走り出す', to: 'lobby' },
        {
          text: '報酬を吊り上げる',
          once: true,
          check: {
            skill: 'persuasion', dc: 12,
            success: {
              text: ['「……250。急いでるんだ」男は舌打ちして端末を操作した。'],
              effects: [{ var: 'fee', set: 250 }, { log: '報酬が €$250 になった。', kind: 'good' }],
              to: 'lobby',
            },
            fail: { text: ['「嫌なら他を当たる」——他は当たらない。それが向こうにも分かっている。'], to: 'lobby' },
          },
        },
        {
          text: '中身を推測する',
          once: true,
          check: {
            skill: 'streetwise', dc: 11,
            success: {
              text: [
                '軽さと大きさ、封の仕方。この街でこの梱包をするのは一種類だけだ——生体部品。',
                '知ったところで、運ぶ以外の選択肢はない。だが心構えは変わる。',
              ],
              effects: [{ setFlag: 'knowsCargo' }],
              to: 'lobby',
            },
            fail: { text: ['分からない。分からないほうが、たぶん長生きする。'], to: 'lobby' },
          },
        },
      ],
    },

    lobby: {
      id: 'lobby', title: 'メリディアン・タワー ロビー', art: '🏢',
      text: [
        '回転扉の内側は乾いていて、暖かくて、この街のものではない匂いがする。',
        'エレベーターは社員証がないと動かない。受付には警備が一人。',
        '——ここで一つ、この世界の目玉を試せる。**改造**だ。キャラクターシートの「適合度」から入れられる。',
        '入れるほど強くなるが、体が受け入れる量を超えると、すべての判定にペナルティがつく。',
      ],
      choices: [
        {
          text: '配達員として堂々と通る',
          check: {
            skill: 'deception', dc: 11,
            success: {
              text: ['「22階ですね。どうぞ」——警備は端末から目も上げなかった。'],
              to: 'floor22',
            },
            fail: { text: ['「配達の登録がありませんね」警備が立ち上がった。'], to: 'gate' },
          },
        },
        {
          text: 'エレベーターの制御に割り込む',
          check: {
            skill: 'netops', dc: 12,
            success: {
              text: ['呼び出しパネルの裏、点検用ポート。三十秒で 22 階の許可が下りた。'],
              effects: [{ setFlag: 'quiet' }],
              to: 'floor22',
            },
            fail: { text: ['パネルが赤く光り、警報が短く鳴った。'], to: 'gate' },
          },
        },
      ],
    },

    gate: {
      id: 'gate', title: '受付の前', art: '🚧',
      text: ['警備が近づいてくる。手はまだ武器にかかっていない。まだ。'],
      choices: [
        {
          text: '押し通る',
          to: 'fight',
        },
        {
          text: '一歩下がって、金を握らせる',
          once: true,
          effects: [{ gold: -50 }],
          check: {
            skill: 'persuasion', dc: 10,
            success: {
              text: ['警備は札を数えもせずポケットに入れた。「……22階だな。急げ」'],
              to: 'floor22',
            },
            fail: { text: ['「買収の記録も残るんですよ」——札は突き返された。'], to: 'fight' },
          },
        },
      ],
    },

    fight: {
      id: 'fight', title: 'ロビーの警備', art: '⚔️',
      text: [
        '警備がスタンバトンを抜いた。奥の壁で、小型ドローンが一機、こちらを向く。',
        '——戦闘は手番制。敵を選んでから行動を押す。HPが0になっても即死ではない。',
      ],
      combat: {
        title: 'ロビーの警備',
        enemies: ['secGuard', 'surveillanceDrone'],
        onVictory: {
          text: ['二つとも床に転がった。エレベーターは、まだ動いている。'],
          to: 'floor22',
        },
        onDefeat: { text: ['気がつくと雨の中に放り出されていた。小箱は無事だ。もう一度やるしかない。'], to: 'retry' },
        onFlee: { to: 'retry' },
      },
    },

    retry: {
      id: 'retry', title: 'タワーの外', art: '🩹',
      text: ['傷は浅い。時計を見る。まだ間に合う。'],
      onEnter: [{ rest: 'short' }],
      choices: [
        { text: 'もう一度入る', to: 'lobby' },
        { text: '仕事を諦める', to: 'endFail' },
      ],
    },

    floor22: {
      id: 'floor22', title: '22階・空の廊下', art: '🛗',
      text: [
        '扉が開く。照明が半分落ちている。オフィスは無人だ。',
        '受取人「ハン」の部屋は 2207。だが扉の前まで来て、足が止まった。',
        '電子錠のランプが緑——つまり、すでに誰かが開けている。',
      ],
      choices: [
        {
          text: '扉の記録を読む',
          check: {
            skill: 'tech', dc: 11,
            success: {
              text: [
                '直近の解錠は四分前。使われたのは保守用の権限——ハンのものではない。',
                '中にいるのは受取人ではない。',
              ],
              effects: [{ setFlag: 'knowsTrap' }],
              to: 'netrun',
            },
            fail: { text: ['記録は消されている。丁寧に、跡が残らないように。'], to: 'netrun' },
          },
        },
        { text: '構わず入る', to: 'handover' },
      ],
    },

    netrun: {
      id: 'netrun', title: '廊下から接続', art: '🕸️',
      text: [
        '扉の前で座り込み、デッキを開く。フロアの監視系に入れば、中が見える。',
        '——これがネットラン。層ごとに「どう抜けるか」を選ぶ。速い手ほど痕跡が残り、',
        '痕跡が満ちると逆探知される。慎重に行くか、焼き切るか。',
      ],
      netrun: {
        title: '22階 監視系',
        traceMax: 5,
        layers: [
          {
            name: 'フロア監視カメラ', skill: 'netops', dc: 11,
            text: ['市販の監視ソフト。パスワードは初期値のままだった。'],
            onFail: { damage: '1d4', text: ['弾かれた。こめかみが痛む。'] },
            effects: [{ setFlag: 'sawInside' }],
          },
        ],
        onSuccess: {
          text: [
            '2207 の映像が出た。中にいるのは二人。どちらもスーツで、どちらも武装している。',
            'ハンらしき男は、椅子に縛られていた。まだ生きている。',
          ],
          to: 'handover',
        },
        onTraced: {
          text: ['接続が切られた。廊下の天井で、カメラがこちらを向いた。'],
          to: 'handover',
        },
      },
    },

    handover: {
      id: 'handover', title: '2207号室', art: '🚪',
      text: [
        '扉を開けると、スーツの男が二人。奥の椅子に、口を塞がれた男が一人。',
        '「その箱を置いて、帰っていい」と手前の男が言った。「君は運び屋だ。それ以上ではない」',
        '本当にそのとおりだった。それ以上ではない。',
      ],
      choices: [
        {
          text: '箱を置いて帰る',
          to: 'endSafe',
        },
        {
          text: '「受取人はハンだ」と言い張る',
          check: {
            skill: 'intimidation', dc: 13,
            advantageIf: { flag: 'sawInside' },
            success: {
              text: [
                '二人は顔を見合わせた。運び屋が抵抗するのは、想定に入っていなかったらしい。',
                '「……面倒だな」奥の男が言い、手前の男が上着に手を入れた。',
              ],
              to: 'rescueFight',
            },
            fail: {
              text: ['「そうか」男は微笑んだまま、こちらの手から箱を取り上げた。'],
              to: 'endSafe',
            },
          },
        },
        {
          text: '不意を突いて撃つ',
          to: 'rescueFight',
        },
      ],
    },

    rescueFight: {
      id: 'rescueFight', title: '2207号室の戦闘', art: '⚔️',
      text: ['狭い部屋だ。逃げ場がないのは、向こうも同じ。'],
      combat: {
        title: '掃除の途中',
        enemies: ['punk', 'punk'],
        onVictory: {
          text: [
            '二人を床に伸ばし、椅子の縄を切った。ハンは咳き込みながら箱を受け取った。',
            '「……開けないでくれたんだな」それが最初の一言だった。',
          ],
          effects: [{ setFlag: 'savedHan' }, { xp: 100 }],
          to: 'endGood',
        },
        onDefeat: { text: ['床に倒れたところまでは覚えている。'], to: 'endBad' },
        onFlee: { text: ['廊下に転がり出て、非常階段を駆け下りた。'], to: 'endSafe' },
      },
    },

    endGood: {
      id: 'endGood', title: '報酬', art: '🪙',
      text: [
        'ハンは €${var:fee} をその場で送金し、それから少し考えて、もう一度端末を操作した。',
        '「上乗せだ。次も頼めるか」',
      ],
      onEnter: [{ gold: 150 }],
      ending: {
        type: 'good',
        title: '運び屋以上',
        text: [
          '報酬 €${var:fee} と、上乗せの €$150。初日にしては上出来だ。',
          '——基本は以上。次は「雨の領収書」で、本物の仕事を受けてみよう。',
        ],
      },
    },

    endSafe: {
      id: 'endSafe', title: '仕事は仕事', art: '🌧️',
      text: [
        '箱を置いて、エレベーターに乗った。22階の照明が、扉の閉まる音と一緒に落ちた。',
        '報酬は振り込まれた。翌日の記事に、その階の名前は出なかった。',
      ],
      ending: {
        type: 'neutral',
        title: '運び屋',
        text: [
          '報酬 €${var:fee}。契約は果たした。中身は最後まで聞かなかった。',
          '——それがこの街の正しい生き方だ。長く生きたければ。',
        ],
      },
    },

    endBad: {
      id: 'endBad', title: '床', art: '🩸',
      text: ['天井の照明が、ゆっくり遠くなっていく。誰かが箱を拾い上げる音がした。'],
      ending: {
        type: 'bad',
        title: '初日',
        text: ['翌朝、22階は清掃済みだった。運び屋が一人、記録から消えた。'],
      },
    },

    endFail: {
      id: 'endFail', title: '雨の中', art: '🚶',
      text: ['小箱を路地に置いて、そのまま歩き出した。誰も追ってこなかった。'],
      ending: {
        type: 'neutral',
        title: '出直し',
        text: ['報酬はなし。だが覚えたことはある。次はうまくやろう。'],
      },
    },
  },
};

export default firstRun;
