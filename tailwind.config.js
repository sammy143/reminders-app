// Design tokens mirror docs/design/DESIGN.md — change them there first, then here.
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#F7F7F5',
        surface: '#FFFFFF',
        ink: { DEFAULT: '#1C1C1E', muted: '#6B6B70' },
        line: '#E5E5E2',
        primary: '#1C1C1E',
        tone: {
          polite: '#14B8A6',
          firm: '#F59E0B',
          sarcastic: '#F97316',
          rude: '#EF4444',
          savage: '#B91C1C',
          supportive: '#6366F1',
          done: '#22C55E',
        },
      },
      fontFamily: {
        // Fonts are not loaded yet (see docs/exec-plans F001 Decisions); these fall back to system.
        heading: ['BricolageGrotesque'],
        body: ['Inter'],
      },
      fontSize: {
        display: ['34px', { lineHeight: '40px', fontWeight: '800' }],
        title: ['24px', { lineHeight: '30px', fontWeight: '700' }],
        headline: ['17px', { lineHeight: '22px', fontWeight: '600' }],
        body: ['15px', { lineHeight: '21px', fontWeight: '400' }],
        label: ['13px', { lineHeight: '18px', fontWeight: '500' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
        countdown: ['48px', { lineHeight: '52px', fontWeight: '800' }],
      },
      borderRadius: {
        card: '16px',
        button: '12px',
      },
    },
  },
  plugins: [],
};
