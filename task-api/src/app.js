const express = require('express');
const taskRoutes = require('./routes/tasks');

const app = express();

app.use(express.json());

// Health-check / root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Task Manager API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      tasks: '/tasks',
      stats: '/tasks/stats',
    },
  });
});

app.use('/tasks', taskRoutes);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Task API running on port ${PORT}`);
  });
}

module.exports = app;
