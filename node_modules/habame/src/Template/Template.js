import AbstractTemplate from "./AbstractTemplate";


/**
 *
 * @param {string} $template
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 * @param {boolean} $isWithTry
 * @param {boolean} $catchValue
 *
 * @class
 * @extends AbstractTemplate
 */
const Template = function($template, $viewProps, $isWithTry = false, $catchValue = false) {

    const $self = this;

    AbstractTemplate.apply(this, [$viewProps]);


    /** @type {Function[]} */
    const $listeners = [];

    /** @type {string[]} */
    let requestedVariablesNames = [];

    /** @type {?Function} */
    let $templateFunction = null;
    /** @type {{source: null|string, transformed: null|string}} */
    let $lastTemplate = {
        source: null,
        transformed: null
    };


    /**
     * @param {string} template
     * @returns {string}
     */
    const getTransformedTemplate = function(template) {
        const RANGE_TEMPLATE_REGEX = /^([a-z0-9.$_]+)\.\.([a-z0-9.$_]+)$/i;
        if(RANGE_TEMPLATE_REGEX.test(template)) {
            const matches = template.match(RANGE_TEMPLATE_REGEX);
            matches.shift();
            if(matches.length !== 2) {
                throw new Error('Range error');
            }
            const [min, max] = matches;
            template = 'Array.from({ length: ' + max+ '}, function(value, index) { return index + ' + min + '; })';
        }
        requestedVariablesNames = $self.getRequestedVars(template);
        return template;
    };


    const trigger = () => {
        $listeners.forEach((listener) => {
            listener.apply(listener, [this.value()]);
        });
    };

    /**
     * @param {Function} listener
     *
     * @returns {Function}
     */
    this.onUpdate = function(listener) {
        $listeners.push(listener);
        return listener;
    };

    this.statesToWatch = function() {
        return requestedVariablesNames;
    };

    /**
     * @param {Function} listener
     */
    this.disconnect = function(listener) {
        const index = $listeners.indexOf(listener);
        if(index < 0) {
            return;
        }
        $listeners.splice(index, 1);
    };

    /**
     * @param {?Object.<string, *>} valuesToUse
     *
     * @returns {*}
     */
    this.value = function(valuesToUse) {
        if(!$templateFunction) {
            return undefined;
        }
        // TODO : get the value evaluated by the template manager
        const states = {};
        for (const name of requestedVariablesNames) {
            if(valuesToUse && valuesToUse[name] !== undefined) {
                states[name] = valuesToUse[name];
                continue;
            }
            const state = $viewProps.getState(name, $lastTemplate.transformed);
            if(state) {
                states[name] = state.value();
            }
        }
        return $templateFunction(states);
    };

    /**
     * @param {?string} sourceTemplate
     * @param {boolean} cleanState
     */
    this.refresh = function(sourceTemplate = null, cleanState = false) {
        sourceTemplate = sourceTemplate === null ? $template : sourceTemplate;
        if(sourceTemplate === $lastTemplate.source) {
            return;
        }

        const stateSource = $viewProps.getStateToUse();

        if(cleanState === true && $viewProps.localState) {
            $viewProps.localState.disconnect();
        }
        if(!sourceTemplate) {
            $lastTemplate.source = sourceTemplate;
            $templateFunction = null;
            return;
        }

        let template = sourceTemplate.trim().replace(/^\{\{|}}$/g, '').trim();
        template = getTransformedTemplate(template);
        try {
            let returnCode = 'return '+ template +';';

            if($isWithTry) {
                returnCode = ' try { '+ returnCode +' } catch(e) { return '+ $catchValue +'; }';
            }

            $templateFunction = new Function(
                'states',
                (requestedVariablesNames.length ? 'const {'+ requestedVariablesNames.join(',') +'} = states;' : '') +
                returnCode
            );
        } catch (e) {
            throw new Error('Syntax error : '+ template);
        }

        $lastTemplate.transformed = template;
        $lastTemplate.source = sourceTemplate;
        if(cleanState) {
            trigger();
        }
        if(!requestedVariablesNames.length) {
            return;
        }
        stateSource.onUpdate(requestedVariablesNames, trigger);
    };

    ((() => {
        this.refresh();
    })());
};

export default Template;