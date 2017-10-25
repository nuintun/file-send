/*!
 * async
 *
 * Date: 2017/10/25
 *
 * This is licensed under the MIT License (MIT).
 */

/**
* @class Iterator
*/
export class Iterator {
  public index: number = 0;
  private array: any[] = [];

  /**
   * @constructor
   * @param {Array} array
   */
  constructor(array: any[]) {
    this.array = array;
  }

  /**
   * @method next
   * @description Create the next item.
   * @returns {{done: boolean, value: undefined}}
   */
  public next(): { done: boolean, value: any } {
    const done: boolean = this.index >= this.array.length;
    const value: any = !done ? this.array[this.index++] : undefined;

    return {
      done: done,
      value: value
    };
  }
}

/**
 * series
 *
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
export function series(array: any[], iterator: (value: any, next: () => void, index: number) => void, done: () => void, context: any) {
  // Create a new iterator
  const it: Iterator = new Iterator(array);

  // Bind context
  if (arguments.length >= 4) {
    iterator = iterator.bind(context);
    done = done.bind(context);
  }

  /**
   * @function walk
   * @param it
   */
  function walk(it: Iterator): void {
    const item: { done: boolean, value: any } = it.next();

    if (item.done) {
      done();
    } else {
      iterator(item.value, function () {
        walk(it);
      }, it.index);
    }
  }

  // Run walk
  walk(it);
}
