import axios, { type AxiosInstance } from "axios";

/**
 * Guest JWT + API token auth against the configured TxLINE network (§4).
 * The API token never leaves this process; the browser never talks to TxLINE directly.
 */
export class TxLineAuth {
  private jwt: string | null = null;
  private readonly baseUrl: string;
  private readonly apiToken: string;

  constructor(baseUrl: string, apiToken: string) {
    this.baseUrl = baseUrl;
    this.apiToken = apiToken;
  }

  private async fetchGuestJwt(): Promise<string> {
    const res = await axios.post(`${this.baseUrl}/auth/guest/start`);
    const token = res.data?.token;
    if (!token) throw new Error("Guest JWT response missing `token` field");
    return token as string;
  }

  async getJwt(forceRefresh = false): Promise<string> {
    if (!this.jwt || forceRefresh) {
      this.jwt = await this.fetchGuestJwt();
    }
    return this.jwt;
  }

  getApiToken(): string {
    return this.apiToken;
  }

  /** Axios instance that auto-refreshes the guest JWT once on a 401 and retries. */
  client(): AxiosInstance {
    const instance = axios.create({ baseURL: this.baseUrl });

    instance.interceptors.request.use(async (config) => {
      const jwt = await this.getJwt();
      config.headers.set("Authorization", `Bearer ${jwt}`);
      config.headers.set("X-Api-Token", this.apiToken);
      return config;
    });

    instance.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retried) {
          original._retried = true;
          const jwt = await this.getJwt(true);
          original.headers = original.headers ?? {};
          original.headers["Authorization"] = `Bearer ${jwt}`;
          original.headers["X-Api-Token"] = this.apiToken;
          return instance(original);
        }
        throw error;
      }
    );

    return instance;
  }
}
