export class KeyringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KeyringError';
  }
}

export class KeyringUnavailableError extends KeyringError {
  constructor(reason?: string) {
    super(
      `OS Keyring is unavailable${reason ? `: ${reason}` : ''}. Pass --no-keyring or --storage=file to use local credentials file storage.`
    );
    this.name = 'KeyringUnavailableError';
  }
}

export class CredentialsNotFoundError extends KeyringError {
  constructor(account: string) {
    super(`No credentials found for account: ${account}`);
    this.name = 'CredentialsNotFoundError';
  }
}

export class InvalidCredentialsError extends KeyringError {
  constructor(reason: string) {
    super(`Invalid credentials: ${reason}`);
    this.name = 'InvalidCredentialsError';
  }
}
