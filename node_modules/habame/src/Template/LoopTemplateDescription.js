import LoopForInExpressionHandler from "src/Template/LoopForInExpressionHandler";
import LoopForAsExpressionHandler from "src/Template/LoopForAsExpressionHandler";
import Template from "./Template";



const LOOP_TEMPLATE_HANDLERS = [
    LoopForInExpressionHandler,
    LoopForAsExpressionHandler
];

/**
 *
 * @param {string} $loopExpression
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 */
const LoopTemplateDescription = function($loopExpression, $viewProps) {

    /** @type {?Template} */
    let $iterableTemplate = null;

    /** @type {?AbstractLoopExpressionHandler} */
    let $loopExpressionDescription = null;
    /** @type {?string} */
    let $lastExpression = null;


    // Todo : get source data
    // Get the iteration values (key|index, value)

    /**
     * @returns {*}
     */
    this.getIterable = function() {
        return $iterableTemplate.value();
    };

    /**
     * @returns {?AbstractLoopExpressionHandler}
     */
    this.expressionDescription = function() {
        return $loopExpressionDescription;
    };

    /**
     * @param {Function} listener
     *
     * @returns {Function}
     */
    this.onUpdate = function(listener) {
        $iterableTemplate.onUpdate(listener);
        return listener;
    };

    /**
     * @param {string} expression
     */
    this.refresh = function(expression) {
        if(expression === $lastExpression) {
            return;
        }
        expression = expression.trim().replace(/[\s]+/, ' ');
        for (const LoopHandler of LOOP_TEMPLATE_HANDLERS) {
            const handler = new LoopHandler();
            if(handler.test(expression)) {
                handler.setExpression(expression);
                $loopExpressionDescription = handler;
                if(!$iterableTemplate) {
                    $iterableTemplate = new Template($loopExpressionDescription.getIterableFullName(), $viewProps);
                } else {
                    $iterableTemplate.refresh($loopExpressionDescription.getIterableFullName());
                }
                $lastExpression = expression;
                return;
            }
        }
        // Todo : Improve error
        throw new Error('Syntax Error : ' + expression);
    };

    ((() => { /* Constructor */
        this.refresh($loopExpression);
    })());

};

export default LoopTemplateDescription;