require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET manquant dans .env : arrêt.');
  process.exit(1);
}

const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API MADINTY sur le port ${port}`));
require('./lib/jobs').startJobs();
