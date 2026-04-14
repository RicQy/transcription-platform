import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Refusing to start with an insecure default.');
}

class AuthService {
  async register(email: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    const user = await db.from('users').insert([{ email, password_hash: hash }]).select().single() as any;
    if (user.error) throw new Error(user.error.message);
    
    return {
      id: user.data.id,
      email: user.data.email,
      role: user.data.role
    };
  }

  async login(email: string, password: string) {
    const { data: user } = await db.from('users').select('*').eq('email', email).single() as any;
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );

    return {
      user: { id: user.id, email: user.email, role: user.role },
      accessToken: token
    };
  }
}

export const authService = new AuthService();
