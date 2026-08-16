/* 自動生成 — `npm run sync` が templates/*.json から作ります。手で編集しない。

   工房から見本を落とせるようにするためのもの。通信を挟まずに済むよう、
   中身をそのまま埋め込んである（このアプリはオフラインで動くのが前提）。 */

export const TEMPLATES = [
  {
    "file": "annotated.json",
    "key": "annotated",
    "data": {
      "_comment": "すべての書き方の見本。_ で始まるキーはエンジンが読み飛ばすので、メモとして残せる。",
      "id": "sample-annotated",
      "title": "見本：使える書き方ぜんぶ",
      "author": "あなたの名前",
      "world": "embers",
      "_world": "embers（剣と魔法）か neon（サイバーパンク）。技能・装備・敵が入れ替わる",
      "blurb": "一覧に出る、短い惹句。",
      "level": 1,
      "length": "短編（10〜15分）",
      "start": "intro",
      "_start": "最初に開く場面の id",
      "vars": {
        "trust": 0,
        "fee": 30
      },
      "_vars": "数えたいもの。条件と効果から読み書きし、本文には {var:trust} で差し込める",
      "items": {
        "letter": {
          "id": "letter",
          "name": "封書",
          "desc": "宛名がない。"
        }
      },
      "_items": "このシナリオだけの持ち物。世界の道具は id を書くだけで使える",
      "monsters": {
        "strayDog": {
          "name": "野良犬",
          "kind": "獣",
          "cr": 0.125,
          "xp": 25,
          "acOverride": 12,
          "hp": "2d6",
          "hpAvg": 7,
          "speed": 12,
          "abilities": {
            "str": 10,
            "dex": 13,
            "con": 11,
            "int": 3,
            "wis": 12,
            "cha": 6
          },
          "attacks": [
            {
              "name": "噛みつき",
              "bonus": 3,
              "damage": "1d4+1",
              "type": "刺突"
            }
          ],
          "tactics": "brute",
          "blurb": "痩せている。"
        }
      },
      "_monsters": "このシナリオだけの敵。世界の敵は id を書くだけで出せる",
      "nodes": {
        "intro": {
          "id": "intro",
          "title": "場面の見出し",
          "art": "🏚️",
          "_art": "絵文字ひとつ。ログの見出しにつく",
          "text": [
            "一行が一段落になる。",
            "{name} は一行の先頭の名前、{party} は一行そのもの。"
          ],
          "onEnter": [
            {
              "giveItem": "letter"
            },
            {
              "var": "trust",
              "add": 1,
              "note": "（信頼が少し上がった）"
            },
            {
              "if": {
                "var": "trust",
                "gte": 1
              },
              "log": "条件つきの効果も書ける。",
              "kind": "good"
            }
          ],
          "_onEnter": "その場面に入ったとき一度だけ走る。repeatEffects: true で毎回走る",
          "choices": [
            {
              "text": "そのまま進む",
              "to": "check"
            },
            {
              "text": "持ち物が要る道",
              "requires": {
                "has": "letter"
              },
              "lockedText": "封書がない",
              "_requires": "満たさないと灰色で表示される。if: にすると条件を満たすまで見えない",
              "to": "check"
            }
          ]
        },
        "check": {
          "id": "check",
          "title": "判定のある場面",
          "text": [
            "判定は 1d20 + 技能。DC 以上で成功。"
          ],
          "choices": [
            {
              "text": "説得してみる",
              "once": true,
              "_once": "一度選ぶと消える",
              "check": {
                "skill": "persuasion",
                "dc": 12,
                "advantageIf": {
                  "classIn": [
                    "cleric"
                  ]
                },
                "_advantageIf": "条件を満たすと有利（2個振って高いほう）",
                "success": {
                  "text": [
                    "通った。"
                  ],
                  "effects": [
                    {
                      "var": "trust",
                      "add": 2
                    }
                  ],
                  "to": "fight"
                },
                "fail": {
                  "text": [
                    "取りつく島もない。"
                  ],
                  "to": "fight"
                }
              }
            }
          ]
        },
        "fight": {
          "id": "fight",
          "title": "戦闘のある場面",
          "text": [
            "群れは頭数で出す。どれから倒すか選べるほうが面白い。"
          ],
          "combat": {
            "title": "路地の番犬",
            "enemies": [
              "strayDog",
              "strayDog"
            ],
            "_enemies": "同じ id を並べると Ａ Ｂ と名前がつく",
            "surprise": null,
            "_surprise": "'party' なら先手、'enemy' なら不意打ちされる",
            "onVictory": {
              "text": [
                "犬は退いた。"
              ],
              "effects": [
                {
                  "xp": 50
                }
              ],
              "to": "ending"
            },
            "onDefeat": {
              "text": [
                "地面に転がった。"
              ],
              "to": "ending"
            },
            "onFlee": {
              "to": "ending"
            }
          }
        },
        "ending": {
          "id": "ending",
          "title": "結末",
          "text": [
            "結末の場面に入ると物語は終わる。"
          ],
          "onEnter": [
            {
              "gold": {
                "var": "fee"
              }
            }
          ],
          "_onEnter2": "報酬は変数でも書ける。{ gold: 30 } のように直に書いてもよい",
          "ending": {
            "type": "good",
            "_type": "good / neutral / bad",
            "title": "一覧に出る結末の名前",
            "text": [
              "締めの文章。",
              "{party} で一行の名前が入る。"
            ],
            "noPay": false,
            "_noPay": "報酬を払わないことに意味がある結末だけ true にする"
          }
        }
      }
    },
    "note": "使える書き方の全部入り。まずこれを開くのがいちばん早い"
  },
  {
    "file": "linear.json",
    "key": "linear",
    "data": {
      "id": "linear",
      "title": "linear 型の見本",
      "author": "灯火のテーブル",
      "world": "embers",
      "blurb": "TODO: 一行のあらすじ",
      "level": 1,
      "length": "短編（30〜45分）",
      "start": "start",
      "vars": {},
      "nodes": {
        "start": {
          "id": "start",
          "title": "導入",
          "art": "📋",
          "text": [
            "ここに情景。何を頼まれたのかを一段落で。",
            "——TODO: 導入の本文"
          ],
          "choices": [
            {
              "text": "引き受ける",
              "to": "approach"
            },
            {
              "text": "相手の様子を窺う",
              "once": true,
              "check": {
                "skill": "insight",
                "dc": 11,
                "success": {
                  "text": [
                    "TODO: 見抜いたこと"
                  ],
                  "effects": [
                    {
                      "setFlag": "sawThrough"
                    }
                  ],
                  "to": "approach"
                },
                "fail": {
                  "text": [
                    "TODO: 読めなかった"
                  ],
                  "to": "approach"
                }
              }
            }
          ]
        },
        "approach": {
          "id": "approach",
          "title": "現場",
          "art": "🚪",
          "text": [
            "TODO: 現場の描写。障害が一つ見えている。"
          ],
          "choices": [
            {
              "text": "静かに入る",
              "check": {
                "skill": "stealth",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 抜けた"
                  ],
                  "to": "core"
                },
                "fail": {
                  "text": [
                    "TODO: 見つかった"
                  ],
                  "to": "fight"
                }
              }
            },
            {
              "text": "正面から入る",
              "to": "fight"
            }
          ]
        },
        "fight": {
          "id": "fight",
          "title": "衝突",
          "art": "⚔️",
          "text": [
            "TODO: 戦闘に入る一行"
          ],
          "combat": {
            "title": "TODO",
            "enemies": [
              "bandit",
              "bandit"
            ],
            "onVictory": {
              "text": [
                "TODO: 勝った後"
              ],
              "to": "core"
            },
            "onDefeat": {
              "to": "endBad"
            },
            "onFlee": {
              "to": "endBad"
            }
          }
        },
        "core": {
          "id": "core",
          "title": "核心",
          "art": "🔍",
          "text": [
            "TODO: ここで一番の情報か物が手に入る。"
          ],
          "choices": [
            {
              "text": "TODO: 良い側の選択",
              "to": "endGood"
            },
            {
              "text": "TODO: 割り切る側の選択",
              "to": "endPlain"
            }
          ]
        },
        "endGood": {
          "id": "endGood",
          "title": "TODO 良い結末",
          "art": "🌅",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "good",
            "title": "TODO 良い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endPlain": {
          "id": "endPlain",
          "title": "TODO ひとつの結末",
          "art": "🚶",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "neutral",
            "title": "TODO ひとつの結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endBad": {
          "id": "endBad",
          "title": "TODO 苦い結末",
          "art": "🩸",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "bad",
            "title": "TODO 苦い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        }
      }
    },
    "note": "一本道。判定と戦闘を一度ずつ"
  },
  {
    "file": "hub.json",
    "key": "hub",
    "data": {
      "id": "hub",
      "title": "hub 型の見本",
      "author": "灯火のテーブル",
      "world": "embers",
      "blurb": "TODO: 一行のあらすじ",
      "level": 1,
      "length": "短編（30〜45分）",
      "start": "start",
      "vars": {
        "clues": 0
      },
      "nodes": {
        "start": {
          "id": "start",
          "title": "依頼",
          "art": "📋",
          "text": [
            "TODO: 依頼を受ける場面。"
          ],
          "choices": [
            {
              "text": "引き受ける",
              "to": "hub"
            }
          ]
        },
        "hub": {
          "id": "hub",
          "title": "拠点",
          "art": "🏙️",
          "text": [
            "TODO: 調べられる先が三つ。",
            "（手がかりが揃うと次へ進める）"
          ],
          "choices": [
            {
              "text": "TODO: 調査先A",
              "to": "leadA"
            },
            {
              "text": "TODO: 調査先B",
              "to": "leadB"
            },
            {
              "text": "TODO: 調査先C",
              "to": "leadC"
            },
            {
              "text": "TODO: 核心へ向かう",
              "requires": {
                "var": "clues",
                "gte": 2
              },
              "lockedText": "まだ手がかりが足りない",
              "to": "core"
            },
            {
              "text": "TODO: 手がかりがないまま踏み込む",
              "if": {
                "var": "clues",
                "lte": 1
              },
              "effects": [
                {
                  "log": "TODO: 代償の一行",
                  "kind": "bad"
                }
              ],
              "to": "core"
            }
          ]
        },
        "leadA": {
          "id": "leadA",
          "title": "TODO 調査先A",
          "art": "🔍",
          "text": [
            "TODO: 調査先Aの描写"
          ],
          "choices": [
            {
              "text": "TODO: 調べる",
              "once": true,
              "check": {
                "skill": "perception",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 分かったこと"
                  ],
                  "effects": [
                    {
                      "var": "clues",
                      "add": 1
                    },
                    {
                      "setFlag": "leadA"
                    }
                  ],
                  "to": "hub"
                },
                "fail": {
                  "text": [
                    "TODO: 空振り"
                  ],
                  "to": "hub"
                }
              }
            },
            {
              "text": "拠点に戻る",
              "to": "hub"
            }
          ]
        },
        "leadB": {
          "id": "leadB",
          "title": "TODO 調査先B",
          "art": "🔍",
          "text": [
            "TODO: 調査先Bの描写"
          ],
          "choices": [
            {
              "text": "TODO: 調べる",
              "once": true,
              "check": {
                "skill": "persuasion",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 分かったこと"
                  ],
                  "effects": [
                    {
                      "var": "clues",
                      "add": 1
                    },
                    {
                      "setFlag": "leadB"
                    }
                  ],
                  "to": "hub"
                },
                "fail": {
                  "text": [
                    "TODO: 空振り"
                  ],
                  "to": "hub"
                }
              }
            },
            {
              "text": "拠点に戻る",
              "to": "hub"
            }
          ]
        },
        "leadC": {
          "id": "leadC",
          "title": "TODO 調査先C",
          "art": "🔍",
          "text": [
            "TODO: 調査先Cの描写"
          ],
          "choices": [
            {
              "text": "TODO: 調べる",
              "once": true,
              "check": {
                "skill": "investigation",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 分かったこと"
                  ],
                  "effects": [
                    {
                      "var": "clues",
                      "add": 1
                    },
                    {
                      "setFlag": "leadC"
                    }
                  ],
                  "to": "hub"
                },
                "fail": {
                  "text": [
                    "TODO: 空振り"
                  ],
                  "to": "hub"
                }
              }
            },
            {
              "text": "拠点に戻る",
              "to": "hub"
            }
          ]
        },
        "core": {
          "id": "core",
          "title": "核心",
          "art": "🕯️",
          "text": [
            "TODO: 真相が見える場面。"
          ],
          "choices": [
            {
              "text": "TODO: 対決する",
              "to": "fight"
            },
            {
              "text": "TODO: 話し合う",
              "check": {
                "skill": "persuasion",
                "dc": 14,
                "success": {
                  "text": [
                    "TODO: 通じた"
                  ],
                  "to": "endGood"
                },
                "fail": {
                  "text": [
                    "TODO: 通じなかった"
                  ],
                  "to": "fight"
                }
              }
            }
          ]
        },
        "fight": {
          "id": "fight",
          "title": "対決",
          "art": "⚔️",
          "text": [
            "TODO: 戦闘に入る一行"
          ],
          "combat": {
            "title": "TODO",
            "enemies": [
              "bandit",
              "bandit"
            ],
            "onVictory": {
              "text": [
                "TODO: 勝った後"
              ],
              "to": "endPlain"
            },
            "onDefeat": {
              "to": "endBad"
            },
            "onFlee": {
              "to": "endBad"
            }
          }
        },
        "endGood": {
          "id": "endGood",
          "title": "TODO 良い結末",
          "art": "🌅",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "good",
            "title": "TODO 良い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endPlain": {
          "id": "endPlain",
          "title": "TODO ひとつの結末",
          "art": "🚶",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "neutral",
            "title": "TODO ひとつの結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endBad": {
          "id": "endBad",
          "title": "TODO 苦い結末",
          "art": "🩸",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "bad",
            "title": "TODO 苦い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        }
      }
    },
    "note": "拠点から複数の調査先へ。手がかりが揃うと次へ"
  },
  {
    "file": "clock.json",
    "key": "clock",
    "data": {
      "id": "clock",
      "title": "clock 型の見本",
      "author": "灯火のテーブル",
      "world": "embers",
      "blurb": "TODO: 一行のあらすじ",
      "level": 1,
      "length": "短編（30〜45分）",
      "start": "plan",
      "vars": {
        "clock": 0,
        "prep": 0
      },
      "nodes": {
        "plan": {
          "id": "plan",
          "title": "下見",
          "art": "🔭",
          "text": [
            "TODO: 下見の場面。重ねるほど本番が楽になる。"
          ],
          "choices": [
            {
              "text": "TODO: 下見A",
              "once": true,
              "check": {
                "skill": "perception",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO"
                  ],
                  "effects": [
                    {
                      "var": "prep",
                      "add": 1
                    },
                    {
                      "setFlag": "prepA"
                    }
                  ],
                  "to": "plan"
                },
                "fail": {
                  "text": [
                    "TODO"
                  ],
                  "to": "plan"
                }
              }
            },
            {
              "text": "TODO: 下見B",
              "once": true,
              "check": {
                "skill": "investigation",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO"
                  ],
                  "effects": [
                    {
                      "var": "prep",
                      "add": 1
                    },
                    {
                      "setFlag": "prepB"
                    }
                  ],
                  "to": "plan"
                },
                "fail": {
                  "text": [
                    "TODO"
                  ],
                  "to": "plan"
                }
              }
            },
            {
              "text": "本番へ",
              "to": "run"
            }
          ]
        },
        "run": {
          "id": "run",
          "title": "本番",
          "art": "🕑",
          "text": [
            "TODO: ここから時計が進む。"
          ],
          "choices": [
            {
              "text": "TODO: 静かな手（下見が要る）",
              "requires": {
                "flag": "prepA"
              },
              "lockedText": "TODO: 下見していない",
              "effects": [
                {
                  "var": "clock",
                  "add": 1
                }
              ],
              "to": "target"
            },
            {
              "text": "TODO: 強引な手",
              "effects": [
                {
                  "var": "clock",
                  "add": 2
                }
              ],
              "to": "target"
            }
          ]
        },
        "target": {
          "id": "target",
          "title": "目的地",
          "art": "🔐",
          "text": [
            "TODO: 目的の場面。時間との勝負。"
          ],
          "choices": [
            {
              "text": "TODO: 慎重にやる",
              "effects": [
                {
                  "var": "clock",
                  "add": 2
                }
              ],
              "check": {
                "skill": "investigation",
                "dc": 14,
                "success": {
                  "text": [
                    "TODO: 成功"
                  ],
                  "to": "escape"
                },
                "fail": {
                  "text": [
                    "TODO: 失敗"
                  ],
                  "effects": [
                    {
                      "var": "clock",
                      "add": 1
                    }
                  ],
                  "to": "target"
                }
              }
            },
            {
              "text": "TODO: 時間切れが近い。引く",
              "if": {
                "var": "clock",
                "gte": 6
              },
              "to": "timeUp"
            }
          ]
        },
        "escape": {
          "id": "escape",
          "title": "脱出",
          "art": "🏃",
          "text": [
            "TODO: 戻り道"
          ],
          "choices": [
            {
              "text": "TODO: 逃げ切る",
              "if": {
                "var": "clock",
                "lte": 7
              },
              "to": "endGood"
            },
            {
              "text": "TODO: 間に合わない",
              "if": {
                "var": "clock",
                "gte": 8
              },
              "to": "timeUp"
            }
          ]
        },
        "timeUp": {
          "id": "timeUp",
          "title": "時間切れ",
          "art": "⏱️",
          "text": [
            "TODO: 時間が尽きた場面"
          ],
          "combat": {
            "title": "TODO",
            "enemies": [
              "bandit",
              "bandit"
            ],
            "onVictory": {
              "text": [
                "TODO"
              ],
              "to": "endPlain"
            },
            "onDefeat": {
              "to": "endBad"
            },
            "onFlee": {
              "to": "endBad"
            }
          }
        },
        "endGood": {
          "id": "endGood",
          "title": "TODO 良い結末",
          "art": "🌅",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "good",
            "title": "TODO 良い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endPlain": {
          "id": "endPlain",
          "title": "TODO ひとつの結末",
          "art": "🚶",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "neutral",
            "title": "TODO ひとつの結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endBad": {
          "id": "endBad",
          "title": "TODO 苦い結末",
          "art": "🩸",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "bad",
            "title": "TODO 苦い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        }
      }
    },
    "note": "変数が上限に達すると場面が強制的に変わる"
  },
  {
    "file": "route.json",
    "key": "route",
    "data": {
      "id": "route",
      "title": "route 型の見本",
      "author": "灯火のテーブル",
      "world": "embers",
      "blurb": "TODO: 一行のあらすじ",
      "level": 1,
      "length": "短編（30〜45分）",
      "start": "start",
      "vars": {
        "pursuit": 0,
        "legs": 0
      },
      "nodes": {
        "start": {
          "id": "start",
          "title": "出発",
          "art": "🚗",
          "text": [
            "TODO: 出発の場面。"
          ],
          "choices": [
            {
              "text": "出す",
              "to": "route"
            }
          ]
        },
        "route": {
          "id": "route",
          "title": "道を選ぶ",
          "art": "🗺️",
          "text": [
            "TODO: 道が三つ。それぞれ危険が違う。"
          ],
          "choices": [
            {
              "text": "TODO: 道A",
              "to": "legA"
            },
            {
              "text": "TODO: 道B",
              "to": "legB"
            },
            {
              "text": "TODO: 道C",
              "to": "legC"
            }
          ]
        },
        "legA": {
          "id": "legA",
          "title": "TODO 道A",
          "art": "🛣️",
          "text": [
            "TODO: 道Aの描写"
          ],
          "choices": [
            {
              "text": "TODO: 切り抜ける",
              "check": {
                "skill": "stealth",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 抜けた"
                  ],
                  "to": "waypoint"
                },
                "fail": {
                  "text": [
                    "TODO: 捕まった"
                  ],
                  "effects": [
                    {
                      "var": "pursuit",
                      "add": 1
                    }
                  ],
                  "to": "trouble"
                }
              }
            }
          ]
        },
        "legB": {
          "id": "legB",
          "title": "TODO 道B",
          "art": "🛣️",
          "text": [
            "TODO: 道Bの描写"
          ],
          "choices": [
            {
              "text": "TODO: 切り抜ける",
              "check": {
                "skill": "persuasion",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 抜けた"
                  ],
                  "to": "waypoint"
                },
                "fail": {
                  "text": [
                    "TODO: 捕まった"
                  ],
                  "effects": [
                    {
                      "var": "pursuit",
                      "add": 1
                    }
                  ],
                  "to": "trouble"
                }
              }
            }
          ]
        },
        "legC": {
          "id": "legC",
          "title": "TODO 道C",
          "art": "🛣️",
          "text": [
            "TODO: 道Cの描写"
          ],
          "choices": [
            {
              "text": "TODO: 切り抜ける",
              "check": {
                "skill": "perception",
                "dc": 12,
                "success": {
                  "text": [
                    "TODO: 抜けた"
                  ],
                  "to": "waypoint"
                },
                "fail": {
                  "text": [
                    "TODO: 捕まった"
                  ],
                  "effects": [
                    {
                      "var": "pursuit",
                      "add": 1
                    }
                  ],
                  "to": "trouble"
                }
              }
            }
          ]
        },
        "trouble": {
          "id": "trouble",
          "title": "道中の衝突",
          "art": "⚔️",
          "text": [
            "TODO: 戦闘に入る一行"
          ],
          "combat": {
            "title": "TODO",
            "enemies": [
              "bandit",
              "bandit"
            ],
            "onVictory": {
              "text": [
                "TODO"
              ],
              "to": "waypoint"
            },
            "onDefeat": {
              "to": "endBad"
            },
            "onFlee": {
              "effects": [
                {
                  "var": "pursuit",
                  "add": 1
                }
              ],
              "to": "waypoint"
            }
          }
        },
        "waypoint": {
          "id": "waypoint",
          "title": "一度止まる",
          "art": "🚙",
          "text": [
            "TODO: 中継点。もう一区間ある。"
          ],
          "onEnter": [
            {
              "var": "legs",
              "add": 1
            }
          ],
          "repeatEffects": true,
          "choices": [
            {
              "text": "次の区間へ——別の道に乗り換える",
              "if": {
                "var": "legs",
                "lte": 1
              },
              "to": "route"
            },
            {
              "text": "目的地へ",
              "requires": {
                "var": "legs",
                "gte": 2
              },
              "lockedText": "まだ一区間ある",
              "to": "arrival"
            }
          ]
        },
        "arrival": {
          "id": "arrival",
          "title": "到着",
          "art": "🌅",
          "text": [
            "TODO: 目的地の場面。"
          ],
          "choices": [
            {
              "text": "TODO: 良い側の選択",
              "to": "endGood"
            },
            {
              "text": "TODO: 割り切る側の選択",
              "to": "endPlain"
            }
          ]
        },
        "endGood": {
          "id": "endGood",
          "title": "TODO 良い結末",
          "art": "🌅",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "good",
            "title": "TODO 良い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endPlain": {
          "id": "endPlain",
          "title": "TODO ひとつの結末",
          "art": "🚶",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "neutral",
            "title": "TODO ひとつの結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        },
        "endBad": {
          "id": "endBad",
          "title": "TODO 苦い結末",
          "art": "🩸",
          "text": [
            "TODO: 結末の一段落"
          ],
          "ending": {
            "type": "bad",
            "title": "TODO 苦い結末",
            "text": [
              "TODO: 締めの一行"
            ]
          }
        }
      }
    },
    "note": "複数の道のうち二区間を通って目的地へ"
  }
];

export const templateByKey = key => TEMPLATES.find(t => t.key === key) || null;
