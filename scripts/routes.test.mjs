// Tests for the route-literal check (scripts/routes.mjs). Run: node --test scripts/
// The fixture tree mirrors Expo Router's layout: groups, nested groups, _layout and +special files.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { routeExists } from './routes.mjs';

const APP = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__', 'app');

test('resolves routes through route groups at any level', () => {
  for (const route of [
    '/', // (tabs)/index.tsx
    '/settings', // (tabs)/settings.tsx
    '/deep', // (tabs)/(inner)/deep.tsx
    '/account', // (auth)/account/index.tsx
    '/(tabs)/settings', // a group named explicitly
    '/(tabs)',
    '/appointment/[id]',
    '/appointment/new', // .ts works too
  ]) {
    assert.equal(routeExists(APP, route), true, route);
  }
});

test('rejects paths with no route file', () => {
  for (const route of [
    '/nope',
    '/tabs/settings', // a group's name without the parentheses is a real segment
    '/(tabs)/nope',
    '/(auth)', // no index directly in (auth)
    '/appointment', // a folder without index
    '/settings/more',
  ]) {
    assert.equal(routeExists(APP, route), false, route);
  }
});

test('never treats _layout or +special files as routes', () => {
  for (const route of [
    '/_layout',
    '/+not-found',
    '/+html',
    '/(tabs)/_layout',
    '/_private/secret',
  ]) {
    assert.equal(routeExists(APP, route), false, route);
  }
});
