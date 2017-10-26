/**
 * @function typeIs
 * @description The data type judgment
 * @param {any} value
 * @param {string} type
 * @returns {boolean}
 */
export declare function typeIs(value: any, type: string): boolean;
/**
 * @function isOutBound
 * @description Test path is out of bound of base
 * @param {string} path
 * @param {string} root
 * @returns {boolean}
 */
export declare function isOutBound(path: string, root: string): boolean;
/**
 * @function normalize
 * @description Normalize path
 * @param {string} path
 * @returns {string}
 */
export declare function normalize(path: string): string;
/**
 * @function posixURI
 * @description Format URI to posix style
 * @param {string} path
 * @returns {string}
 */
export declare function posixURI(path: string): string;
/**
 * @function decodeURI
 * @description Decode URI component.
 * @param {string} uri
 * @returns {string|-1}
 */
export declare function decodeURI(uri: string): string | -1;
/**
 * @function boundaryGenerator
 * @description Create boundary
 * @returns {string}
 */
export declare function boundaryGenerator(): string;
/**
 * @function parseHttpDate
 * @description Parse an HTTP Date into a number.
 * @param {string} date
 * @private
 */
export declare function parseHttpDate(date: string): number;
/**
 * @function Faster apply
 * @description Call is faster than apply, optimize less than 6 args
 * @param  {Function} fn
 * @param  {any} context
 * @param  {Array} args
 * @see https://github.com/micro-js/apply
 * @see http://blog.csdn.net/zhengyinhui100/article/details/7837127
 */
export declare function apply(fn: Function, context: any, args: any[]): void;
