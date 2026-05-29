import { Router } from 'express';
import { searchIndex } from '../search';

const router = Router();

router.get('/api/search', (req, res) => {
  const q = (req.query.q as string) || '';
  const limit = parseInt(req.query.limit as string) || 100;
  if (!q || q.length < 2) return res.json({ results: [], query: q, total: 0 });
  const results = searchIndex(q);
  res.json({ results: results.slice(0, limit), query: q, total: results.length });
});

export default router;
