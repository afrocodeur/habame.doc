import {IS_PROXY_PROPERTY} from "../../constantes";


const ComponentDev = function({ $lifecycle, $event, $componentRequirements , $state }) {

    const $listeners = [];

    /**
     * @param {Function} controller
     */
    this.updateController = function(controller) {
        const stateValues = $state.getAll();
        $lifecycle.clearAll();
        $event.clearAll();
        for(const key in $componentRequirements.Actions) {
            $componentRequirements.Actions[key] = undefined;
        }
        controller($componentRequirements);
        $componentRequirements.State.useProps($componentRequirements.Props);
        const statesToKeep = {};
        for(const oldStateName in stateValues) {
            if($state.exists(oldStateName)) {
                const stateItem = $state.get(oldStateName);
                const value = stateItem.value();
                const oldValue = stateValues[oldStateName];
                if(typeof value !== typeof oldValue) {
                    continue;
                }
                if(typeof oldValue === 'object') {
                    try {
                        if(JSON.stringify(stateItem.getInitialValue()) !== JSON.stringify(value)) {
                            continue;
                        }
                    } catch (e) {
                        continue;
                    }
                }
                else if(stateItem.getInitialValue() !== value) {
                    continue;
                }
                statesToKeep[oldStateName] = oldValue[IS_PROXY_PROPERTY] ? oldValue.toObject() : oldValue;
            }
        }
        $state.set(statesToKeep);
        this.handleListeners();
    };

    this.handleListeners = function() {
        $listeners.forEach((callback) => {
            callback && callback();
        });
    };

    this.onControllerUpdated = function(callback) {
        $listeners.push(callback);
    };

    this.removeControllerUpdatedListener = function(callback) {
        const index = $listeners.findIndex((item) => callback === item);
        $listeners.splice(index, 1);
    };

};

export default ComponentDev;