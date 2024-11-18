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

export default ViewRefCollection;