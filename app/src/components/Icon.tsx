import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'flask'
  | 'scan'
  | 'user'
  | 'heart'
  | 'heartFill'
  | 'search'
  | 'clock'
  | 'arrowLeft'
  | 'arrowRight'
  | 'close'
  | 'apple'
  | 'mail'
  | 'leaf'
  | 'shield'
  | 'spark'
  | 'drop'
  | 'image'
  | 'text'
  | 'check'
  | 'alert'
  | 'bolt'
  | 'logout'
  | 'history';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

// Thin-line icon set drawn on a 24px grid so it matches the hairline UI.
export function Icon({ name, size = 22, color = colors.ink, strokeWidth = 1.5 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const body = (() => {
    switch (name) {
      case 'flask':
        return (
          <>
            <Path d="M9.5 3h5M10 3v6.2L4.8 18.1A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-2.9L14 9.2V3" {...p} />
            <Path d="M7.2 14h9.6" {...p} />
          </>
        );
      case 'scan':
        return (
          <>
            <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" {...p} />
            <Path d="M8 9.5h8M8 12h8M8 14.5h5" {...p} />
          </>
        );
      case 'user':
        return (
          <>
            <Circle cx="12" cy="8.5" r="3.8" {...p} />
            <Path d="M4.5 20.5c1.2-3.6 4-5.3 7.5-5.3s6.3 1.7 7.5 5.3" {...p} />
          </>
        );
      case 'heart':
        return <Path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20Z" {...p} />;
      case 'heartFill':
        return <Path d="M12 20s-7.5-4.6-7.5-10.1A4.4 4.4 0 0 1 12 7.2a4.4 4.4 0 0 1 7.5 2.7C19.5 15.4 12 20 12 20Z" {...p} fill={color} />;
      case 'search':
        return (
          <>
            <Circle cx="11" cy="11" r="6.5" {...p} />
            <Path d="m16 16 4 4" {...p} />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle cx="12" cy="12" r="8.5" {...p} />
            <Path d="M12 7.5V12l3 2" {...p} />
          </>
        );
      case 'arrowLeft':
        return <Path d="M19 12H5M11 6l-6 6 6 6" {...p} />;
      case 'arrowRight':
        return <Path d="M5 12h14M13 6l6 6-6 6" {...p} />;
      case 'close':
        return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
      case 'apple':
        return (
          <Path
            d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.3 1.3-2.5 1.3-2.6 0 0-2.5-1-2.5-3.6ZM14.1 5.5c.6-.8 1.1-1.9 1-2.9-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.8 1 .1 2.1-.5 2.7-1.3Z"
            fill={color}
          />
        );
      case 'mail':
        return (
          <>
            <Rect x="3.5" y="5.5" width="17" height="13" rx="2" {...p} />
            <Path d="m4 7 8 6 8-6" {...p} />
          </>
        );
      case 'leaf':
        return (
          <>
            <Path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" {...p} />
            <Path d="M5 19c3-4 6-6.5 9.5-8.5" {...p} />
          </>
        );
      case 'shield':
        return (
          <>
            <Path d="M12 3.5 5 6v5.5c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6l-7-2.5Z" {...p} />
            <Path d="m9 12 2.2 2.2L15.5 10" {...p} />
          </>
        );
      case 'spark':
        return <Path d="M12 3.5 13.8 10l6.7 2-6.7 2L12 20.5 10.2 14l-6.7-2 6.7-2L12 3.5Z" {...p} />;
      case 'drop':
        return <Path d="M12 3.5s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11Z" {...p} />;
      case 'image':
        return (
          <>
            <Rect x="3.5" y="4.5" width="17" height="15" rx="2" {...p} />
            <Circle cx="9" cy="9.5" r="1.6" {...p} />
            <Path d="m4 17 4.5-4.5 3.5 3.5 2.5-2.5L20 19" {...p} />
          </>
        );
      case 'text':
        return <Path d="M5 6.5h14M5 11h14M5 15.5h9M5 20h6" {...p} />;
      case 'check':
        return <Path d="m5 12.5 4.5 4.5L19 7.5" {...p} />;
      case 'alert':
        return (
          <>
            <Path d="M12 4 2.8 19.5h18.4L12 4Z" {...p} />
            <Path d="M12 10v4.2M12 16.8v.2" {...p} />
          </>
        );
      case 'bolt':
        return <Path d="M13 3 5.5 13.5H12L11 21l7.5-10.5H12L13 3Z" {...p} />;
      case 'logout':
        return <Path d="M10 4.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 19.5h4M15 8l4 4-4 4M19 12H9.5" {...p} />;
      case 'history':
        return (
          <>
            <Path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" {...p} />
            <Path d="M4 4v4.5h4.5M12 8v4l2.8 1.8" {...p} />
          </>
        );
    }
  })();
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}
