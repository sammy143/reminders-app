import { render, screen } from '@testing-library/react-native';

import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('renders the placeholder heading and empty-state copy', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Nothing to nag you about yet.')).toBeTruthy();
  });
});
