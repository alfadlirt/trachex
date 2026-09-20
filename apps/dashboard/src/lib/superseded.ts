export type SupersededAudit = {
  action: string;
  checkedAt: string;
};

export type SupersededCompletionState =
  | 'Completed before replacement'
  | 'Was completed, then marked incomplete'
  | 'Not completed before replacement'
  | 'Completion state unavailable';

export function getSupersededCompletionState(
  devStatus: string,
  oldAudits: readonly SupersededAudit[],
): SupersededCompletionState {
  const chronologicalAudits = oldAudits.map((audit, index) => {
    const timestamp = Date.parse(audit.checkedAt);
    return { audit, index, timestamp };
  });
  if (chronologicalAudits.some(({ timestamp }) => Number.isNaN(timestamp))) {
    return 'Completion state unavailable';
  }
  chronologicalAudits.sort(
    (left, right) => left.timestamp - right.timestamp || left.index - right.index,
  );

  let checked = false;
  let sawCheck = false;
  let sawUncheck = false;

  for (const { audit } of chronologicalAudits) {
    if (audit.action === 'check') {
      if (checked) return 'Completion state unavailable';
      checked = true;
      sawCheck = true;
      continue;
    }
    if (audit.action === 'uncheck') {
      if (!checked) return 'Completion state unavailable';
      checked = false;
      sawUncheck = true;
      continue;
    }
    return 'Completion state unavailable';
  }

  if (devStatus === 'checked' && checked && sawCheck) {
    return 'Completed before replacement';
  }
  if (devStatus === 'unchecked' && !sawCheck && !sawUncheck) {
    return 'Not completed before replacement';
  }
  if (devStatus === 'unchecked' && sawCheck && sawUncheck && !checked) {
    return 'Was completed, then marked incomplete';
  }
  return 'Completion state unavailable';
}
