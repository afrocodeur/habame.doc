
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

export default LifecycleHandler;