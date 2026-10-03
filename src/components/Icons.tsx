import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme';

type P = { size?: number; color?: string };

export const BackIcon = ({ size = 20, color = colors.plum }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 5 L8 12 L15 19" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const HeartIcon = ({ size = 20, color = colors.plum, filled }: P & { filled?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M12 20.5 C7 16.8 3.2 13.6 3.2 9.4 C3.2 6.7 5.3 4.6 7.9 4.6 C9.6 4.6 11.1 5.5 12 6.9 C12.9 5.5 14.4 4.6 16.1 4.6 C18.7 4.6 20.8 6.7 20.8 9.4 C20.8 13.6 17 16.8 12 20.5 Z"
      stroke={color}
      strokeWidth={1.6}
      strokeLinejoin="round"
      fill={filled ? color : 'none'}
    />
  </Svg>
);

export const ShuffleIcon = ({ size = 20, color = colors.plum }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M3 7 H7 C11 7 13 17 17 17 H21 M18 14 L21 17 L18 20 M3 17 H7 C8.6 17 9.8 15.4 10.8 13.6 M13.2 10.4 C14.2 8.6 15.4 7 17 7 H21 M18 4 L21 7 L18 10"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const InfoIcon = ({ size = 20, color = colors.plum }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 21 A9 9 0 1 0 12 3 A9 9 0 1 0 12 21 Z" stroke={color} strokeWidth={1.5} />
    <Path d="M12 11 V16.5 M12 7.6 V7.8" stroke={color} strokeWidth={1.9} strokeLinecap="round" />
  </Svg>
);

export const SoundIcon = ({ size = 20, color = colors.plum, off }: P & { off?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M4 9.5 H7.5 L12 5.5 V18.5 L7.5 14.5 H4 Z" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    {off ? (
      <Path d="M16 9.5 L21 14.5 M21 9.5 L16 14.5" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    ) : (
      <Path
        d="M15.5 9 C16.6 10.4 16.6 13.6 15.5 15 M18.2 6.6 C20.5 9.2 20.5 14.8 18.2 17.4"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    )}
  </Svg>
);

export const NextIcon = ({ size = 18, color = '#FFF8EA' }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 12 H19 M13 6 L19 12 L13 18" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const CloseIcon = ({ size = 18, color = colors.plum }: P) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6 L18 18 M18 6 L6 18" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
  </Svg>
);
