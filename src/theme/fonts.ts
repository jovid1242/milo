// Per-weight subpath imports: only these six font files are bundled,
// not all 36 weights of both families.
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { Fraunces_700Bold } from '@expo-google-fonts/fraunces/700Bold';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';

import { fontFamilies } from './tokens/typography';

export const fontSources = {
  [fontFamilies.displaySemiBold]: Fraunces_600SemiBold,
  [fontFamilies.displayBold]: Fraunces_700Bold,
  [fontFamilies.regular]: Inter_400Regular,
  [fontFamilies.medium]: Inter_500Medium,
  [fontFamilies.semiBold]: Inter_600SemiBold,
  [fontFamilies.bold]: Inter_700Bold,
};
