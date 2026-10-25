import jwt from 'jsonwebtoken';
export const sign = (u, role) => jwt.sign({ id: u._id, role }, process.env.JWT_SECRET, { expiresIn: '12h' });
export const need = (...roles) => (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const p = jwt.verify(token, process.env.JWT_SECRET);
    if (!roles.includes(p.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = p; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
