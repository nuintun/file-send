/// <reference path="../../typings/readable-stream.d.ts" />
import { Transform, TransformOptions } from 'readable-stream';
export declare type NextFunction = (error: any, chunk?: any) => void;
export declare type TransformFunction = (chunk: any, encoding: string, next: NextFunction) => void;
export declare type FlushFunction = () => void;
/**
 * @class DestroyableTransform
 */
export declare class DestroyableTransform extends Transform {
    private _destroyed;
    /**
     * @constructor
     * @param {Object} options
     */
    constructor(options: TransformOptions);
    /**
     * @method destroy
     * @param {any} error
     */
    destroy(error: any): void;
}
/**
 * @function throuth
 * @description Create a new export function, contains common logic for dealing with arguments
 * @param {Object} [options]
 * @param {Function} transform
 * @param {Function} [flush]
 * @returns {DestroyableTransform}
 */
export default function through(options: TransformOptions, transform?: TransformFunction, flush?: FlushFunction): DestroyableTransform;
