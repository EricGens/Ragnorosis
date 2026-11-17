// Regenerates tournament-report.md: `npm run balance:tournament`. Skipped in the normal test run. The
// report is committed, like balance-report.md, so a rule change shows up as a diff.

import { expect, it } from 'vitest'
import { tournamentReport } from './tournament'

it.runIf(import.meta.env.VITE_TOURNAMENT)(
  'tournament report',
  async () => {
    await expect(tournamentReport().join('\n') + '\n').toMatchFileSnapshot('./tournament-report.md')
  },
  7_200_000,
)
