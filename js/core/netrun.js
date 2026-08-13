/* ネットラン — 電脳侵入の小さな状態機械。

   戦闘と同じ形（start / options / act）で動くので、UI もエンジンも同じ扱い
   ができる。違うのは殴り合いではなく、層をひとつずつ抜けていくこと。

   毎層、どう抜けるかを選ぶ。速い手ほど痕跡（trace）が増え、痕跡が上限に
   達すると追跡が完了して弾き出される。ICE が設定されていれば、そのまま
   電脳内での戦闘になる。

   シナリオ側の書き方:
     netrun: {
       title: '社内網', traceMax: 6,
       layers: [
         { name: '外周ファイアウォール', skill: 'netops', dc: 13 },
         { name: '認証ゲート', skill: 'tech', dc: 14, onFail: { damage: '1d6' } },
         { name: '保管庫', skill: 'netops', dc: 15, effects: [{ setFlag: 'gotFiles' }] },
       ],
       ice: ['ice'],                       // 痕跡が満ちたときに出てくる相手
       onSuccess: { to: 'node-a' }, onTraced: { to: 'node-b' },
     } */

import { check, applyDamage, skillMod } from './rules.js';
import { roll } from './dice.js';

/* 抜け方。trace は成功しても増えるものがある — 速さの代償。 */
export const APPROACHES = [
  {
    id: 'careful', name: '慎重に潜る',
    desc: '時間をかけて痕跡を消す。判定は有利だが、そのぶん相手も気づきはじめる。',
    advantage: true, dcMod: 0, traceOnSuccess: 1, traceOnFail: 1,
  },
  {
    id: 'fast', name: '一気に押し通る',
    desc: '素直に叩く。成功すれば痕跡は増えないが、失敗すると大きく残る。',
    advantage: false, dcMod: 0, traceOnSuccess: 0, traceOnFail: 2,
  },
  {
    id: 'bypass', name: '迂回路を探す',
    desc: '別経路から入る。難易度は上がるが、成功すれば痕跡は一切残らない。',
    advantage: false, dcMod: 3, traceOnSuccess: 0, traceOnFail: 2,
  },
  {
    id: 'burn', name: '強引に焼き切る',
    desc: '防壁を力ずくで破る。必ず抜けられるが、痕跡は跳ね上がり、反動を受ける。',
    auto: true, traceOnSuccess: 3, traceOnFail: 3, backlash: '1d6',
  },
];

export class Netrun {
  /**
   * @param {object} spec シナリオの netrun 定義
   * @param {object[]} party 参加キャラクター（判定役はここから選ぶ）
   * @param {object} [opts] {rng, onLog}
   */
  constructor(spec, party, opts = {}) {
    this.spec = spec;
    this.party = party;
    this.rng = opts.rng;
    this.onLog = opts.onLog || null;

    this.layers = (spec.layers || []).map(l => ({ ...l }));
    this.index = 0;
    this.trace = 0;
    this.traceMax = spec.traceMax ?? 6;
    this.log = [];
    this.over = false;
    this.result = null;
    this.runnerId = null;
  }

  say(text, kind = 'info') {
    const entry = { text, kind, at: Date.now() };
    this.log.push(entry);
    this.onLog?.(entry);
    return entry;
  }

  get layer() { return this.layers[this.index] || null; }
  get living() { return this.party.filter(p => p.hp > 0 && !p.dead); }

  /** 誰が潜るか。指定がなければその層の技能が一番高い者。 */
  runner(skillId = this.layer?.skill) {
    if (this.runnerId) {
      const chosen = this.living.find(p => p.id === this.runnerId);
      if (chosen) return chosen;
    }
    return this.candidates(skillId)[0]?.pc || this.living[0] || null;
  }

  candidates(skillId = this.layer?.skill) {
    return this.living
      .map(pc => ({ pc, id: pc.id, name: pc.name, mod: skillId ? skillMod(pc, skillId) : 0 }))
      .sort((a, b) => b.mod - a.mod);
  }

  start() {
    this.say(`— ${this.spec.title || 'ネットラン'} 接続 —`, 'header');
    this.say(`層 ${this.layers.length}／追跡上限 ${this.traceMax}`, 'muted');
    if (!this.layers.length) {
      this.over = true;
      this.result = 'success';
      return this.finish();
    }
    this.announceLayer();
    return { done: false, layer: this.layer };
  }

  announceLayer() {
    const layer = this.layer;
    this.say(`第${this.index + 1}層：${layer.name}（DC${layer.dc}／【${layer.skill}】）`, 'scene');
    if (layer.text) for (const line of [].concat(layer.text)) this.say(line, 'narration');
  }

  /** いま選べる手。 */
  options() {
    if (this.over || !this.layer) return [];
    return APPROACHES.map(a => ({
      kind: 'netrun', id: a.id, name: a.name, desc: a.desc,
      dc: a.auto ? null : this.layer.dc + (a.dcMod || 0),
    }));
  }

  /**
   * 一手進める。
   * @param {object} action {id: 抜け方, actorId?}
   */
  act(action) {
    if (this.over) return { error: 'すでに終了しています' };
    const approach = APPROACHES.find(a => a.id === action.id);
    if (!approach) return { error: '不明な手です' };
    const layer = this.layer;
    if (action.actorId) this.runnerId = action.actorId;
    const actor = this.runner(layer.skill);
    if (!actor) { this.over = true; this.result = 'traced'; return this.finish(); }

    let success;
    if (approach.auto) {
      success = true;
      this.say(`${actor.name}は防壁を焼き切った。`, 'good');
      if (approach.backlash) {
        const hit = roll(approach.backlash, { rng: this.rng });
        const applied = applyDamage(actor, hit.total, 'データ');
        this.say(`反動 — ${actor.name}に ${applied.dealt} ダメージ（${actor.hp}/${actor.maxHp}）`, 'bad');
      }
    } else {
      const dc = layer.dc + (approach.dcMod || 0);
      const result = check(actor, layer.skill, dc, { rng: this.rng, advantage: approach.advantage });
      this.say(result.text, result.success ? 'roll-good' : 'roll-bad');
      success = result.success;
    }

    this.addTrace(success ? approach.traceOnSuccess : approach.traceOnFail);

    if (!success) {
      if (layer.onFail?.damage) {
        const hit = roll(String(layer.onFail.damage), { rng: this.rng });
        const applied = applyDamage(actor, hit.total, 'データ');
        this.say(`防壁の反撃 — ${actor.name}に ${applied.dealt} ダメージ（${actor.hp}/${actor.maxHp}）`, 'bad');
        if (applied.downed) this.say(`${actor.name}は接続を切られ、意識を失った。`, 'bad');
      }
      if (layer.onFail?.text) for (const line of [].concat(layer.onFail.text)) this.say(line, 'narration');
    }

    if (this.trace >= this.traceMax) {
      this.over = true;
      this.result = 'traced';
      this.say('追跡完了 — 逆探知された。', 'bad');
      return this.finish();
    }
    if (!this.living.length) {
      this.over = true;
      this.result = 'traced';
      return this.finish();
    }

    if (success) {
      this.say(`第${this.index + 1}層を突破。`, 'good');
      this.index += 1;
      if (this.index >= this.layers.length) {
        this.over = true;
        this.result = 'success';
        return this.finish();
      }
      this.announceLayer();
    } else {
      this.say('突破できない。もう一度試すしかない。', 'muted');
    }
    return { done: false, layer: this.layer, trace: this.trace };
  }

  addTrace(amount = 0) {
    if (!amount) return;
    this.trace = Math.min(this.traceMax, this.trace + amount);
    const bar = '■'.repeat(this.trace) + '□'.repeat(Math.max(0, this.traceMax - this.trace));
    this.say(`追跡 +${amount} 〔${bar}〕`, this.trace >= this.traceMax - 1 ? 'bad' : 'muted');
  }

  finish() {
    if (this.result === 'success') this.say('— 目的の階層に到達した —', 'good');
    else this.say('— 接続を切られた —', 'bad');
    return { done: true, result: this.result, trace: this.trace, log: this.log };
  }

  /** UI が読む要約。 */
  state() {
    return {
      title: this.spec.title || 'ネットラン',
      layerIndex: this.index,
      layerCount: this.layers.length,
      layer: this.layer ? { name: this.layer.name, skill: this.layer.skill, dc: this.layer.dc } : null,
      trace: this.trace,
      traceMax: this.traceMax,
      over: this.over,
      result: this.result,
      runner: this.runner()?.name || null,
      candidates: this.candidates().map(c => ({ id: c.id, name: c.name, mod: c.mod })),
    };
  }
}
