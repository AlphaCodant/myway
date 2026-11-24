import { normalizeCiPhone } from './phone';

describe('normalizeCiPhone', () => {
  it.each([
    ['07 01 02 03 04', '+2250701020304'],
    ['0501020304', '+2250501020304'],
    ['+225 01 02 03 04 05', '+2250102030405'],
    ['002250701020304', '+2250701020304'],
    ['2250701020304', '+2250701020304'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeCiPhone(input)).toBe(expected);
  });

  it('refuse un numéro trop court', () => {
    expect(() => normalizeCiPhone('070102')).toThrow();
  });
});
