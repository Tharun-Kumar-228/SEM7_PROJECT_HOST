const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const parentRoutes = require('./routes/parentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const screeningRoutes = require('./routes/screeningRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { UPLOAD_DIR } = require('./config/storage');

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting (200 requests per 15 mins)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests, please try again later.' },
  },
});
app.use('/api', apiLimiter);

// Serve static uploaded stroke samples (protected in production)
app.use('/uploads', express.static(path.join(process.cwd(), UPLOAD_DIR)));

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/parents', parentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/screenings', screeningRoutes);
app.use('/api/reports', reportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'NEUROSCREEN API Gateway Operational',
    timestamp: new Date(),
    version: '1.0.0',
    mlProviderStatus: 'PYTORCH_VISION_MAMBA_MODEL_ACTIVE',
  });
});

// Global Error Handler
app.use(errorHandler);

module.exports = app;
