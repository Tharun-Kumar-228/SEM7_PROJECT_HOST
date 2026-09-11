const app = require('./app');
const { connectDB } = require('./config/db');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEUROSCREEN API] Gateway running on http://0.0.0.0:${PORT}`);
    console.log(`[NEUROSCREEN API] Mode: ${process.env.NODE_ENV || 'development'}`);
  });
};

startServer();
