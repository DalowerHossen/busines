import assert from 'node:assert/strict';
import {
  CoreDomainError,
  allocateMoney,
  calculateFxGainLoss,
  calculateInvoice,
  compareMoney,
  convertMoney,
  createMoney,
  freezeFxConversion,
  fromMinorUnits,
  moneyToWords,
  numberToWords,
  roundDecimalAmount,
  sumMoney,
  toMinorUnits,
  validateExchangeRateSnapshot,
} from '@/lib/core';

const directSnapshot = {
  baseCurrencyCode: 'USD',
  quoteCurrencyCode: 'BDT',
  rate: '110.250000000000',
  source: 'official-rate-provider',
  effectiveAt: '2026-10-06T00:00:00Z',
  fetchedAt: '2026-10-06T00:01:00Z',
};

function main(): void {
  assert.equal(roundDecimalAmount('1.005', 2, 'half_even'), '1.00');
  assert.equal(roundDecimalAmount('1.005', 2, 'half_up'), '1.01');
  assert.deepEqual(createMoney('12.345', 'USD'), { amount: '12.34', currency: 'USD' });
  assert.deepEqual(createMoney('1.005', 'USD', { roundingMode: 'half_up' }), {
    amount: '1.01',
    currency: 'USD',
  });
  assert.equal(toMinorUnits(createMoney('12.34', 'USD')), 1234n);
  assert.deepEqual(fromMinorUnits(1234n, 'USD'), { amount: '12.34', currency: 'USD' });
  assert.deepEqual(allocateMoney(createMoney('10.00', 'USD'), ['1', '1', '1']), [
    { amount: '3.34', currency: 'USD' },
    { amount: '3.33', currency: 'USD' },
    { amount: '3.33', currency: 'USD' },
  ]);
  assert.equal(
    toMinorUnits(sumMoney(allocateMoney(createMoney('10.00', 'USD'), ['1', '1']))),
    1000n
  );
  assert.equal(compareMoney(createMoney('2.00', 'USD'), createMoney('2.00', 'USD')), 0);
  assert.throws(
    () => compareMoney(createMoney('2.00', 'USD'), createMoney('2.00', 'BDT')),
    (error: unknown) => error instanceof CoreDomainError && error.code === 'invalid_request'
  );

  assert.equal(numberToWords('123.45'), 'one hundred twenty-three point four five');
  assert.equal(
    moneyToWords(createMoney('123.45', 'USD')),
    'one hundred twenty-three dollars and forty-five cents'
  );
  assert.equal(moneyToWords(createMoney('500', 'JPY')), 'five hundred yen');

  const lineRounded = calculateInvoice({
    currencyCode: 'USD',
    roundingScope: 'line',
    roundingMode: 'half_even',
    lines: [
      { lineId: 'one', quantity: '1', unitPrice: '0.03', taxRatePercent: '10' },
      { lineId: 'two', quantity: '1', unitPrice: '0.03', taxRatePercent: '10' },
    ],
  });
  const totalRounded = calculateInvoice({
    currencyCode: 'USD',
    roundingScope: 'total',
    roundingMode: 'half_even',
    lines: [
      {
        lineId: 'one',
        quantity: '1',
        unitPrice: '0.03',
        taxRatePercent: '10',
        taxRule: { id: 'tax-rule-1', version: '2026-01' },
      },
      { lineId: 'two', quantity: '1', unitPrice: '0.03', taxRatePercent: '10' },
    ],
  });
  assert.equal(lineRounded.taxTotal.amount, '0.00');
  assert.equal(totalRounded.taxTotal.amount, '0.01');
  assert.deepEqual(totalRounded.lines[0]?.taxRule, { id: 'tax-rule-1', version: '2026-01' });
  assert.equal(totalRounded.total.amount, '0.07');

  const converted = convertMoney({
    amount: createMoney('2.00', 'USD'),
    targetCurrencyCode: 'BDT',
    rateSnapshot: directSnapshot,
  });
  assert.deepEqual(converted, { amount: '220.50', currency: 'BDT' });
  const inverse = convertMoney({
    amount: createMoney('220.50', 'BDT'),
    targetCurrencyCode: 'USD',
    rateSnapshot: directSnapshot,
  });
  assert.deepEqual(inverse, { amount: '2.00', currency: 'USD' });
  const frozen = freezeFxConversion({
    sourceAmount: createMoney('2.00', 'USD'),
    targetCurrencyCode: 'BDT',
    rateSnapshot: directSnapshot,
    roundingMode: 'half_even',
    convertedAt: '2026-10-06T00:02:00Z',
  });
  assert.equal(frozen.direction, 'direct');
  assert.equal(frozen.rateApplied, '110.250000000000');
  assert.equal(frozen.targetAmount.amount, '220.50');
  const fxGainLoss = calculateFxGainLoss({
    bookedAmount: createMoney('220.00', 'BDT'),
    settledAmount: createMoney('2.00', 'USD'),
    rateSnapshot: directSnapshot,
  });
  assert.equal(fxGainLoss.settledAmountAtBookedCurrency.amount, '220.50');
  assert.equal(fxGainLoss.gainLoss.amount, '0.50');
  assert.equal(fxGainLoss.direction, 'gain');
  assert.equal(
    validateExchangeRateSnapshot(directSnapshot, directSnapshot.source).rate,
    '110.250000000000'
  );
  assert.throws(
    () =>
      validateExchangeRateSnapshot(
        { ...directSnapshot, fetchedAt: '2026-10-05T00:00:00Z' },
        directSnapshot.source
      ),
    (error: unknown) => error instanceof CoreDomainError && error.code === 'invalid_request'
  );

  process.stdout.write(
    'Phase 24 verification passed: decimal-safe money, currency minor units, configurable rounding, invoice calculation, English number-to-words, FX gain/loss, and immutable FX conversion contracts are covered.\n'
  );
}

main();
