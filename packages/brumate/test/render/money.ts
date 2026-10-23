import { definePlugin } from 'brumate/serial';
import type { ValuePlugin } from 'brumate/serial';

/** An amount of a currency, in cents, for the serial entry of the tests. */
export class Money {
  readonly cents: number;
  readonly currency: string;

  constructor(cents: number, currency: string) {
    this.cents = cents;
    this.currency = currency;
  }

  add(cents: number): Money {
    return new Money(this.cents + cents, this.currency);
  }

  format(): string {
    return `${(this.cents / 100).toFixed(2)} ${this.currency}`;
  }
}

export const plugins: ValuePlugin[] = [
  definePlugin<Money, [number, string]>({
    tag: 'test/money',
    test: (value) => value instanceof Money,
    toData: (money) => [money.cents, money.currency],
    fromData: ([cents, currency]) => new Money(cents, currency),
  }),
];
