declare module "cookies.js" {
  export interface CookieAttributes {
    path?: string;
    domain?: string;
    expires?: number | Date;
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none" | "Strict" | "Lax" | "None";
    [attribute: string]: string | number | boolean | Date | undefined;
  }

  export interface CookiesApi {
    get(key: string): string | undefined;
    get(): Record<string, string>;
    getJSON<T = unknown>(key: string): T;
    set(key: string, value: unknown, attributes?: CookieAttributes): string;
    remove(key: string, attributes?: CookieAttributes): string;
  }

  const Cookies: CookiesApi;
  export default Cookies;
}
