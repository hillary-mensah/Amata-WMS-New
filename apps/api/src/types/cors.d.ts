declare module 'cors' {
  import { type RequestHandler } from 'express';

  interface CorsOptions {
    origin?: string | string[] | boolean;
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    preflightContinue?: boolean;
    optionsSuccessStatus?: number;
  }

  export function cors(options?: CorsOptions): RequestHandler;
  export default cors;
}
