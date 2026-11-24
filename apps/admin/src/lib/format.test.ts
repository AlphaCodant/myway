import { describe, expect, it } from 'vitest';
import { ago, fcfa, settingLabels } from './format';

describe('format', () => {
  it('écrit les montants en francs CFA', () => {
    expect(fcfa(1500)).toBe('1 500 F');
    expect(fcfa(null)).toBe('0 F');
  });

  it('dit depuis quand', () => {
    const now = new Date('2026-11-24T12:00:00Z').getTime();
    expect(ago('2026-11-24T11:59:40Z', now)).toBe('à l’instant');
    expect(ago('2026-11-24T11:48:00Z', now)).toBe('il y a 12 min');
    expect(ago('2026-11-24T09:55:00Z', now)).toBe('il y a 2 h 05');
    expect(ago(null, now)).toBe('—');
  });

  it('a un libellé pour chaque paramètre métier de l’API', () => {
    const apiKeys = [
      'courierCashCeiling', 'courierSharePercent', 'maxDeliveryDistanceMeters', 'dispatchRadiusMeters', 'offerTimeoutSeconds',
      'merchantReminderMinutes', 'cancellationFeeAfterConfirm', 'unreachableCallAttempts', 'unreachableWaitMinutes',
      'commissionFreeMonths', 'defaultCommissionPercent',
    ];
    expect(Object.keys(settingLabels).sort()).toEqual(apiKeys.sort());
  });
});
