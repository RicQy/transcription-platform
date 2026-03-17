import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, originalUrl, ip } = req;
  const userAgent = req.get('User-Agent') || 'Unknown';
  
  // Log request
  logger.info('Incoming Request', {
    method,
    url: originalUrl,
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  });
  
  // Listen for response finish event
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    logger.info('Request Completed', {
      method,
      url: originalUrl,
      statusCode,
      duration: `${duration}ms`,
      ip,
      timestamp: new Date().toISOString()
    });
  });
  
  next();
};
