import StateItem from "src/State/StateItem";
import ComponentProps from "src/Component/ComponentProps";
import {IS_PROXY_PROPERTY} from "src/constantes";

/**
 *
 * @param {?Object.<string, *>} $defaultValues
 * @param {Habame} HabameCore
 *
 * @class
 */
const State = function($defaultValues = {}, HabameCore) {

    /** @type {Object.<string, StateItem>} */
    const $stateItems = {};

    /**
     *  @type {string} $listeners[].names - list of state name
     *  @type {Function} $listeners[].listener - the function to handle if one of names match
     *  @type {Object[]} $listeners
     *
     */
    const $listeners = [];
    const $triggerListenersOptions = {
        enable: true,
        observer: null,
        listenersToHandle: new Set()
    };
    const $propsUsed = { props: null, only: null, callbacks: {} };

    let $lock = false;

    /**
     * @param {string[]} stateNames
     */
    const triggerStateItems = (stateNames) => {
        if(!$triggerListenersOptions.enable) {
            if($triggerListenersOptions.observer) {
                if($triggerListenersOptions.observer(this)) {
                    this.switchOn();
                }
            }
            return;
        }

        $listeners.forEach(({ names, listener }) => {
            if(!names) {
                return;
            }
            const shouldTriggerListener = names.some((name) => stateNames.includes(name));
            if(!shouldTriggerListener) {
                return;
            }
            listener.apply(listener, []);
        });
    };

    /**
     * @param {string} stateName
     * @param {*} stateValue
     *
     * @returns {StateItem}
     */
    this.add = function(stateName, stateValue) {
        if($lock) {
            // TODO
            // console.warn("It's not recommended to add a state after initialisation");
        }
        if($stateItems[stateName]) {
            const exitingStateItem = $stateItems[stateName];
            exitingStateItem.set(stateValue);
            return exitingStateItem;
        }
        const stateItem = new StateItem(stateName, stateValue, this);

        // If this state change, let's inform all concerned listeners
        stateItem.onUpdate(() => triggerStateItems([stateName]));
        $stateItems[stateName] = stateItem;

        Object.defineProperty(this, stateName, {
            configurable: true,
            get () {
                return stateItem.value();
            },
            set(newValue) {
                stateItem.set(newValue);
            }
        });

        return stateItem;
    };

    /**
     * @param {Function} observer
     */
    this.switchOff = function(observer) {
        $triggerListenersOptions.enable = false;
        $triggerListenersOptions.observer = observer;
    };

    this.isSwitchOff = function() {
        return (($triggerListenersOptions.enable === false) || (this.parent && this.parent.isSwitchOff()));
    };

    this.switchOn = function() {
        $triggerListenersOptions.enable = true;
        const updaters = [...$triggerListenersOptions.listenersToHandle];
        $triggerListenersOptions.listenersToHandle.clear(); // Avoid recursive update
        updaters.forEach(({ state, variables }) => state.trigger(variables) );
    };

    /**
     * Add multiple states
     *
     * @param {Object.<string, *>} values
     */
    this.init = function(values) {
        for(const key in values) {
            this.add(key, values[key]);
        }
    };

    this.refreshProps = function() {
        $propsUsed.props && this.useProps($propsUsed.props, $propsUsed.only);
    };

    /**
     * Connect the component state to its props
     *
     * @param {ComponentProps} props
     * @param {string[]} only
     */
    this.useProps = function(props, only= null) {
        if(!(props instanceof ComponentProps)) {
            throw new Error('State.useProps require a ComponentProps instance');
        }
        $propsUsed.props = props;
        $propsUsed.only = only;
        const propsValues = props.all();
        for (const propName in propsValues) {
            if(Array.isArray(only) && !only.includes(propName)) {
                continue;
            }
            if($propsUsed.callbacks[propName]) {
                return;
            }
            const stateItem = this.add(propName, propsValues[propName]);
            $propsUsed.callbacks[propName] = props.onUpdate(propName, (value, oldValue) => {
                stateItem.set(value);
                if(value[IS_PROXY_PROPERTY] || value === oldValue) {
                    stateItem.trigger();
                }
            });
        }
    };

    /**
     * @param {string[]} names
     */
    this.disconnectProps = function(names) {
        if(!$propsUsed) {
            return;
        }
        let namesToDisconnect = [...names];
        if(!names  || names.length === 0) {
            const propsValues = $propsUsed.props.all();
            namesToDisconnect = Object.keys(propsValues);
        }
        namesToDisconnect.forEach(function(name ) {
            $propsUsed.callbacks[name] && $propsUsed.callbacks[name].disconnect();
        });
    };

    /**
     * @param {string|Object} serviceInstance
     * @param {State} serviceInstance.$serviceState
     * @param {string[] }only
     *
     * @returns {Object}
     */
    this.useService = function(serviceInstance, only = []) {
        if(typeof serviceInstance === 'string') {
            serviceInstance = HabameCore.Services[serviceInstance];
            if(!serviceInstance) {
                throw new Error(`Undefined service ${serviceInstance}`);
            }
        }

        const serviceState = serviceInstance.$serviceState;
        if(!serviceState || !(serviceState instanceof State)) {
            throw new Error('Invalid service provide to useService');
        }
        const stateNames = serviceState.getStateNames();
        for(const stateName of stateNames) {
            if(only && only.length && !only.includes(stateName)) {
                continue;
            }
            const sourceState = serviceState.get(stateName);
            const stateItem = this.add(stateName, sourceState.value());
            sourceState.onUpdate((value, oldValue) => {
                stateItem.set(value);
                if(value === oldValue) {
                    stateItem.trigger();
                }
            });
        }
        return serviceInstance;
    };

    /**
     * Update multiple state at the same for more performance
     * @param {Object.<string, *>} values
     */
    this.set = function(values) {
        let shouldTrigger = false;
        for (const stateName in values) {
            if($stateItems[stateName] === undefined) {
                throw new Error('Undefined State: ' + stateName + ' is not declared as state');
            }
            const isUpdated = $stateItems[stateName].set(values[stateName], false);
            if(isUpdated) {
                shouldTrigger = true;
            }
        }
        if(!shouldTrigger) {
            return;
        }
        triggerStateItems(Object.keys(values));
    };

    /**
     * @param {string[]} names
     */
    this.trigger = function(names) {
        triggerStateItems(names);
    };

    /**
     * @param {string[]} names
     * @param {Function|AsyncFunction} callbabk
     */
    this.edit = async function(names, callbabk) {
        if(typeof callbabk === 'function') {
            if(callbabk.constructor.name === 'AsyncFunction') {
                await callbabk();
            }
            callbabk && callbabk();
        }
        triggerStateItems(names);
    };

    /**
     * @param {string} name
     *
     * @returns {boolean}
     */
    this.exists = function(name) {
        return $stateItems[name] !== undefined;
    };

    /**
     * get State which has a state with the name
     *
     * @param {string} name
     *
     * @returns {?State}
     */
    this.getStateWith = function(name) {
        if($stateItems[name] !== undefined) {
            return this;
        }
        return (this.parent) ? this.parent.getStateWith(name) : null;
    };

    /**
     * @param {string[]} names
     *
     * @returns {Object.<string, *>}
     */
    this.getValues = function(names) {
        const values = {};
        names.forEach((name) => {
            const stateItem = this.get(name);
            values[name] = stateItem.value();
        });
        return values;
    };

    /**
     * @returns {Object.<string, *>}
     */
    this.getAll = function() {
        return this.getValues(this.getStateNames());
    };

    /**
     * @param {string} name
     *
     * @returns {StateItem}
     */
    this.get = function(name) {
        if($stateItems[name] === undefined) {
            if(this.parent) {
                return this.parent.get(name);
            }
        }
        return $stateItems[name];
    };

    /**
     * @returns {string[]}
     */
    this.getStateNames = function() {
        return Object.keys($stateItems);
    };

    this.reset = function() {
        for(const state of $stateItems) {
            state.reset();
        }
    };

    /**
     *
     * @param {string[]} names
     * @param {Function} listener
     * @param {boolean} isToHandleFirst
     * @returns {{names, listener, remove: boolean}}
     */
    this.addListener =  function(names, listener, isToHandleFirst) {
        const listenerItem = { names, listener, remove: false };
        isToHandleFirst ? $listeners.unshift(listenerItem) : $listeners.push(listenerItem);
        return listenerItem;
    };

    /**
     *
     * @param {string[]} names
     * @param {Function} listener
     * @param {boolean} isToHandleFirst
     *
     * @returns {Function}
     */
    this.onUpdate = function(names, listener, isToHandleFirst = false) {
        const notFoundStateNames = names.filter((name) => !this.exists(name));
        const listenerItem = this.addListener(names, listener, isToHandleFirst);
        if(notFoundStateNames.length === 0) {
            return listener;
        }

        /** @type {{state: State, variables: string[]}[]} */
        const dependedStates = [];
        notFoundStateNames.forEach((name) => {
            const dependedState = this.getStateWith(name);
            if(!dependedState) {
                return;
            }
            const item = dependedStates.find(({ state }) => (state === dependedState));
            if(!item) {
                dependedStates.push({ state: dependedState, variables: [name] });
                return;
            }
            item.variables.push(name);
        });

        if(dependedStates.length === 0) {
            return listener;
        }

        dependedStates.forEach(({ state, variables}) => {
            const updateDataOptions = { variables, state };
            state.onUpdate(variables, () => {
                if(listenerItem.remove) {
                    return;
                }
                if(this.isSwitchOff()) {
                    if(!$triggerListenersOptions.observer || !$triggerListenersOptions.observer(this)) {
                        $triggerListenersOptions.listenersToHandle.add(updateDataOptions);
                        return;
                    }
                }
                listener.apply(listener, Array.from(arguments));
            });
        });

        return listener;
    };

    this.removeOnUpdateListenerFromParent = function(listener) {
        return (this.parent) ? this.parent.removeOnUpdateListener(listener) : null;
    };

    this.removeOnUpdateListener = function(listener) {
        const index  = $listeners.findIndex((item) => item.listener === listener);
        if(index === -1) {
            return;
        }
        const item = $listeners.splice(index, 1);
        item.remove = true;
        this.removeOnUpdateListenerFromParent(listener);
    };

    this.unlock = function() {
        $lock = false;
    };

    this.disconnect = function() {
        $listeners.splice(0);
        $triggerListenersOptions.listenersToHandle.clear();
    };

    this.lock =  function() {
        $lock = true;
    };

    ((() => { /* constructor */
        if(!$defaultValues) {
            return;
        }
        for(const key in $defaultValues) {
            this.add(key, $defaultValues[key]);
        }
    })());
};

export default State;