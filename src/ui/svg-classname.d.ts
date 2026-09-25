// NativeWind `className` on the react-native-svg shapes registered with cssInterop in components/svgInterop.ts.
// cssInterop targets `style`, which react-native-svg accepts at runtime but doesn't declare.
import type { StyleProp, ViewStyle } from 'react-native';
import 'react-native-svg';

declare module 'react-native-svg' {
  interface PathProps {
    className?: string;
    style?: StyleProp<ViewStyle>;
  }
  interface EllipseProps {
    className?: string;
    style?: StyleProp<ViewStyle>;
  }
  interface RectProps {
    className?: string;
    style?: StyleProp<ViewStyle>;
  }
}
