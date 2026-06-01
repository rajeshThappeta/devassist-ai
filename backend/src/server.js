import 'dotenv/config';
import http from 'http';
import app from './app.js';

const PORT = process.env.PORT || 6000;
const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`DevAssist AI backend running on port ${PORT}`);
});
