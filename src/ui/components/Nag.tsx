import { cssInterop } from 'nativewind';
import { View } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';

import { TONE, type UiTone } from '../tone';

// Colours stay tokens: shapes take NativeWind fill-*/stroke-* classes. cssInterop turns them
// into style; native then maps fill/stroke to SVG props, and web (react-native-web) emits the
// CSS classes. Typings for className/style: src/ui/svg-classname.d.ts.
const svgClassName = {
  className: { target: 'style', nativeStyleToProp: { fill: true, stroke: true } },
} as const;
cssInterop(Path, svgClassName);
cssInterop(Ellipse, svgClassName);
cssInterop(Rect, svgClassName);

interface NagProps {
  tone: UiTone;
  /** Diameter in px of the tinted circle. */
  size?: number;
}

/**
 * Nag, calm variant only (per-tone expressions arrive with F006). Simplified from
 * docs/design/screens/nag-irritated.svg: blob body, half-lidded eyes, flat mouth.
 * The outline takes the tone colour; the circle behind it a tone tint.
 */
export function Nag({ tone, size = 40 }: NagProps) {
  const t = TONE[tone];
  return (
    <View
      className={`items-center justify-center rounded-full ${t.tint}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 200 200">
        <Path
          d="M100 24 C148 24 176 56 176 104 C176 150 144 174 100 174 C56 174 24 150 24 104 C24 56 52 24 100 24 Z"
          className={`fill-surface ${t.stroke}`}
          strokeWidth={10}
        />
        <Ellipse cx={72} cy={98} rx={14} ry={11} className="fill-ink" />
        <Ellipse cx={128} cy={98} rx={14} ry={11} className="fill-ink" />
        <Rect x={54} y={82} width={38} height={15} className="fill-surface" />
        <Rect x={108} y={82} width={38} height={15} className="fill-surface" />
        <Path
          d="M58 94 L88 94 M112 94 L142 94"
          className="stroke-ink"
          strokeWidth={6}
          strokeLinecap="round"
        />
        <Path d="M82 130 L118 130" className="stroke-ink" strokeWidth={7} strokeLinecap="round" />
      </Svg>
    </View>
  );
}
