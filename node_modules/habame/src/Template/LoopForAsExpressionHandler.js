import AbstractLoopExpressionHandler  from 'src/Template/AbstractLoopExpressionHandler';

/**
 *
 * @class
 * @extends AbstractLoopExpressionHandler
 */
const LoopForAsExpressionHandler = function() {
    const $regex = /^([a-z0-9_.$]+) as ([a-z0-9_,\s$]+)$/i;
    const $regexWithParenthesis = /^([a-z0-9_.$]+) as \(([a-z0-9_,\s$]+)\)$/i;

    const $iterableIndex = 0;
    const $iterableItemsIndex = 1;

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

export default LoopForAsExpressionHandler;