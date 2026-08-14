/* 立場 — その世界で「あなたが何者として扱われるか」を一本の目盛りにしたもの。

   ネオンの雨では信用スコア。金とは別で、金より先に効く。宿を断られるのも、
   医者に前金を求められるのも、区画に入れないのも、残高ではなく段位のせいだ。

   世界が standing を宣言していなければ、この層は何もしない。ファンタジー側は
   宣言していないので、段位も表示も出ない——世界ごとにルールが違ってよい、
   というのがこの設計の意味である。

   世界の宣言:
     standing: {
       name: '信用スコア', short: '信用',
       start: 2,                      // 作成時の既定値
       tiers: [ { at: 0, name: '存在しない', priceScale: …, note: … }, … ],
     }

   シナリオからは効果と条件で触る:
     effects:  [{ standing: -1, note: '顔が記録された' }]
     if:       { standing: { gte: 3 } } */

import { activeWorld } from '../worlds/index.js';

/** この世界に立場の概念があるか。UI の出し分けに使う。 */
export const hasStanding = () => !!activeWorld().standing;

export const standingSpec = () => activeWorld().standing || null;

/** 目盛りの上限。宣言された段位の数から決まる。 */
export const maxStanding = () => Math.max(0, (standingSpec()?.tiers?.length ?? 1) - 1);

/** 値を段位の範囲に収める。 */
export const clampStanding = value =>
  Math.max(0, Math.min(maxStanding(), Math.round(Number(value) || 0)));

/** 作成時の既定値。世界が言わなければ真ん中。 */
export function startingStanding() {
  const spec = standingSpec();
  if (!spec) return 0;
  return clampStanding(spec.start ?? Math.floor(maxStanding() / 2));
}

/**
 * この人物の立場。世界が立場を持たなければ 0。
 *
 * 既定値をここに集めるのが肝心だ。以前は表示側が「未設定なら初期値」、
 * 条件側が「未設定なら 0」と別々に決めていて、古いセーブを読むと
 * 画面には「企業級」と出るのに扉は開かない、という食い違いが起きた。
 */
export function standingOf(character) {
  if (!hasStanding()) return 0;
  return clampStanding(character?.standing ?? startingStanding());
}

/** その値がどの段位に当たるか。 */
export function tierOf(value) {
  const spec = standingSpec();
  if (!spec?.tiers?.length) return null;
  const at = clampStanding(value);
  // 宣言された at 以下でいちばん高いものを採る。段位は飛び番でもよい。
  let best = spec.tiers[0];
  for (const tier of spec.tiers) if (at >= tier.at) best = tier;
  return best;
}

/**
 * 立場に応じた値段の倍率。段位が低いほど、同じものが高くつく。
 * 前金を求められる、足元を見られる——それを一つの数にしたもの。
 */
export function priceScale(character) {
  return tierOf(standingOf(character))?.priceScale ?? 1;
}

/** 表示用のひとこと。「並（3）」のような形。 */
export function standingLabel(character) {
  const spec = standingSpec();
  if (!spec) return '';
  const value = standingOf(character);
  return `${tierOf(value)?.name ?? value}（${value}/${maxStanding()}）`;
}

/**
 * 立場を動かす。範囲外には出ない。
 * @returns {{before:number, after:number, tier:object|null, changedTier:boolean}}
 */
export function adjustStanding(character, delta) {
  const before = standingOf(character);
  const after = clampStanding(before + delta);
  character.standing = after;
  return {
    before, after,
    tier: tierOf(after),
    changedTier: tierOf(before)?.name !== tierOf(after)?.name,
  };
}
