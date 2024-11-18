import stateItemMutatorOverride from "src/State/stateItemMutatorOverride";
import {IS_PROXY_PROPERTY, PROXY_TARGET_LABEL} from "../constantes";

/**
 *
 * @param {string} $stateName
 * @param {*} $defaultValue
 * @param {State} $parentState
 *
 * @class
 */
const StateItem = function($stateName, $defaultValue, $parentState) {

    const $stateValue = {
        default: (typeof $defaultValue === 'object' ? JSON.parse(JSON.stringify($defaultValue)) : $defaultValue),
        current: null,
        last: $defaultValue
    };

    /** @type {Function[]} */
    const $listeners = [];

    /** @type {Object.<string, Function[]>} */
    const $watchListeners = {};

    /**
     * @param {string} path
     * @param {*} oldValue
     * @param {*} newValue
     */
    const triggerWatchListener = (path, oldValue, newValue) => {
        if($parentState && $parentState.isSwitchOff()) {
            return;
        }
        const listeners = $watchListeners[path];
        if(!listeners) {
            return;
        }
        listeners.forEach((listener) => {
            listener.apply(listener, [oldValue, newValue]);
        });
    };

    const triggerListener = () => {
        if($parentState && $parentState.isSwitchOff()) {
            return;
        }
        $listeners.forEach((listener) => {
            listener.apply(listener, [$stateValue.current, $stateValue.last]);
        });
    };

    /**
     * @param {*} value
     * @param {boolean} shouldTriggerListeners
     *
     * @returns {boolean}
     */
    this.set = (value, shouldTriggerListeners = true) => {
        if(value === $stateValue.current) {
            return false;
        }
        if($stateValue.current && $stateValue.current[IS_PROXY_PROPERTY]) {
            if(value === $stateValue.current[PROXY_TARGET_LABEL]) {
                return false;
            }
        }
        $stateValue.last = $stateValue.current;
        $stateValue.current = stateItemMutatorOverride(value, this);
        if(shouldTriggerListeners) {
            triggerListener();
        }
        return true;
    };

    this.value = function() {
        return $stateValue.current;
    };

    this.getLastValue = function() {
        return $stateValue.last;
    };

    this.getInitialValue = function() {
        return $stateValue.default;
    };

    this.getName = function() {
        return $stateName;
    };

    /**
     * @param {Function} listener
     *
     * @returns {Function}
     */
    this.onUpdate = function(listener) {
        // Todo: thinks about options to allow once edit
        $listeners.push(listener);
        return listener;
    };

    /**
     * @param {string} path
     * @param {*} oldValue
     * @param {*} newValue
     */
    this.handleUpdate = function(path, oldValue, newValue) {
        this.trigger();
        triggerWatchListener(path, oldValue, newValue);
    };

    /**
     * @param {string} path
     * @param {Function} callback
     */
    this.watch = function(path, callback) {
        $watchListeners[path] = callback;
    };

    this.trigger = function() {
        triggerListener();
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

    this.reset = function() {
        this.set($stateValue.default);
    };

    $stateValue.current = stateItemMutatorOverride($defaultValue, this);
};

export default StateItem;