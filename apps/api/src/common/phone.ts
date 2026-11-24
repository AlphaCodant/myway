import { BadRequestException } from '@nestjs/common';

/**
 * Normalise un numéro ivoirien (10 chiffres depuis 2021) au format +225XXXXXXXXXX.
 * Accepte « 07 01 02 03 04 », « 0701020304 », « +2250701020304 », « 002250701020304 ».
 */
export function normalizeCiPhone(input: string): string {
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+225')) digits = digits.slice(4);
  else if (digits.startsWith('225') && digits.length === 13) digits = digits.slice(3);
  if (!/^\d{10}$/.test(digits) || !/^(01|05|07|21|25|27)/.test(digits)) {
    throw new BadRequestException('Numéro de téléphone ivoirien invalide (10 chiffres, ex. 07 01 02 03 04)');
  }
  return '+225' + digits;
}
