import AbstractLoopExpressionHandler  from 'src/Template/AbstractLoopExpressionHandler';

/**
 *
 * @class
 * @extends AbstractLoopExpressionHandler
 */
const LoopForInExpressionHandler = function() {
    const $regex = /^([a-z0-9_,\s$]+) in ([a-z0-9_.$]+)$/i;
    const $regexWithParenthesis = /^\(([a-z0-9_,\s$]+)\) in ([a-z0-9._$]+)$/i;

    const $iterableIndex = 1;
    const $iterableItemsIndex = 0;

    // Extends from AbstractLoopExpressionHandler
    AbstractLoopExpressionHandler.apply(this, [$regex, $regexWithParenthesis]);

    /**
     * @param {string} template
     *
     * @returns {?{iterableName: string, itemKeyName: string, iterable: string, itemValueName: string}}
     */
    this.setExpression = function(template) {
        return this.getExpressionDetails(template, $iterableIndex, $iterableItemsIndex);
    };

};

export default LoopForInExpressionHandler;