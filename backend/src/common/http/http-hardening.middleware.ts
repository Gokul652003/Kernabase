import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { AppConfig } from '@/config/app-config.service';

interface WindowEntry { count: number; resetAt: number }

@Injectable()
export class HttpHardeningMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly windows = new Map<string, WindowEntry>();
  private lastSweep = Date.now();

  constructor(private readonly config: AppConfig) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = String(req.headers['x-request-id'] ?? randomUUID()).slice(0, 128);
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');

    const now = Date.now();
    const isAuth = req.path === '/api/auth/login' || req.path === '/api/auth/signup';
    const limit = isAuth ? this.config.http.authRateLimit : this.config.http.globalRateLimit;
    const key = `${isAuth ? 'auth' : 'global'}:${req.ip}`;
    let entry = this.windows.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + this.config.http.rateWindowMs };
      this.windows.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(limit));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, limit - entry.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > limit) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      res.status(429).json({ statusCode: 429, message: 'Too many requests' });
      return;
    }

    if (now - this.lastSweep > this.config.http.rateWindowMs) {
      for (const [storedKey, stored] of this.windows) if (stored.resetAt <= now) this.windows.delete(storedKey);
      this.lastSweep = now;
    }

    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      this.logger.log(JSON.stringify({ requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(durationMs * 10) / 10 }));
    });
    next();
  }
}
