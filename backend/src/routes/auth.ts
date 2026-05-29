import { Router } from 'express';
import { ADMIN_PASSWORD } from '../config';
import { hashPw, checkAdmin } from '../helpers';

const router = Router();

router.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    res.cookie('admin_token', hashPw(ADMIN_PASSWORD), {
      httpOnly: true, sameSite: 'none', secure: true, maxAge: 86400000,
    });
    return res.json({ success: true });
  }
  res.status(401).json({ detail: 'Nieprawidłowe hasło' });
});

router.post('/api/logout', (_req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true });
});

router.get('/api/auth-status', (req, res) => {
  res.json({ isAdmin: checkAdmin(req) });
});

export default router;
