import { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

class AuthController {
  async register(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
      const user = await authService.register(email, password);
      res.json({ user });
    } catch (err: any) {
      console.error('Registration failed:', err);
      res.status(400).json({ error: String(err.message || 'Signup failed') });
    }
  }

  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    try {
      const result = await authService.login(email, password);
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  }
}

export const authController = new AuthController();
