(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Habame = factory());
})(this, (function () { 'use strict';

    const DEFAULT_SLOT_NAME = 'default';

    const SLOT_RENDER_TAG_NAME = 'yield-fragment';
    const SLOT_DEFINITION_TAG_NAME = 'slot-fragment';
    const IS_PROXY_PROPERTY =  '__IS_PROXY_PROPERTY__';
    const PROXY_STATE_ITEM =  '__PROXY_STATE_ITEM__';
    const PROXY_TARGET_LABEL =  '__PROXY_TARGET_LABEL__';

    const EVENT_DIRECTIVE = {
        PREVENT_DEFAULT: 'prevent',
        STOP_PROPAGATION: 'stop'
    };

    /**
     *
     * @class
     */
    const HbEvent = function () {

        const $this = this;

        /** @type {Object.<string, Function[]>} */
        const $listeners = {};

        /**
         * @param {string} name
         * @param {?Array} params
         */
        this.emit = function(name, params) {
            if(!$listeners[name]) {
                return;
            }

            const args = (params || []).map((item) => {
                if(item[IS_PROXY_PROPERTY]) {
                    return item.toObject();
                }
                return item;
            });

            $listeners[name].forEach((listener) => {
                listener.apply(listener, args);
            });
        };

        /**
         * @param {string} name
         *
         * @returns {?{emit: Function}}
         */
        this.create = function(name) {
            const eventBridge = {
                emit: function() {
                    $this.emit(name, Array.from(arguments));
                }
            };
            if(this[name] !== undefined) {
                return null;
            }
            Object.defineProperty(this, name, {
                get() {
                    return eventBridge;
                }
            });

            return eventBridge;
        };

        this.disconnect = function() {
            for(const key in $listeners) {
                $listeners[key].splice(0);
            }
        };

        /**
         *
         * @param {string} name
         * @param {Function} listener
         *
         * @returns {?Function}
         */
        this.addEventListener = function(name, listener) {
            if(typeof listener !== 'function') {
                return null;
            }
            $listeners[name] = $listeners[name] || [];
            $listeners[name].push(listener);
            return listener;
        };

        this.on = this.addEventListener;

        /**
         * @param {string} name
         * @param {Function} listenerToRemove
         */
        this.removeEventListener = function(name, listenerToRemove) {
            if($listeners[name] === undefined) {
                return;
            }
            const listeners = $listeners[name];
            const listenerIndex = listeners.indexOf(listenerToRemove);
            if(listenerIndex < 0) {
                return;
            }
            listeners.splice(listenerIndex, 1);
        };

        this.clearAll = function() {
            for(const key in $listeners) {
                $listeners[key].splice();
            }
        };

    };

    const ARRAY_OVERRIDABLE_METHODS = [
        'push',
        'pop',
        'shift',
        'unshift',
        'sort',
        'reverse',
        'splice'
    ];



    const transformToProxy = function(object, options) {
        if(!object || typeof object !== 'object') {
            return object;
        }
        options.path = options.path || [];
        for(const name in object) {
            if(typeof object[name] === 'object') {
                const proxy = transformToProxy(object[name], {
                    ...options,
                    path: [...options.path, name]
                });
                if(Array.isArray(object[name])) {
                    object[name] = proxy;
                }
            }
        }

        let mutators = [];
        if(Array.isArray(object)) {
            mutators = ARRAY_OVERRIDABLE_METHODS;
        }
        else if(object && object.MUTATORS) {
            mutators = object.MUTATORS;
        }

        return new Proxy(object, {
            get(target, prop) {
                if(prop === IS_PROXY_PROPERTY) {
                    return true;
                }
                if(prop === PROXY_STATE_ITEM) {
                    return options.$stateItem;
                }
                if(prop === PROXY_TARGET_LABEL) {
                    return object;
                }

                const value = target[prop];
                if(typeof value === 'function') {
                    return function() {
                        const result = value.apply(target, Array.from(arguments));
                        if(mutators.includes(prop)) {
                            options.$stateItem.trigger();
                        }
                        return result;
                    };
                }

                if(prop === 'toObject' && object.toObject === undefined) {
                    return () => {
                        return JSON.parse(JSON.stringify(target));
                    };
                }

                return value;
            },
            set(target, prop, value) {
                const propPath = [...options.path, prop].join('.');
                const oldValue = target[prop];
                if(typeof value === 'object') {
                    if(value === target[prop]) {
                        return;
                    }
                    if(value && value[IS_PROXY_PROPERTY] === true) {
                        value = JSON.parse(JSON.stringify(value));
                    }
                    const proxy = transformToProxy(value, options);
                    target[prop] = (Array.isArray(value)) ? proxy : value;
                }
                else {
                    target[prop] = value;
                }
                options.onSet && options.onSet(propPath, oldValue, value);
            }
        });
    };

    const stateItemMutatorOverride = function($value, $stateItem) {
        if(!$value || typeof $value !== 'object' || !$stateItem) {
            return $value;
        }

        if($value[IS_PROXY_PROPERTY]) {
            // if($stateItem === $value[PROXY_STATE_ITEM]) {
            //     return $value;
            // }
            // $value = JSON.parse(JSON.stringify($value));
            return $value;
        }

        return transformToProxy($value, {
            path: [],
            $stateItem,
            onSet: function(path, oldValue, newValue) {
                $stateItem.handleUpdate(path, oldValue, newValue);
            }
        });
    };

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

    /**
     *
     * @param {Object.<string, Template>} $propTemplates
     * @param {Object.<string, Function>} $slots
     *
     * @class
     */
    const ComponentProps = function($propTemplates = {}, $slots = {}) {



        /**
         * @param {string} propName
         * @returns {*}
         */
        const getPropValue = (propName) => {
            const value = $propTemplates[propName].value();
            if(value[IS_PROXY_PROPERTY]) {
                return value.toObject();
            }
            return value;
        };

        /**
         * @param {string} propName
         */
        const updatePropValue = (propName) => {
            this[propName] = getPropValue(propName);
        };

        const updatePropsValues = () => {
            for (const propName in $propTemplates) {
                if(['onUpdate', 'all', 'getSlot'].includes(propName)) {
                    continue;
                }
                updatePropValue(propName);
            }
        };

        /**
         * @param {string} propName
         * @returns {boolean}
         */
        this.exists = function(propName) {
            return Object.keys($propTemplates).includes(propName);
        };

        /**
         * @param {string} propName
         * @param {Template} template
         */
        this.add = function(propName, template) {
            if(this.exists(propName)) {
                return;
            }
            $propTemplates[propName] = template;
            template.onUpdate(updatePropsValues);
            updatePropValue(propName);
        };

        /**
         * @param {string} name
         * @param {Function} listener
         *
         * @returns {{disconnect: (function(): void)}}
         */
        this.onUpdate = function(name, listener) {
            if($propTemplates[name] === undefined) {
                throw new Error('undefined props ' + name);
            }
            $propTemplates[name].onUpdate(listener);
            return {
                disconnect: function() {
                    $propTemplates[name].disconnect(listener);
                }
            };
        };

        /**
         * @param {string} name
         * @param {Function} listener
         */
        this.disconnect = function(name, listener) {
            $propTemplates[name]?.disconnect(listener);
        };


        /**
         * @returns {Object.<string, *>}
         */
        this.all = function() {
            const props = {};
            for (const propName in $propTemplates) {
                props[propName] = getPropValue(propName);
            }
            return props;
        };

        /**
         * @param {string} name
         *
         * @returns {?Function}
         */
        this.getSlot = function(name) {
            return $slots ? $slots[name] : null;
        };

        /**
         * @param {Object.<string, Function>} slots
         */
        this.updateSlots = function(slots) {
            $slots = slots;
        };

        /**
         * @param {string} propName
         * @returns {Template}
         */
        this.getTemplate = function(propName) {
            return $propTemplates[propName];
        };

        ((() => { /* constructor */
            updatePropsValues();
            for (const propName in $propTemplates) {
                $propTemplates[propName].onUpdate(updatePropsValues);
            }
        })());

    };

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
            $listeners.splice(index, 1);
            this.removeOnUpdateListenerFromParent(listener);
        };

        this.unlock = function() {
        };

        this.disconnect = function() {
            $listeners.splice(0);
            $triggerListenersOptions.listenersToHandle.clear();
        };

        this.lock =  function() {
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

    /**
     *
     * @param {string} $ifStatement
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     *  @class
     */
    const ViewIfStatement = function($ifStatement, $viewProps) {

        const $ifTemplate = new Template($ifStatement, $viewProps, true);

        /** @type {Function[]} */
        const $listeners = [];

        const trigger = function() {
            $listeners.forEach((callback) => {
                callback.apply(callback, [!!$ifTemplate.value()]);
            });
        };

        /**
         * @param {Function} callback
         *
         * @returns {Function}
         */
        this.watch = function(callback) {
            $listeners.push(callback);
            return callback;
        };

        this.isTrue = function() {
            return !!$ifTemplate.value() === true;
        };

        this.trigger = trigger;

        this.isFalse = function() {
            return !!$ifTemplate.value() === false;
        };

        this.loadStateWatcher = function() {
            const state = $viewProps.getStateToUse();
            const stateToWatchNames = $ifTemplate.statesToWatch();

            state.removeOnUpdateListener(trigger);
            state.onUpdate(stateToWatchNames, trigger, true);
        };

        /**
         * @param {string} template
         */
        this.refresh = function(template) {
            $ifTemplate.refresh(template);
            this.loadStateWatcher();
        };

        ((() => { /* Constructor */
            this.loadStateWatcher();
        })());

    };

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

    /**
     *
     * @param {Object} arg
     * @param {string|Array|Object} arg.$viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
     * @param {boolean} arg.$isFragment
     *
     * @class
     */
    const AbstractView = function({ $viewDescription, $viewProps, $isFragment }) {

        const $viewState = { isRendered: false, isUnmount: false, isRemoved: false };

        /** @type {ViewIfStatement} */
        let $ifStatement = null;

        const $switchContainers =  {
            anchorsFragment: document.createDocumentFragment(),
            anchorParent: null, // the node parent
            selfFragment: document.createDocumentFragment(),
            anchor: null, // the node anchor in the DOM
            parent: null // the node parent
        };

        const switchOnState = () => {
            return $ifStatement.isTrue();
        };

        /**
         * @param {string} ifDescription
         * @returns {?ViewIfStatement}
         */
        const buildIfStatement = (ifDescription)=> {
            if(!ifDescription) {
                return null;
            }
            if($ifStatement) {
                return null;
            }
            $ifStatement = new ViewIfStatement(ifDescription, $viewProps);
            $ifStatement.watch((isTrue) => {
                if($viewProps.localState) {
                    (!isTrue) ? $viewProps.localState.switchOff(switchOnState) : $viewProps.localState.switchOn();
                }
                (isTrue) ? this.mount() : this.unmount();
            });
            return $ifStatement;
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         */
        this.render = function(parentNode) {
            if(!parentNode || this.isRendered()) {
                return;
            }
            if($isFragment !== true) {
                buildIfStatement($viewDescription.if);
            }
            this.beforeRenderProcess ? this.beforeRenderProcess() : null;
            this.renderProcess(parentNode, $ifStatement);
            if($ifStatement && $ifStatement.isFalse()){
                this.setIsUnmounted();
            }else {
                this.setIsMounted();
                this.setIsRendered();
            }
        };

        /**
         * @param {HTMLElement|DocumentFragment|Comment} nodeToInsert
         * @param {HTMLElement|DocumentFragment|Comment} targetNode
         */
        this.insertAfter = function(nodeToInsert, targetNode) {
            const nextElement = targetNode.nextSibling;
            if(!targetNode.parentNode) {
                return;
            }
            if(!nextElement) {
                targetNode.parentNode.appendChild(nodeToInsert);
                return;
            }
            targetNode.parentNode.insertBefore(nodeToInsert, nextElement);
        };

        this.mount = function( ) {
            if(!$viewState.isUnmount) {
                return;
            }
            if(!this.mountProcess) {
                return;
            }
            this.mountProcess($ifStatement);
        };

        /**
         * @param {boolean} full
         */
        this.unmount = function(full = false) {
            if($viewState.isUnmount && full !== true) {
                return;
            }
            if(!this.unmountProcess) {
                return;
            }
            this.unmountProcess(full);
        };

        this.remove = function() {
            if($viewState.isRemoved) {
                return;
            }
            if(!this.removeProcess) {
                return;
            }
            this.removeProcess();
        };

        this.setIsRendered = function() {
            $viewState.isRendered = true;
        };

        this.setIsMounted = function() {
            $viewState.isUnmount = false;
        };

        this.setIsRemoved = function() {
            $viewState.isRemoved = true;
        };

        this.setIsNotRemoved = function() {
            $viewState.isRemoved = false;
        };

        this.setIsUnmounted = function() {
            $viewState.isUnmount = true;
        };

        this.isRendered = function() {
            return $viewState.isRendered;
        };

        this.isRemoved = function() {
            return $viewState.isRemoved;
        };

        /**
         * @param {HTMLElement?} parentNode
         */
        this.setParent = function(parentNode) {
            $switchContainers.parent = parentNode;
        };

        /**
         * @param {HTMLElement|Comment} anchorNode
         */
        this.setAnchor = function(anchorNode) {
            $switchContainers.anchor = anchorNode;
        };

        /**
         * @param {HTMLElement | DocumentFragment} parent
         * @param {HTMLElement | DocumentFragment | Text | Comment | (HTMLElement | DocumentFragment | Text | Comment)[]} node
         */
        this.unmountAnchors = function(parent, node) {
            $switchContainers.anchorParent = parent;
            if(Array.isArray(node)) {
                node.forEach((nodeItem) => {
                    $switchContainers.anchorsFragment.appendChild(nodeItem);
                });
                return;
            }
            $switchContainers.anchorsFragment.appendChild(node);
        };
        this.mountAnchors = function() {
            if($switchContainers.anchorParent) {
                $switchContainers.anchorParent.appendChild($switchContainers.anchorsFragment);
            }
            $switchContainers.anchorParent = null;
        };

        /**
         * @param {HTMLElement | DocumentFragment | Text | Comment | (HTMLElement | DocumentFragment | Text | Comment)[]} node
         */
        this.moveIntoFragment = function(node) {
            if(Array.isArray(node)) {
                node.forEach((nodeItem) => {
                    $switchContainers.selfFragment.appendChild(nodeItem);
                });
                return;
            }
            $switchContainers.selfFragment.appendChild(node);
        };

        /**
         * @param {boolean} isForceAppend
         */
        this.moveIntoParent = function(isForceAppend = false) {
            if($switchContainers.parent || isForceAppend) {
                $switchContainers.parent.appendChild($switchContainers.selfFragment);
                return;
            }
            if(!$switchContainers.anchor) {
                return;
            }
            this.insertAfter($switchContainers.selfFragment, $switchContainers.anchor);
        };

        /**
         * @returns {DocumentFragment}
         */
        this.unMountedFragment = function() {
            return $switchContainers.selfFragment;
        };

        this.getViewDescription = function() {
            return $viewDescription;
        };

        this.updateViewDescription = () => {};
        this.updateIfControl = () => {};

        AbstractViewDev.apply(this, [{
            $viewDescription,
            $callbacks: {
                getIfStatement: () => $ifStatement,
                buildIfStatement
            }
        }]);

    };

    /**
     * @param {Object} arg
     * @param {string} arg.$viewDescription
     * @param {TextTemplateDescription} arg.$viewDescriptionDetails
     * @param {Text[]} arg.$htmlTextNodes
     * @param {{ partValue: string, htmlTextNode: Text }[]} arg.$textNodes
     * @param {{createConnexion: Function, getParentNode: Function}} arg.callbacks
     *
     * @class
     */
    const ViewTextElementDev = function({ $viewDescription, $viewDescriptionDetails, $htmlTextNodes, $textNodes, callbacks }) {

        const { createConnexion, getParentNode } = callbacks;

        const unmountNodes = function() {
            $htmlTextNodes.forEach((node) => {
                node.remove();
            });
            $htmlTextNodes.splice(0);
        };

        const updateRender = () => {
            const parentNode = getParentNode();
            $htmlTextNodes.forEach((htmlTextNode) => {
                parentNode.appendChild(htmlTextNode);
            });
        };

        const build = function() {
            unmountNodes();
            let tempExistingTextNodes = [...$textNodes];
            $viewDescriptionDetails.each((viewPart) => {
                let partValue = (!viewPart.hasAState) ? viewPart.value : viewPart.template.value();

                const existingNode = tempExistingTextNodes.find((item) => item.partValue === partValue);


                const htmlTextNode = existingNode ? existingNode.htmlTextNode : document.createTextNode(partValue);
                $htmlTextNodes.push(htmlTextNode);
                if(!existingNode) {
                    $textNodes.push({ partValue, htmlTextNode });
                }
                else {
                    tempExistingTextNodes = tempExistingTextNodes.filter((item) => item === existingNode);
                }

                if(existingNode || !viewPart.hasAState) {
                    return;
                }
                createConnexion(htmlTextNode, viewPart);
            });

            updateRender();
        };


        /**
         * @param {string} newDescription
         */
        this.updateViewDescription = function(newDescription) {
            if(newDescription === $viewDescription) {
                return;
            }
            $viewDescriptionDetails.refresh(newDescription);
            build();
        };

    };

    /**
     * @param {string} $viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps

     * @class
     * @extends AbstractView
     */
    const ViewTextElement = function($viewDescription, $viewProps) {

        AbstractView.call(this, { $viewDescription, $viewProps });
        const $viewDescriptionDetails = new TextTemplateDescription($viewDescription, $viewProps);

        /** @type {Text[]} */
        const $htmlTextNodes = [];
        /** @type {{ partValue: string, htmlTextNode: Text }[]} */
        const $textNodes = [];
        let $parentNode = null;

        const build = function() {
            $viewDescriptionDetails.each((viewPart) => {
                let partValue = (!viewPart.hasAState) ? viewPart.value : viewPart.template.value();
                const htmlTextNode = document.createTextNode(partValue);
                $htmlTextNodes.push(htmlTextNode);
                $textNodes.push({ partValue, htmlTextNode });

                if(!viewPart.hasAState) {
                    return;
                }
                createConnexion(htmlTextNode, viewPart);
            });
        };

        /**
         * @param {Text} htmlTextNode
         * @param {{template: Template, value: string}} viewPart
         */
        const createConnexion = function(htmlTextNode, viewPart) {
            viewPart.template.onUpdate((updatedValue) => {
                if(updatedValue !== htmlTextNode.textContent) {
                    htmlTextNode.textContent = updatedValue;
                }
            });
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         */
        this.renderProcess = function(parentNode) {
            $parentNode = parentNode;
            if(this.isRendered()) {
                return;
            }
            build();
            this.setParent(parentNode);
            $htmlTextNodes.forEach((htmlTextNode) => {
                parentNode.appendChild(htmlTextNode);
            });
            this.setIsRendered();
        };

        this.unmountProcess = function() {
            this.moveIntoFragment($htmlTextNodes);
            this.setIsUnmounted();
        };

        this.mountProcess = function() {
            this.moveIntoParent();
            this.setIsMounted();
        };
        this.removeProcess = function() {
            $htmlTextNodes.forEach((node) => node.remove());
            this.setIsRemoved();
        };

        ViewTextElementDev.apply(this, [{
            $viewDescription,
            $viewDescriptionDetails,
            $htmlTextNodes,
            $textNodes,
            callbacks: {
                createConnexion,
                getParentNode: () => $parentNode
            }
        }]);
    };

    /**
     *
     * @param {string} $template
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     * @class
     * @extends AbstractTemplate
     */
    const ActionTemplate = function($template, $viewProps) {

        const $self =  this;

        AbstractTemplate.apply(this, [$viewProps]);

        /** @type {{states: string[], actions: string[]}} */
        let $requestedVariablesNames = {};
        const $stateToUse = $viewProps.getStateToUse();
        const $actions = $viewProps.componentInstance.getActions();

        /** @type {?Function} */
        let $actionFunctionBridge = null;

        /** @type {?string} */
        let $lastTemplate = null;


        /**
         * @param {Event} event
         * @param {?*[]} args
         */
        this.handle =  function(event, args = null) {
            $actionFunctionBridge.apply($actions, [$stateToUse, $requestedVariablesNames.states, $actions, event, args]);
        };

        /**
         * @param {string} template
         */
        this.refresh = function(template) {
            if(template === $lastTemplate) {
                return;
            }
            $requestedVariablesNames = this.getRequestedVars(template, false);
            if($actions[template]) {
                template = template + '.apply(actions, (Array.isArray($args) ? $args : [$event]))';
            }

            try {
                let returnCode = 'return '+template+';';
                const { states, actions} = $requestedVariablesNames;

                $actionFunctionBridge = new Function(
                    'state','states', 'actions', '$event', '$args',
                    (states.length ? 'const {' + states.join(',') + '} = state.getValues(states);' : '') +
                    (actions.length ? 'const {' + actions.join(',') + '} = actions;' : '') +
                    returnCode
                );
                $lastTemplate = template;
            } catch (e) {
                throw new Error('Syntax error : ' + template);
            }
        };

        ((() => { // constructor
            $self.refresh($template);
            const callback = () => {
                if($actions[$template]) {
                    $lastTemplate = null;
                    this.refresh($template);
                    $viewProps.componentInstance.removeControllerUpdatedListener(callback);
                }
            };
            if(!$actions[$template]) {
                $viewProps.componentInstance.onControllerUpdated(callback);
            }
        })());
    };

    /**
     * @param {Object} arg
     * @param {Object} arg.$viewDescription
     * @param {Object.<string, {template: ActionTemplate, callback: Function, name: string}>} arg.$componentEventActions
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
     * @param {Object.<string, ?{ builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }>} arg.$slotManagers
     * @param {{getProps: Function, getHbEvent: Function, buildEvent: Function}} arg.$callbacks
     *
     * @class
     */
    const ViewComponentElementDev = function({ $viewDescription, $componentEventActions, $viewProps, $slotManagers, $callbacks  }) {

        const { getProps, getElement, getHbEvent, buildEvent, getSlotManagerObject } = $callbacks;

        /**
         * @param {Object.<string, string>} props
         */
        const buildProps = function(props) {
            const componentProps = getProps();
            if(!componentProps) {
                return;
            }

            Object.keys($viewDescription.props).forEach((name) => {
                if(!props[name]) {
                    const template = componentProps.getTemplate(name);
                    if(template) {
                        template.disconnect();
                    }
                }
            });

            const componentState = getElement().getState();
            const propsToRefresh = [];
            for(const propName in props) {
                if(componentProps.exists(propName)) {
                    propsToRefresh.push(propName);
                    continue;
                }
                const template = new Template(props[propName], $viewProps);
                componentProps.add(propName, template);
                componentState.useProps(componentProps, [propName]);
            }
            propsToRefresh.forEach(function(propName) {
                componentProps.getTemplate(propName).refresh(props[propName], true);
            });
        };

        /**
         * @param {Object.<string, string>} events
         */
        const buildEvents = function(events) {
            const hbEvent = getHbEvent();
            if(!hbEvent) {
                return;
            }

            Object.keys($viewDescription.events).forEach((eventName) => {
                const event = $componentEventActions[eventName];
                if(!events[eventName]) {
                    hbEvent.removeEventListener(event.name, event.callback);
                    return;
                }
                event.template.refresh(events[eventName]);
            });

            for(const eventName in events) {
                if($componentEventActions[eventName]) {
                    continue;
                }
                const actionName = events[eventName];
                buildEvent(eventName, actionName);
            }
        };

        const updatePropsSlots = function() {
            const componentProps = getProps();
            if(!componentProps) {
                return;
            }
            const slotBuilders = {};
            Object.keys($slotManagers).forEach(() => {
                if(!$slotManagers[name]) {
                    return;
                }
                slotBuilders[name] = $slotManagers[name].builder;
            });
            componentProps.updateSlots(slotBuilders);
        };


        /**
         * @param {Object} template
         */
        const updateSlots = function(template) {
            if(!template.content && !template.slots) {
                Object.keys($slotManagers).forEach((name) => {
                    $slotManagers[name].deleteInstances();
                    $slotManagers[name] = null;
                });
                return;
            }

            if($viewDescription.slots) {
                Object.keys($viewDescription.slots).forEach((name) => {
                    if(!template.slots || !template.slots[name]) {
                        $slotManagers[name].deleteInstances();
                        $slotManagers[name] = null;
                        return;
                    }
                    $slotManagers[name].updateViewDescription(template.slots[name]);
                });
            }

            if(template.content) {
                if($viewDescription.content) {
                    $slotManagers.default.updateViewDescription(template.content);
                }
                else {
                    $slotManagers.default = getSlotManagerObject(template.content);
                }
            }
            else if($viewDescription.content) {
                $slotManagers.default.deleteInstances();
                $slotManagers.default = null;
            }

            Object.keys(template.slots).forEach((name) => {
                if($viewDescription.slots[name]) {
                    return;
                }
                $slotManagers[name] = getSlotManagerObject(template[name]);
            });

        };


        /**
         * @param {Object} template
         */
        this.updateViewDescription = function(template) {
            buildProps(template.props);
            buildEvents(template.events);
            updateSlots(template);
            updatePropsSlots();

            const propertiesToUpdated = ['content', 'slots', 'events', 'props'];

            propertiesToUpdated.forEach((property) => {
                $viewDescription[property] = template[property];
            });
        };

    };

    /**
     *
     * @param {Object} $viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     * @class
     * @extends AbstractView
     */
    const ViewComponentElement = function($viewDescription, $viewProps) {

        AbstractView.call(this, { $viewDescription, $viewProps });

        const $viewAnchor = document.createComment('');

        /** @type {?Component} */
        let $componentElement = null;

        /** @type {?ComponentProps} */
        let $componentProps = null;
        /** @type {?HbEvent} */
        let $hbEvent = null;
        /** @type {Object.<string, {template: ActionTemplate, callback: Function, name: string}>} */
        let $componentEventActions = {};
        /** @type {Object.<string, { builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }>} */
        let $slotManagers = {};

        const build = function() {
            const props = {};
            if($viewDescription.props) {
                for(const propName in $viewDescription.props) {
                    props[propName] = new Template($viewDescription.props[propName], $viewProps);
                }
            }
            $componentProps = new ComponentProps(props, getSlots());
            $componentElement = $viewProps.appInstance.createComponentByName($viewDescription.component, $componentProps);
            buildEventListenerWithParent();
        };

        /**
         * @param {Object} viewDescription
         * @returns {{ builder: function(*, *): ViewElementFragment, updateViewDescription: Function, deleteInstances: Function }}
         */
        const getSlotManagerObject = function(viewDescription) {
            /** @type {ViewElementFragment[]} */
            const instances = [];
            return {
                updateViewDescription: function(newViewDescription) {
                    viewDescription = newViewDescription;
                    instances.forEach((node) => {
                        node.updateViewDescription(newViewDescription);
                    });
                },
                deleteInstances: function() {
                    instances.forEach((node)=> {
                        node.remove();
                    });
                },
                builder: function(container, callback) {
                    const localState = callback(viewDescription.props);
                    const customProps = { ...$viewProps };
                    if(localState) {
                        localState.parent = $viewProps.getStateToUse();
                        customProps.localState = localState;
                    }
                    const node = new ViewElementFragment(viewDescription, customProps);
                    node.render(container);
                    instances.push(node);
                    return node;
                }
            };
        };

        const getSlots = function() {
            const slots = { };
            if($viewDescription.content) {
                const slotManager = getSlotManagerObject($viewDescription.content);
                slots.default = slotManager.builder;
                $slotManagers.default = slotManager;
            }
            if(!$viewDescription.slots) {
                return slots;
            }

            for(const name in $viewDescription.slots) {
                const slotManager = getSlotManagerObject($viewDescription.slots[name]);
                $slotManagers[name] = slotManager;
                slots[name]= slotManager.builder;
            }
            return slots;
        };

        const buildEventListenerWithParent = () => {
            const componentActions = $viewProps.componentInstance.getActions();
            if(!$viewDescription.events || !componentActions) {
                return;
            }
            $hbEvent = $componentElement.getHbEvent();

            for(const eventName in $viewDescription.events) {
                const actionName = $viewDescription.events[eventName];
                buildEvent(eventName, actionName);
            }
        };

        /**
         * @param {string} eventName
         * @param {string} actionName
         */
        const buildEvent = function(eventName, actionName) {
            const actionTemplate = new ActionTemplate(actionName, $viewProps);
            const callback = function() {
                const params = Array.from(arguments);
                params.push($viewProps.localState);
                actionTemplate.handle(null, params);
            };
            $componentEventActions[eventName] = { template: actionTemplate, callback, name: eventName };
            $hbEvent.addEventListener(eventName, callback);
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         * @param {ViewIfStatement} ifStatement
         */
        this.renderProcess = function(parentNode, ifStatement) {
            build();
            parentNode.appendChild($viewAnchor);
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            $componentElement.render(parentNode);
        };

        /**
         * @param {boolean} full
         */
        this.unmountProcess = function(full) {
            if(full) {
                this.unmountAnchors($viewAnchor.parentNode, $viewAnchor);
                if(!$componentElement) {
                    return;
                }
            }
            $componentElement.unmount(full);
            this.setIsUnmounted();
        };

        /**
         * @param {ViewIfStatement} ifStatement
         */
        this.mountProcess = function(ifStatement) {
            this.mountAnchors();
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            if($componentElement.isRendered()) {
                $componentElement.mount();
            }
            else {
                const fragment = document.createDocumentFragment();
                $componentElement.render(fragment);
                this.insertAfter(fragment, $viewAnchor);
            }
            this.setIsMounted();
        };

        this.removeProcess = function() {
            $viewAnchor.remove();
            $componentElement.remove();
            this.setIsUnmounted();
        };

        this.target = function() {
            if(!$componentElement) {
                return null;
            }
            return $componentElement.getPublicMethod();
        };


        ViewComponentElementDev.apply(this, [{
            $viewDescription,
            $viewProps,
            $componentEventActions,
            $slotManagers,
            $callbacks: {
                getProps: () => $componentProps,
                getElement: () => $componentElement,
                getHbEvent: () => $hbEvent,
                getSlots,
                buildEvent,
                getSlotManagerObject
            }
        }]);
    };

    /**
     * @param {Object} arg
     * @param {TextTemplateDescription} arg.$templateDescription
     *
     * @class
     */
    const ViewHtmlElementAttributeDev =  function({ $templateDescription }) {

        this.disconnect = function() {
            this.emitUpdate = () => {};
        };

        this.updateValueSource = function(value) {
            $templateDescription.refresh(value);
            this.emitUpdate();
        };

    };

    const ATTR_MAPPERS =  {
        style: (value) => {
            return Object.keys(value).map((name) => name + ': ' + value[name] + ';').join(' ');
        },
        class: (value) => {
            return Object.keys(value).filter((name) => value[name]).join(' ');
        }
    };

    /**
     * @param {HTMLElement} $htmlNode
     * @param {string} $attrName
     * @param {string} $attrValue
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     * @class
     */
    const ViewHtmlElementAttribute =  function($htmlNode, $attrName, $attrValue, $viewProps) {

        const $templateDescription = new TextTemplateDescription($attrValue, $viewProps);

        /** @type {{onUpdate: Function[]}} */
        const $listeners = { onUpdate: [] };
        /** @type {string[]} */
        const $directAttributesChange = ['value', 'checked'];

        /**
         * @param {string} value
         */
        const updateNodeAttribute = (value) => {
            if(!$attrName) {
                return;
            }
            if($directAttributesChange.indexOf($attrName) >= 0) {
                $htmlNode[$attrName] = value;
                return;
            }
            if(!$htmlNode || typeof $htmlNode.setAttribute !== 'function') {
                return;
            }
            $htmlNode.setAttribute($attrName, value);
        };

        /**
         * @param {string} listenerType
         * @param {?Array} params
         */
        const trigger = (listenerType, params) => {
            if(!$listeners[listenerType]) {
                return;
            }
            $listeners[listenerType].forEach((listener) => {
                listener.apply(listener, params || []);
            });
        };

        this.disconnect = () => {};

        this.value = function() {
            const values = [];
            $templateDescription.each((part) => {
                const value = (!part.hasAState) ? part.value : part.template.value();
                if(typeof value !== 'object') {
                    values.push(value);
                    return;
                }
                const objectValue = ATTR_MAPPERS[$attrName] ? ATTR_MAPPERS[$attrName].apply(ATTR_MAPPERS, [value]) : value;
                values.push(objectValue);
            });
            const filteredValues = values.filter((value) => (value !== undefined && value !== null && value !== ''));
            if(filteredValues.length === 1) {
                return filteredValues[0];
            }
            return filteredValues.join(' ');
        };

        /**
         * @param {Function} listener
         */
        this.onUpdate = function(listener) {
            $listeners.onUpdate.push(listener);
        };

        this.emitUpdate = function() {
            const value = this.value();
            updateNodeAttribute(value);
            trigger('onUpdate', [value]);
        };

        ((() => { /* Constructor */
            updateNodeAttribute(this.value());
            const state = $viewProps.getStateToUse();
            state.onUpdate($templateDescription.statesToWatch(), () => {
                this.emitUpdate();
            });
        })());

        ViewHtmlElementAttributeDev.apply(this, [{
            $templateDescription,
            $callbacks: { updateNodeAttribute }
        }]);
    };

    /**
     * @param  {Object.<string, Function[]>} $listeners
     *
     * @class
     */
    const Lifecycle =  function($listeners) {

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onBeforeCreate = function(listener) {
            $listeners.beforeCreate.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onCreated = function(listener) {
            $listeners.created.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onBeforeMount = function(listener) {
            $listeners.beforeMount.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onMounted = function(listener) {
            $listeners.mounted.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onBeforeUnmount = function(listener) {
            $listeners.beforeUnmount.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onUnmounted = function(listener) {
            $listeners.unmounted.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onBeforeRemove = function(listener) {
            $listeners.beforeRemove.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onRemove = function(listener) {
            $listeners.remove.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onBeforeUpdate = function(listener) {
            $listeners.beforeUpdate.push(listener);
            return this;
        };

        /**
         * @param {Function} listener
         *
         * @returns {this}
         */
        this.onUpdated = function(listener) {
            $listeners.updated.push(listener);
            return this;
        };

        this.clearAll = function() {
            for(const key in $listeners) {
                $listeners[key].slice();
            }
        };

    };

    /**
     * @static
     *
     * @returns {Object.<string, Function[]>}
     */
    Lifecycle.newListenersStore = function() {
        return {
            beforeCreate: [],
            created: [],
            beforeMount: [],
            mounted: [],
            beforeUnmount: [],
            unmounted: [],
            beforeRemove: [],
            removed: [],
            beforeUpdate: [],
            updated: []
        };
    };

    /**
     *
     * @param {Object.<string, Function[]>} $listeners
     *
     * @class
     */
    const LifecycleHandler = function ($listeners) {

        /**
         * @param {Function[]} listeners
         * @param {Object} args
         */
        const handleListeners = (listeners, args) => {
            listeners.forEach((listener) => {
                listener.apply(listener, Array.from(args));
            });
        };

        this.beforeCreate = function() {
            handleListeners($listeners.beforeCreate, arguments);
        };

        this.created = function() {
            handleListeners($listeners.created, arguments);
        };

        this.beforeUnmount = function() {
            handleListeners($listeners.beforeUnmount, arguments);
        };

        this.unmounted = function() {
            handleListeners($listeners.unmounted, arguments);
        };

        this.beforeMount = function() {
            handleListeners($listeners.beforeMount, arguments);
        };

        this.mounted = function() {
            handleListeners($listeners.mounted, arguments);
        };

        this.beforeRemove = function() {
            handleListeners($listeners.beforeRemove, arguments);
        };

        this.removed = function() {
            handleListeners($listeners.removed, arguments);
        };

        this.beforeUpdate = function() {
            handleListeners($listeners.beforeUpdate, arguments);
        };

        this.updated = function() {
            handleListeners($listeners.updated, arguments);
        };

    };

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

    /**
     * @param {string|Array|Object} newDescription
     * @param {string|Array|Object} newDescriptionIndex
     * @param {ViewElementFragment[]} elements
     * @returns {{isSameIndex: boolean, element: ViewElementFragment}}
     */
    const getExistingElement = function(newDescription, newDescriptionIndex, elements) {
        let isSameIndex = false;
        const element = elements.find((node, elementIndex) => {
            const description = node.getViewDescription();
            isSameIndex = elementIndex === newDescriptionIndex;
            if(typeof description === 'string') {
                return description === newDescription;
            }
            if(description.key && (description.key === newDescription.key)) {
                return true;
            }
            if(description.ref && (description.ref === newDescription.ref)) {
                return true;
            }
            if(JSON.stringify(description) === JSON.stringify(newDescription)) {
                return true;
            }
            if(description.component && (description.component === newDescription.component)) {
                return true;
            }
            const {content: _,  ...descriptionWithoutContent} = description;
            const {content: __,  ...newDescriptionWithoutContent} = newDescription;

            return JSON.stringify(descriptionWithoutContent) === JSON.stringify(newDescriptionWithoutContent);
        });

        return {
            isSameIndex,
            element
        };
    };

    /**
     * @param {string|Array|Object} newViewDescription
     * @param {string|Array|Object} oldViewDescription
     * @param {ViewElementFragment} elements
     * @returns {*[]}
     */
    const arrayViewDescriptionCompare = function(newViewDescription, oldViewDescription, elements) {
        const diff = [];
        let oldElements = [...elements];
        const oldDescription = [...oldViewDescription];

        newViewDescription.forEach((newDescription, index) => {
            if(newDescription === oldDescription[index]) {
                diff.push({ node: elements[index], viewDescription: newDescription });
                return;
            }
            const existingElement = getExistingElement(newDescription, index, oldElements);
            if(existingElement.element) {
                diff.push({ node: existingElement.element, viewDescription: newDescription });
                oldElements = oldElements.filter((item) => (item !== existingElement.element));
                return;
            }
            diff.push(newDescription);
        });
        return diff;
    };

    /**
     * @param {string|Array|Object} newDescription
     * @param {string|Array|Object} currentDescription
     * @returns {boolean}
     */
    const htmlObjectDescriptionCompare = function(newDescription, currentDescription) {


        const  {content: _, ...newDescriptionWithoutContent } = newDescription;
        const  {content: __, ...viewDescriptionWithoutContent } = currentDescription;

        return JSON.stringify(newDescriptionWithoutContent) !== JSON.stringify(viewDescriptionWithoutContent);
    };

    const ViewDescriptionCompare = {
        array: arrayViewDescriptionCompare,
        html: htmlObjectDescriptionCompare
    };

    /**
     * @param {Object} arg
     * @param {Object} arg.$viewDescription
     * @param {Object.<string, ViewHtmlElementAttribute>} arg.$htmlAttributes
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} arg.$viewProps
     * @param {Object.<string, {name: string, callback: Function,disconnect: Function, updateAction: Function}>} arg.$htmlEventsStore
     * @param {{getChildren: Function, getHtmlNode: Function, buildEventConnexion: Function}} arg.$callback
     *
     * @class
     */
    const ViewHtmlElementDev = function({ $viewDescription, $htmlAttributes, $viewProps, $htmlEventsStore, $callback }) {

        const { getChildren, getHtmlNode, buildEventConnexion } = $callback;


        this.updateAttributes = function(attributes) {
            let newAttributes = {};
            if(attributes) {
                newAttributes = {...attributes};
            }

            Object.keys($htmlAttributes).forEach((attrName) => {
                if(!newAttributes[attrName]) {
                    getHtmlNode().removeAttribute(attrName);
                    $htmlAttributes[attrName].disconnect();
                    return;
                }
                $htmlAttributes[attrName].updateValueSource(newAttributes[attrName]);
            });

            for(const attrName in newAttributes) {
                if($htmlAttributes[attrName]) {
                    continue;
                }
                const htmlNode = getHtmlNode();
                if(!htmlNode) {
                    continue;
                }
                $htmlAttributes[attrName] = (new ViewHtmlElementAttribute(
                    htmlNode,
                    attrName,
                    newAttributes[attrName],
                    $viewProps
                ));
            }
            $viewDescription.attrs = newAttributes;
        };

        this.updateEventHandlers = function(events) {
            let newEvents = {};
            if(events) {
                newEvents = { ...events };
            }
            Object.keys($htmlEventsStore).forEach((eventPath) => {
                if(!newEvents[eventPath]) {
                    $htmlEventsStore[eventPath].disconnect();
                    return;
                }
                $htmlEventsStore[eventPath].updateAction(newEvents[eventPath]);
            });

            for(const eventPath in events) {
                if($htmlEventsStore[eventPath]) {
                    continue;
                }
                buildEventConnexion(eventPath, events);
            }
            $viewDescription.events = events;
        };

        /**
         * @param {Object} viewDescription
         */
        this.updateViewDescription = function(viewDescription) {
            if(ViewDescriptionCompare.html(viewDescription, $viewDescription)) {
                this.updateAttributes(viewDescription.attrs);
                this.updateEventHandlers(viewDescription.events);
                this.updateIfControl(viewDescription.if);
            }
            const children = getChildren();
            if(children) {
                children.updateViewDescription(viewDescription.content);
            }
            $viewDescription.content = viewDescription.content;
        };

    };

    /**
     *
     * @param {Object} $viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     *
     * @class
     * @extends AbstractView
     */
    const ViewHtmlElement = function($viewDescription, $viewProps) {
        if($viewDescription.if) {
            const localState = new State();
            localState.parent = $viewProps.getStateToUse();
            localState.if = $viewDescription.if;
            $viewProps = { ...$viewProps, localState };
        }

        AbstractView.call(this, { $viewDescription, $viewProps });

        const $viewAnchor = document.createComment(($viewDescription.name || 'DocumentFragment') + ' Anchor ' + ($viewDescription.if ? ': If (' + $viewDescription.if + ')' : ''));

        /** @type {Object.<string, ViewHtmlElementAttribute>} */
        const $htmlAttributes = {};
        /** @type {Object.<string, {name: string, callback: Function,disconnect: Function, updateAction: Function}>} */
        const $htmlEventsStore = {};

        const $lifecycleListeners = Lifecycle.newListenersStore();

        const $lifeCycleHandler = new LifecycleHandler($lifecycleListeners);

        /** @type {HTMLElement|DocumentFragment|null} */
        let $htmlNode = null;

        /** @type {?Directive} */
        let $htmlNodeDirective = null;

        /** @type {?ViewElementFragment} */
        let $children = null;

        const build = function() {
            if($viewDescription.name === SLOT_RENDER_TAG_NAME) {
                const slot = $viewProps.componentInstance.getSlot($viewDescription.slot || DEFAULT_SLOT_NAME);
                $htmlNode = document.createDocumentFragment();
                if(!slot) {
                    throw new Error('Undefined Slot name '+ $viewDescription.slot);
                }
                $children = slot($htmlNode, getSlotLocalState);
                return;
            }
            $htmlNode = ($viewDescription.name) ? document.createElement($viewDescription.name) : document.createDocumentFragment();
            buildAttrs();
            if($viewDescription.content) {
               $children = (new ViewElementFragment($viewDescription.content, $viewProps));
            }
            if($viewDescription.directives) {
                $htmlNodeDirective = new Directive($htmlNode, $viewDescription.directives, $htmlAttributes, $viewProps, $lifecycleListeners);
            }
            buildEventsConnexion();
        };

        /**
         * @param {?string[]} slotProps
         *
         * @returns {?State}
         */
        const getSlotLocalState = function(slotProps) {
            if(!slotProps) {
                return null;
            }
            buildAttrs(false);
            const localState = new State();
            for(const attrName in $htmlAttributes) {
                if(!slotProps.includes(attrName)) {
                    continue;
                }
                const attributeStateItem = localState.add(attrName, $htmlAttributes[attrName].value());
                $htmlAttributes[attrName].onUpdate((value) => {
                    attributeStateItem.set(value);
                });
            }

            return localState;
        };
        /**
         * @param {boolean} isUpdateAttribute
         */
        const buildAttrs = function(isUpdateAttribute = true) {
            if(!$viewDescription.attrs) {
                return;
            }
            for(const attrName in $viewDescription.attrs) {
                $htmlAttributes[attrName] = (new ViewHtmlElementAttribute(
                    $htmlNode,
                    isUpdateAttribute ? attrName : '',
                    $viewDescription.attrs[attrName],
                    $viewProps
                ));
            }
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         */
        const renderContent = (parentNode) => {
            build();
            if($children) {
                $children.render($htmlNode);
            }
            parentNode && parentNode.append($htmlNode);
            $lifeCycleHandler.created();
            this.setAnchor($viewAnchor);
        };

        /**
         * @param {string} eventPath
         * @param {Object.<string, string>} events
         */
        const buildEventConnexion = function(eventPath, events) {
            const eventSteps = eventPath.split('.');
            const eventName = eventSteps.pop();
            const actionName = events[eventPath];
            const actionTemplate = new ActionTemplate(actionName, $viewProps);
            const eventCallback = function(event) {
                if(eventSteps.includes(EVENT_DIRECTIVE.PREVENT_DEFAULT)) {
                    event.preventDefault();
                }
                if(eventSteps.includes(EVENT_DIRECTIVE.STOP_PROPAGATION)) {
                    event.stopPropagation();
                }
                actionTemplate.handle(event);
            };
            $htmlNode.addEventListener(eventName, eventCallback);

            $htmlEventsStore[eventPath] = {
                name: eventName,
                callback: eventCallback,
                disconnect: () => $htmlNode.removeEventListener(eventName, eventCallback),
                updateAction: (action) => actionTemplate.refresh(action)
            };
        };

        const buildEventsConnexion = function() {
            if(!$viewDescription.events) {
                return;
            }

            for(const eventPath in $viewDescription.events) {
                buildEventConnexion(eventPath, $viewDescription.events);
            }
        };

        this.beforeRenderProcess = function() {
            $lifeCycleHandler.beforeCreate();
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         * @param {ViewIfStatement} ifStatement
         */
        this.renderProcess = function(parentNode, ifStatement) {
            parentNode.appendChild($viewAnchor);
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            renderContent(parentNode);
        };

        /**
         * @param {boolean} full
         */
        this.unmountProcess = function(full) {
            $lifeCycleHandler.beforeUnmount();
            if(full) {
                this.unmountAnchors($viewAnchor.parentNode, $viewAnchor);
                if(!$htmlNode) {
                    return;
                }
            }
            this.moveIntoFragment($htmlNode);
            if($htmlNode instanceof DocumentFragment) {
                $children.unmount();
            }
            this.setIsUnmounted();
            $lifeCycleHandler.unmounted();
        };

        /**
         * @param {ViewIfStatement} ifStatement
         */
        this.mountProcess = function(ifStatement) {
            this.mountAnchors();
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            if(!$htmlNode) {
                renderContent();
            }
            $lifeCycleHandler.beforeMount();
            if(($viewDescription.content || $viewDescription.name === SLOT_RENDER_TAG_NAME) && $children === null) {
                const fragment = document.createDocumentFragment();
                renderContent(fragment);
                this.insertAfter(fragment, $viewAnchor);
                this.setIsMounted();
                return;
            }
            this.moveIntoParent();
            if($htmlNode instanceof DocumentFragment) {
                $children.mount();
            }
            this.insertAfter($htmlNode, $viewAnchor);

            this.setIsMounted();
            $lifeCycleHandler.mounted();
        };

        this.removeProcess = function() {
            $lifeCycleHandler.beforeRemove();
            if(!$htmlNode) {
                $lifeCycleHandler.removed();
                return;
            }
            $viewAnchor.remove();
            $htmlNode.remove();
            if($children) {
                $children.remove();
            }
            this.setIsRemoved();
            $lifeCycleHandler.removed();
        };

        this.target = function() {
            return $htmlNode;
        };

        this.directive = function() {
            return $htmlNodeDirective;
        };

        ViewHtmlElementDev.apply(this, [{
            $viewDescription,
            $htmlAttributes,
            $viewProps,
            $htmlEventsStore,
            $callback: {
                getChildren: () => $children,
                getHtmlNode: () => $htmlNode,
                buildEventConnexion
            }
        }]);
    };

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

    /**
     *
     * @class
     * @extends AbstractLoopExpressionHandler
     */
    const LoopForInExpressionHandler = function() {
        const $regex = /^([a-z0-9_,\s$]+) in ([a-z0-9_.$]+)$/i;
        const $regexWithParenthesis = /^\(([a-z0-9_,\s$]+)\) in ([a-z0-9._$]+)$/i;

        const $iterableIndex = 1;
        const $iterableItemsIndex = 0;

        // Extends from AbstractLoopExpressionHandler
        AbstractLoopExpressionHandler.apply(this, [$regex, $regexWithParenthesis]);

        /**
         * @param {string} template
         *
         * @returns {?{iterableName: string, itemKeyName: string, iterable: string, itemValueName: string}}
         */
        this.setExpression = function(template) {
            return this.getExpressionDetails(template, $iterableIndex, $iterableItemsIndex);
        };

    };

    /**
     *
     * @class
     * @extends AbstractLoopExpressionHandler
     */
    const LoopForAsExpressionHandler = function() {
        const $regex = /^([a-z0-9_.$]+) as ([a-z0-9_,\s$]+)$/i;
        const $regexWithParenthesis = /^([a-z0-9_.$]+) as \(([a-z0-9_,\s$]+)\)$/i;

        const $iterableIndex = 0;
        const $iterableItemsIndex = 1;

        AbstractLoopExpressionHandler.apply(this, [$regex, $regexWithParenthesis]);


        /**
         * @param {string} template
         *
         * @returns {?{iterableName: string, itemKeyName: string, iterable: string, itemValueName: string}}
         */
        this.setExpression = function(template) {
            return this.getExpressionDetails(template, $iterableIndex, $iterableItemsIndex);
        };

    };

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

    /**
     * @param {Object} arg
     * @param {LoopTemplateDescription} arg.$loopTemplate
     * @param {Template} arg.$keyTemplate
     * @param {Object} arg.$viewDescriptionWithoutRepeat
     * @param {{store: Object.<string, {node: ViewElementFragment, localState: State}>,current: Array,last: Array }} arg.$nodeInstancesByKey
     * @param {ViewElementFragment} arg.$callbacks
     *
     * @class
     */
    const ViewLoopFragmentDev =  function({ $loopTemplate, $keyTemplate, $viewDescriptionWithoutRepeat, $nodeInstancesByKey, $callbacks }) {

        const { handleLoopExpression, getItemKeyName, updateIteration } = $callbacks;

        const updateExistingNodes = function(viewWithoutRepeat) {
            Object.values($nodeInstancesByKey.store).forEach(({ node }) => {
                if(
                    (viewWithoutRepeat.name && $viewDescriptionWithoutRepeat.name === viewWithoutRepeat.name)
                    ||
                    (viewWithoutRepeat.component && $viewDescriptionWithoutRepeat.component === viewWithoutRepeat.component)
                ) {
                    node.updateViewDescription(viewWithoutRepeat);
                }
            });
        };

        /**
         * @param {Object.<string, *>} value
         */
        this.updateViewDescription = function(value) {
            const { repeat, ...viewWithoutRepeat } = value;
            $loopTemplate.refresh(repeat);
            handleLoopExpression();
            $keyTemplate.refresh(value.key || getItemKeyName());

            const isNotTheSameNode = viewWithoutRepeat.name && $viewDescriptionWithoutRepeat.name !== viewWithoutRepeat.name;
            const isNotTheSameComponent = viewWithoutRepeat.component && $viewDescriptionWithoutRepeat.component !== viewWithoutRepeat.component;


            if(isNotTheSameNode || isNotTheSameComponent) {
                $nodeInstancesByKey.store = {};
                $nodeInstancesByKey.current = {};
            }
            else {
                updateExistingNodes(viewWithoutRepeat);
            }

            Object.keys($viewDescriptionWithoutRepeat).forEach((property) => {
                $viewDescriptionWithoutRepeat[property] = (viewWithoutRepeat[property] !== undefined ? viewWithoutRepeat[property] : null);
            });

            updateIteration();
        };

    };

    /**
     * @param {Array|Object} $viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     * @class
     * @extends AbstractView
     */
    const ViewLoopFragment = function($viewDescription, $viewProps) {

        AbstractView.call(this, { $viewDescription, $viewProps, $isFragment: true });

        const $viewAnchor = document.createComment('Loop Anchor Start : ' + $viewDescription.repeat);
        const $viewAnchorEnd = document.createComment('Loop Anchor End : ' + $viewDescription.repeat);
        /** @type {{store: Object.<string, {node: ViewElementFragment, localState: State, data: *}>,current: Array,last: Array }} */
        const $nodeInstancesByKey = {
            store: {},
            current: [],
            last: []
        };
        const $viewDescriptionWithoutRepeat = { ...$viewDescription };
        $viewDescriptionWithoutRepeat.repeat = null;

        const $loopTemplate = new LoopTemplateDescription($viewDescription.repeat, $viewProps);
        /** @type {?AbstractLoopExpressionHandler} */
        let $loopExpressionDescription = null;
        let $itemKeyName = '';
        let $itemValueName = '';
        let keyState = new State({ [$itemKeyName]: '' });
        keyState.parent = $viewProps.getStateToUse();
        const $keyTemplate = new Template('', { ...$viewProps, localState: keyState});

        let $isBuild = false;

        const handleLoopExpression = () => {
            $loopExpressionDescription = $loopTemplate.expressionDescription();
            if(!$loopExpressionDescription) {
                return;
            }
            $itemKeyName = $loopExpressionDescription.getIterableItemKeyName();
            $itemValueName = $loopExpressionDescription.getIterableItemValueName();
            keyState.add($itemKeyName, '');
        };

        const build = () => {
            $isBuild = true;
            this.insertAfter($viewAnchorEnd, $viewAnchor);
            updateIteration();
            $loopTemplate.onUpdate(() => { updateIteration(); });
        };

        /**
         * @param {Object} iterable
         * @param {string|number} index
         */
        const updateIterationItem = function(iterable, index) {
            // TODO : create this own state or update it
            const stateData = { [$itemValueName]: iterable[index] };
            if($itemKeyName) {
                stateData[$itemKeyName] = index;
            }
            const nodeKey = $keyTemplate.value(stateData);
            $nodeInstancesByKey.current.push(nodeKey);

            if($nodeInstancesByKey.store[nodeKey]) {
                const existingNode = $nodeInstancesByKey.store[nodeKey];
                if(existingNode.data !== stateData[$itemValueName]) {
                    existingNode.localState.set(stateData);
                }
                existingNode.localState.refreshProps();
                existingNode.node.restoreRef();
                return;
            }

            const localState = new State(stateData);
            localState.parent = $viewProps.getStateToUse();
            const node = new ViewElementFragment($viewDescriptionWithoutRepeat, { ...$viewProps, localState });
            $nodeInstancesByKey.store[nodeKey] = {
                node,
                data: stateData[$itemValueName],
                localState
            };
        };
        const updateIteration = function() {
            const iterable = $loopTemplate.getIterable();
            if($viewDescriptionWithoutRepeat.ref) {
                $viewProps.view.cleanReference($viewDescription.ref, true);
            }

            const iterableIsArray = Array.isArray(iterable);
            $nodeInstancesByKey.last = $nodeInstancesByKey.current;
            $nodeInstancesByKey.current = [];

            if(iterableIsArray) {
                for(let index = 0; index < iterable.length; index++) {
                    updateIterationItem(iterable, index);
                }
            }
            else {
                for(const index in iterable) {
                    updateIterationItem(iterable, index);
                }
            }

            updateDom();
        };

        const removeUselessElement = function() {
            for (const nodeKey of $nodeInstancesByKey.last) {
                if(!$nodeInstancesByKey.current.includes(nodeKey)) {
                    // Think about reusable node
                    $nodeInstancesByKey.store[nodeKey].node.remove();
                    $nodeInstancesByKey.store[nodeKey] = null;
                }
            }
        };

        const updateDom = function() {
            removeUselessElement();

            // update existing elements or add new elements
            for (const nodeKey of $nodeInstancesByKey.current) {
                if($nodeInstancesByKey.last.includes(nodeKey)) {
                    continue;
                }
                const fragment = document.createDocumentFragment();
                const node = $nodeInstancesByKey.store[nodeKey].node;
                if(node.isRendered()) {
                    continue;
                }
                node.render(fragment);
                if($viewAnchorEnd.parentNode) {
                    $viewAnchorEnd.parentNode.insertBefore(fragment, $viewAnchorEnd);
                }
            }
        };


        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         * @param {ViewIfStatement} ifStatement
         */
        this.renderProcess = function(parentNode, ifStatement) {
            parentNode.appendChild($viewAnchor);
            this.setAnchor($viewAnchor);
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            build();
        };

        /**
         * @param {boolean} full
         */
        this.unmountProcess = function(full) {
            this.setParent(null);
            for (const nodeKey of $nodeInstancesByKey.current) {
                $nodeInstancesByKey.store[nodeKey].node.unmount();
            }
            if(full) {
                const nodes = [$viewAnchor];
                let currentStep = $viewAnchor;

                while(currentStep.nextSibling !== $viewAnchorEnd) {
                    currentStep = currentStep.nextSibling;
                    if(currentStep instanceof Comment) {
                        nodes.push(currentStep);
                    }
                }
                nodes.push($viewAnchorEnd);

                this.unmountAnchors($viewAnchor.parentNode, nodes);
            }
            this.setIsUnmounted();
        };

        /**
         * @param {ViewIfStatement} ifStatement
         */
        this.mountProcess = function(ifStatement) {
            this.mountAnchors();
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            if($isBuild) {
                for (const nodeKey of $nodeInstancesByKey.current) {
                    $nodeInstancesByKey.store[nodeKey].node.mount();
                }
            }
            else {
                build();
            }
            this.setIsMounted();
        };

        this.removeProcess = function() {
            for (const nodeKey of $nodeInstancesByKey.current) {
                $nodeInstancesByKey.store[nodeKey].node.remove();
            }
            $viewAnchor.remove();
            $viewAnchorEnd.remove();
            this.setIsRemoved();
        };

        ViewLoopFragmentDev.apply(this, [{
            $loopTemplate,
            $keyTemplate,
            $nodeInstancesByKey,
            $viewDescriptionWithoutRepeat,
            $callbacks: {
                handleLoopExpression,
                updateIteration,
                getItemKeyName: () => $itemKeyName
            }
        }]);

        ((() => {
            handleLoopExpression();
            $keyTemplate.refresh($viewDescriptionWithoutRepeat.key || $itemKeyName);
        })());

    };

    /**
     * @param {Object} arg
     * @param {string|Array|Object} arg.$viewDescription
     * @param {ViewElementFragment[]} arg.$fragmentElements
     * @param {{handleViewDescriptionElement: Function, getParentNode: Function}} arg.$callbacks
     *
     * @class
     */
    const ViewElementFragmentDev = function({ $viewDescription, $fragmentElements, $callbacks }) {

        const { handleViewDescriptionElement, getParentNode, buildViewDescription } = $callbacks;

        const render = function(parentNode) {
            parentNode = parentNode || getParentNode();
            if(!parentNode) {
                return;
            }
            $fragmentElements.forEach((node) => {
                node.render(parentNode);
            });
        };

        /**
         * @param {string|Array|Object} viewDescription
         * @param {DocumentFragment|ParentNode|HTMLElement} parentNode
         */
        this.updateViewDescription = function(viewDescription, parentNode) {
            const isViewDescriptionTypeAreDifferent =
                (typeof $viewDescription !== typeof viewDescription)
                || (typeof $viewDescription === 'object' && Array.isArray($viewDescription) === Array.isArray(viewDescription));

            if(isViewDescriptionTypeAreDifferent) {
                $fragmentElements.forEach((node) => {
                    node.remove();
                });
                $fragmentElements.splice(0);
                buildViewDescription(viewDescription);
                render(parentNode);
                return;
            }
            const firstElement = $fragmentElements[0];
            if(typeof viewDescription === 'string') {
                firstElement.updateViewDescription(viewDescription);
                return;
            }
            if(typeof viewDescription !== 'object') {
                return;
            }
            if(Array.isArray(viewDescription)) {
                // Todo: compare two object and extract the différence
                if(!Array.isArray($viewDescription)) {
                    $viewDescription = [];
                }
                const differences = ViewDescriptionCompare.array(viewDescription, $viewDescription, $fragmentElements);
                $viewDescription.splice(0);
                $viewDescription.push(...viewDescription);
                const nodesToRemove = [];
                $fragmentElements.forEach((element) => {
                    element.unmount(true);
                    const isNotRemoved = differences.find((item) => {
                        return item?.node === element;
                    });
                    if(!isNotRemoved) {
                        element.remove();
                        nodesToRemove.push(element);
                    }
                });

                nodesToRemove.forEach((elementToRemove) => {
                    const index = $fragmentElements.findIndex((element) => element === elementToRemove);
                    $fragmentElements.splice(index, 1);
                });

                let ifStatements = [];
                differences.forEach((item) => {
                    if(item?.node && item.node instanceof ViewElementFragment) {
                        item.node.mount();
                        if(item.viewDescription?.if) {
                            ifStatements = [item.viewDescription.if];
                        }
                        else if(item.viewDescription?.elseif) {
                            ifStatements.push(item.viewDescription.elseif);
                        }
                        if(item.viewDescription) {
                            item.node.updateViewDescription(item.viewDescription);
                        }
                        return;
                    }
                    if(item) {
                        const newNode = handleViewDescriptionElement(item, ifStatements);
                        newNode.render(parentNode || getParentNode());
                    }
                });
                return;
            }
            if(!viewDescription) {
                return;
            }
            firstElement.updateViewDescription(viewDescription);
        };

    };

    /**
     *
     * @param {string|Array|Object} $viewDescription
     * @param {{view: View, componentInstance: Component, appInstance: App, localState: ?State, getState: Function, getStateToUse: function(): State }} $viewProps
     *
     * @class
     * @extends AbstractView
     */
    const ViewElementFragment = function($viewDescription, $viewProps) {

        AbstractView.call(this, { $viewDescription, $viewProps, $isFragment: true });

        /**
         * @type {(ViewTextElement | ViewLoopFragment | ViewElementFragment | ViewComponentElement | ViewHtmlElement)[]}
         */
        const $fragmentElements = [];
        let $nodeToReference = null;
        let $parentNode = null;


        /**
         * @param {string|Array|Object} element
         * @param {string[]} ifStatements
         * @returns {ViewElementFragment}
         */
        const handleViewDescriptionElement = function(element, ifStatements) {
            if(typeof element === 'string') {
                const node = new ViewElementFragment(element, $viewProps);
                $fragmentElements.push(node);
                return node;
            }

            const viewDescriptionItem = { ...element };
            if(element.if) {
                ifStatements.push(element.if);
            }
            else if(element.else === '') {
                if (ifStatements.length === 0) {
                    throw new Error('Else without If');
                }
                viewDescriptionItem.if = transformElseIf(ifStatements);
            }
            else if(element.elseif) {
                if(ifStatements.length === 0) {
                    throw new Error('ElseIf without If');
                }
                viewDescriptionItem.if = transformElseIf(ifStatements, element.elseif);
                ifStatements.push(element.elseif);
            }
            else {
                ifStatements.splice(0);
            }
            const node = new ViewElementFragment(viewDescriptionItem, $viewProps);
            $fragmentElements.push(node);
            return node;
        };

        /**
         * @param {(string|Array|Object)[]} viewDescription
         */
        const buildFromArray = function(viewDescription) {
            const ifStatements = [];
            for(const element of viewDescription) {
                handleViewDescriptionElement(element, ifStatements);
            }
        };

        /**
         * @param {string|Array|Object} viewDescription
         */
        const buildViewDescription = function(viewDescription) {
            if(!viewDescription) {
                return;
            }
            if(typeof  viewDescription === 'string') {
                const node = new ViewTextElement(viewDescription, $viewProps);
                $fragmentElements.push(node);
                return;
            }
            if(typeof viewDescription !== 'object') {
                return;
            }
            if(viewDescription.repeat) {
                const node = new ViewLoopFragment(viewDescription, $viewProps);
                $fragmentElements.push(node);
                return;
            }
            if(Array.isArray(viewDescription)) {
                buildFromArray(viewDescription);
                return;
            }
            if(viewDescription.component) {
                const node = new ViewComponentElement(viewDescription, $viewProps);
                $fragmentElements.push(node);
                if(viewDescription.ref) {
                    $viewProps.view.setReference(viewDescription.ref, node);
                    $nodeToReference = node;
                }
                return;
            }
            const node = new ViewHtmlElement(viewDescription, $viewProps);
            $fragmentElements.push(node);
            if(viewDescription.ref) {
                $viewProps.view.setReference(viewDescription.ref, node);
                $nodeToReference = node;
            }
        };

        this.build = function() {
            if(!$viewProps.componentInstance) {
                return;
            }
            buildViewDescription($viewDescription);
        };

        this.restoreRef = function() {
            if(!$nodeToReference || !$viewDescription.ref) {
                return;
            }
            $viewProps.view.setReference($viewDescription.ref, $nodeToReference);
        };

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         */
        this.renderProcess = function(parentNode) {
            $parentNode = parentNode;
            this.build();
            for(const fragmentElement of $fragmentElements) {
                fragmentElement.render(parentNode);
            }
        };

        /**
         * @param {boolean} full
         */
        this.unmountProcess = function(full) {
            for(const fragmentElement of $fragmentElements) {
                fragmentElement.unmount(full);
            }
            this.setIsUnmounted();
        };

        /**
         * @param {ViewIfStatement} ifStatement
         */
        this.mountProcess = function(ifStatement) {
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            for(const fragmentElement of $fragmentElements) {
                fragmentElement.mount();
            }
            this.setIsMounted();
        };
        this.removeProcess = function() {
            for(const fragmentElement of $fragmentElements) {
                fragmentElement.remove();
            }
            this.setIsRemoved();
        };

        ViewElementFragmentDev.apply(this, [{
            $viewDescription,
            $fragmentElements,
            $callbacks: {
                handleViewDescriptionElement,
                buildViewDescription,
                getParentNode: () => $parentNode
            },
        }]);

    };

    /**
     * @param {string} statementTemplate
     * @returns {string}
     */
    const cleanConditionStatement = function(statementTemplate) {
        if(/^\(/.test(statementTemplate) && /\)$/.test(statementTemplate)) {
            return statementTemplate;
        }

        return '(' + statementTemplate.trim() + ')';
    };

    /**
     * @param {string[]} previousConditions
     * @param {?string} currentIf
     *
     * @returns {string}
     */
    const transformElseIf = function(previousConditions, currentIf = null) {
        const notStatementsCleaned = previousConditions.map(cleanConditionStatement);
        const notStatement = '!(' + notStatementsCleaned.join('||') + ')';

        if(!currentIf) {
            return notStatement;
        }

        return notStatement +' && (' + cleanConditionStatement(currentIf) + ')';
    };

    /**
     * @param {ViewHtmlElement|ViewComponentElement} viewElement
     *
     * @returns {Object.<string, Function>}
     */
    const getSafeNode = function(viewElement) {
        const safeMethods = ['target'];

        const safeNode = {};

        safeMethods.forEach((methodName) => {
            if(!viewElement[methodName]) {
                return;
            }
            safeNode[methodName] = function() {
                return viewElement[methodName].apply(viewElement, Array.from(arguments));
            };
        });

        return { ...safeNode };
    };

    /**
     *
     * @class
     */
    const ViewRefCollection = function() {

        const $references = [];

        this.clean = function() {
            $references.splice(0);
        };

        /**
         * @param {Object} node
         */
        this.push = function(node) {
            $references.push(node);
        };

        /**
         * @param {Number} index
         * @returns {*}
         */
        this.get = function(index) {
            return $references[index]?.target();
        };

        this.props = function(name) {
            const values = [];

            this.each(function(target) {
                values.push(target ? target[name] : undefined);
            });

            return values;
        };

        /**
         * @param {Function} callback
         */
        this.each = function(callback) {
            $references.forEach(function(reference) {
                callback(reference.target());
            });
        };

    };

    /**
     * @param {Object} arg
     * @param {ViewElementFragment} arg.$viewFragment
     * @param {Comment} arg.$viewAnchor
     * @param {Comment} arg.$viewAnchorEnd
     *
     * @class
     */
    const ViewDev = function({ $viewFragment, $viewAnchor, $viewAnchorEnd }) {

        const $renderBox = document.createDocumentFragment();


        /**
         * @type {Comment} startAnchor
         * @type {Comment} endAnchor
         */
        this.putInRenderBox = function(startAnchor, endAnchor) {
            let nodeInView = startAnchor.nextSibling;
            while(nodeInView !== endAnchor) {
                if(!nodeInView) {
                    break;
                }
                const nodeToStore = nodeInView;
                nodeInView = nodeInView.nextSibling;
                $renderBox.appendChild(nodeToStore);
            }
        };

        /**
         * @param {Comment} anchor
         */
        this.renderRenderBox = function(anchor) {
            this.insertAfter($renderBox, anchor);
        };


        /**
         * @param {string|Array|Object} viewDescription
         */
        this.updateViewDescription = function(viewDescription) {
            this.putInRenderBox($viewAnchor, $viewAnchorEnd);
            $viewFragment.updateViewDescription(viewDescription, $renderBox);
            this.renderRenderBox($viewAnchor);
        };

    };

    /**
     *
     * @param  {string|Array|object} $viewDescription
     * @param {App} $appInstance
     *
     *
     * @class
     * @extends AbstractView
     */
    const View = function($viewDescription, $appInstance) {

        const $viewAnchor = document.createComment('');
        const $viewAnchorEnd = document.createComment('');

        /** @type {null|HTMLElement|ParentNode} */
        let $parentNode = null;

        /** @type {{view: View, componentInstance: ?Component, appInstance: App, localState: ?State, getState: ?Function, getStateToUse: function(): State }} */
        const $viewProps = {
            view: this,
            appInstance: $appInstance,
            componentInstance: null,
            localState: null,
            getState: null,
            getStateToUse: function() {
                return this.localState ? this.localState : this.componentInstance.getState();
            }
        };

        AbstractView.call(this, { $viewDescription, $viewProps });

        const $viewFragment = new ViewElementFragment($viewDescription, $viewProps);

        /** @type {Object.<string, (Object.<string, Function>)|ViewRefCollection>} */
        const $references = {};
        const $referenceStore = {};

        /** @type  {?Component} */
        let $componentInstance = null;

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         * @param {ViewIfStatement} ifStatement
         */
        this.renderProcess = function(parentNode, ifStatement) {
            $parentNode = parentNode;
            parentNode.appendChild($viewAnchor);
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            $viewFragment.render(parentNode);
            parentNode.appendChild($viewAnchorEnd);
        };

        /**
         * @param {boolean} full
         */
        this.unmountProcess = function (full) {
            if(full) {
                this.unmountAnchors($viewAnchor.parentNode, $viewAnchor);
            }
            $viewFragment.unmount(full);
            this.setIsUnmounted();
        };

        /**
         * @param {ViewIfStatement} ifStatement
         */
        this.mountProcess = function(ifStatement) {
            this.mountAnchors();
            if(ifStatement && ifStatement.isFalse()) {
                return;
            }
            if($viewFragment.isRendered()) {
                $viewFragment.mount();
            }
            else {
                const fragment = document.createDocumentFragment();
                $viewFragment.render(fragment);
                this.insertAfter(fragment, $viewAnchor);
            }
            this.setIsMounted();
        };

        this.removeProcess = function() {
            $viewFragment.remove();
            this.setIsRemoved();
        };

        /**
         * @param {Component} componentInstance
         */
        this.setComponentInstance = function(componentInstance) {
            $viewProps.componentInstance = componentInstance;
            $viewProps.getState = function(name) {
                if(this.localState) {
                    const state = this.localState.get(name);
                    if(state) {
                       return state;
                    }
                }
                return componentInstance.getStateByName.apply($viewProps.componentInstance, [name]);
            };
            $componentInstance = componentInstance;
            $viewAnchor.textContent = componentInstance.getName() +' Component View Anchor';
            $viewAnchorEnd.textContent = componentInstance.getName() +' Component View End Anchor';
        };

        /**
         * @param {string} name
         * @param {ViewHtmlElement|ViewComponentElement} viewElement
         */
        this.setReference = function(name, viewElement) {
            const refInstance = getSafeNode(viewElement);
            if($referenceStore[name] instanceof ViewRefCollection) {
                $referenceStore[name].push(refInstance);
                if($references[name] === undefined) {
                    Object.defineProperty($references, name, {
                        get: function() {
                            return $referenceStore[name];
                        }
                    });
                }
                return;
            }
            $referenceStore[name] = refInstance;
            if($references[name] === undefined) {
                Object.defineProperty($references, name, {
                    get: function() {
                        return $referenceStore[name]?.target();
                    }
                });
            }
        };
        /**
         * @param {string} name
         * @param {boolean} isCollection
         */
        this.cleanReference = function(name, isCollection) {
            if(isCollection === true) {
                if($referenceStore[name] instanceof ViewRefCollection) {
                    $referenceStore[name].clean();
                    return;
                }
                $referenceStore[name] = new ViewRefCollection();
                return;
            }
            $referenceStore[name] = undefined;
        };

        this.getReferences = function() {
            return $references;
        };

        this.getComponentInstance = function() {
            return $componentInstance;
        };

        this.getAnchor = function() {
            return $viewAnchor;
        };

        ViewDev.apply(this, [{
            $viewFragment,
            $viewAnchor,
            $viewAnchorEnd,
            $callbacks: {
                getParentNode: () => $parentNode
            }
        }]);

    };

    const STRUCT_CONTROL_AND_LOOP_ATTRIBUTES = ['ref', 'if', 'else', 'elseif', 'repeat'];
    const FRAGMENT_ACCEPTED_NAMES = ['fragment', 'habame'];

    /**
     * @param {string|Document} viewTemplate
     *
     * @returns {Object|string|Array}
     */
    const xmlEngine = function(viewTemplate) {

        if(viewTemplate === '') {
            return { content: '' };
        }

        const view = [];
        let parsedDocument = viewTemplate;
        if(!(viewTemplate instanceof Document)) {
            const parser = new DOMParser();
            parsedDocument = parser.parseFromString(`<habame>${viewTemplate}</habame>`, 'application/xhtml+xml');
        }

        const errorNode = parsedDocument.querySelector('parsererror');

        if(!errorNode) {
            return xmlNodeToJson(parsedDocument.activeElement);
        }

        return view;
    };

    const xmlNodeAttributeDescriptions =  function(nodeElement) {
        if(!nodeElement.getAttributeNames) {
            return {};
        }
        const attributes = { };
        const attributeNames = nodeElement.getAttributeNames();

        attributeNames.forEach(function(attributeName) {
            const attributePath = attributeName.split('.');
            const attributeValue = nodeElement.getAttribute(attributeName);
            if(attributePath.length === 1) {

                if(STRUCT_CONTROL_AND_LOOP_ATTRIBUTES.includes(attributeName.toLowerCase())) {
                    attributes[attributeName] = attributeValue;
                    return;
                }

                attributes.attrs = attributes.attrs || {};
                attributes.attrs[attributeName] = attributeValue;
                return;
            }
            const attributeType = attributePath.shift();
            const attributeSubName = attributePath.join('.');
            if(!attributes[attributeType]) {
                attributes[attributeType] = {};
            }
            attributes[attributeType][attributeSubName] = attributeValue;
        });

        return attributes;
    };
    const xmlNodeToJson =  function(nodeElement) {
        const element = {};
        const nodeTagName = nodeElement.tagName;
        if(nodeTagName && !FRAGMENT_ACCEPTED_NAMES.includes(nodeTagName.toLowerCase())) {
            const firstCharOfName = nodeTagName[0];
            if(firstCharOfName === firstCharOfName.toUpperCase()) {
                element.component = nodeTagName;
            }
            else {
                element.name = nodeTagName;
            }
        }

        if(nodeElement.children && nodeElement.children.length > 0) {
            const elementChildren = [];
            const slots = [];
            Array.from(nodeElement.childNodes).forEach((nodeChild) => {
                if(nodeChild instanceof Comment) {
                    return;
                }
                const child = xmlNodeToJson(nodeChild);
                if(child.name === SLOT_DEFINITION_TAG_NAME) {
                    if(!child.attrs.name) {
                        throw new Error('Slot name is required');
                    }
                    if(child.props) {
                        child.props = Object.keys(child.props);
                    }
                    child.name = '';
                    slots[child.attrs.name] = child;
                    return;
                }
                if(child.name === SLOT_RENDER_TAG_NAME) {
                    child.slot = (child.attrs && child.attrs.name) || DEFAULT_SLOT_NAME;
                }
                elementChildren.push(child);
            });
            element.content = elementChildren;
            element.slots = slots;
        }
        else if(nodeElement.textContent) {
            element.content = nodeElement.textContent;
        }
        const attributeDescriptions = xmlNodeAttributeDescriptions(nodeElement);
        if(element.name === undefined && element.component === undefined && Object.keys(attributeDescriptions).length === 0) {
            return element.content;
        }
        for(const key in attributeDescriptions) {
            element[key] = attributeDescriptions[key];
        }
        return element;
    };

    const Helper = {
        clone: function(object) {
            return JSON.parse(JSON.stringify(object));
        }    
    };

    /**
     *
     * @param {string|Array|Object} $viewDescription
     * @param {App} $appInstance
     * @param {{ engines: string[], disableXmlEngine: boolean }} $options
     *
     * @class
     */
    const ViewFactory =  function($viewDescription, $appInstance, $options) {
        let $view = $viewDescription;

        /**
         *
         * @param {string|Object} view
         * @returns {Object|string|Array|*}
         */
        const applyViewEngines = (view) => {
            if($options && $options.engines) {
                const engines = (typeof $options.engines === 'string') ? [$options.engines] : $options.engines;

                engines.forEach((engineName) => {
                    const engine = window.Habame.getViewEngine(engineName);
                    view = engine(view);
                });
            }

            if($options.disableXmlEngine === true) {
                return view;
            }

            if(typeof view === 'string') {
                view = xmlEngine(view);
            }
            return view;
        };

        this.create = function() {
            const view = (typeof $view === 'string') ? $view : Helper.clone($view);
            return new View(view, $appInstance);
        };

        /**
         * @param {string|Array|Object} viewDescription
         * @returns {string|Array|Object}
         */
        this.updateViewDescription = function(viewDescription) {
            $view = applyViewEngines(viewDescription);
            return $view;
        };

        ((function() { // constructor
            $view = applyViewEngines($viewDescription);
        })());
    };

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

    /**
     *
     * @param {string} $name Description - Component name
     * @param {View} $view
     * @param {Function} $controller
     * @param {ComponentProps} $props
     * @param {App} $appInstance
     * @param {Habame} HabameCore
     *
     * @class
     */
    const Component = function($name, $view, $controller, $props, $appInstance, HabameCore) {

        /** @type {Object.<string, Function>} */
        const $actions = {};

        const $event = new HbEvent();

        const $state = new State({}, HabameCore);

        const $lifecycleListeners = Lifecycle.newListenersStore();

        const $lifecycle = new Lifecycle($lifecycleListeners);

        const $lifecycleHandler = new LifecycleHandler($lifecycleListeners);

        /** @type {Object.<string, ViewHtmlElement|ViewComponentElement>} */
        const $refs = $view.getReferences();

        /* Allow current component to use the application state */
        $state.parent = $appInstance.getState();
        $state.App = $appInstance.getState();

        if($props instanceof ComponentProps) {
            $state.useProps($props);
        }

        const $componentRequirements = { App: $appInstance, Actions: $actions, HbEvent: $event, State: $state, Props: $props,  Lifecycle: $lifecycle, Refs: $refs };

        const $publicFunctions = $controller($componentRequirements, $view);

        ComponentDev.apply(this, [{ $lifecycle, $event, $componentRequirements , $state }]);

        /**
         * @param {HTMLElement|DocumentFragment} parentNode
         */
        this.render = function(parentNode) {
            $lifecycleHandler.beforeCreate();
            $view.render(parentNode);
            $lifecycleHandler.created();
        };

        this.getView = function() {
            return $view;
        };

        this.isRendered = function() {
            return $view.isRendered();
        };

        /**
         * @param {boolean} full
         */
        this.unmount = function(full) {
            $lifecycleHandler.beforeUnmount();
            $view.unmount(full);
            $lifecycleHandler.unmounted();
        };

        this.mount = function() {
            $lifecycleHandler.beforeMount();
            $view.mount();
            $lifecycleHandler.mounted();
        };

        this.remove = function() {
            // TODO : improve the remove
            $lifecycleHandler.beforeRemove();
            $view.remove();
            $state.disconnect();
            $event.disconnect();
            $lifecycleHandler.removed();
        };

        /**
         * @param {string} name
         *
         * @returns {StateItem}
         */
        this.getStateByName = function(name) {
            return $state.get(name);
        };

        /**
         * @returns {State}
         */
        this.getState = function() {
            return $state;
        };

        /**
         * @returns {string}
         */
        this.getName = function() {
            return $name;
        };

        /**
         * @returns {Object.<string, Function>}
         */
        this.getActions = function() {
            return $actions;
        };

        /**
         * @returns {HbEvent}
         */
        this.getHbEvent = function() {
            return $event;
        };

        /**
         * @param {string} name
         *
         * @returns {?Function}
         */
        this.getSlot = function(name) {
            return $props.getSlot(name);
        };

        /**
         * @returns {Object.<string, Function>}
         */
        this.getPublicMethod = function() {
            return !$publicFunctions ? {} : { ...$publicFunctions };
        };

        ((() => { /* constructor */
            for(const actionName in $actions) {
                $actions[actionName] = $actions[actionName].bind($actions);
            }

            $view.setComponentInstance(this);
        })());
    };

    /**
     *
     * @param {string} $name
     * @param {Function} $controller
     * @param {string|Array|Object} $viewDescription
     * @param {?{ engines?: string|string[], disableXmlEngine?: boolean }} $options
     *
     * @class
     */
    const ComponentFactory = function($name, $controller, $viewDescription, $options) {

        /** @type {{component: Component, view: View }[]} */
        const $instances = [];

        const $sources = {
            view: $viewDescription,
            controller: $controller,
            options: $options
        };

        /** @type {?ViewFactory} */
        let $viewFactory = null;

        /**
         * @param {App} appInstance
         *
         * @returns {View}
         */
        const getNewView = function(appInstance) {
            if($viewFactory === null) {
                $viewFactory = new ViewFactory($sources.view, appInstance, $options);
            }

            return $viewFactory.create();
        };

        /**
         * @param {ComponentProps} props
         * @param {App} appInstance
         * @param {Habame} HabameCore
         *
         * @returns {Component}
         */
        this.create = function(props, appInstance, HabameCore) {
            const view = getNewView(appInstance);
            const componentInstance = new Component($name, view, $sources.controller, props, appInstance, HabameCore);
            $instances.push({ component: componentInstance, view });
            return componentInstance;
        };

        /**
         * @param {Function} controller
         */
        this.updateController = function(controller) {
            $sources.controller = controller;
            $instances.forEach(({ component }) => {
                component.updateController(controller);
            });
        };

        /**
         * @param {string|Array|Object} viewDescription
         */
        this.updateView = function(viewDescription) {
            $sources.view = viewDescription;
            if(!$viewFactory) {
                return;
            }
            const viewDescriptionTransformed = $viewFactory.updateViewDescription(viewDescription);
            $instances.forEach(({ view }) => {
                const vue = typeof viewDescriptionTransformed === 'string' ? viewDescriptionTransformed : Helper.clone(viewDescriptionTransformed);
                view?.updateViewDescription(vue);
            });
        };

        /**
         * @param {string|Array|Object} view
         * @param {Function} controller
         */
        this.updateControllerAndView = function(view, controller) {
            this.updateController(controller);
            this.updateView(view);
        };

    };

    /**
     * @param {HTMLElement} htmlNodeElement
     * @param {Habame} HabameCore
     *
     * @class
     */
    const App = function(htmlNodeElement, HabameCore) {

        const $event = new HbEvent();
        const $state = new State();

        /**
         * @param {ComponentFactory} componentFactory
         * @param {ComponentProps} props
         *
         * @returns {Component}
         */
        const createComponentInstance = (componentFactory, props) => {
            return componentFactory.create(props, this, HabameCore);
        };

        /**
         * @param {string} name
         * @param {Array} params
         *
         * @returns {*}
         */
        this.createDirectiveInstance = function(name, params) {
            const directiveFactory = HabameCore.getDirectiveFactory(name);
            return directiveFactory.create(params);
        };

        /**
         * @param {ComponentFactory|string} source
         * @param {?ComponentProps} props
         *
         * @returns {Component}
         */
        this.createComponentByName = function(source, props) {
            const componentFactory = (source instanceof ComponentFactory) ? source : window.Habame.getComponentFactory(source);
            props = props || new ComponentProps();
            return createComponentInstance(componentFactory, props);
        };

        this.getEvent = function() {
            return $event;
        };

        this.getState = function() {
            return $state;
        };

        /**
         * @param {string} name
         * @returns {?App}
         */
        this.getApp = function(name) {
            return HabameCore.getApp(name);
        };

        /**
         * @param {ComponentFactory|string} componentFactory
         *
         * @returns {Component}
         */
        this.render = function(componentFactory) {
            const instance = (typeof componentFactory === 'string')
                ? this.createComponentByName(componentFactory, null)
                :createComponentInstance(componentFactory, null);
            instance.render(htmlNodeElement);
            return instance;
        };
    };

    /**
     *
     * @param {string} $name
     * @param {Function} $factoryClass
     *
     * @class
     */
    const DirectiveFactory = function($name, $factoryClass) {

        this.create = function(params) {
            return new $factoryClass(...params);
        };

    };

    /**
     *
     * @param {Function} $service
     * @param {{ isUniqueInstance?: boolean, params?: *[] }} $options
     *
     * @class
     */
    const ServiceWrapper = function($service, $options) {
        let $uniqueInstance = null;

        const getNewInstance = function() {
            const serviceState = new State();
            const otherArgs = Array.isArray($options.params) ? $options.params : [];
            const instance = new $service(serviceState, ...otherArgs);
            instance.$serviceState = serviceState;
            return instance;
        };

        this.create = function() {
            if($options.isUniqueInstance === false) {
                return getNewInstance();
            }
            if(!$uniqueInstance) {
                $uniqueInstance = getNewInstance();
            }
            return $uniqueInstance;
        };

        this.definition = function() {
            return $service;
        };
    };

    /**
     * @param {Habame} Habame
     */
    function DynamicComponent(Habame) {
        Habame.createComponent('DynamicComponent', function({ State, Props, App, Lifecycle }, $view) {

            const $componentCache = {};
            const $currentComponent = { component: null, name: null };

            State.disconnectProps();
            const build = function() {
                const componentName = Props.use;
                if(!componentName) {
                    throw new Error('Props *use* required');
                }
                if($currentComponent.name === componentName) {
                    return;
                }
                if($currentComponent.component) {
                    $currentComponent.component.unmount();
                }
                if(!$componentCache[componentName]) {
                    const component = App.createComponentByName(Props.use, Props);
                    const componentView = component.getView();

                    const fragment = document.createDocumentFragment();
                    component.render(fragment);

                    componentView.insertAfter(fragment, $view.getAnchor());
                    $componentCache[componentName] = { component, fragment };
                } else {
                    $componentCache[componentName].component.mount();
                }
                $currentComponent.component = $componentCache[componentName].component;
                $currentComponent.name = componentName;
            };

            Props.onUpdate('use', build);

            Lifecycle.onCreated(build);

        }, ``);
    }

    const DEFAULT_ROUTER_NAME = 'Router';

    const RouterLinkView =  {
        name: 'a',
        content: { name:'yield-fragment' },
        attrs: { href: '{{ href }}' },
        events: { 'prevent.click': 'push' }
    };

    /**
     * @param {Habame} Habame
     */
    function Link(Habame) {
        Habame.createComponent('Link', function({ State, Props, Actions }) {

            State.init({ href: '' });

            const routerName = Props.router || DEFAULT_ROUTER_NAME;
            const router = Habame.Router.getRouter(routerName);

            if(!router) {
                throw new Error('Undefined Router '+ (Props.router || DEFAULT_ROUTER_NAME));
            }

            if(Props.to && !router.routeExists(Props.to)) {
                throw new Error('Undefined route name '+ Props.to);
            }

            const getRoute = function() {
                if(Props.to) {
                    const route = router.getRouteByName(Props.to);
                    route.set(Props.params || {}, Props.query, Props.hash);
                    return route;
                }
                return router.getRouteByPath(Props.href);
            };

            const updateEndPoint = function() {
                const route = getRoute();
                State.href = route.getUrl();
            };

            Actions.push = function() {
                const route = getRoute();
                router.push(route);
            };


            (function() {
                updateEndPoint();
                if(Props.to) {
                    Props.onUpdate('to', () => updateEndPoint());
                    return;
                }
                if(Props.href) {
                    Props.onUpdate('href', () => updateEndPoint());
                }
            }());

        }, RouterLinkView);
    }

    const RouteHelper =  {

        cleanPath: function(path) {
            if(path === undefined || path === null) {
                return null;
            }
            return path.replace(/^[/]+/, '').replace(/[/]+$/, '').replace(/[/]+/g, '/').trim();
        }

    };

    const Route = function($router) {

        const $params =  {
            required: [],
            params: {},
            search: null,
            hash: null,
        };
        const $routerGroupsBuilder = $router.groups();
        const $route = {
            name: '',
            path: null,
            isUniqueInstance: true,
            component: null,
            redirectTo: null,
            middlewares: [],
            where: {}
        };

        const extractParams = function(path, regex) {
            const matches = path.match(regex);
            matches.shift();
            const params = {};
            $params.required.forEach((paramsDetails, index) => {
                params[paramsDetails.name] = matches[index];
            });
            $params.params = params;
        };

        const getParamDefinition = function(param) {
            return { name: param.trim() };
        };
        const getRegexp = function() {
            const regexPattern = $route.path.replace(/\{(.*?)}/g, function(fullValue, paramDefinition) {
                const paramsDetails = getParamDefinition(paramDefinition);
                $params.required.push(paramsDetails);
                if($route.where[paramsDetails.name]) {
                    return '(' +$route.where[paramsDetails.name].replace(/\(/g, '(?:') +')';
                }
                return "(.*?)";
            });

            return new RegExp("^"+regexPattern+"$");
        };

        this.params = function() {
            return { ...$params.params };
        };

        this.hash = function() {
            return $params.hash;
        };

        this.query = function() {
            return new URLSearchParams($params.search);
        };

        this.router = function() {
            return $router;
        };

        this.getPath = function() {
            return $route.path;
        };

        this.isUniqueInstance = function() {
            return $params.isUniqueInstance;
        };

        this.getState = function() {
            return {
                params: this.params(),
                query: this.query().toString(),
                hash: this.hash()
            };
        };

        this.path = function(path, component) {
            if(!path && path !== '') {
                throw new Error('Undefined path');
            }
            $route.path = $routerGroupsBuilder.getPath(RouteHelper.cleanPath(path));
            if(!component) {
                return this;
            }
            $route.component = component;
            return this;
        };

        this.name = function(name) {
            $route.name = $routerGroupsBuilder.getName(name);
            $router.setNamedRoute(name, this);
            return this;
        };

        this.dontUseUniqueInstance = function() {
            $route.isUniqueInstance = false;
            return this;
        };

        this.redirectTo = function(redirectTo) {
            $route.redirectTo = redirectTo;
            return this;
        };

        this.middlewares = function() {
            if(arguments.length === 0) {
                throw new Error('Route Middlewares : provide the middlewares names');
            }
            $route.middlewares = $routerGroupsBuilder.getMiddlewares(Array.from(arguments));
            return this;
        };

        this.where = function(where) {
            $route.where = where;
            return this;
        };
        this.isMatch = function(path) {
            if($route.path === null) {
                return false;
            }
            if (path === undefined || path === null) {
                return false;
            }
            const url = new URL(path, location.origin);
            const regex = getRegexp();
            const cleanedPath = RouteHelper.cleanPath(url.pathname);
            if(!regex.test(cleanedPath)) {
                return false;
            }
            $params.search = url.search || null;
            $params.hash = url.hash || null;

            extractParams(cleanedPath, regex);
            return true;
        };

        this.getName = function() {
            return $route.name;
        };

        this.getPath = function() {
            return $route.path;
        };

        this.getMiddlewares = function() {
            return $route.middlewares || [];
        };

        this.getComponent = function() {
            return $route.component;
        };

        this.set = function(params, query, hash) {
            $params.params = params;
            $params.search = query || null;
            $params.hash = hash || null;
        };

        this.getUrl = function(params, query, hash) {
            params = params || $params.params;
            query = query || $params.search;
            hash = hash || $params.hash;

            let url = $route.path.replace(/\{(.*?)}/g, function(fullValue, paramDefinition) {
                const param = getParamDefinition(paramDefinition);
                if(params[param.name] === undefined) {
                    throw new Error('Route param required: '+ param.name);
                }
                return encodeURIComponent(params[param.name]);
            });
            if(query) {
                if(typeof query === 'string') {
                    url += '?'+ query;
                }
                if(typeof query === 'object') {
                    url += '?'+ (new URLSearchParams(query)).toString();
                }
            }
            if(hash) {
                url += '#'+ hash;
            }
            return '/'+ url;
        };

    };

    /**
     * @class
     */
    const MiddlewareHandler = function() {

        let $route = null;
        let $middlewares = [];
        let $currentIndex  = -1;

        const next = function() {
            $currentIndex++;
            if(!$middlewares[$currentIndex]) {
                return;
            }

            const callback = $middlewares[$currentIndex];
            if(typeof callback !== 'function') {
                return;
            }
            callback($route, next);
        };

        this.handle = function(middlewares, route) {
            $route = route;
            $middlewares = middlewares;
            $currentIndex = -1;
            next();
        };

    };

    /**
     * @class
     */
    const BrowserHistory = function() {

        this.push = function(historyItem) {
            const route = historyItem.route;
            history.pushState({ ...route.getState(), uuid: historyItem.uuid }, '', route.getUrl());
        };

        this.back = function() {
            history.back();
        };

        this.forward = function() {
            history.forward();
        };

        this.getCurrentLocation = function() {
            const pathname = location.pathname.replace(/\+$/, '')
                .replace(/^\+/, '');
            return pathname + location.search;
        };

        this.useService = function(routerService) {
            window.addEventListener("popstate", (event) => {
                if(!event.state || !event.state.uuid) {
                    return;
                }
                routerService.moveTo(event.state.uuid);
            });
        };

    };

    const RouterView = {
        name: 'div',
        ref: 'routerRenderContainer',
        attrs: {
            id: '{{ id }}'
        }
    };

    /**
     * @param {Habame} Habame
     */
    function Router$1(Habame) {
        Habame.createComponent('Router', function({ Props, State, Refs, App, Lifecycle }) {
            State.init({
                id: Props.id || ''
            });

            const middlewareHandler = new MiddlewareHandler();
            const components = {};

            const routerService = Habame.Services[Props.name || DEFAULT_ROUTER_NAME];
            State.useService(routerService);
            let currentComponent = null;

            const mountRouteComponent = function(route) {
                if(!Refs.routerRenderContainer) {
                    return;
                }

                let key = route.getPath();

                if(!route.isUniqueInstance()) {
                    key = route.getUrl();
                }
                if(components[key]) {
                    currentComponent = components[key];
                    currentComponent.mount();
                    return components[key];
                }

                currentComponent = App.createComponentByName(route.getComponent(), null);
                components[key] = currentComponent;

                currentComponent.render(Refs.routerRenderContainer);
            };

            State.get('$route').onUpdate((route) => {
                if(currentComponent) {
                    currentComponent.unmount();
                }
                if(!(route instanceof Route)) {
                    return;
                }
                const middlewares = route.getMiddlewares();
                middlewares.push(mountRouteComponent);
                middlewareHandler.handle(middlewares, route);
            });

            Lifecycle.onCreated(() => {
                const historyHandler = routerService.historyHandler();
                if(historyHandler && typeof historyHandler.getCurrentLocation === 'function') {
                    routerService.push(historyHandler.getCurrentLocation());
                    if(historyHandler instanceof BrowserHistory) {
                        historyHandler.useService(routerService);
                    }
                }  else {
                    routerService.push('/');
                }
            });

        }, RouterView);
    }

    var stdCore = {
        DynamicComponent,
        Link,
        Router: Router$1
    };

    const RouteGroup = function($router) {

        const $routeGroupOptions = {
            prefix: null,
            name: null,
            middlewares: []
        };

        this.prefix = function(prefix) {
            $routeGroupOptions.prefix = prefix;
            return this;
        };

        this.name = function(name) {
            $routeGroupOptions.name = name;
            return this;
        };

        this.middlewares = function() {
            $routeGroupOptions.middlewares = Array.from(arguments);
            return this;
        };

        this.getName = function() {
            return $routeGroupOptions.name;
        };

        this.getPrefix = function() {
            return $routeGroupOptions.prefix;
        };

        this.getMiddlewares = function() {
            return $routeGroupOptions.middlewares;
        };

        this.group = function(callback) {
            $router.groups().addGroup(this);
            callback();
            $router.groups().removeGroup(this);
        };

    };

    const RouteGroupBuilder = function() {

        let $groups = [];

        this.addGroup = function(group) {
            $groups.push(group);
        };

        this.removeGroup = function(group) {
            $groups = $groups.filter((groupItem) => group !== groupItem);
        };

        this.getName = function(name) {
            const names = [];
            $groups.forEach((group) => {
                const name = group.getName();
                if(name) {
                    names.push(name);
                }
             });
            if(name) {
                names.push(name);
            }
            return names.join('');
        };

        this.getPath = function(path) {
            const prefixes = [];
            $groups.forEach((group) => {
                const prefix = group.getPrefix();
                if(prefix) {
                    prefixes.push(prefix);
                }
            });
            if(path) {
                prefixes.push(path);
            }
            return prefixes.join('/');
        };

        this.getMiddlewares = function(middlewares) {
            let allMiddlewares = [];
            $groups.forEach((group) => {
                const groupMiddlewares = group.getMiddlewares();
                if(groupMiddlewares) {
                    allMiddlewares = allMiddlewares.concat(groupMiddlewares);
                }
            });
            if(middlewares) {
                allMiddlewares = allMiddlewares.concat(middlewares);
            }
            return allMiddlewares;
        };

    };

    /**
     * @param {string} $name RouterService name
     * @param {Habame} Habame
     *
     * @class
     */
    const Router = function($name, Habame) {

        const $routerGroupBuilder = new RouteGroupBuilder();

        const $namedRoutes = {};
        const $routes = [];

        let $routeNotFound = null;
        let $routerInstanceService = null;

        this.setNamedRoute = function(name, route) {
            $namedRoutes[name] = route;
        };

        this.getRouterService = function() {
            if($routerInstanceService) {
                return $routerInstanceService;
            }
            $routerInstanceService = Habame.Services[$name];
            return $routerInstanceService;
        };

        this.path = function(path, component) {
            const route = new Route(this);
            route.path(path, component);
            $routes.push(route);
            return route;
        };

        this.notFound = function(path, component) {
            const route = new Route(this);
            route.path(path, component);
            $routeNotFound = route;
        };

        this.prefix = function(prefix) {
            return (new RouteGroup(this)).prefix(prefix);
        };

        this.name = function(name) {
            return (new RouteGroup(this)).name(name);
        };

        this.middlewares = function() {
            return (new RouteGroup(this)).middlewares(...arguments);
        };

        this.groups = function() {
            return $routerGroupBuilder;
        };

        this.routeExists = function(routeName) {
            return $namedRoutes[routeName] !== undefined;
        };

        this.getRouteByName = function(name) {
            if(!$namedRoutes[name]) {
                throw new Error("Undefined route "+ name);
            }
            return $namedRoutes[name];
        };

        this.getRouteByPath = function(path) {
            const pathCleaned = RouteHelper.cleanPath(path);
            for(const route of $routes) {
                if(route.isMatch(pathCleaned)) {
                    return route;
                }
            }
            if(!$routeNotFound) {
                throw new Error("Route not found: "+ path);
            }
            return $routeNotFound;
        };

        this.get = function(route) {
            if(route instanceof Route) {
                return route;
            }
            if(typeof route === 'object') {
                const routeFound = this.getRouteByName(route.name);
                if(routeFound) {
                    routeFound.set(route.params, route.query, route.hash);
                    return routeFound;
                }
            }
            if(typeof route === 'string') {
                const routeFound = this.getRouteByPath(route);
                if(routeFound) {
                    return routeFound;
                }
            }

            return $routeNotFound;
        };

        this.push = function(route) {
            if(!route) {
                throw new Error("Router.push params require a valid param");
            }
            const routeFound = this.get(route);
            if(routeFound) {
                const service = this.getRouterService();
                service.pushRoute(routeFound);
                return;
            }

            throw new Error('Route not found');
        };
    };

    /**
     * @param {State} State
     * @param {Router} $router
     * @param {object} $historyHandler
     *
     *
     * @class
     */
    const RouterService = function(State, $router, $historyHandler) {

        const $histories = [];
        const $listeners = [];
        let $currentIndex = -1;
        let $currentUrl = null;

        State.init({ $route: null });

        const getHistory = function(index) {
            const historyItem = $histories[index];
            const state = historyItem.state;
            historyItem.route.set(state.params, state.query, state.hash);
            return historyItem;
        };

        const triggerListeners = function (route) {
            $listeners.forEach((listener) => {
                listener(route);
            });
        };

        this.onChange = function(callback) {
            if(typeof callback === 'function') {
                throw new Error('onChange require a function, '+ (typeof callback) +' given');
            }
            $listeners.push(callback);
        };

        this.historyHandler = function() {
            return $historyHandler;
        };

        this.pushRoute = function(route) {
            if(!(route instanceof Route)) {
                return;
            }
            const uuid = (new Date()).getTime();
            const historyItem = { route, state: route.getState(), url: route.getUrl(), uuid };
            $histories.splice($currentIndex + 1);

            $histories.push(historyItem);
            $currentIndex++;

            $historyHandler ? $historyHandler.push(historyItem) : null;
            const isSameRouteButDifferentUrl = State.$route === route && $currentUrl !== historyItem.url;
            State.$route = route;
            $currentUrl = historyItem.url;
            if(isSameRouteButDifferentUrl) {
                State.get('$route').trigger();
            }
            triggerListeners(route);
        };

        this.push = function(route) {
            this.pushRoute($router.get(route));
        };

        this.moveTo = function(uuid) {
            let historyItem = null;
            if($histories[$currentIndex - 1]?.uuid === uuid) {
                $currentIndex--;
                historyItem = $histories[$currentIndex];
            }
            else if($histories[$currentIndex + 1]?.uuid === uuid) {
                $currentIndex++;
                historyItem = $histories[$currentIndex];
            }

            if(historyItem) {
                State.$route = historyItem.route;
            }
        };

        this.back = function() {
            if($currentIndex-1 < 0) {
                return;
            }
            $currentIndex--;
            const historyItem = getHistory($currentIndex);
            $historyHandler ? $historyHandler.back(historyItem.route) : null;
            State.$route = historyItem.route;
        };

        this.forward = function() {
            if(!$histories[$currentIndex + 1]) {
                return;
            }
            $currentIndex++;
            const historyItem = getHistory($currentIndex);
            $historyHandler ? $historyHandler.forward(historyItem.route) : null;
            State.$route = historyItem.route;
        };

    };

    const HabameRouter = function(Habame) {

        /** @type {Object.<string, Router>} */
        const $routers = {};

        return {

            /**
             * @param {string} name
             * @param {{ history?: Object, browserHistory?: boolean }} options
             *
             * @returns {Router}
             */
            createRouter: function(name, options) {
                name = name || DEFAULT_ROUTER_NAME;
                if($routers[name] instanceof Router) {
                    throw new Error('router : '+ name +' already exists');
                }

                const router = new Router(name, Habame);
                let history = null;

                if(options && options.browserHistory === true) {
                    history = new BrowserHistory();
                }
                else if(options && options.history) {
                    history = options.history;
                }

                Habame.createService(DEFAULT_ROUTER_NAME, RouterService, { params: [router, history] });
                $routers[name] = router;
                return router;
            },
            /**
             * @returns {Router}
             */
            createBrowserRouter: function() {
                return Habame.Router.createRouter(null, { browserHistory: true });
            },
            /**
             * @param {string} name
             *
             * @returns {Router}
             */
            getRouter: function(name) {
                name = name || DEFAULT_ROUTER_NAME;
                if(!($routers[name] instanceof Router)) {
                    throw new Error('Undefined router '+ name);
                }
                return $routers[name];
            }

        };
    };

    /**
     * @member {{
     * Services: {},
     * getDirectiveFactory: (function(string): DirectiveFactory),
     * createService: (function(string, (function(State): void), {isUniqueInstance: boolean}?): void),
     * getApp: (function(string): *),
     * setDefaultViewEngine: (function(string, (function(string|object): string|object)?): void),
     * createRoot: (function((HTMLElement|string), ?string=): App),
     * getViewEngine: (function(string): *),
     * createDirective: (function(string, (function(HTMLElement, Template, Object<string, Template>): void)): DirectiveFactory),
     * createComponent: (function(string, (function({App: App, Actions: object, HbEvent: HbEvent, State: State, Props: ComponentProps, Lifecycle: object, Refs: object}): ?object), string|object, { engines?: string|string[], disableXmlEngine?: boolean }?): ComponentFactory),
     * getServices: (function(): Record<string, ServiceWrapper>),
     * getComponentFactory: (function(string): ComponentFactory),
     * addViewEngine: (function(string, function(string|object): string|object): void)
     * }}
     *
     *  }
     */
    const Habame = (function(){

        /** @type {Object.<string, ComponentFactory>} */
        const $componentFactories = {};

        /** @type {Object.<string, DirectiveFactory>} */
        const $directiveFactories = {};

        /** @type {Object.<string, ServiceWrapper>} */
        const $serviceWrappers = {};

        const $apps = {};

        let $viewEngines = {};
        let $defaultViewEngine = null;

        const HabameCore = {
            Services: {},
            /**
             * @param {HTMLElement|string} htmlNodeElement
             * @param {?string} name
             *
             * @returns {App}
             */
            createRoot: function(htmlNodeElement, name = null) {
                if(typeof htmlNodeElement === 'string') {
                    htmlNodeElement = document.getElementById(htmlNodeElement);
                }
                const app = new App(htmlNodeElement, HabameCore);
                if(name) {
                    $apps[name] = app;
                }

                return app;
            },
            /**
             * @param {string} name
             * @param {Function} viewEngine
             */
            setDefaultViewEngine: function(name, viewEngine) {
                if(viewEngine) {
                    this.addViewEngine(name, viewEngine);
                }
                $defaultViewEngine = name;
            },
            /**
             * @param {string} name
             * @param {Function} viewEngine
             */
            addViewEngine: function(name, viewEngine) {
                if($viewEngines[name] !== undefined ) {
                    return;
                }

                if(typeof viewEngine !== 'function') {
                    throw new Error('View Engine ' + name + ' must be a function');
                }

                $viewEngines[name] = viewEngine;
            },
            /**
             * @param {string} name
             *
             * @returns {?Function}
             */
            getViewEngine: function(name) {
                return $viewEngines[name];
            },
            /**
             * @param {string} name
             * @param {Function} controller
             * @param {string|Array|Object} view
             * @param {?{ engines?: string|string[], disableXmlEngine?: boolean }} options
             *
             * @returns {ComponentFactory}
             */
            createComponent: function(name, controller, view, options = {}) {
                options.engines = options.engines || $defaultViewEngine;
                const $componentFactory = new ComponentFactory(name, controller, view, options);
                $componentFactories[name] = $componentFactory;
                return $componentFactory;
            },
            /**
             * @param {string} name
             * @param {Function} service
             * @param {?{ isUniqueInstance?: boolean, params?: *[] }} options
             */
            createService: function(name, service, options ){
                const serviceWrapper = new ServiceWrapper(service, options || {});
                $serviceWrappers[name] = serviceWrapper;
                Object.defineProperty(Habame.Services, name, {
                    get() {
                        return serviceWrapper.create();
                    }
                });
            },
            getServices: function() {
                return $serviceWrappers;
            },
            /**
             * @param {string} name
             *
             * @returns {ComponentFactory}
             */
            getComponentFactory: function(name) {
                const factory = $componentFactories[name];
                if(!factory) {
                    throw new Error('Component ' + name + ' not found');
                }
                return factory;
            },
            /**
             * @param {string} name
             * @returns {boolean}
             */
            isComponentFactoryExists: function(name) {
                return !!$componentFactories[name];
            },
            /**
             * @param {string} name
             * @param {Function} directive
             *
             * @returns {DirectiveFactory}
             */
            createDirective: function(name, directive) {
                const $directiveFactory = new DirectiveFactory(name, directive);
                $directiveFactories[name] = $directiveFactory;
                return $directiveFactory;
            },
            /**
             * @param {string} name
             *
             * @returns {DirectiveFactory}
             */
            getDirectiveFactory: function(name) {
                const factory = $directiveFactories[name];
                if(!factory) {
                    throw new Error('Directive ' + name + ' not found');
                }
                return factory;
            },
            /**
             * @param {string} name
             * @returns {?App}
             */
            getApp: function(name) {
                return $apps[name];
            }
        };

        HabameCore.Router = HabameRouter(HabameCore);

        const stdCoreItems = Object.values(stdCore);
        for(const stdCoreItem of stdCoreItems) {
            (typeof stdCoreItem === 'function') && stdCoreItem(HabameCore);
        }

        return HabameCore;
    }());

    return Habame;

}));
