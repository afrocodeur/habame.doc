
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

export default Lifecycle;