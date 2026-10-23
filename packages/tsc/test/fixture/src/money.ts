/** A class that the serial entry sends, so a signal can hold one. */
export class Money {
  constructor(public cents: number) {}
  add(cents: number): Money {
    return new Money(this.cents + cents);
  }
}

declare module 'brumate/serial' {
  interface SendableValues {
    money: Money;
  }
}
