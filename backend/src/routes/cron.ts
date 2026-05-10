import { FastifyInstance } from 'fastify';
import { config } from '../config';
import { sendDailyReport } from '../services/EmailReportService';

export async function cronRoutes(app: FastifyInstance) {
  app.get('/cron/daily-report', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    if (!config.CRON_SECRET || authHeader !== `Bearer ${config.CRON_SECRET}`) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const result = await sendDailyReport(yesterday);

    if (result.sent) {
      app.log.info(`Daily API report sent for ${yesterday}`);
      return reply.send({ ok: true, date: yesterday });
    } else {
      app.log.warn(`Daily API report failed: ${result.error}`);
      return reply.status(500).send({ ok: false, error: result.error });
    }
  });
}
