/**
 *
 * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
 *
 * @class
 */
const AbstractTemplate = function($viewProps) {

    const $currentState = $viewProps.getStateToUse();
    const $componentActions = $viewProps.componentInstance.getActions();

    /**
     * @param {string} template
     * @param {boolean} stateOnly
     *
     * @returns {string[] | {states: string[], actions: string[]}}
     */
    this.getRequestedVars = function(template, stateOnly = true) {
        const states = [];
        const actions = [];
        const possibleRequestedVars = template
            .replace(/('.*?')|(".*?")/g, '')
            .match(/[a-z_0-9$_.]+/ig)
            ?.map((varCall) => {
                return varCall.split('.').shift().trim();
            })
            .reduce((uniqueVars, name) => {
                if(!/^[a-z$_]+/i.test(name)) {
                    return uniqueVars;
                }
                if(uniqueVars.includes(name)) {
                    return uniqueVars;
                }
                uniqueVars.push(name);
                return uniqueVars;
            }, []);

        possibleRequestedVars && possibleRequestedVars.forEach((name) => {
            if($currentState.get(name) !== undefined) {
                states.push(name);
            }
            else if($componentActions[name] !== undefined) {
                actions.push(name);
            }
        });

        if(stateOnly) {
            return states;
        }
        return { states, actions };
    };

};

export default AbstractTemplate;