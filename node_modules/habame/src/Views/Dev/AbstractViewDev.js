
/**
 * @param {Object} arg
 * @param {ViewElementFragment} arg.$viewDescription
 * @param {{getIfStatement: Function, buildIfStatement: Function}} arg.$callbacks
 *
 * @class
 */
const AbstractViewDev = function({ $viewDescription, $callbacks  }) {

    const { getIfStatement, buildIfStatement } = $callbacks;
    /**
     * @param {string} template
     */
    this.updateIfControl = function(template) {
        let ifStatement = getIfStatement();
        if(!ifStatement) {
            if(!template) {
                return;
            }
            ifStatement = buildIfStatement(template);
            ifStatement.trigger();
            return;
        }
        ifStatement.refresh(template || 'true');
        ifStatement.trigger();
        $viewDescription.if = template;
    };

};

export default AbstractViewDev;