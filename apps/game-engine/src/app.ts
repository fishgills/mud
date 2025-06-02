import express from 'express';
import playerRoutes from './routes/player-new';
import worldRoutes from './routes/world-new';
import tickRoutes from './routes/tick';

const app = express();
app.use(express.json());

app.use('/players', playerRoutes);
app.use('/world', worldRoutes);
app.use('/tick', tickRoutes);

export default app;
