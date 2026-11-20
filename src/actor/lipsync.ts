/**
 * Text → viseme timeline for Mandarin lines.
 *
 * Each hanzi is one syllable. We map the syllable's main vowel (from a small
 * built-in table of common characters) to one of the five VRM visemes:
 *   aa (a, ai, an, ang, ao, ia, ian…)   ih (i, in, ing, -i)
 *   ee (e, ei, en, eng, ie, ui)          oh (o, uo, ong)
 *   ou (u, ou, iu, ü)
 * Unknown characters fall back to a stable hash so the mouth still moves
 * naturally. Punctuation inserts pauses. Latin words get ~2 syllables.
 */

export type Viseme = 'aa' | 'ih' | 'ou' | 'ee' | 'oh';

export interface VisemeKey {
  t: number; // start (s)
  d: number; // duration (s)
  v: Viseme;
  w: number; // peak weight 0..1
}

export interface VisemeTrack {
  keys: VisemeKey[];
  duration: number;
}

// Characters grouped by viseme. Covers the demo script plus several hundred
// high-frequency characters used in romance / drama dialogue.
const TABLE: Record<Viseme, string> = {
  aa: '啊阿大他她它那哪吧怕家加假价下夏吓卡拉啦妈吗嘛马骂发法八把爸茶查差沙杀傻牙呀压鸭在再载才菜采彩开凯该改还孩海害来赖太泰台抬带待代戴袋白百摆拜买卖卖排派奶耐赛晒外坏怀快块帅爱哀矮晚完玩万湾弯碗关管惯观光广逛黄皇慌换欢环患缓看砍干赶敢感刚钢港杠讲江将降强墙抢想香相向像象箱乡样养阳洋央亮良两凉粮量娘让嚷上伤尚商赏伤常场长唱厂场张掌丈帐章当党挡忙盲芒放房方芳防访胖旁帮棒傍扛抗康慌王网往忘望谈坦探叹谈弹难男南蓝篮懒烂山闪善扇伞散三产单胆担但淡安岸暗按案班般板办半伴满慢漫盼判翻反饭凡烦范站占战展湛然染燃见间简减剪尖坚件建健键钱前浅千牵签欠先现线鲜险显仙天田甜填点电店典颠年念连脸练恋莲联边变便遍片偏篇面眠棉免言眼烟演研严炎宴验燕颜岩脸到道倒岛刀导好号毫豪高告搞稿早造澡枣找照招朝潮吵炒少烧绍跑抛炮保报宝包抱毛冒帽猫老劳脑闹恼草曹考靠烤扫嫂套逃讨桃要药摇遥咬腰邀笑小校消晓萧桥巧瞧鸟料聊辽表标票飘漂苗庙秒妙掉调跳条挑交教叫较觉焦',
  ih: '你泥呢腻一以已衣医依意义易亿艺忆移姨疑椅亦异益里理李力立利例离礼丽历哩厉黎西喜洗系细希习席惜吸息稀戏吉几机鸡及级极即急集记计纪寄技季继迹奇其起气汽期器齐骑七妻弃企启提题体替踢梯地第低底弟帝滴敌笛比笔必闭鼻避币彼米迷密蜜秘弥匹皮批屁是时事十石实识使世市史式试室视始师诗失湿食拾适释势饰知直只之指止至治纸志制智质值职执纸日次此词刺字自子紫资姿死四思私丝斯寺似心新信辛欣星行性姓醒形型兴幸今进近金尽紧斤静晶京经精井景境竟敬睛请情清青轻亲琴勤晴庆明名命鸣民敏您宁凝停听亭庭厅挺定丁顶订林临邻灵领另零铃宾冰病兵并品平评瓶凭英应因音印银影营迎硬赢',
  ee: '的得德地特这着者车扯哲热惹的了乐勒个各歌哥格隔可课客克科渴喝和合河何贺盒色社设射舍蛇额饿恶鹅么么们门闷怎曾增真针阵镇珍振陈晨尘沉趁称城成承程诚身深神生升声省胜剩圣绳什人认任忍仁本奔笨分份风封峰丰逢粉愤奋跟根更耕很恨痕恒横能嫩疼腾等灯登邓冷愣朋碰捧蓬猛梦盟每美没妹媚梅眉煤被北备背杯悲贝给黑嘿内雷类泪累谁水睡税对队推退腿嘴最醉罪会回为位维味喂未微卫围危伟尾谓委贵鬼归规跪亏葵吹垂追随岁虽碎蕊锐也夜叶业页野爷谢写些鞋血姐接界借节街解结切且茄铁贴别憋灭咧烈列裂学雪月越约悦乐略觉缺确却决绝嗯恩儿而耳二',
  oh: '我窝握卧哦喔说所锁索做作坐座左多朵躲夺过国果锅郭火活或货获伙落罗洛络脱托妥拖弄红宏洪哄中种重终钟众总纵从丛匆同通痛童统铜东懂动冻洞空孔控工公功共攻宫容荣融用永勇拥泳雄熊胸穷琼兄送松宋颂龙隆陇笼浓脓哦破婆迫泼摸末莫默魔模没博波伯薄播佛',
  ou: '不布步部补捕都读度独毒肚堵赌渡顾故古股骨谷鼓固苦哭库酷裤户护互湖呼胡虎壶糊乎主住注猪祝助竹出初处除楚书输树数属术舒熟叔入如乳辱无五午舞物务误屋吴武雾路陆录露炉鹿卢福服富父复负夫付府附扶浮符妇木目母幕牧亩努奴怒素速宿诉租组足族祖粗醋苏俗徒图土兔吐突涂去曲取趣区娶句局举具据剧居聚巨菊绿旅律虑女于与语雨鱼遇玉育预欲余愚宇羽续许须需虚徐序绪有又友右由油游优忧幽流留六刘柳求球秋酒九就久旧救究休修秀袖牛扭丢后候厚口扣走奏收手首受守寿兽周州洲轴舟头投透豆斗抖楼漏搂肉柔揉都够狗勾沟购谋某否剖欧偶',
};

const MAP = new Map<string, Viseme>();
for (const [v, chars] of Object.entries(TABLE) as [Viseme, string][]) {
  for (const ch of chars) if (!MAP.has(ch)) MAP.set(ch, v);
}

const FALLBACK: Viseme[] = ['aa', 'ee', 'ih', 'aa', 'oh', 'ou', 'ee', 'aa'];

export function visemeForChar(ch: string): Viseme {
  const v = MAP.get(ch);
  if (v) return v;
  return FALLBACK[ch.codePointAt(0)! % FALLBACK.length];
}

const PAUSE: Record<string, number> = {
  '，': 0.2, ',': 0.2, '、': 0.14, '；': 0.26, ';': 0.26, '：': 0.2, ':': 0.2,
  '。': 0.36, '.': 0.3, '！': 0.36, '!': 0.36, '？': 0.4, '?': 0.4,
  '…': 0.22, '—': 0.18, '～': 0.12, '~': 0.12, ' ': 0.06, '\n': 0.3,
  '“': 0, '”': 0, '「': 0, '」': 0, '《': 0, '》': 0, '（': 0, '）': 0, '(': 0, ')': 0,
};

function isHan(ch: string) {
  return /\p{Script=Han}/u.test(ch);
}

/**
 * Build a viseme track. `rate` = syllables per second (≈4.3 is natural
 * Mandarin drama delivery; slow tender lines ≈3.4, angry ≈5.2).
 */
export function buildVisemeTrack(text: string, rate = 4.3): VisemeTrack {
  const keys: VisemeKey[] = [];
  let t = 0.05;
  const syl = 1 / rate;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch in PAUSE) {
      t += PAUSE[ch];
      continue;
    }
    if (isHan(ch)) {
      // phrase-final syllables are a touch longer and softer
      const next = chars[i + 1];
      const final = next === undefined || next in PAUSE;
      const d = syl * (final ? 1.25 : 1) * (0.92 + ((ch.codePointAt(0)! * 7) % 17) / 100);
      keys.push({ t, d, v: visemeForChar(ch), w: final ? 0.75 : 0.9 });
      t += d;
    } else if (/[A-Za-z0-9]/.test(ch)) {
      // latin letters: roughly one syllable per 2.5 letters
      let j = i;
      while (j < chars.length && /[A-Za-z0-9]/.test(chars[j])) j++;
      const word = chars.slice(i, j).join('');
      const n = Math.max(1, Math.round(word.length / 2.5));
      for (let k = 0; k < n; k++) {
        keys.push({ t, d: syl * 0.9, v: FALLBACK[(word.charCodeAt(k) + k) % FALLBACK.length], w: 0.8 });
        t += syl * 0.9;
      }
      i = j - 1;
    }
  }
  return { keys, duration: t + 0.15 };
}

/** Sample viseme weights at time t (seconds since line start). */
export function sampleVisemes(track: VisemeTrack, t: number, out: Record<Viseme, number>) {
  out.aa = out.ih = out.ou = out.ee = out.oh = 0;
  for (const k of track.keys) {
    if (t < k.t - 0.06 || t > k.t + k.d + 0.08) continue;
    // attack 35% / hold / release: a smooth bump with slight lead so the
    // mouth opens just before the sound (reads better on screen)
    const x = (t - (k.t - 0.04)) / (k.d + 0.08);
    if (x <= 0 || x >= 1) continue;
    const bump = Math.sin(Math.PI * Math.pow(x, 0.85));
    out[k.v] = Math.max(out[k.v], bump * k.w);
  }
}
