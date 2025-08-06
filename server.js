import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import { promisify } from 'util';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const execAsync = promisify(exec);
const app = express();

// Environment-based configuration with defaults
const PORT = process.env.BACKEND_PORT || 3001;
const HOST = process.env.BACKEND_HOST || 'localhost';

// Enable CORS for frontend communication
app.use(cors());
app.use(express.json());

// Parse zellij session output
function parseZellijSessions(output) {
  const lines = output.trim().split('\n').filter(line => line.trim());
  const sessions = [];

  for (const line of lines) {
    // Parse format: "session_name [Created time_ago ago]" with optional additional text
    const match = line.match(/^(.+?)\s+\[Created\s+(.+?)\s+ago\](.*)$/);
    if (match) {
      const sessionName = match[1].trim();
      const createdAgo = match[2].trim();
      const additionalInfo = match[3].trim();

      sessions.push({
        name: sessionName,
        createdAgo: createdAgo,
        status: additionalInfo || 'active',
        raw: line
      });
    }
  }

  return sessions;
}

// API endpoint to get zellij sessions
app.get('/api/sessions', async (req, res) => {
  try {
    console.log('Fetching zellij sessions...');
    const { stdout, stderr } = await execAsync('zellij list-sessions --no-formatting');

    if (stderr) {
      console.warn('Zellij stderr:', stderr);
    }

    const sessions = parseZellijSessions(stdout);
    console.log(`Found ${sessions.length} sessions`);

    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching zellij sessions:', error);

    // Handle case where zellij command fails (e.g., no sessions)
    if (error.code === 1 && error.stdout === '') {
      res.json({
        success: true,
        sessions: [],
        count: 0,
        message: 'No active zellij sessions found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.stderr || error.stdout
      });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, HOST, () => {
  console.log(`Zellij session server running on http://${HOST}:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /api/sessions - List zellij sessions');
  console.log('  GET /api/health - Health check');
});
