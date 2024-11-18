import {IS_PROXY_PROPERTY, PROXY_STATE_ITEM, PROXY_TARGET_LABEL} from "../constantes";

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

export default stateItemMutatorOverride;