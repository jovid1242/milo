/**
 * Raw color primitives. Components never use these directly — they use the
 * semantic tokens in `colors.ts`.
 *
 * Sampled from the app's own art: quest SVG icons (#2F6B46, #163E2C, #F4C95D,
 * #D7B36A, #FFFDF8), Milo's body and beanie, badge wood and gold, camp scene.
 */
export const palette = {
  white: '#FFFFFF',

  forest50: '#F1F6F1',
  forest100: '#DCEADF',
  forest200: '#B9D3BF',
  forest300: '#8DB598',
  forest400: '#5E9270',
  forest500: '#3F7D55',
  forest600: '#2F6B46',
  forest700: '#245638',
  forest800: '#1B442C',
  forest900: '#163E2C',

  cream50: '#FFFDF8',
  cream100: '#FAF5EC',
  cream200: '#F3EADB',
  cream300: '#E8DAC3',

  wood200: '#E9D3AE',
  wood300: '#D7B36A',
  wood400: '#C08A4E',
  wood500: '#A86E36',
  wood600: '#8D562B',
  wood700: '#6B3F1F',
  wood800: '#4C290C',

  gold50: '#FFF8E6',
  gold100: '#FFF1CC',
  gold200: '#FBE1A0',
  gold400: '#F4C95D',
  gold500: '#EAAE3A',
  gold700: '#8F6310',

  ink50: '#F6F7F4',
  ink100: '#ECEFEA',
  ink200: '#DDE2DC',
  ink300: '#B7BEB8',
  ink400: '#8A938B',
  ink500: '#667067',
  ink700: '#3A433C',
  ink900: '#151A16',

  // Journey environments, sampled from the journey art (river water, mountain sky)
  // and lightened to background strength.
  river50: '#EEF7FA',
  sky50: '#F1F4F9',

  ember500: '#E8641E',
  red50: '#FBEAE7',
  red500: '#C8473B',
  red700: '#9E3329',
} as const;
