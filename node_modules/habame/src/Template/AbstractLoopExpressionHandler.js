/**
 *
 * @param {RegExp} $regex
 * @param {RegExp} $regexWithParenthesis
 *
 * @class
 */
const AbstractLoopExpressionHandler = function($regex, $regexWithParenthesis) {

    /** @type {{iterableName: ?string, itemKeyName: ?string, iterable: ?string, itemValueName: ?string}} */
    const $loopExpressionDescription = { iterableName: null, iterable: null, itemValueName: null, itemKeyName: null };

    /**
     * @param {string} template
     *
     * @returns {boolean}
     */
    this.test = function(template) {
        return $regex.test(template) || $regexWithParenthesis.test(template);
    };

    /**
     *
     * @param {string} template
     * @param {Number} iterableIndex
     * @param {Number}iterableItemsIndex
     *
     * @returns {?{iterableName: string, itemKeyName: string, iterable: string, itemValueName: string}}
     */
    this.getExpressionDetails = function(template, iterableIndex, iterableItemsIndex) {
        if($regexWithParenthesis.test(template)) {
            template = template.replace(/\(|\)/g, '');
        }
        const parts = template.match($regex);
        if(!parts || parts.length < 2) {
            return null;
        }
        const iterable = parts[iterableIndex + 1];
        $loopExpressionDescription.iterableName = iterable.split('.').shift();
        $loopExpressionDescription.iterable = iterable;

        const itemParts = parts[iterableItemsIndex + 1].split(',').map((item) => item.trim());
        if(itemParts.length === 1) {
            itemParts.unshift('index');
        }
        $loopExpressionDescription.itemValueName = itemParts[1];
        $loopExpressionDescription.itemKeyName = itemParts[0] || 'index';

        return $loopExpressionDescription;
    };

    /**
     * @returns {string}
     */
    this.getIterableFullName = function() {
        return $loopExpressionDescription.iterable;
    };

    this.getIterableName = function() {
        return $loopExpressionDescription.iterableName;
    };

    /**
     * @returns {string}
     */
    this.getIterableItemKeyName = function() {
        return $loopExpressionDescription.itemKeyName;
    };

    /**
     * @returns {string}
     */
    this.getIterableItemValueName = function() {
        return $loopExpressionDescription.itemValueName;
    };

};

export default AbstractLoopExpressionHandler;