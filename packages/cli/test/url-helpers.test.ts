import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeServerUrl,
  serverAccountKey,
  isServerAccountKey,
  serverUrlFromAccountKey
} from '../src/commands/url-helpers.js';

describe('url-helpers', () => {
  it('normalizes server URLs consistently', () => {
    assert.equal(normalizeServerUrl('https://nsec.chames.dev/'), 'https://nsec.chames.dev');
    assert.equal(normalizeServerUrl('HTTPS://NSEC.CHAMES.DEV'), 'https://nsec.chames.dev');
    assert.equal(normalizeServerUrl('http://localhost:4000///'), 'http://localhost:4000');
    assert.equal(normalizeServerUrl('https://api.example.com/v1/'), 'https://api.example.com/v1');
  });

  it('formats and detects server account keys', () => {
    const key = serverAccountKey('https://nsec.chames.dev/');
    assert.equal(key, 'server:https://nsec.chames.dev');
    assert.equal(isServerAccountKey(key), true);
    assert.equal(isServerAccountKey('default'), false);
    assert.equal(isServerAccountKey('project-a'), false);
  });

  it('extracts server url from account key', () => {
    assert.equal(serverUrlFromAccountKey('server:https://nsec.chames.dev'), 'https://nsec.chames.dev');
    assert.equal(serverUrlFromAccountKey('default'), 'default');
  });
});
