import { cssInterop } from 'nativewind';
import { Ellipse, Path, Rect } from 'react-native-svg';

// Colours stay tokens: shapes take NativeWind fill-*/stroke-* classes. cssInterop turns them
// into style; native then maps fill/stroke to SVG props, and web (react-native-web) emits the
// CSS classes. Registered once here for every SVG in ui/. Typings: src/ui/svg-classname.d.ts.
const svgClassName = {
  className: { target: 'style', nativeStyleToProp: { fill: true, stroke: true } },
} as const;
cssInterop(Path, svgClassName);
cssInterop(Ellipse, svgClassName);
cssInterop(Rect, svgClassName);
