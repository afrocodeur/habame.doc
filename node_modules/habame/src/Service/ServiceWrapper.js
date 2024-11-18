import State from "../State/State";

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

export default ServiceWrapper;