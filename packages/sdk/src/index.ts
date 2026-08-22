// SDK class stub for @zvault/sdk
export class ZVault {
  private project: string;
  private env: string;

  constructor(options: { project: string; env?: string }) {
    this.project = options.project;
    this.env = options.env || 'development';
  }

  public async getSecret(key: string): Promise<string | undefined> {
    return process.env[key];
  }
}
