import Lifecycle from "src/Component/Lifecycle";
import Template from "src/Template/Template";

/**
 *
 * @param {HTMLElement} $node
 * @param {Object.<string, string>} $directives
 * @param {Object.<string, ViewHtmlElementAttribute>} $attributeTemplates
 * @param {Object} $viewProps
 * @param {Object.<string, Function[]>} $lifecycleListeners
 *
 *
 * @class
 */
const Directive = function($node, $directives, $attributeTemplates, $viewProps, $lifecycleListeners) {
    const $nodeDirectives = {};
    const $lifeCycle = new Lifecycle($lifecycleListeners);

    /**
     * @param {string} name
     * @returns {*}
     */
    this.get = function(name) {
        return $nodeDirectives[name];
    };

    ((function() {
        for(const directiveName in $directives) {
            const attrValue = new Template($directives[directiveName], $viewProps);
            const directive = $viewProps.appInstance.createDirectiveInstance(directiveName, [{ element: $node, attribute: attrValue, attrs: $attributeTemplates }]);

            for(const key in directive) {
                if($lifecycleListeners[key] === undefined) {
                    continue;
                }
                const eventName = 'on' + key[0].toUpperCase() + key.substring(1);
                $lifeCycle[eventName].apply($lifeCycle, [directive[key]]);
            }

            $nodeDirectives[directiveName] = directive;
        }

    })());
};

export default Directive;