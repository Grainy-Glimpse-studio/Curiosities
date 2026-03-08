// Font configs for random selection
export interface FontConfig {
  name: string;
  file: string | null;
  size: number;
}

// English font configs
export const ENGLISH_FONT_CONFIG: FontConfig[] = [
  { name: 'Courier', file: null, size: 18 },
  { name: 'Courier New', file: null, size: 18 },
  { name: 'Erika Ormig', file: 'Erika Ormig.ttf', size: 20 },
  { name: 'Erika PL DWS', file: 'Erika PL DWS wariant.otf', size: 26 },
  { name: 'Gabriele Light', file: 'gabriele-l.ttf', size: 20 },
  { name: 'Kingthings Typewriter', file: 'Kingthings_Trypewriter_2.ttf', size: 20 },
  { name: 'Nazi Typewriter', file: 'NaziTypewriterRegular.ttf', size: 20 },
  { name: 'Buadly Signature', file: 'BuadlySignature.ttf', size: 24 },
  { name: 'Wolgast Rand', file: 'WolgastRand.ttf', size: 32 },
  { name: 'Penna', file: 'penna.otf', size: 32 },
  { name: 'Tango', file: 'Tango.woff', size: 32 },
];

// Chinese font configs
export const CHINESE_FONT_CONFIG: FontConfig[] = [
  { name: '匯文明朝體', file: '汇文明朝体.otf', size: 22 },
  { name: '京華老宋體', file: '京華老宋体2.0.ttf', size: 22 },
  { name: '中華薪火體', file: '中华薪火体.ttf', size: 24 },
];

// Helper to detect if text contains Chinese
export const isChinese = (text: string) => /[\u4e00-\u9fa5]/.test(text);

// Get random font config based on text content
export const getRandomFontForText = (text: string): FontConfig => {
  const config = isChinese(text) ? CHINESE_FONT_CONFIG : ENGLISH_FONT_CONFIG;
  return config[Math.floor(Math.random() * config.length)];
};

// Get a random font for a specific language
export const getRandomFont = (language: 'chinese' | 'english'): FontConfig => {
  const config = language === 'chinese' ? CHINESE_FONT_CONFIG : ENGLISH_FONT_CONFIG;
  return config[Math.floor(Math.random() * config.length)];
};
