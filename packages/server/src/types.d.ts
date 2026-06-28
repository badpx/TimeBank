declare module "cookie-signature" {
  export function sign(val: string, secret: string): string;
  export function unsign(val: string, secret: string): string | false;
}

declare module "cookie-parser" {
  import type { RequestHandler } from "express";
  function cookieParser(secret?: string | string[]): RequestHandler;
  export = cookieParser;
}
