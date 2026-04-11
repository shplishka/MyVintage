import { Request } from 'express';

export interface AuthRequest extends Request {
  jwtUser?: {
    userId: string;
    email: string;
  };
}