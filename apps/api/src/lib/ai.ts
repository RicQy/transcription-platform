import Replicate from 'replicate';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

export const replicate = new Replicate({ auth: REPLICATE_API_TOKEN });
export const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
