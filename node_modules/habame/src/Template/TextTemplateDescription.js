import Template from "src/Template/Template";

/**
 *
 * @param {string} $template
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 */
const TextTemplateDescription = function($template, $viewProps) {

    let $parts = [];

    /** @type {string[]} */
    let $statesToWatch = [];
    /** @type {string} */
    let $lastTemplate = null;

    /** @type {boolean} */
    const $stateless = !$parts.some((part) => part.hasAState);

    this.isStateLess = function() {
        return $stateless;
    };

    /**
     * @param {Function} callback
     */
    this.each = function(callback) {
        $parts.forEach((part) => {
            callback.apply(callback, [part]);
        });
    };

    /**
     * @param {string} template
     */
    this.refresh = function(template) {
        if(template === $lastTemplate) {
            return;
        }
        $parts = (template || $template)
            .split(/(\{\{.+?\}\})/)
            .map((value) => {
                const hasAState = /(^\{\{.+?\}\}$)/.test(value);
                return {
                    value: value,
                    hasAState,
                    template: (hasAState ? new Template(value, $viewProps): null)
                };
            });

        $statesToWatch = $parts.reduce(function(statesToWatch, currentValue) {
            if(!currentValue.hasAState) {
                return statesToWatch;
            }
            const stateList = currentValue.template.statesToWatch();
            stateList.forEach((stateName) => {
                if(!statesToWatch.includes(stateName)) {
                    statesToWatch.push(stateName);
                }
            });
            return statesToWatch;
        }, []);
        $lastTemplate = template;
    };

    this.statesToWatch = function() {
        return $statesToWatch;
    };

    ((() => {
        this.refresh($template);
    })());

};

export default TextTemplateDescription;