import { startDashboard } from './index.ts';
import { loadTrachexEnv } from '@trachex/shared';

loadTrachexEnv();
await startDashboard();
