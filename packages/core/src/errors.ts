export class ZVaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZVaultError';
  }
}

export class ValidationError extends ZVaultError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ConfigError extends ZVaultError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class ApiClientError extends ZVaultError {
  public readonly statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
  }
}

export class AuthenticationError extends ApiClientError {
  constructor(message = 'Authentication failed') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends ApiClientError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}
