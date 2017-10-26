/**
 * @module async
 * @license MIT
 * @version 2017/10/25
 */
export declare type IteratorResult = {
    done: boolean;
    value: any;
};
/**
* @class Iterator
*/
export declare class Iterator {
    private array;
    index: number;
    /**
     * @constructor
     * @param {Array} array
     */
    constructor(array: any[]);
    /**
     * @method next
     * @description Create the next item.
     * @returns {{done: boolean, value: undefined}}
     */
    next(): IteratorResult;
}
/**
 * series
 *
 * @param {Array} array
 * @param {Function} iterator
 * @param {Function} done
 * @param {any} context
 */
export declare function series(array: any[], iterator: (value: any, next: () => void, index: number) => void, done?: () => void, context?: any): void;
