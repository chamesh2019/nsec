import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateUserKeyPair,
  generateProjectKey,
  encryptProjectSecrets,
  decryptProjectSecrets,
  encryptProjectKeyForUser,
  decryptProjectKeyWithUserKey,
  signPayload,
  verifySignature
} from '../src/index.js';

describe('Zero-Knowledge 2-Tier Cryptography Full Lifecycle', () => {
  it('simulates multi-user secret sharing and injection workflow', async () => {
    // 1. User A (Admin) and User B (Teammate) create keypairs
    const userA = await generateUserKeyPair();
    const userB = await generateUserKeyPair();

    // 2. User A initializes a project and creates a Project Master Key
    const projectKey = generateProjectKey();

    // 3. User A encrypts the project environment secrets
    const secretVars = {
      DATABASE_URL: 'postgresql://dbadmin:p@ssword@cloud.zvault.dev:5432/main',
      API_TOKEN: 'secret_live_tok_998877',
      PORT: '3000'
    };
    const encryptedSecretsBlob = encryptProjectSecrets(secretVars, projectKey);

    // 4. Project Master Key is encrypted for User A and User B
    const userAEncryptedKey = encryptProjectKeyForUser(projectKey, userA.encryption.publicKey);
    const userBEncryptedKey = encryptProjectKeyForUser(projectKey, userB.encryption.publicKey);

    // 5. User B signs an API request to fetch project secrets
    const request = signPayload(
      { action: 'get_secrets', project: 'zvault_demo', env: 'production' },
      userB.signing.privateKey,
      userB.signing.publicKey
    );
    assert.equal(verifySignature(request), true);

    // 6. User B receives the encrypted blob and their encrypted Project Key
    // User B decrypts the Project Key in memory:
    const unlockedProjectKey = decryptProjectKeyWithUserKey(userBEncryptedKey, userB.encryption.privateKey);
    assert.equal(unlockedProjectKey, projectKey);

    // 7. User B decrypts the secrets into process.env memory:
    const injectedSecrets = decryptProjectSecrets(encryptedSecretsBlob, unlockedProjectKey);
    assert.deepEqual(injectedSecrets, secretVars);
  });
});
