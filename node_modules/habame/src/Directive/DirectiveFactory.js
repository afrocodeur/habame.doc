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

export default DirectiveFactory;