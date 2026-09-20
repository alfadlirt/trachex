import { loadTrachexEnv } from '@trachex/shared';
import { startDashboard } from './index.ts';

loadTrachexEnv();
await startDashboard();
